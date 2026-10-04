"""
Aerodynamics, Vehicle Performance & Dirty-Air Wake Dynamics Module
===================================================================
Models the intersection of aerodynamic development, vehicle kinematics,
and tire degradation to optimize pit-wall race strategy decisions.

Formulations:
1. Aerodynamic Downforce:
   F_downforce = 0.5 * rho * v^2 * C_L * A
2. Aerodynamic Drag:
   F_drag = 0.5 * rho * v^2 * C_D * A
3. DRS Aerodynamic Drag Reduction:
   Delta_CD_DRS = -0.22  (yielding +12 to +18 km/h top speed on main straights)
4. Turbulent Wake Downforce Decay in Follow Mode (Dirty Air):
   Delta_CL(gap_s) = -0.35 * exp(-gap_s / 0.85)
5. Dirty-Air Micro-Slip Induced Tire Wear Penalty:
   alpha_dirty = alpha_clean * (1.0 + 0.35 * exp(-gap_s / 0.90))
"""

from typing import Dict, Any, List, Optional
import numpy as np


# Air density at 25°C sea level (kg/m³)
AIR_DENSITY_RHO = 1.184
# Frontal reference area (m²)
FRONTAL_AREA_A = 1.55


# Circuit Aerodynamic Configurations
CIRCUIT_AERO_SPECS = {
    "monaco": {
        "downforce_level": "Maximum Downforce (High Drag)",
        "wing_angle_deg": 38.5,
        "cl_clean": 3.85,
        "cd_clean": 1.25,
        "drs_efficiency_gain_kmh": 11.2,
        "drs_cd_reduction": 0.20,
        "dirty_air_sensitivity": 0.38,  # Critical due to slow corners & low cooling airflow
        "clean_air_traffic_release_bonus_s": 1.45
    },
    "hungary": {
        "downforce_level": "High Downforce",
        "wing_angle_deg": 34.0,
        "cl_clean": 3.65,
        "cd_clean": 1.18,
        "drs_efficiency_gain_kmh": 13.5,
        "drs_cd_reduction": 0.22,
        "dirty_air_sensitivity": 0.32,
        "clean_air_traffic_release_bonus_s": 1.30
    },
    "silverstone": {
        "downforce_level": "Medium-High Downforce (High Lateral Load)",
        "wing_angle_deg": 28.0,
        "cl_clean": 3.25,
        "cd_clean": 1.05,
        "drs_efficiency_gain_kmh": 16.8,
        "drs_cd_reduction": 0.24,
        "dirty_air_sensitivity": 0.35,  # High speed Copse/Maggotts/Becketts tire shear
        "clean_air_traffic_release_bonus_s": 1.60
    },
    "monza": {
        "downforce_level": "Ultra-Low Downforce (Skinny Wing)",
        "wing_angle_deg": 14.5,
        "cl_clean": 2.15,
        "cd_clean": 0.72,
        "drs_efficiency_gain_kmh": 18.5,
        "drs_cd_reduction": 0.26,
        "dirty_air_sensitivity": 0.20,  # Straight-line slipstreaming overrides downforce loss
        "clean_air_traffic_release_bonus_s": 0.85
    },
    "bahrain": {
        "downforce_level": "Medium Downforce (Traction Limited)",
        "wing_angle_deg": 30.0,
        "cl_clean": 3.35,
        "cd_clean": 1.10,
        "drs_efficiency_gain_kmh": 15.2,
        "drs_cd_reduction": 0.23,
        "dirty_air_sensitivity": 0.30,
        "clean_air_traffic_release_bonus_s": 1.25
    }
}


