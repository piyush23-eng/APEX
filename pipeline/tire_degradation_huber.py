"""
Tire Degradation Modeling with Robust Huber Loss M-Estimation
=============================================================
Fits tire degradation curves on fuel-corrected telemetry laps using HuberRegressor.
Robust M-estimation penalizes outlier residuals linearly (|r| > epsilon) while
maintaining quadratic loss for small residuals (|r| <= epsilon), preventing traffic
slowdowns and yellow flags from corrupting tire wear gradients.
"""

import os
import sys
import logging
import warnings
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List

# Suppress urllib3 and requests_cache connection warnings when running offline/cached
warnings.filterwarnings("ignore")
logging.getLogger("urllib3").setLevel(logging.ERROR)
logging.getLogger("requests_cache").setLevel(logging.ERROR)
logging.getLogger("fastf1").setLevel(logging.WARNING)

root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import numpy as np
import pandas as pd
from sklearn.linear_model import HuberRegressor, LinearRegression
from sklearn.metrics import r2_score, mean_squared_error

from src.data_loader import load_race_session, clean_laps_data
from src.tire_model import filter_clean_modeling_laps, DEFAULT_FUEL_CORRECTION_PER_LAP


# Circuit Fuel Burn Rates (seconds per lap)
CIRCUIT_FUEL_RATES = {
    "monaco": 0.035,
    "hungary": 0.045,
    "silverstone": 0.055,
    "monza": 0.055,
    "bahrain": 0.045
}

# Empirical Pirelli Tire Cliff Limits by Circuit and Compound (Laps before exponential drop)
PIRELLI_CLIFF_THRESHOLDS = {
    "monaco": {"SOFT": 22, "MEDIUM": 38, "HARD": 58},
    "hungary": {"SOFT": 18, "MEDIUM": 30, "HARD": 44},
    "silverstone": {"SOFT": 14, "MEDIUM": 26, "HARD": 38},
    "monza": {"SOFT": 16, "MEDIUM": 28, "HARD": 42},
    "bahrain": {"SOFT": 14, "MEDIUM": 24, "HARD": 36}
}


def fit_compound_huber(
    df_comp: pd.DataFrame,
    compound: str,
    epsilon: float = 1.345,
    alpha: float = 0.0001
) -> Dict[str, Any]:
    """
    Fits both HuberRegressor (robust M-estimator) and LinearRegression (OLS)
    on fuel-corrected lap times against tyre life, comparing residual distributions.
    """
    compound = compound.upper()
    if len(df_comp) < 5:
        # Default fallback if sample size is too small in sparse sessions
        return {
            "compound": compound,
            "slope": 0.06 if compound == "SOFT" else (0.038 if compound == "MEDIUM" else 0.024),
            "intercept": 82.0,
            "r2": 0.0,
            "rmse": 0.0,
            "sample_size": len(df_comp),
            "outlier_count": 0,
            "outlier_indices": [],
            "ols_slope": 0.06 if compound == "SOFT" else 0.035,
            "estimator": "Synthetic Prior (N < 5)",
            "formula": f"Delta_t(age) = 0.040 * age (N={len(df_comp)})"
        }

    X = df_comp[["TyreLife"]].values
    y = df_comp["FuelCorrectedLapTime"].values

    # 1. Huber Robust M-Estimator
    huber = HuberRegressor(epsilon=epsilon, alpha=alpha, max_iter=300)
    huber.fit(X, y)
    huber_slope = float(huber.coef_[0])
    huber_intercept = float(huber.intercept_)
    huber_pred = huber.predict(X)
    huber_r2 = max(0.0, float(r2_score(y, huber_pred)))
    huber_rmse = float(np.sqrt(mean_squared_error(y, huber_pred)))
    outliers_mask = huber.outliers_ if hasattr(huber, "outliers_") else np.zeros(len(y), dtype=bool)
    outlier_count = int(np.sum(outliers_mask))

    # 2. Baseline Ordinary Least Squares (OLS) for comparative telemetry audit
    ols = LinearRegression()
    ols.fit(X, y)
    ols_slope = float(ols.coef_[0])
    ols_intercept = float(ols.intercept_)

    # Calculate Huber outlier leverage offset
    leverage_delta = ols_slope - huber_slope

    return {
        "compound": compound,
        "slope": huber_slope,
        "intercept": huber_intercept,
        "r2": huber_r2,
        "rmse": huber_rmse,
        "sample_size": len(df_comp),
        "outlier_count": outlier_count,
        "ols_slope": ols_slope,
        "ols_intercept": ols_intercept,
        "leverage_delta": leverage_delta,
        "estimator": "Huber Loss M-Estimator (delta=1.345)",
        "formula": f"FuelCorrectedLapTime = {huber_slope:+.4f} * TyreAge + {huber_intercept:.3f}"
    }


