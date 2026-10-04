import sys
from pathlib import Path
root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
"""
F1 Race Data Loader & Telemetry Cleaning Module
===============================================

This module pulls and cleans official Formula 1 timing and telemetry data via FastF1.
It prepares raw session telemetry into clean, statistically reliable lap data suitable
for tire degradation modeling and race strategy simulations.

Domain Concepts & Racing Logic Explained:
-----------------------------------------
1. In-Laps and Out-Laps:
   - In-Lap: The lap where a driver enters the pit lane. The driver decelerates to the
     pit speed limit (usually 60 or 80 km/h) before the timing line, inflating lap time
     by 5 to 25+ seconds.
   - Out-Lap: The lap where a driver leaves the pit lane from a standstill with cold tires
     (blanket temps capped at 70°C).
   - Why Clean Them: Neither in-laps nor out-laps represent true vehicle or tire pace.
     Leaving them in would corrupt tire degradation regressions.

2. Fuel Burn-Off Effect:
   - Modern F1 cars start a Grand Prix with up to 110 kg of fuel and no refueling is permitted.
   - Cars burn approximately 1.5 to 2.0 kg of fuel per lap depending on circuit layout.
   - Rule of thumb: 10 kg of fuel costs ~0.30 - 0.35 seconds per lap in lap time.
   - Thus, as fuel burns off, cars naturally get faster by ~0.030 - 0.035s per lap.
   - Why Correct It: Fuel burn-off masks tire degradation! A driver might lap at 1:16.0
     on lap 5 and 1:16.0 on lap 25. While lap times look identical, the car actually lost
     ~0.7s of tire grip that was masked by the car being 35 kg lighter. Correcting for fuel
     isolates the true mechanical and thermal degradation of the compound.

3. Track Status & Safety Cars (SC / VSC):
   - TrackStatus '1': All clear / Green flag racing conditions.
   - TrackStatus '4' / '5' / '6': Safety Car (Full SC or Virtual Safety Car) and Red Flags.
   - Under SC/VSC, drivers must follow a mandatory delta time (~30-40% slower than racing pace).
     All non-green flag laps must be excluded from pace and degradation modeling.

4. Tire Life vs. Stint Lap:
   - 'Stint': Consecutive laps driven on a single set of tires during a race.
   - 'TyreLife': Total laps driven on that physical set of tires, which may include laps
     driven in Qualifying or Free Practice if scrubbed/used sets were fitted at the pit stop.
"""

import os
import argparse
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
import logging
import warnings

# Suppress network fallback logs when using local FastF1 cache
warnings.filterwarnings("ignore")
logging.getLogger("urllib3").setLevel(logging.CRITICAL)
logging.getLogger("requests_cache").setLevel(logging.CRITICAL)
logging.getLogger("fastf1.req").setLevel(logging.CRITICAL)

import pandas as pd
import numpy as np
import fastf1


# Default cache location inside project repository
DEFAULT_CACHE_DIR = Path(__file__).resolve().parent.parent / "data"


def setup_cache(cache_dir: Optional[str or Path] = None) -> Path:
    """
    Enables and configures the local FastF1 cache directory.
    
    Caching ensures API requests to the Formula 1 Ergast/Live Timing servers
    are persisted locally to eliminate redundant network roundtrips and ensure
    reproducible analysis offline.
    """
    path = Path(cache_dir) if cache_dir else DEFAULT_CACHE_DIR
    path.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(path))
    return path


def load_race_session(year: int, circuit: str, session_type: str = "R") -> fastf1.core.Session:
    """
    Loads a specific Formula 1 session via FastF1 with local caching.
    
    Args:
        year: Championship season (e.g. 2023)
        circuit: Circuit or Grand Prix name (e.g. 'Monaco', 'Silverstone', 'Bahrain')
        session_type: Session identifier ('R' for Race, 'Q' for Qualifying, 'FP1', etc.)
        
    Returns:
        fastf1.core.Session: Loaded FastF1 session object with laps and timing metadata.
    """
    setup_cache()
    session = fastf1.get_session(year, circuit, session_type)
    # Load session timing and lap data (telemetry=False to keep loading lightweight & fast)
    session.load(telemetry=False, weather=True, messages=True)
    return session


