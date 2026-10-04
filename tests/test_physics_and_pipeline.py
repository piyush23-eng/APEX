"""
Automated Physics, Telemetry & Pipeline Sanity Test Suite
=========================================================
Executes unit tests and domain invariant physics checks to ensure
statistical models conform to real-world vehicle dynamics constraints.
"""

import os
import sys
import unittest
from pathlib import Path

os.environ["MPLCONFIGDIR"] = "/tmp/matplotlib_cache"

root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import numpy as np
import pandas as pd
from pipeline.aero_performance_model import AeroVehiclePerformanceModel
from pipeline.bayesian_tire_updater import BayesianTireUpdater
from pipeline.monte_carlo_solver import run_stochastic_race_solver
from src.strategy_sim import generate_candidate_strategies


class TestF1PhysicsAndPipeline(unittest.TestCase):
    """
    Test suite for F1 domain constraints, vehicle aerodynamics, and Bayesian inference.
    """

    def setUp(self):
        self.aero = AeroVehiclePerformanceModel("monaco")

    def test_aerodynamic_downforce_quadratic_scaling(self):
        """
        Physics Invariant: Aerodynamic downforce must scale quadratically with velocity (F_downforce proportional to v^2).
        Doubling speed from 100 km/h to 200 km/h must yield 4x downforce.
        """
        f_100 = self.aero.compute_aero_forces(speed_kmh=100.0, drs_active=False)["downforce_n"]
        f_200 = self.aero.compute_aero_forces(speed_kmh=200.0, drs_active=False)["downforce_n"]

        ratio = f_200 / f_100
        self.assertAlmostEqual(ratio, 4.0, delta=0.05,
                               msg=f"Aerodynamic downforce does not scale with v^2! Ratio: {ratio}")

    def test_drs_drag_reduction_magnitude(self):
        """
        Physics Invariant: Opening DRS flap must reduce aerodynamic drag by at least 18%.
        """
        drag_off = self.aero.compute_aero_forces(speed_kmh=300.0, drs_active=False)["drag_n"]
        drag_on = self.aero.compute_aero_forces(speed_kmh=300.0, drs_active=True)["drag_n"]

        reduction_pct = (drag_off - drag_on) / drag_off * 100.0
        self.assertGreaterEqual(reduction_pct, 18.0,
                                msg=f"DRS drag reduction insufficient: {reduction_pct:.1f}%")

    def test_dirty_air_wake_decay_monotonicity(self):
        """
        Aerodynamic Wake Constraint: Following downforce loss must decay monotonically
        as the time interval behind the leading car increases.
        """
        loss_05 = self.aero.compute_dirty_air_wake_decay(gap_seconds=0.5)["downforce_loss_pct"]
        loss_12 = self.aero.compute_dirty_air_wake_decay(gap_seconds=1.2)["downforce_loss_pct"]
        loss_25 = self.aero.compute_dirty_air_wake_decay(gap_seconds=2.5)["downforce_loss_pct"]

        self.assertGreater(loss_05, loss_12, "Wake decay not strictly monotonic between 0.5s and 1.2s")
        self.assertGreater(loss_12, loss_25, "Wake decay not strictly monotonic between 1.2s and 2.5s")

    def test_bayesian_variance_contraction(self):
        """
        Statistical Constraint: As additional lap telemetry observations are incorporated,
        the Bayesian posterior variance for tire wear slope must contract (uncertainty shrinks).
        """
        updater = BayesianTireUpdater(compound="MEDIUM", prior_slope=0.030, prior_slope_var=0.02**2)
        initial_std = float(np.sqrt(updater.Sigma_0[0, 0]))

        # Ingest 15 simulated laps
        for lap in range(1, 16):
            updater.update(stint_lap=lap, raw_lap_time=78.5 + lap * 0.03)

        posterior_std = float(np.sqrt(updater.Sigma_N[0, 0]))
        self.assertLess(posterior_std, initial_std,
                        msg=f"Bayesian posterior variance did not shrink! Initial: {initial_std}, Final: {posterior_std}")

    def test_strategy_fia_compliance_and_distance(self):
        """
        FIA Sporting Regulations: Each candidate strategy must sum exactly to race laps
        and must utilize at least two distinct dry compound specifications (Article 30.5).
        """
        total_laps = 78
        strategies = generate_candidate_strategies(total_laps=total_laps)
        self.assertGreaterEqual(len(strategies), 5, "Fewer than 5 candidate strategies generated")

        for strat in strategies:
            sum_laps = sum(stint[1] for stint in strat.stints)
            self.assertEqual(sum_laps, total_laps,
                             f"Strategy {strat.name} sum of laps ({sum_laps}) != race laps ({total_laps})")
            unique_compounds = len(set(strat.compounds))
            self.assertGreaterEqual(unique_compounds, 2,
                                    f"Strategy {strat.name} violates FIA two-compound rule!")

    def test_monte_carlo_solver_ranking(self):
        """
        Stochastic Solver Test: Solves N=100 iterations and verifies fastest strategy has delta = 0.0s.
        """
        meta = {"id": "monaco", "laps": 78, "green_pit_loss": 20.25, "sc_pit_loss": 11.75, "fuel_burn_rate": 0.035, "historical_sc_rate": 0.50}
        models = {
            "SOFT": {"slope": 0.09, "intercept": 77.0, "deg_cliff_lap": 22},
            "MEDIUM": {"slope": 0.035, "intercept": 77.5, "deg_cliff_lap": 38},
            "HARD": {"slope": 0.020, "intercept": 78.0, "deg_cliff_lap": 58}
        }
        res = run_stochastic_race_solver(meta, models, sim_count=100)
        self.assertEqual(res["strategies"][0]["rank"], 1)
        self.assertEqual(res["strategies"][0]["delta_to_best"], 0.0)


if __name__ == "__main__":
    unittest.main()