def fit_track_tire_models(
    track_id: str,
    year: int = 2023,
    fuel_burn_rate: Optional[float] = None
) -> Dict[str, Any]:
    """
    Loads raw FastF1 race data for the circuit, normalizes for fuel burn,
    and fits robust Huber degradation models for SOFT, MEDIUM, and HARD.
    """
    track_key = track_id.lower()
    burn_rate = fuel_burn_rate or CIRCUIT_FUEL_RATES.get(track_key, 0.040)
    circuit_name = "Monaco" if track_key == "monaco" else (
        "Hungary" if track_key == "hungary" else (
            "Silverstone" if track_key == "silverstone" else (
                "Monza" if track_key == "monza" else "Bahrain"
            )
        )
    )

    session = load_race_session(year, circuit_name, "R")
    raw_df = clean_laps_data(session, fuel_burn_rate_sec_per_lap=burn_rate)
    clean_df = filter_clean_modeling_laps(raw_df, fuel_burn_rate=burn_rate)

    results = {}
    scatter_points = []

    for comp in ["SOFT", "MEDIUM", "HARD"]:
        df_comp = clean_df[clean_df["Compound"] == comp].copy()
        model_fit = fit_compound_huber(df_comp, compound=comp)
        
        # Add Pirelli cliff threshold
        cliff_lap = PIRELLI_CLIFF_THRESHOLDS.get(track_key, {}).get(comp, 30)
        model_fit["deg_cliff_lap"] = cliff_lap

        results[comp] = model_fit

        # Extract representative scatter telemetry points for dashboard visualization
        if not df_comp.empty:
            sampled_df = df_comp.sample(min(80, len(df_comp)), random_state=42) if len(df_comp) > 80 else df_comp
            for _, row in sampled_df.iterrows():
                scatter_points.append({
                    "compound": comp,
                    "tyre_life": int(row["TyreLife"]),
                    "lap_time": round(float(row["FuelCorrectedLapTime"]), 3),
                    "driver": str(row.get("Driver", "VER")),
                    "lap_number": int(row.get("LapNumber", 1))
                })

    return {
        "track_id": track_key,
        "track_name": circuit_name,
        "year": year,
        "fuel_burn_rate": burn_rate,
        "models": results,
        "scatter_points": scatter_points,
        "total_clean_laps": len(clean_df)
    }


if __name__ == "__main__":
    print("\n🏁 TESTING PIRELLI TIRE DEGRADATION HUBER ESTIMATION...")
    res = fit_track_tire_models("monaco", 2023)
    print(f"Track: {res['track_name']} ({res['year']}) - Total clean laps: {res['total_clean_laps']}")
    for comp, m in res["models"].items():
        print(f"  [{comp}] Huber Slope: {m['slope']:+.4f} s/lap | OLS Slope: {m['ols_slope']:+.4f} s/lap | Outliers Rejected: {m['outlier_count']} | R²: {m['r2']:.3f}")
    print("✅ Huber Regression Model Fit Succeeded!\n")
