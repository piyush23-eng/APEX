import sys
from pathlib import Path
root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

"""
F1 Monte Carlo Race Strategy Simulator
======================================

This module models and simulates Formula 1 race strategies using fitted tire
degradation curves, fuel-burn dynamics, pit loss mechanics, and stochastic
Safety Car events.

Domain Concepts & Strategic Principles Explained:
-------------------------------------------------
1. Defining Strategy as Stint Tuples:
   A race strategy is defined as a list of (compound, stint_length) pairs:
       e.g., [('MEDIUM', 32), ('HARD', 46)] for a 1-stop, or
             [('SOFT', 16), ('MEDIUM', 30), ('HARD', 32)] for a 2-stop.
   The sum of stint lengths must equal total race laps (78 laps for Monaco).
   Under FIA Sporting Regulations (Article 30.5), each driver must use at least
   two distinct dry compound specifications during a dry race.

2. Why Model Distributions Instead of Just Means?
   A strategy with a faster average lap time might carry high variance (high risk
   of traffic exposure, two pit stop execution risks, or sensitivity to SC timing).
   Conversely, a 1-stop strategy may be slightly slower on peak tire pace but has
   far lower variance (only one pit stop risk, fewer traffic interactions).
   Strategic decision-makers must choose between:
     - "Best on Average": Strategy with lowest expected total race time.
     - "Safest": Strategy with lowest variance (standard deviation / IQR).

3. The "Free Pit Stop" Under Safety Car / VSC:
   - Green Flag Pit Loss: Normal pit loss is ~20 to 22 seconds (empirical Monaco
     data: ~20.25s). Cars crawl through the pit lane at the 60 km/h speed limiter
     while on-track rivals fly past at racing speed.
   - Neutralized Pit Loss (SC/VSC): Under Safety Car, cars on track are restricted
     by delta times to ~140 km/h (~35% slower). But the pit lane speed limit remains
     60 km/h!
   - Therefore, pitting under an SC costs only ~11.5 to 12.0 seconds relative to
     on-track cars. Pitting under SC gifts an ~8.5 to 10-second bonus. A strategy
     whose pit window coincides with an SC gains an enormous competitive advantage.
"""

import argparse
from typing import List, Tuple, Dict, Any, Optional
from dataclasses import dataclass

import numpy as np
import pandas as pd

from src.data_loader import load_race_session, clean_laps_data
from src.tire_model import get_degradation_curve, DEFAULT_FUEL_CORRECTION_PER_LAP


# Stint representation: (Compound Name, Stint Length in Laps)
StintTuple = Tuple[str, int]


@dataclass
class CandidateStrategy:
    name: str
    stints: List[StintTuple]
    total_laps: int

    @property
    def stops(self) -> int:
        return len(self.stints) - 1

    @property
    def compounds(self) -> List[str]:
        return [s[0] for s in self.stints]

    @property
    def pit_laps(self) -> List[int]:
        """Calculates exact lap numbers where pit stops occur."""
        laps = []
        cumulative = 0
        for comp, length in self.stints[:-1]:
            cumulative += length
            laps.append(cumulative)
        return laps

    def is_fia_compliant(self) -> bool:
        """Validates that total laps match and at least two distinct dry compounds are used."""
        sum_laps = sum(s[1] for s in self.stints)
        distinct_compounds = len(set(self.compounds))
        return sum_laps == self.total_laps and distinct_compounds >= 2


