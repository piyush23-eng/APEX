import sys
from pathlib import Path
root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

"""
FastAPI Backend API for F1 Race Strategy Simulator
==================================================
Exposes endpoints for track listings, tire degradation models,
Monte Carlo simulation distributions, and historical validation benchmarks.
"""

from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import pandas as pd

from src.data_loader import load_race_session, clean_laps_data
from src.tire_model import filter_clean_modeling_laps, fit_all_compounds
from src.strategy_sim import StrategySimulator, format_hms
from src.validate import (
    BENCHMARK_RACES,
    extract_actual_winner_strategy,
    find_strategy_rank_and_delta,
    VALIDATION_WRITEUPS
)

app = FastAPI(
    title="F1 Race Strategy Simulator API",
    description="Statistical modeling and Monte Carlo strategy optimization powered by FastF1 telemetry.",
    version="1.0.0"
)

# Enable CORS for local React development servers (Vite default port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Circuit metadata lookup
TRACKS_METADATA = {
    "monaco": {
        "id": "monaco",
        "name": "Monaco Grand Prix",
        "race": "Monaco",
        "year": 2023,
        "laps": 78,
        "track_type": "Street (High Track Position)",
        "green_pit_loss": 20.25,
        "sc_pit_loss": 11.75,
        "fuel_burn_rate": 0.035,
        "historical_sc_rate": 0.50,
        "circuit_length_km": 3.337
    },
    "hungary": {
        "id": "hungary",
        "name": "Hungarian Grand Prix (Hungaroring)",
        "race": "Hungary",
        "year": 2023,
        "laps": 70,
        "track_type": "Permanent (High Thermal Deg)",
        "green_pit_loss": 22.50,
        "sc_pit_loss": 13.00,
        "fuel_burn_rate": 0.045,
        "historical_sc_rate": 0.30,
        "circuit_length_km": 4.381
    },
    "silverstone": {
        "id": "silverstone",
        "name": "British Grand Prix (Silverstone)",
        "race": "Silverstone",
        "year": 2023,
        "laps": 52,
        "track_type": "High-Speed Lateral",
        "green_pit_loss": 22.00,
        "sc_pit_loss": 12.50,
        "fuel_burn_rate": 0.055,
        "historical_sc_rate": 0.55,
        "circuit_length_km": 5.891
    },
    "monza": {
        "id": "monza",
        "name": "Italian Grand Prix (Monza)",
        "race": "Monza",
        "year": 2023,
        "laps": 51,
        "track_type": "Temple of Speed (Low Deg)",
        "green_pit_loss": 24.00,
        "sc_pit_loss": 13.50,
        "fuel_burn_rate": 0.055,
        "historical_sc_rate": 0.35,
        "circuit_length_km": 5.793
    },
    "bahrain": {
        "id": "bahrain",
        "name": "Bahrain Grand Prix (Sakhir)",
        "race": "Bahrain",
        "year": 2023,
        "laps": 57,
        "track_type": "Abrasive Asphalt (High Traction Deg)",
        "green_pit_loss": 24.50,
        "sc_pit_loss": 13.50,
        "fuel_burn_rate": 0.055,
        "historical_sc_rate": 0.40,
        "circuit_length_km": 5.412
    }
}

_SESSION_CACHE: Dict[str, Any] = {}

def get_session_and_clean_data(race_key: str):
    race_key = race_key.lower()
    if race_key not in TRACKS_METADATA:
        raise HTTPException(status_code=404, detail=f"Track '{race_key}' not found.")
    
    if race_key not in _SESSION_CACHE:
        meta = TRACKS_METADATA[race_key]
        session = load_race_session(meta["year"], meta["race"], "R")
        clean_df = clean_laps_data(session)
        _SESSION_CACHE[race_key] = (session, clean_df)
    
    return _SESSION_CACHE[race_key]


@app.get("/")
def root():
    return {"status": "ok", "service": "F1 Race Strategy Simulator API"}


@app.get("/tracks")
def get_tracks():
    """Returns list of available tracks and basic circuit characteristics."""
    return list(TRACKS_METADATA.values())


@app.get("/degradation-curve")
def get_degradation_data(track: str = Query("monaco", description="Track ID (e.g. monaco, hungary, silverstone, monza, bahrain)")):
    """Returns fitted linear degradation model coefficients and clean telemetry scatter points."""
    track_key = track.lower()
    if track_key not in TRACKS_METADATA:
        raise HTTPException(status_code=404, detail=f"Unknown track '{track}'")

    meta = TRACKS_METADATA[track_key]
    session, clean_df = get_session_and_clean_data(track_key)
    filtered_laps = filter_clean_modeling_laps(clean_df, fuel_burn_rate=meta["fuel_burn_rate"])
    models = fit_all_compounds(filtered_laps, track=meta["race"], year=meta["year"], fuel_burn_rate=meta["fuel_burn_rate"])

    # Sample scattered telemetry points (capped at 400 for frontend rendering performance)
    scatter = []
    for _, row in filtered_laps.sample(min(400, len(filtered_laps)), random_state=42).iterrows():
        scatter.append({
            "compound": row["Compound"],
            "tyre_life": int(row["TyreLife"]),
            "lap_time": round(float(row["FuelCorrectedLapTime"]), 3),
            "lap_number": int(row["LapNumber"]),
            "driver": str(row["Driver"])
        })

    return {
        "track": meta["race"],
        "year": meta["year"],
        "fuel_burn_rate": meta["fuel_burn_rate"],
        "models": models,
        "scatter_points": scatter
    }


