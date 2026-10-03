"""
Exploratory Telemetry & Tire Degradation Analysis
================================================
This script performs exploratory data analysis (EDA) on raw FastF1 race telemetry,
inspecting tire life distributions, lap time variations, fuel burn rate sensitivity,
and pit stop execution times.
"""

import sys
from pathlib import Path
root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import pandas as pd
import numpy as np
from src.data_loader import load_race_session, clean_laps_data, extract_pit_stops
from src.tire_model import TrackTireModel


def run_exploration():
    print("Loading 2023 Monaco GP for Exploratory Analysis...")
    session = load_race_session(2023, "Monaco", "R")
    clean_df = clean_laps_data(session)
    pit_df = extract_pit_stops(clean_df)

    print("\n--- 1. Raw vs Clean Laps ---")
    print(f"Total laps in session: {len(clean_df)}")
    print(f"Clean dry racing laps: {clean_df['IsCleanRacingLap'].sum()}")

    print("\n--- 2. Stint Lengths by Compound ---")
    stints_summary = clean_df.groupby(["Compound", "Stint"])["TyreLife"].max().reset_index()
    print(stints_summary.groupby("Compound")["TyreLife"].describe())

    print("\n--- 3. Pit Stop Count & Frequencies ---")
    print(f"Total Pit Stops: {len(pit_df)}")
    print(pit_df["FromCompound"].value_counts())

    print("\n--- 4. Fitting Quick Tire Model ---")
    model = TrackTireModel("Monaco", 2023).fit_from_dataframe(clean_df)
    print(model.get_summary_table())

if __name__ == "__main__":
    run_exploration()