def clean_laps_data(
    session: fastf1.core.Session,
    fuel_burn_rate_sec_per_lap: float = 0.033
) -> pd.DataFrame:
    """
    Processes raw session laps into a clean, analytics-ready DataFrame.
    
    Transforms and filters:
    1. Standardizes driver code, team, lap numbers, and tire compounds.
    2. Converts timedeltas (LapTime, PitInTime, PitOutTime) to clean float seconds.
    3. Identifies pit-in laps, pit-out laps, and safety car / VSC laps.
    4. Applies fuel-burn correction to isolate true compound degradation.
    5. Flags strictly clean green-flag racing laps (`IsCleanRacingLap`).
    
    Args:
        session: Loaded FastF1 Session object
        fuel_burn_rate_sec_per_lap: Estimated lap time delta reduction per lap from fuel burn-off
        
    Returns:
        pd.DataFrame: Cleaned laps dataframe with telemetry flags and fuel-corrected pace
    """
    raw_laps = session.laps.copy()
    if raw_laps.empty:
        raise ValueError(f"No lap data found for session {session}")

    # Total laps scheduled / run in this race
    total_race_laps = int(raw_laps["LapNumber"].max())

    df = pd.DataFrame()
    df["Driver"] = raw_laps["Driver"]
    df["DriverNumber"] = raw_laps["DriverNumber"]
    df["Team"] = raw_laps["Team"]
    df["LapNumber"] = raw_laps["LapNumber"].astype(int)
    df["Stint"] = raw_laps["Stint"].fillna(1).astype(int)
    df["Compound"] = raw_laps["Compound"].astype(str).str.upper()
    df["TyreLife"] = raw_laps["TyreLife"].fillna(1).astype(int)
    df["FreshTyre"] = raw_laps["FreshTyre"].fillna(True).astype(bool)
    
    # Track and Lap status
    df["TrackStatus"] = raw_laps["TrackStatus"].astype(str)
    df["IsAccurate"] = raw_laps["IsAccurate"].fillna(False).astype(bool)

    # Convert Timedeltas to total seconds for scientific modeling
    df["LapTime"] = raw_laps["LapTime"]
    df["LapTimeSeconds"] = raw_laps["LapTime"].dt.total_seconds()
    df["PitInTime"] = raw_laps["PitInTime"]
    df["PitOutTime"] = raw_laps["PitOutTime"]
    
    # Pit Lap Identification
    df["IsPitInLap"] = raw_laps["PitInTime"].notna()
    df["IsPitOutLap"] = raw_laps["PitOutTime"].notna()
    
    # Safety Car & Neutralized Lap Identification
    # In F1 Live Timing: '1' is Green Flag.
    # '2' = Yellow, '4' = SC, '5' = Red Flag, '6' = VSC deployed, '7' = VSC ending
    def is_neutralized(status_str: str) -> bool:
        return any(flag in status_str for flag in ["4", "5", "6", "7"])

    df["IsNeutralizedLap"] = df["TrackStatus"].apply(is_neutralized)

    # Fuel-Burn Correction:
    # At lap 1, the car carries max fuel (total_race_laps * fuel_burn_rate_sec_per_lap disadvantage).
    # At the final lap, the tank is empty (0 kg disadvantage).
    # FuelCorrectedLapTime = Measured LapTime + (LapNumber - 1) * fuel_burn_rate
    # This brings all laps to the baseline of an empty car (or lap 1 equivalent),
    # allowing pure tire wear to be revealed as an upward slope over stint age.
    df["FuelCorrectionSeconds"] = (df["LapNumber"] - 1) * fuel_burn_rate_sec_per_lap
    df["FuelCorrectedLapTime"] = df["LapTimeSeconds"] + df["FuelCorrectionSeconds"]

    # Filter condition for pristine racing laps:
    # 1. Valid lap time
    # 2. Not an in-lap or out-lap (pit lane transit)
    # 3. Green flag condition (TrackStatus == '1')
    # 4. Lap time within reasonable competitive bounds (filter out spins, punctures, traffic pile-ups)
    median_pace = df.loc[df["LapTimeSeconds"].notna(), "LapTimeSeconds"].median()
    # Laps > 115% of median pace are usually spins, punctures, or extreme traffic
    df["IsPaceAnomaly"] = df["LapTimeSeconds"] > (median_pace * 1.15)

    df["IsCleanRacingLap"] = (
        df["LapTimeSeconds"].notna() &
        (~df["IsPitInLap"]) &
        (~df["IsPitOutLap"]) &
        (~df["IsNeutralizedLap"]) &
        (~df["IsPaceAnomaly"]) &
        (df["Compound"].isin(["SOFT", "MEDIUM", "HARD"]))
    )

    return df


def extract_pit_stops(clean_df: pd.DataFrame) -> pd.DataFrame:
    """
    Extracts structured pit stop events from session laps.
    
    Racing Insight:
    Pit strategy dictates track position. Identifying exact pit laps, stint durations,
    and compound changes lets us reconstruct team strategy choices and validate our simulator.
    """
    pit_laps = clean_df[clean_df["IsPitInLap"]].copy()
    pit_stops = []

    for _, row in pit_laps.iterrows():
        driver = row["Driver"]
        pit_lap = row["LapNumber"]
        stint_idx = row["Stint"]
        prev_compound = row["Compound"]
        
        # Determine next compound from following lap if available
        next_laps = clean_df[(clean_df["Driver"] == driver) & (clean_df["LapNumber"] == pit_lap + 1)]
        next_compound = next_laps["Compound"].values[0] if not next_laps.empty else "UNKNOWN"

        pit_stops.append({
            "Driver": driver,
            "Team": row["Team"],
            "PitLap": pit_lap,
            "Stint": stint_idx,
            "FromCompound": prev_compound,
            "ToCompound": next_compound,
            "StintLength": row["TyreLife"]
        })

    return pd.DataFrame(pit_stops)


