"""
F1 Telemetry, Aerodynamics & Race Strategy Data Science Pipeline
================================================================
Production machine learning and stochastic vehicle dynamics package.
"""

from src.tire_model import TrackTireModel, fit_all_compounds, get_degradation_curve
from src.strategy_sim import StrategySimulator, CandidateStrategy