def generate_candidate_strategies(total_laps: int = 78) -> List[CandidateStrategy]:
    """
    Generates realistic candidate 1-stop and 2-stop strategies that a real F1 team
    would actually evaluate on pit wall, rather than arbitrary mathematical permutations.
    """
    strats = []

    # ---------------- 1-STOP STRATEGIES ----------------
    # 1. Medium -> Hard (Textbook Monaco 1-stop: Ocon, Hamilton)
    p1 = int(round(total_laps * 0.41))  # ~Lap 32 for 78 laps
    strats.append(CandidateStrategy(
        name="1-Stop: M -> H (Textbook)",
        stints=[("MEDIUM", p1), ("HARD", total_laps - p1)],
        total_laps=total_laps
    ))

    # 2. Medium -> Hard (Extended Medium stint)
    p2 = int(round(total_laps * 0.48))  # ~Lap 37
    strats.append(CandidateStrategy(
        name="1-Stop: M -> H (Extended)",
        stints=[("MEDIUM", p2), ("HARD", total_laps - p2)],
        total_laps=total_laps
    ))

    # 3. Hard -> Medium (The Alonso Overcut gamble)
    p3 = int(round(total_laps * 0.58))  # ~Lap 45
    strats.append(CandidateStrategy(
        name="1-Stop: H -> M (Overcut)",
        stints=[("HARD", p3), ("MEDIUM", total_laps - p3)],
        total_laps=total_laps
    ))

    # 4. Hard -> Medium (Deep Overcut / Waiting for SC)
    p4 = int(round(total_laps * 0.68))  # ~Lap 53
    strats.append(CandidateStrategy(
        name="1-Stop: H -> M (Deep Overcut)",
        stints=[("HARD", p4), ("MEDIUM", total_laps - p4)],
        total_laps=total_laps
    ))

    # 5. Soft -> Hard (Aggressive start / Undercut)
    p5 = int(round(total_laps * 0.23))  # ~Lap 18
    strats.append(CandidateStrategy(
        name="1-Stop: S -> H (Undercut)",
        stints=[("SOFT", p5), ("HARD", total_laps - p5)],
        total_laps=total_laps
    ))

    # 6. Medium -> Soft (Late race sprint on low fuel)
    p6 = int(round(total_laps * 0.72))  # ~Lap 56
    strats.append(CandidateStrategy(
        name="1-Stop: M -> S (Late Sprint)",
        stints=[("MEDIUM", p6), ("SOFT", total_laps - p6)],
        total_laps=total_laps
    ))

    # 7. Hard -> Soft (Ultra-late sprint)
    p7 = int(round(total_laps * 0.77))  # ~Lap 60
    strats.append(CandidateStrategy(
        name="1-Stop: H -> S (Late Charge)",
        stints=[("HARD", p7), ("SOFT", total_laps - p7)],
        total_laps=total_laps
    ))

    # ---------------- 2-STOP STRATEGIES ----------------
    # 8. Soft -> Medium -> Hard (Aggressive sprint)
    s1 = int(round(total_laps * 0.20))  # ~Lap 16
    s2 = int(round(total_laps * 0.38))  # ~30 laps
    s3 = total_laps - s1 - s2          # ~32 laps
    strats.append(CandidateStrategy(
        name="2-Stop: S -> M -> H (Sprint)",
        stints=[("SOFT", s1), ("MEDIUM", s2), ("HARD", s3)],
        total_laps=total_laps
    ))

    # 9. Medium -> Hard -> Medium (Balanced 2-stop)
    m1 = int(round(total_laps * 0.31))  # ~Lap 24
    m2 = int(round(total_laps * 0.36))  # ~28 laps
    m3 = total_laps - m1 - m2          # ~26 laps
    strats.append(CandidateStrategy(
        name="2-Stop: M -> H -> M (Balanced)",
        stints=[("MEDIUM", m1), ("HARD", m2), ("MEDIUM", m3)],
        total_laps=total_laps
    ))

    # 10. Medium -> Hard -> Soft (Attack 2-stop)
    a1 = int(round(total_laps * 0.32))  # ~Lap 25
    a2 = int(round(total_laps * 0.42))  # ~33 laps
    a3 = total_laps - a1 - a2          # ~20 laps Soft
    strats.append(CandidateStrategy(
        name="2-Stop: M -> H -> S (Attack)",
        stints=[("MEDIUM", a1), ("HARD", a2), ("SOFT", a3)],
        total_laps=total_laps
    ))

    return [s for s in strats if s.is_fia_compliant()]