def get_race_summary(session: fastf1.core.Session, clean_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Generates an executive summary of the cleaned Grand Prix data.
    """
    total_raw_laps = len(clean_df)
    clean_laps = clean_df[clean_df["IsCleanRacingLap"]]
    pit_df = extract_pit_stops(clean_df)

    # Driver standings / classifications
    driver_laps = clean_df.groupby("Driver")["LapNumber"].max().sort_values(ascending=False)
    
    # Compound distribution
    compound_counts = clean_df["Compound"].value_counts().to_dict()
    clean_compound_counts = clean_laps["Compound"].value_counts().to_dict()

    return {
        "EventName": session.event["EventName"],
        "Year": session.event.year,
        "TotalScheduledLaps": int(clean_df["LapNumber"].max()),
        "TotalRawLaps": total_raw_laps,
        "CleanRacingLaps": len(clean_laps),
        "TotalPitStops": len(pit_df),
        "CompoundsUsed": compound_counts,
        "CleanLapsPerCompound": clean_compound_counts,
        "DriversCount": clean_df["Driver"].nunique(),
        "NeutralizedLapsCount": int(clean_df["IsNeutralizedLap"].sum())
    }


def print_summary_report(summary: Dict[str, Any], pit_df: pd.DataFrame, clean_df: pd.DataFrame) -> None:
    """
    Prints a formatted, human-readable terminal report of the race data.
    """
    print("\n" + "="*70)
    print(f"🏁 FORMULA 1 DATA SUMMARY: {summary['Year']} {summary['EventName']}")
    print("="*70)
    print(f"Total Drivers Analyzed:     {summary['DriversCount']}")
    print(f"Total Race Laps:            {summary['TotalScheduledLaps']}")
    print(f"Total Raw Laps Logged:      {summary['TotalRawLaps']}")
    print(f"Clean Racing Laps (Dry):    {summary['CleanRacingLaps']} ({(summary['CleanRacingLaps']/summary['TotalRawLaps'])*100:.1f}%)")
    print(f"Neutralized / SC Laps:      {summary['NeutralizedLapsCount']}")
    print(f"Total Pit Stops Recorded:   {summary['TotalPitStops']}")
    
    print("\n📊 Lap Distribution by Tire Compound:")
    for compound, count in summary["CompoundsUsed"].items():
        clean_count = summary["CleanLapsPerCompound"].get(compound, 0)
        print(f"  - {compound:<12}: {count:>4} total laps | {clean_count:>4} clean modeling laps")

    print("\n⏱️ Baseline Pace by Compound (Clean Racing Laps):")
    clean_laps = clean_df[clean_df["IsCleanRacingLap"]]
    for comp in ["SOFT", "MEDIUM", "HARD"]:
        comp_laps = clean_laps[clean_laps["Compound"] == comp]
        if not comp_laps.empty:
            mean_time = comp_laps["LapTimeSeconds"].mean()
            min_time = comp_laps["LapTimeSeconds"].min()
            std_time = comp_laps["LapTimeSeconds"].std()
            m, s = divmod(min_time, 60)
            print(f"  - {comp:<8}: Fastest {int(m)}:{s:06.3f} | Mean {mean_time:.3f}s (±{std_time:.2f}s) | N={len(comp_laps)}")

    print("\n🔧 Sample Historical Pit Stops (First 8):")
    if not pit_df.empty:
        sample_pits = pit_df.head(8)
        print(f"  {'Driver':<8} {'Lap':<6} {'Stint':<6} {'From':<8} {'To':<8} {'Laps on Tire':<12}")
        print("  " + "-"*50)
        for _, p in sample_pits.iterrows():
            print(f"  {p['Driver']:<8} {p['PitLap']:<6} {p['Stint']:<6} {p['FromCompound']:<8} {p['ToCompound']:<8} {p['StintLength']:<12}")
    print("="*70 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pull & Clean FastF1 Race Lap Telemetry")
    parser.add_argument("--year", type=int, default=2023, help="Championship season year (default: 2023)")
    parser.add_argument("--race", type=str, default="Monaco", help="Race/Circuit name (default: Monaco)")
    args = parser.parse_args()

    print(f"Fetching official F1 telemetry for {args.year} {args.race} Grand Prix...")
    session_obj = load_race_session(args.year, args.race, "R")
    clean_data = clean_laps_data(session_obj)
    pit_data = extract_pit_stops(clean_data)
    summary_data = get_race_summary(session_obj, clean_data)
    print_summary_report(summary_data, pit_data, clean_data)
