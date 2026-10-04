"""
Vectorized Monte Carlo Race Strategy Stochastic Solver
======================================================
Executes high-throughput Monte Carlo simulations (N=1,000 - 10,000 iterations)
integrating Huber tire wear models, fuel burn mass loss, aerodynamic dirty air
wake penalties, and stochastic Safety Car deployments.
"""

import sys
from pathlib import Path
root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import pandas as pd

from src.strategy_sim import generate_candidate_strategies, format_hms, CandidateStrategy
from pipeline.aero_performance_model import AeroVehiclePerformanceModel


def run_stochastic_race_solver(
    track_meta: Dict[str, Any],
    deg_models: Dict[str, Any],
    sim_count: int = 1000,
    sc_prob_override: Optional[float] = None,
    pit_loss_override: Optional[float] = None,
    wear_multiplier: float = 1.0,
    dirty_air_mode: bool = False,
    random_seed: int = 42
) -> Dict[str, Any]:
    """
    Executes vectorized Monte Carlo race simulation across all candidate strategies.
    
    Args:
        track_meta: Metadata dict with total laps, pit loss deltas, fuel burn rates.
        deg_models: Fitted Huber degradation parameters for SOFT, MEDIUM, HARD.
        sim_count: Number of stochastic race trajectories (default: 1,000).
        sc_prob_override: Safety Car probability per race (default from track meta).
        pit_loss_override: Green flag pit loss transit penalty (default from track meta).
        wear_multiplier: Thermal degradation scaling factor (track temp sensitivity).
        dirty_air_mode: If True, simulates follower in dirty air wake (+15% tire deg).
        random_seed: Reproducibility seed.
    """
    np.random.seed(random_seed)

    total_laps = track_meta.get("laps", 78)
    green_pit_loss = pit_loss_override or track_meta.get("green_pit_loss", 20.25)
    sc_pit_loss = track_meta.get("sc_pit_loss", 11.75)
    sc_bonus = green_pit_loss - sc_pit_loss
    fuel_burn_rate = track_meta.get("fuel_burn_rate", 0.035)
    sc_rate = sc_prob_override if sc_prob_override is not None else track_meta.get("historical_sc_rate", 0.50)

    # Per-lap SC deployment probability
    prob_sc_per_lap = 1.0 - (1.0 - sc_rate) ** (1.0 / max(1, total_laps))

    # Aero wake penalty
    aero_wear_mult = 1.18 if dirty_air_mode else 1.0
    effective_wear_mult = wear_multiplier * aero_wear_mult

    # 1. Pre-generate stochastic race environment matrices across all N iterations
    # Pace noise: N(0, 0.22^2) per lap
    pace_noise_matrix = np.random.normal(0.0, 0.22, size=(sim_count, total_laps))

    # Safety car events: Bernoulli trials per lap
    sc_events_matrix = np.random.binomial(1, prob_sc_per_lap, size=(sim_count, total_laps)).astype(bool)

    # Pit stop stationary execution duration: N(2.45s, 0.30^2)
    # Plus transit speed limiter loss
    pit_stationary_noise = np.random.normal(2.45, 0.30, size=(sim_count, 10))

    candidate_strategies = generate_candidate_strategies(total_laps=total_laps)
    evaluated_strategies = []

    for strat in candidate_strategies:
        pit_laps = set(strat.pit_laps)

        # Build nominal lap-by-lap pace vector
        nominal_laps = np.zeros(total_laps)
        compounds_per_lap = []

        current_lap = 0
        for comp, stint_len in strat.stints:
            comp_model = deg_models.get(comp, {})
            slope = comp_model.get("slope", 0.035) * effective_wear_mult
            intercept = comp_model.get("intercept", 80.0)
            cliff_lap = comp_model.get("deg_cliff_lap", 35)

            for stint_lap in range(1, stint_len + 1):
                lap_idx = current_lap + stint_lap - 1
                if lap_idx >= total_laps:
                    break

                # Base pace + linear degradation - fuel mass burnoff
                lap_time = intercept + (slope * stint_lap) - (lap_idx * fuel_burn_rate)

                # Non-linear degradation cliff: exponential decay past critical life
                if stint_lap > cliff_lap:
                    cliff_excess = stint_lap - cliff_lap
                    lap_time += 0.12 * (cliff_excess ** 1.35)

                nominal_laps[lap_idx] = lap_time
                compounds_per_lap.append(comp)

            current_lap += stint_len

        # Broadcast nominal laps across all N Monte Carlo trajectories: (sim_count, total_laps)
        race_trajectories = np.tile(nominal_laps, (sim_count, 1)) + pace_noise_matrix

        # Inject pit stop penalties
        total_pit_times = np.zeros(sim_count)
        sc_benefited_count = 0

        for p_idx, pit_lap in enumerate(strat.pit_laps):
            pit_lap_idx = pit_lap - 1

            # Check if Safety Car was active during this pit window
            # SC window encompasses pit_lap - 1, pit_lap, pit_lap + 1
            window_start = max(0, pit_lap_idx - 1)
            window_end = min(total_laps, pit_lap_idx + 2)
            sc_active_in_window = np.any(sc_events_matrix[:, window_start:window_end], axis=1)

            # Apply pit loss: green pit loss vs reduced SC pit loss
            transit_loss = np.where(sc_active_in_window, sc_pit_loss, green_pit_loss)
            stationary_loss = np.maximum(2.0, pit_stationary_noise[:, p_idx])

            total_pit_times += (transit_loss + (stationary_loss - 2.45))
            sc_benefited_count += np.sum(sc_active_in_window)

        # Total simulated race durations (seconds)
        total_race_times = np.sum(race_trajectories, axis=1) + total_pit_times

        # Distribution statistics
        mean_time = float(np.mean(total_race_times))
        std_dev = float(np.std(total_race_times))
        q25 = float(np.percentile(total_race_times, 25))
        q50 = float(np.median(total_race_times))
        q75 = float(np.percentile(total_race_times, 75))
        iqr = float(q75 - q25)
        p_sc_benefit = float(sc_benefited_count / (sim_count * max(1, len(strat.pit_laps))))

        evaluated_strategies.append({
            "name": strat.name,
            "stops": strat.stops,
            "stints": [{"compound": c, "length": l} for c, l in strat.stints],
            "pit_laps": strat.pit_laps,
            "mean_total_time": mean_time,
            "formatted_mean": format_hms(mean_time),
            "median_time": q50,
            "std_dev": round(std_dev, 2),
            "iqr": round(iqr, 2),
            "q25": q25,
            "q75": q75,
            "sc_benefit_prob": round(p_sc_benefit, 3),
            "raw_distribution_sample": [round(float(x), 2) for x in total_race_times[:50]]
        })

    # Rank by fastest mean expected total race time
    evaluated_strategies.sort(key=lambda s: s["mean_total_time"])
    best_time = evaluated_strategies[0]["mean_total_time"]

    for rank_idx, s in enumerate(evaluated_strategies, start=1):
        s["rank"] = rank_idx
        s["delta_to_best"] = round(s["mean_total_time"] - best_time, 2)

    # Identify safest strategy (lowest variance / tightest IQR)
    safest = sorted(evaluated_strategies, key=lambda s: s["iqr"])[0]

    return {
        "track_id": track_meta.get("id", "monaco"),
        "sim_count": sim_count,
        "sc_rate_applied": sc_rate,
        "green_pit_loss_applied": green_pit_loss,
        "strategies": evaluated_strategies,
        "optimal_strategy": evaluated_strategies[0],
        "safest_strategy": safest,
        "pareto_divergence": evaluated_strategies[0]["rank"] != safest["rank"]
    }