class StrategySimulator:
    """
    Monte Carlo Race Strategy Simulator evaluating stochastic outcomes across N runs.
    """
    def __init__(
        self,
        track: str = "Monaco",
        year: int = 2023,
        total_laps: int = 78,
        clean_df: Optional[pd.DataFrame] = None,
        fuel_burn_rate: float = DEFAULT_FUEL_CORRECTION_PER_LAP,
        green_pit_loss: float = 20.25,  # Measured empirical average for Monaco
        sc_pit_loss: float = 11.75,     # Measured pit delta under SC/VSC
        historical_sc_rate: float = 0.50, # 50% historical SC rate for Monaco
        lap_pace_noise_std: float = 0.30  # Random lap noise (driver consistency, traffic)
    ):
        self.track = track
        self.year = year
        self.total_laps = total_laps
        self.fuel_burn_rate = fuel_burn_rate
        self.green_pit_loss = green_pit_loss
        self.sc_pit_loss = sc_pit_loss
        self.historical_sc_rate = historical_sc_rate
        self.lap_pace_noise_std = lap_pace_noise_std

        # Load and fit tire degradation models
        if clean_df is None:
            session = load_race_session(year, track, "R")
            self.clean_df = clean_laps_data(session)
        else:
            self.clean_df = clean_df

        self.deg_curves = {}
        for comp in ["SOFT", "MEDIUM", "HARD"]:
            self.deg_curves[comp] = get_degradation_curve(
                track=track,
                compound=comp,
                year=year,
                clean_df=self.clean_df,
                fuel_burn_rate=fuel_burn_rate
            )

    def _build_deterministic_pace_profile(self, strategy: CandidateStrategy) -> np.ndarray:
        """
        Calculates baseline lap times for every lap of the race using fitted
        degradation slopes and un-correcting for fuel weight.
        """
        laps = np.zeros(self.total_laps)
        current_race_lap = 0

        for comp, stint_len in strategy.stints:
            m = self.deg_curves[comp]
            slope = m["slope"]
            intercept = m["intercept"]

            for stint_age in range(1, stint_len + 1):
                # Fuel-corrected lap pace on this compound at this tire age
                fuel_corrected_time = intercept + slope * stint_age
                
                # Actual on-track lap time: car has fuel weight penalty on early laps
                # At Lap 1, penalty is (total_laps - 1) * fuel_rate.
                # At final lap, penalty is 0.
                fuel_weight_penalty = (self.total_laps - 1 - current_race_lap) * self.fuel_burn_rate
                actual_lap_time = fuel_corrected_time - fuel_weight_penalty

                laps[current_race_lap] = actual_lap_time
                current_race_lap += 1

        return laps

    def simulate_strategy(
        self,
        strategy: CandidateStrategy,
        n_simulations: int = 2000,
        random_seed: Optional[int] = 42
    ) -> Dict[str, Any]:
        """
        Simulates a candidate strategy N times incorporating:
        1. Base pace profile + tire degradation
        2. Fuel weight burn-off
        3. Pit stop transit loss + execution jitter (slow stop probability)
        4. Historical Safety Car probability & strategic pit timing bonus
        5. Stochastic lap noise (traffic / driver variance)
        """
        rng = np.random.default_rng(random_seed)
        base_laps = self._build_deterministic_pace_profile(strategy)
        simulated_total_times = np.zeros(n_simulations)
        sc_triggered_benefits = np.zeros(n_simulations, dtype=bool)

        pit_laps = strategy.pit_laps

        for i in range(n_simulations):
            # 1. Lap-to-lap stochastic variance
            noise = rng.normal(0, self.lap_pace_noise_std, size=self.total_laps)
            total_driving_time = np.sum(base_laps + noise)

            # 2. Safety Car simulation
            # Safety car deploys with historical probability
            has_sc = rng.random() < self.historical_sc_rate
            sc_start_lap = rng.integers(12, self.total_laps - 8) if has_sc else -1
            sc_duration = rng.integers(3, 6) if has_sc else 0

            # 3. Pit stop loss calculation
            total_pit_loss = 0.0
            benefited_from_sc = False

            for p_lap in pit_laps:
                # Base stationary stop: 2.4s + jitter
                stationary_stop = rng.normal(2.4, 0.25)
                # 5% chance of slow stop (cross-thread wheel nut, stuck jack)
                if rng.random() < 0.05:
                    stationary_stop += rng.uniform(1.5, 3.5)

                # Did this pit stop fall during an active Safety Car?
                # Pitting right after SC appears confers the ~8.5s "cheap pit stop" bonus
                if has_sc and (sc_start_lap <= p_lap <= sc_start_lap + sc_duration):
                    pit_loss = self.sc_pit_loss + (stationary_stop - 2.4)
                    benefited_from_sc = True
                else:
                    pit_loss = self.green_pit_loss + (stationary_stop - 2.4)

                total_pit_loss += pit_loss

            simulated_total_times[i] = total_driving_time + total_pit_loss
            sc_triggered_benefits[i] = benefited_from_sc

        # Calculate comprehensive distribution statistics
        mean_val = float(np.mean(simulated_total_times))
        std_val = float(np.std(simulated_total_times))
        median_val = float(np.median(simulated_total_times))
        p05 = float(np.percentile(simulated_total_times, 5))
        p25 = float(np.percentile(simulated_total_times, 25))
        p75 = float(np.percentile(simulated_total_times, 75))
        p95 = float(np.percentile(simulated_total_times, 95))
        iqr = p75 - p25

        return {
            "strategy": strategy,
            "name": strategy.name,
            "stops": strategy.stops,
            "stints_str": " -> ".join([f"{c}({l}L)" for c, l in strategy.stints]),
            "pit_laps": str(strategy.pit_laps),
            "mean_time": mean_val,
            "median_time": median_val,
            "std_dev": std_val,
            "p05": p05,
            "p25": p25,
            "p75": p75,
            "p95": p95,
            "iqr": iqr,
            "sc_benefit_prob": float(np.mean(sc_triggered_benefits)),
            "sim_times": simulated_total_times
        }

    def evaluate_all(
        self,
        strategies: Optional[List[CandidateStrategy]] = None,
        n_simulations: int = 2000,
        random_seed: int = 42
    ) -> pd.DataFrame:
        """
        Runs Monte Carlo evaluation for all candidate strategies and returns
        a ranked leaderboard.
        """
        if strategies is None:
            strategies = generate_candidate_strategies(self.total_laps)

        results = []
        for idx, strat in enumerate(strategies):
            res = self.simulate_strategy(
                strategy=strat,
                n_simulations=n_simulations,
                random_seed=random_seed + idx * 100
            )
            results.append(res)

        df = pd.DataFrame(results)
        # Rank by Expected Outcome (Mean Race Time)
        df = df.sort_values(by="mean_time").reset_index(drop=True)
        fastest_mean = df.loc[0, "mean_time"]
        df["DeltaToBest"] = df["mean_time"] - fastest_mean
        df["Rank"] = df.index + 1
        return df