@app.get("/simulate")
def run_simulation(
    track: str = Query("monaco"),
    safety_car_prob: Optional[float] = Query(None, ge=0.0, le=1.0),
    n_sims: int = Query(2000, ge=100, le=10000)
):
    """Executes Monte Carlo race simulation and returns ranked strategy distributions."""
    track_key = track.lower()
    if track_key not in TRACKS_METADATA:
        raise HTTPException(status_code=404, detail=f"Unknown track '{track}'")

    meta = TRACKS_METADATA[track_key]
    session, clean_df = get_session_and_clean_data(track_key)
    sc_prob = safety_car_prob if safety_car_prob is not None else meta["historical_sc_rate"]

    sim = StrategySimulator(
        track=meta["race"],
        year=meta["year"],
        total_laps=meta["laps"],
        clean_df=clean_df,
        fuel_burn_rate=meta["fuel_burn_rate"],
        green_pit_loss=meta["green_pit_loss"],
        sc_pit_loss=meta["sc_pit_loss"],
        historical_sc_rate=sc_prob
    )

    leaderboard = sim.evaluate_all(n_simulations=n_sims)
    fastest_mean = leaderboard.iloc[0]["mean_time"]

    strategies_out = []
    for _, row in leaderboard.iterrows():
        sim_times = row["sim_times"]
        # Quantiles and sample points (50 points for box/violin plot)
        sample_rel_times = (np.random.choice(sim_times, size=min(60, len(sim_times)), replace=False) - fastest_mean).round(2).tolist()

        strategies_out.append({
            "rank": int(row["Rank"]),
            "name": row["name"],
            "stops": int(row["stops"]),
            "pit_laps": [int(p) for p in row["strategy"].pit_laps],
            "stints": [{"compound": c, "length": l} for c, l in row["strategy"].stints],
            "stints_str": row["stints_str"],
            "mean_time": round(float(row["mean_time"]), 2),
            "median_time": round(float(row["median_time"]), 2),
            "std_dev": round(float(row["std_dev"]), 2),
            "p05": round(float(row["p05"]), 2),
            "p25": round(float(row["p25"]), 2),
            "p75": round(float(row["p75"]), 2),
            "p95": round(float(row["p95"]), 2),
            "iqr": round(float(row["iqr"]), 2),
            "sc_benefit_prob": round(float(row["sc_benefit_prob"]), 3),
            "delta_to_best": round(float(row["DeltaToBest"]), 2),
            "formatted_mean": format_hms(row["mean_time"]),
            "distribution_samples": sample_rel_times
        })

    return {
        "track": meta["race"],
        "year": meta["year"],
        "total_laps": meta["laps"],
        "simulations": n_sims,
        "sc_prob": sc_prob,
        "strategies": strategies_out
    }


@app.get("/validate")
def get_validation_data(track: str = Query("monaco")):
    """Returns historical winner strategy comparison and written validation analysis."""
    track_key = track.lower()
    if track_key not in TRACKS_METADATA:
        raise HTTPException(status_code=404, detail=f"Unknown track '{track}'")

    meta = TRACKS_METADATA[track_key]
    session, clean_df = get_session_and_clean_data(track_key)
    actual_winner = extract_actual_winner_strategy(session, clean_df)

    sim = StrategySimulator(
        track=meta["race"],
        year=meta["year"],
        total_laps=meta["laps"],
        clean_df=clean_df,
        fuel_burn_rate=meta["fuel_burn_rate"],
        green_pit_loss=meta["green_pit_loss"],
        sc_pit_loss=meta["sc_pit_loss"],
        historical_sc_rate=meta["historical_sc_rate"]
    )
    leaderboard = sim.evaluate_all(n_simulations=500)
    sim_rank, matched_row, pit_err, matched_name = find_strategy_rank_and_delta(leaderboard, actual_winner, meta["race"])

    val_meta = VALIDATION_WRITEUPS.get(meta["race"], {
        "tier": "Benchmark Evaluation",
        "badge_color": "blue",
        "writeup": "Validation data available."
    })

    return {
        "track": meta["race"],
        "year": meta["year"],
        "winner": {
            "driver": actual_winner["driver"],
            "team": actual_winner["team"],
            "stints": actual_winner["stints"],
            "stints_str": actual_winner["stints_str"],
            "pit_laps": actual_winner["pit_laps"],
            "stops": actual_winner["stops"]
        },
        "model_match": {
            "rank": sim_rank,
            "matched_strategy_name": matched_name,
            "pit_error_laps": pit_err,
            "tier": val_meta["tier"],
            "badge_color": val_meta["badge_color"]
        },
        "analysis_writeup": val_meta["writeup"]
    }