class AeroVehiclePerformanceModel:
    """
    Evaluates aerodynamic downforce, drag, DRS opening benefits,
    and dirty-air wake decay penalties on vehicle dynamics and tire life.
    """
    def __init__(self, track_id: str = "monaco"):
        self.track_id = track_id.lower()
        self.specs = CIRCUIT_AERO_SPECS.get(self.track_id, CIRCUIT_AERO_SPECS["monaco"])

    def compute_aero_forces(self, speed_kmh: float, drs_active: bool = False) -> Dict[str, float]:
        """
        Computes instantaneous aerodynamic lift (downforce) and drag in Newtons.
        """
        v_ms = speed_kmh / 3.6
        dynamic_pressure = 0.5 * AIR_DENSITY_RHO * (v_ms ** 2)

        cd = self.specs["cd_clean"] * (1.0 - self.specs["drs_cd_reduction"]) if drs_active else self.specs["cd_clean"]
        cl = self.specs["cl_clean"] * 0.92 if drs_active else self.specs["cl_clean"]

        f_downforce_n = dynamic_pressure * cl * FRONTAL_AREA_A
        f_drag_n = dynamic_pressure * cd * FRONTAL_AREA_A

        # Downforce in kg equivalent
        downforce_kg = f_downforce_n / 9.81

        return {
            "speed_kmh": speed_kmh,
            "drs_active": drs_active,
            "downforce_n": round(f_downforce_n, 1),
            "downforce_kg": round(downforce_kg, 1),
            "drag_n": round(f_drag_n, 1),
            "cl": round(cl, 3),
            "cd": round(cd, 3)
        }

    def compute_dirty_air_wake_decay(self, gap_seconds: float) -> Dict[str, float]:
        """
        Models downforce decay and tire degradation acceleration when following a rival chassis.
        """
        gap = max(0.2, float(gap_seconds))
        sensitivity = self.specs["dirty_air_sensitivity"]

        # Exponential decay of dirty air wake vortex
        downforce_loss_pct = min(40.0, sensitivity * 100.0 * np.exp(-gap / 0.85))
        effective_cl = self.specs["cl_clean"] * (1.0 - (downforce_loss_pct / 100.0))

        # Tire slip heating & degradation acceleration multiplier
        # Micro-slip increases front-axle scrubbing wear by up to 35%
        wear_multiplier = 1.0 + (sensitivity * np.exp(-gap / 0.90))

        # Pace loss purely from aerodynamic instability (seconds per lap)
        aero_time_deficit_s = (downforce_loss_pct / 100.0) * 1.85

        return {
            "gap_seconds": gap,
            "downforce_loss_pct": round(downforce_loss_pct, 1),
            "effective_cl": round(effective_cl, 3),
            "wear_acceleration_multiplier": round(wear_multiplier, 3),
            "aero_time_deficit_s": round(aero_time_deficit_s, 2),
            "clean_air_state": "DIRTY AIR (CRITICAL WAKE)" if gap < 0.9 else (
                "FOLLOWING WAKE (TURBULENT)" if gap < 1.8 else "CLEAN AIR (ISOLATED)"
            )
        }

    def get_circuit_aero_summary(self) -> Dict[str, Any]:
        """
        Returns full aerodynamic configuration summary for pit-wall decision support.
        """
        at_150_kmh = self.compute_aero_forces(150.0, drs_active=False)
        at_300_kmh_drs_off = self.compute_aero_forces(300.0, drs_active=False)
        at_300_kmh_drs_on = self.compute_aero_forces(300.0, drs_active=True)

        return {
            "track_id": self.track_id,
            "downforce_level": self.specs["downforce_level"],
            "wing_angle_deg": self.specs["wing_angle_deg"],
            "cl_clean": self.specs["cl_clean"],
            "cd_clean": self.specs["cd_clean"],
            "drs_efficiency_delta_kmh": self.specs["drs_efficiency_gain_kmh"],
            "downforce_at_150kmh_kg": at_150_kmh["downforce_kg"],
            "downforce_at_300kmh_kg": at_300_kmh_drs_off["downforce_kg"],
            "drag_reduction_drs_pct": round(self.specs["drs_cd_reduction"] * 100.0, 1),
            "drag_at_300kmh_drs_off_n": at_300_kmh_drs_off["drag_n"],
            "drag_at_300kmh_drs_on_n": at_300_kmh_drs_on["drag_n"],
            "clean_air_traffic_release_bonus_s": self.specs["clean_air_traffic_release_bonus_s"]
        }


if __name__ == "__main__":
    print("\n🏎️ TESTING AERODYNAMICS & DIRTY-AIR WAKE ENGINE...")
    aero = AeroVehiclePerformanceModel("monaco")
    summary = aero.get_circuit_aero_summary()
    print(f"Track: Monaco | Downforce: {summary['downforce_level']} ({summary['wing_angle_deg']}°)")
    print(f"  Downforce @ 150 km/h: {summary['downforce_at_150kmh_kg']} kg | @ 300 km/h: {summary['downforce_at_300kmh_kg']} kg")
    print(f"  DRS Drag Reduction: -{summary['drag_reduction_drs_pct']}% | Top Speed Delta: +{summary['drs_efficiency_delta_kmh']} km/h")
    
    print("\n  Evaluating Dirty Air Wake Downforce Decay vs Following Gap:")
    for gap in [0.5, 0.8, 1.2, 1.8, 2.5]:
        decay = aero.compute_dirty_air_wake_decay(gap)
        print(f"    Gap {gap:.1f}s -> Downforce Loss: -{decay['downforce_loss_pct']}% | Tire Wear Multiplier: {decay['wear_acceleration_multiplier']}x | Status: {decay['clean_air_state']}")
    print("✅ Aerodynamics Performance Engine Operational!\n")