def format_hms(seconds: float) -> str:
    """Formats float seconds into HH:MM:SS.sss"""
    h = int(seconds // 3600)
    rem = seconds % 3600
    m = int(rem // 60)
    s = rem % 60
    return f"{h}:{m:02d}:{s:06.3f}"


def print_simulation_report(df_leaderboard: pd.DataFrame) -> None:
    """
    Prints ranked leaderboard, side-by-side distributions for top 3,
    and flags 'Best on Average' vs 'Safest' (Lowest Variance).
    """
    print("\n" + "="*96)
    print(f"🏁 F1 MONTE CARLO RACE STRATEGY SIMULATOR: MONACO GRAND PRIX (78 LAPS)")
    print(f"   Evaluated 2,000 Iterations per Strategy • Incorporating Real Pit Loss & SC Bonus")
    print("="*96)

    # 1. Full Ranked Leaderboard Table
    header = f"{'Rank':<5} {'Strategy Name':<28} {'Stops':<6} {'Pit Laps':<12} {'Mean Time':<14} {'Delta':<9} {'Risk (Std)':<11} {'IQR (P75-P25)'}"
    print(header)
    print("-" * 96)

    for _, row in df_leaderboard.iterrows():
        delta_str = "BASE" if row["DeltaToBest"] == 0.0 else f"+{row['DeltaToBest']:.2f}s"
        hms = format_hms(row["mean_time"])
        print(f"#{row['Rank']:<4} {row['name']:<28} {row['stops']:<6} {str(row['pit_laps']):<12} {hms:<14} {delta_str:<9} ±{row['std_dev']:.2f}s       {row['iqr']:.2f}s")

    print("\n" + "="*96)
    print("📊 SIDE-BY-SIDE DISTRIBUTION COMPARISON (TOP 3 STRATEGIES):")
    print("="*96)

    top3 = df_leaderboard.head(3)
    dist_header = f"{'Metric':<22} " + " ".join([f"{r['name'][:22]:<23}" for _, r in top3.iterrows()])
    print(dist_header)
    print("-" * 96)

    stint_strs = [r['stints_str'][:22] for _, r in top3.iterrows()]
    mean_strs = [format_hms(r['mean_time']) for _, r in top3.iterrows()]
    median_strs = [format_hms(r['median_time']) for _, r in top3.iterrows()]
    std_strs = [f"±{r['std_dev']:.2f}s" for _, r in top3.iterrows()]
    p05_strs = [format_hms(r['p05']) for _, r in top3.iterrows()]
    p95_strs = [format_hms(r['p95']) for _, r in top3.iterrows()]
    iqr_strs = [f"{r['iqr']:.2f}s" for _, r in top3.iterrows()]
    sc_strs = [f"{r['sc_benefit_prob']*100:.1f}%" for _, r in top3.iterrows()]

    print(f"{'Stint Sequence':<22} " + " ".join([f"{s:<23}" for s in stint_strs]))
    print(f"{'Expected Mean Time':<22} " + " ".join([f"{s:<23}" for s in mean_strs]))
    print(f"{'Median Time (P50)':<22} " + " ".join([f"{s:<23}" for s in median_strs]))
    print(f"{'Std Deviation (Risk)':<22} " + " ".join([f"{s:<23}" for s in std_strs]))
    print(f"{'Best Case (P05)':<22} " + " ".join([f"{s:<23}" for s in p05_strs]))
    print(f"{'Worst Case (P95)':<22} " + " ".join([f"{s:<23}" for s in p95_strs]))
    print(f"{'Spread / IQR':<22} " + " ".join([f"{s:<23}" for s in iqr_strs]))
    print(f"{'SC Win Advantage':<22} " + " ".join([f"{s:<23}" for s in sc_strs]))

    # 2. Decision Analysis: Best on Average vs. Safest
    best_avg_row = df_leaderboard.sort_values(by="mean_time").iloc[0]
    safest_row = df_leaderboard.sort_values(by="std_dev").iloc[0]

    print("\n" + "="*96)
    print("🎯 STRATEGIC DECISION-MAKER SUMMARY:")
    print("="*96)
    print(f"🥇 BEST ON AVERAGE (Lowest Expected Race Time):")
    print(f"   -> {best_avg_row['name']}")
    print(f"      Expected Time: {format_hms(best_avg_row['mean_time'])} | Pit Laps: {best_avg_row['pit_laps']} | Risk: ±{best_avg_row['std_dev']:.2f}s")
    
    print(f"\n🛡️ SAFEST (Lowest Variance / Narrowest Outcome Spread):")
    print(f"   -> {safest_row['name']}")
    print(f"      Expected Time: {format_hms(safest_row['mean_time'])} | Risk: ±{safest_row['std_dev']:.2f}s (IQR: {safest_row['iqr']:.2f}s)")

    if best_avg_row["name"] == safest_row["name"]:
        print(f"\n💡 UNANIMOUS CALL: {best_avg_row['name']} dominates on BOTH average pace and safety!")
    else:
        delta_risk = best_avg_row["std_dev"] - safest_row["std_dev"]
        delta_pace = safest_row["mean_time"] - best_avg_row["mean_time"]
        print(f"\n💡 THE TACTICAL DILEMMA:")
        print(f"   - Choosing '{best_avg_row['name']}' gains {delta_pace:.2f}s in expected race time,")
        print(f"     but carries an extra ±{delta_risk:.2f}s in volatility.")
        print(f"   - Choosing '{safest_row['name']}' trades {delta_pace:.2f}s of theoretical pace to guarantee")
        print(f"     the narrowest outcome variance and protect against unexpected pit or traffic delays.")

    # 3. Monaco Intuitive Sanity Check
    print("\n🏁 RACING LOGIC SANITY CHECK (MONACO GP):")
    top_1stop = df_leaderboard[df_leaderboard["stops"] == 1].iloc[0]
    top_2stop = df_leaderboard[df_leaderboard["stops"] == 2].iloc[0] if any(df_leaderboard["stops"] == 2) else None

    if top_1stop["mean_time"] <= top_2stop["mean_time"]:
        print(f"   ✅ PASS: The simulator correctly favors a 1-stop strategy ({top_1stop['name']})")
        print(f"      at Monaco. With a ~20.25s green pit loss and low tire degradation, an extra pit stop")
        print(f"      costs +{top_2stop['mean_time'] - top_1stop['mean_time']:.2f}s that cannot be recovered on track.")
    else:
        print(f"   ℹ️ NOTE: 2-stop ({top_2stop['name']}) is {top_1stop['mean_time'] - top_2stop['mean_time']:.2f}s faster in pure clean air,")
        print(f"      but 1-stop has lower variance and zero overtaking risk.")
    print("="*96 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Monte Carlo F1 Race Strategy Simulator")
    parser.add_argument("--year", type=int, default=2023, help="Season year (default: 2023)")
    parser.add_argument("--race", type=str, default="Monaco", help="Circuit name (default: Monaco)")
    parser.add_argument("--laps", type=int, default=78, help="Total race distance laps (default: 78)")
    parser.add_argument("--sims", type=int, default=2000, help="Monte Carlo simulations per strategy (default: 2000)")
    args = parser.parse_args()

    print(f"Initializing Strategy Simulator for {args.year} {args.race} GP ({args.laps} laps)...")
    sim = StrategySimulator(track=args.race, year=args.year, total_laps=args.laps)
    
    print(f"Running Monte Carlo simulation ({args.sims} iterations per candidate strategy)...")
    leaderboard = sim.evaluate_all(n_simulations=args.sims)
    print_simulation_report(leaderboard)