if __name__ == "__main__":
    print("\n🎲 TESTING MONTE CARLO STOCHASTIC STRATEGY SOLVER...")
    meta = {
        "id": "monaco",
        "laps": 78,
        "green_pit_loss": 20.25,
        "sc_pit_loss": 11.75,
        "fuel_burn_rate": 0.035,
        "historical_sc_rate": 0.50
    }
    models = {
        "SOFT": {"slope": 0.085, "intercept": 76.5, "deg_cliff_lap": 22},
        "MEDIUM": {"slope": 0.032, "intercept": 77.2, "deg_cliff_lap": 38},
        "HARD": {"slope": 0.019, "intercept": 77.9, "deg_cliff_lap": 58}
    }
    result = run_stochastic_race_solver(meta, models, sim_count=1000)
    print(f"Solver completed N={result['sim_count']} iterations across {len(result['strategies'])} candidate strategies.")
    print("\nTop 3 Solver Ranked Strategies:")
    for s in result["strategies"][:3]:
        print(f"  P{s['rank']}: {s['name']} | E[T]: {s['formatted_mean']} | Delta: +{s['delta_to_best']}s | IQR: ±{(s['iqr']/2):.1f}s | SC Bonus P: {int(s['sc_benefit_prob']*100)}%")
    print(f"\nPareto Consensus: {'Divergent (P1 Optimal != Lowest Variance)' if result['pareto_divergence'] else 'Dominant P1'}")
    print("✅ Monte Carlo Engine Operational!\n")
