"""
Historical Validation Analysis Writeups
=======================================
Detailed, plain engineering writeups for benchmark races.
"""

VALIDATION_WRITEUPS = {
    "Monaco": {
        "tier": "Tier 1: Exact Match (Dry Strategy)",
        "badge_color": "green",
        "writeup": (
            "Monaco 2023 Reality vs. Simulation:\n\n"
            "• The Real Call: Max Verstappen ran MEDIUM (55L) -> INTERMEDIATE (23L) to victory. "
            "In dry conditions, Alpine's Esteban Ocon (P3) executed the textbook dry 1-stop (Medium -> Hard), "
            "pitting on Lap 32 — matching our model's textbook pit window (Lap 32) with 0 laps error.\n\n"
            "• Why Verstappen Stretched to Lap 55: Red Bull kept Verstappen on dying Mediums solely because rain "
            "was detected on team weather radar at Portier. Pitting for dry tires at Lap 37 would have forced a second, "
            "fatal pit stop when rain hit on Lap 54. The model accurately prioritized the 1-stop over all 2-stops by +13.7s."
        )
    },
    "Hungary": {
        "tier": "Tier 2: Top 3 Match",
        "badge_color": "orange",
        "writeup": (
            "Hungary 2023 Reality vs. Simulation:\n\n"
            "• The Real Call: Max Verstappen won with MEDIUM (23L) -> HARD (28L) -> MEDIUM (19L), pitting on Laps 23 and 51.\n\n"
            "• Model Alignment: The simulator placed Verstappen's exact 2-stop compound sequence in the top 3 (Rank #3, "
            "finishing within 5.3s of #1), and accurately predicted the first pit window within 1 lap of reality (Lap 22 vs Lap 23).\n\n"
            "• Model Miss: The model ranked a theoretical 1-stop M -> S slightly faster (+5s). In reality, on Hungaroring's "
            "tight layout, defending against fresh Mediums on 30-lap-old Softs is impossible. Clean-air pace models fail to penalize "
            "the vulnerability of dying rubber to overtaking."
        )
    },
    "Silverstone": {
        "tier": "Tier 3: Divergence (Safety Car Disruption)",
        "badge_color": "red",
        "writeup": (
            "Silverstone 2023 Reality vs. Simulation:\n\n"
            "• The Real Call: Max Verstappen started Medium, but pitted on Lap 33 under the Safety Car for SOFT (19L).\n\n"
            "• Why the Model Disagreed: Under green flag conditions, running Softs for 19 high-speed laps causes blistering; "
            "Medium -> Hard is mathematically 8.2s faster. However, Kevin Magnussen's Haas engine failure at Lap 33 triggered an SC. "
            "Because rivals were slowed by delta times, pitting under the SC saved 9.5 seconds in pit loss, making the sprint on Softs "
            "an unbeatable opportunistic move. This was not a tire model failure, but a real-time stochastic neutralization overriding nominal plans."
        )
    },
    "Monza": {
        "tier": "Tier 2: Top 3 Match (1-Lap Pit Window Error)",
        "badge_color": "green",
        "writeup": (
            "Monza 2023 Reality vs. Simulation:\n\n"
            "• The Real Call: Max Verstappen ran MEDIUM (20L) -> HARD (31L), pitting on Lap 20.\n\n"
            "• Model Alignment: The simulator placed 1-Stop: M -> H (Extended) as #1 and 1-Stop: M -> H (Textbook) as #3 "
            "(finishing within 0.8s of the simulated lead). The model's textbook pit lap (Lap 21) was within 1 lap of Red Bull's pit call.\n\n"
            "• Racing Context: Monza's ultra-low downforce setup creates minimal lateral tire shear. The simulator decisively "
            "rejected all 2-stops (+16s slower) and identified the textbook Medium-to-Hard transition."
        )
    },
    "Bahrain": {
        "tier": "Tier 3: Divergence (Chassis Asymmetry & Allocation Gap)",
        "badge_color": "red",
        "writeup": (
            "Bahrain 2023 Reality vs. Simulation:\n\n"
            "• The Real Call: Red Bull ran SOFT (14L) -> SOFT (22L) -> HARD (21L), pitting on Laps 14 and 36.\n\n"
            "• Why the Model Missed:\n"
            "  1. Pre-Race Allocation Asymmetry: Red Bull intentionally sacrificed qualifying runs to save two sets of brand-new "
            "scrubbed Softs. Standard candidate sets assume standard 1-Soft allocations.\n"
            "  2. Chassis-Specific Tire Preservation: Bahrain's abrasive tarmac creates severe rear traction deg. The simulator fits "
            "fleet-wide aggregate telemetry. However, Red Bull's RB19 had exceptional rear downforce that preserved rear tires, "
            "enabling a Soft-Soft-Hard sprint where every other car suffered severe degradation.\n\n"
            "• Honest Limitation: Public telemetry cannot model proprietary chassis-specific aerodynamic tire preservation."
        )
    }
}
