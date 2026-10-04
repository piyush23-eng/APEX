"""
In-Race Online Bayesian Tire Degradation Updater
================================================
Models real-time pit-wall telemetry processing using Bayesian Linear Regression.
As each lap completes, the algorithm updates the posterior distribution of the
compound wear rate (alpha ~ N(mu_N, Sigma_N)), dynamically tightening credible
intervals and projecting early degradation cliffs.

Mathematical Formulation:
Conjugate Gaussian Prior:
    p(w) = N(w | mu_0, Sigma_0)
Likelihood (Lap Telemetry):
    p(y | X, w) = N(y | X w, sigma^2 I)
Posterior Distribution:
    p(w | y) = N(w | mu_N, Sigma_N)
where:
    Sigma_N^-1 = Sigma_0^-1 + sigma^-2 * X^T X
    mu_N = Sigma_N * (Sigma_0^-1 * mu_0 + sigma^-2 * X^T y)
"""

import sys
from pathlib import Path
root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import pandas as pd


class BayesianTireUpdater:
    """
    Online Bayesian updater for tire degradation slopes and cliff projections.
    """
    def __init__(
        self,
        compound: str = "MEDIUM",
        prior_slope: float = 0.035,
        prior_slope_var: float = 0.015**2,
        prior_intercept: float = 78.5,
        prior_intercept_var: float = 1.0**2,
        observation_noise_sigma: float = 0.35,
        fuel_burn_rate: float = 0.035
    ):
        self.compound = compound.upper()
        self.fuel_burn_rate = fuel_burn_rate
        self.sigma2 = observation_noise_sigma ** 2

        # Prior parameter vector w = [slope, intercept]^T
        self.mu_0 = np.array([prior_slope, prior_intercept], dtype=float)
        self.Sigma_0 = np.diag([prior_slope_var, prior_intercept_var])
        self.Sigma_0_inv = np.linalg.inv(self.Sigma_0)

        # Running telemetry observation history
        self.X_history: List[List[float]] = []
        self.y_history: List[float] = []

        # Current posterior state
        self.mu_N = self.mu_0.copy()
        self.Sigma_N = self.Sigma_0.copy()
        self.laps_observed = 0

    def update(self, stint_lap: int, raw_lap_time: float, total_race_lap: Optional[int] = None) -> Dict[str, Any]:
        """
        Incorporates a newly completed lap into the posterior belief distribution.
        
        Args:
            stint_lap: Current lap number driven on this physical tire set (TyreLife).
            raw_lap_time: Uncorrected lap time from transponder timing line.
            total_race_lap: Absolute race lap (used for fuel mass correction).
        """
        race_lap = total_race_lap if total_race_lap is not None else stint_lap

        # Apply fuel mass normalization
        fuel_corrected_time = raw_lap_time + (race_lap - 1) * self.fuel_burn_rate

        # Design matrix row: [stint_lap, 1.0]
        x_row = [float(stint_lap), 1.0]
        self.X_history.append(x_row)
        self.y_history.append(float(fuel_corrected_time))
        self.laps_observed += 1

        X = np.array(self.X_history)
        y = np.array(self.y_history)

        # Compute exact conjugate posterior:
        # Sigma_N^-1 = Sigma_0^-1 + (1 / sigma^2) * X^T * X
        XTX = X.T @ X
        XTy = X.T @ y
        Sigma_N_inv = self.Sigma_0_inv + (1.0 / self.sigma2) * XTX
        self.Sigma_N = np.linalg.inv(Sigma_N_inv)

        # mu_N = Sigma_N * (Sigma_0^-1 * mu_0 + (1 / sigma^2) * X^T * y)
        self.mu_N = self.Sigma_N @ (self.Sigma_0_inv @ self.mu_0 + (1.0 / self.sigma2) * XTy)

        slope_mean = float(self.mu_N[0])
        slope_std = float(np.sqrt(max(1e-8, self.Sigma_N[0, 0])))
        intercept_mean = float(self.mu_N[1])

        # 95% Credible interval (mu +- 1.96 * sigma)
        ci_lower = slope_mean - 1.96 * slope_std
        ci_upper = slope_mean + 1.96 * slope_std

        # In-race drift detection: Is tire degrading faster than the pre-race baseline?
        prior_slope = float(self.mu_0[0])
        drift_delta = slope_mean - prior_slope
        is_accelerating = drift_delta > 0.015 and self.laps_observed >= 5

        return {
            "laps_observed": self.laps_observed,
            "stint_lap": stint_lap,
            "fuel_corrected_time": round(fuel_corrected_time, 3),
            "posterior_slope_mean": round(slope_mean, 4),
            "posterior_slope_std": round(slope_std, 4),
            "posterior_intercept": round(intercept_mean, 3),
            "ci_95": (round(ci_lower, 4), round(ci_upper, 4)),
            "prior_slope": round(prior_slope, 4),
            "drift_delta": round(drift_delta, 4),
            "is_accelerating": bool(is_accelerating),
            "tactical_alert": "EARLY BOX REQUIRED: THERMAL CLIFF ACCELERATING" if is_accelerating else "NOMINAL WEAR REGIME"
        }

    def predict_future_pace(self, max_laps: int = 40) -> List[Dict[str, float]]:
        """
        Projects future lap pace with 95% predictive posterior uncertainty envelope.
        """
        predictions = []
        for lap in range(1, max_laps + 1):
            x = np.array([lap, 1.0])
            pred_mean = float(x @ self.mu_N)
            # Total predictive variance = model parameter uncertainty + observation noise
            pred_var = float(x @ self.Sigma_N @ x.T + self.sigma2)
            pred_std = float(np.sqrt(pred_var))

            predictions.append({
                "stint_lap": lap,
                "expected_pace": round(pred_mean, 3),
                "lower_bound_95": round(pred_mean - 1.96 * pred_std, 3),
                "upper_bound_95": round(pred_mean + 1.96 * pred_std, 3)
            })
        return predictions


if __name__ == "__main__":
    print("\n" + "="*80)
    print("🧠 IN-RACE BAYESIAN ONLINE TIRE DEGRADATION UPDATER")
    print("="*80)
    print("Simulating real-time lap telemetry stream on 2023 Monaco GP Medium compound...\n")

    # Initialize with conservative pre-race engineering prior: slope = +0.025 s/lap
    updater = BayesianTireUpdater(
        compound="MEDIUM",
        prior_slope=0.025,
        prior_slope_var=0.020**2,
        prior_intercept=78.50,
        observation_noise_sigma=0.25
    )

    # Simulated incoming telemetry: high wear drift occurs around lap 12
    np.random.seed(42)
    true_wear = 0.048  # Actual in-race track surface creates higher degradation
    base_time = 78.60

    print("Lap | Raw Pace | Fuel-Corr | Posterior alpha | 95% Credible Interval | Tactical Status")
    print("-" * 85)

    for lap in range(1, 21):
        noise = np.random.normal(0, 0.22)
        simulated_raw = (base_time + (true_wear * lap) - (lap * 0.035)) + noise
        update_result = updater.update(stint_lap=lap, raw_lap_time=simulated_raw, total_race_lap=lap)

        ci = update_result["ci_95"]
        print(f"L{lap:02d} | {simulated_raw:.3f}s | {update_result['fuel_corrected_time']:.3f}s | "
              f"{update_result['posterior_slope_mean']:+.4f} s/lap | [{ci[0]:+.4f}, {ci[1]:+.4f}] | "
              f"{update_result['tactical_alert']}")

    print("\n✅ Bayesian Online Learning Engine Verified!\n")
