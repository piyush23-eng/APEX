import sys
from pathlib import Path
root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

"""
F1 Race Strategy Simulator - Streamlit Analysis Dashboard
=========================================================

Interactive engineering and statistical analysis tool demonstrating tire degradation
modeling, Monte Carlo strategy simulation, and historical validation using official
FastF1 telemetry.
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go

from src.data_loader import load_race_session, clean_laps_data
from src.tire_model import (
    filter_clean_modeling_laps,
    fit_all_compounds,
    COMPOUND_COLORS
)
from src.strategy_sim import (
    StrategySimulator,
    format_hms
)
from src.validate import (
    BENCHMARK_RACES,
    extract_actual_winner_strategy,
    find_strategy_rank_and_delta
)


# Set clean page configuration
st.set_page_config(
    page_title="F1 Race Strategy Simulator",
    page_icon="🏎️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Styling adjustments for high contrast and readability on screen-shares
st.markdown("""
<style>
    .block-container {
        padding-top: 2rem;
        padding-bottom: 3rem;
        max-width: 1200px;
    }
    .metric-box {
        background-color: #1E222D;
        border: 1px solid #333948;
        border-radius: 6px;
        padding: 14px 18px;
        margin-bottom: 15px;
    }
    .stMetric label {
        font-size: 0.85rem !important;
        color: #A0AAB8 !important;
    }
</style>
""", unsafe_allow_html=True)


# Validation Case Lookup Map
RACE_CONFIGS = {
    f"{c.year} {c.race} GP": c for c in BENCHMARK_RACES
}

# Real-world detailed writeups from validate.py
VALIDATION_WRITEUPS = {
    "Monaco": {
        "tier": "Tier 1: Exact Match (Dry Strategy)",
        "badge_color": "green",
        "writeup": (
            "**Monaco 2023 Reality vs. Simulation:**\n\n"
            "• **The Real Call**: Max Verstappen ran `MEDIUM (55L) -> INTERMEDIATE (23L)` to victory. "
            "In dry conditions, Alpine's Esteban Ocon (P3) executed the textbook dry 1-stop (`Medium -> Hard`), "
            "pitting on **Lap 32** — matching our model's textbook pit window (Lap 32) with **0 laps error**.\n\n"
            "• **Why Verstappen Stretched to Lap 55**: Red Bull kept Verstappen on dying Mediums solely because rain "
            "was detected on team weather radar at Portier. Pitting for dry tires at Lap 37 would have forced a second, "
            "fatal pit stop when rain hit on Lap 54. The model accurately prioritized the 1-stop over all 2-stops by +13.7s."
        )
    },
    "Hungary": {
        "tier": "Tier 2: Top 3 Match",
        "badge_color": "orange",
        "writeup": (
            "**Hungary 2023 Reality vs. Simulation:**\n\n"
            "• **The Real Call**: Max Verstappen won with `MEDIUM (23L) -> HARD (28L) -> MEDIUM (19L)`, pitting on Laps 23 and 51.\n\n"
            "• **Model Alignment**: The simulator placed Verstappen's exact 2-stop compound sequence in the top 3 (Rank #3, "
            "finishing within 5.3s of #1), and accurately predicted the first pit window within **1 lap of reality** (Lap 22 vs Lap 23).\n\n"
            "• **Model Miss**: The model ranked a theoretical 1-stop `M -> S` slightly faster (+5s). In reality, on Hungaroring's "
            "tight layout, defending against fresh Mediums on 30-lap-old Softs is impossible. Clean-air pace models fail to penalize "
            "the vulnerability of dying rubber to overtaking."
        )
    },
    "Silverstone": {
        "tier": "Tier 3: Divergence (Safety Car Disruption)",
        "badge_color": "red",
        "writeup": (
            "**Silverstone 2023 Reality vs. Simulation:**\n\n"
            "• **The Real Call**: Max Verstappen started Medium, but pitted on Lap 33 under the Safety Car for `SOFT (19L)`.\n\n"
            "• **Why the Model Disagreed**: Under green flag conditions, running Softs for 19 high-speed laps causes blistering; "
            "`Medium -> Hard` is mathematically 8.2s faster. However, Kevin Magnussen's Haas engine failure at Lap 33 triggered an SC. "
            "Because rivals were slowed by delta times, pitting under the SC saved 9.5 seconds in pit loss, making the sprint on Softs "
            "an unbeatable opportunistic move. This was not a tire model failure, but a real-time stochastic neutralization overriding nominal plans."
        )
    },
    "Monza": {
        "tier": "Tier 2: Top 3 Match (1-Lap Pit Window Error)",
        "badge_color": "green",
        "writeup": (
            "**Monza 2023 Reality vs. Simulation:**\n\n"
            "• **The Real Call**: Max Verstappen ran `MEDIUM (20L) -> HARD (31L)`, pitting on Lap 20.\n\n"
            "• **Model Alignment**: The simulator placed `1-Stop: M -> H (Extended)` as #1 and `1-Stop: M -> H (Textbook)` as #3 "
            "(finishing within 0.8s of the simulated lead). The model's textbook pit lap (Lap 21) was within **1 lap of Red Bull's pit call**.\n\n"
            "• **Racing Context**: Monza's ultra-low downforce setup creates minimal lateral tire shear. The simulator decisively "
            "rejected all 2-stops (+16s slower) and identified the textbook Medium-to-Hard transition."
        )
    },
    "Bahrain": {
        "tier": "Tier 3: Divergence (Chassis Asymmetry & Allocation Gap)",
        "badge_color": "red",
        "writeup": (
            "**Bahrain 2023 Reality vs. Simulation:**\n\n"
            "• **The Real Call**: Red Bull ran `SOFT (14L) -> SOFT (22L) -> HARD (21L)`, pitting on Laps 14 and 36.\n\n"
            "• **Why the Model Missed**:\n"
            "  1. **Pre-Race Allocation Asymmetry**: Red Bull intentionally sacrificed qualifying runs to save two sets of brand-new "
            "scrubbed Softs. Standard candidate sets assume standard 1-Soft allocations.\n"
            "  2. **Chassis-Specific Tire Preservation**: Bahrain's abrasive tarmac creates severe rear traction deg. The simulator fits "
            "fleet-wide aggregate telemetry. However, Red Bull's RB19 had exceptional rear downforce that preserved rear tires, "
            "enabling a Soft-Soft-Hard sprint where every other car suffered severe degradation.\n\n"
            "• **Honest Limitation**: Public telemetry cannot model proprietary chassis-specific aerodynamic tire preservation."
        )
    }
}


@st.cache_resource(show_spinner=False)
def get_cached_session_and_clean_df(year: int, race: str):
    """Loads session telemetry and cleans laps with caching."""
    session = load_race_session(year, race, "R")
    clean_df = clean_laps_data(session)
    return session, clean_df


# =========================================================================
# SIDEBAR CONTROLS
# =========================================================================
st.sidebar.title("🏁 Strategy Controls")

race_selection_key = st.sidebar.selectbox(
    "Select Track & Grand Prix",
    options=list(RACE_CONFIGS.keys()),
    index=0,
    help="Pulls official telemetry and historical track characteristics"
)
case_cfg = RACE_CONFIGS[race_selection_key]

st.sidebar.markdown("---")
st.sidebar.subheader("🎲 Monte Carlo & Neutralization")

# Safety car probability override slider
sc_prob = st.sidebar.slider(
    "Safety Car Probability",
    min_value=0.0,
    max_value=1.0,
    value=float(case_cfg.historical_sc_rate),
    step=0.05,
    help=f"Historical rate for {case_cfg.race} is {case_cfg.historical_sc_rate*100:.0f}%. Adjust to test strategy sensitivity."
)

# Number of Monte Carlo simulations slider
n_sims = st.sidebar.slider(
    "Monte Carlo Iterations (N)",
    min_value=500,
    max_value=10000,
    value=2000,
    step=500,
    help="Higher iterations increase confidence but require slightly more computation."
)

if n_sims > 4000:
    st.sidebar.warning(f"⚠️ High iteration count ({n_sims:,} runs): simulation will take ~3–5 seconds.")

st.sidebar.markdown("---")
st.sidebar.caption(
    f"**Track Type**: {case_cfg.track_type}\n\n"
    f"**Scheduled Laps**: {case_cfg.laps} Laps\n\n"
    f"**Green Pit Loss**: ~{case_cfg.green_pit_loss:.1f}s | **SC Pit Loss**: ~{case_cfg.sc_pit_loss:.1f}s"
)


# =========================================================================
# LOAD TELEMETRY & RUN SIMULATION
# =========================================================================
with st.spinner(f"Loading official telemetry and executing {n_sims:,} Monte Carlo trials for {case_cfg.race}..."):
    session, clean_df = get_cached_session_and_clean_df(case_cfg.year, case_cfg.race)
    
    # Fit linear tire degradation models
    filtered_laps = filter_clean_modeling_laps(clean_df, fuel_burn_rate=case_cfg.fuel_burn_rate)
    deg_models = fit_all_compounds(filtered_laps, track=case_cfg.race, year=case_cfg.year, fuel_burn_rate=case_cfg.fuel_burn_rate)

    # Initialize and execute simulator
    sim = StrategySimulator(
        track=case_cfg.race,
        year=case_cfg.year,
        total_laps=case_cfg.laps,
        clean_df=clean_df,
        fuel_burn_rate=case_cfg.fuel_burn_rate,
        green_pit_loss=case_cfg.green_pit_loss,
        sc_pit_loss=case_cfg.sc_pit_loss,
        historical_sc_rate=sc_prob
    )
    leaderboard = sim.evaluate_all(n_simulations=n_sims)


# =========================================================================
# MAIN DASHBOARD CONTENT
# =========================================================================
st.title(f"🏁 F1 Race Strategy Simulator: {case_cfg.year} {case_cfg.race} GP")
st.caption(f"Statistical Modeling & Stochastic Optimization using Official FastF1 Telemetry • {case_cfg.laps} Scheduled Laps")

st.markdown("---")

# ---------------- SECTION 1: TIRE DEGRADATION CURVES ----------------
st.subheader("1. 📈 Empirical Tire Degradation Curves (The Raw Signal)")
st.caption(
    f"Cleaned telemetry laps with linear regression fit ($T(a) = T_0 + \\alpha \\cdot a$) per compound. "
    f"Fuel burn-off correction ({case_cfg.fuel_burn_rate:.3f}s/lap) applied to isolate mechanical wear."
)

fig_deg = go.Figure()
max_observed_age = int(filtered_laps["TyreLife"].max()) if not filtered_laps.empty else 45

for comp in ["SOFT", "MEDIUM", "HARD"]:
    comp_laps = filtered_laps[filtered_laps["Compound"] == comp]
    color = COMPOUND_COLORS.get(comp, "#00bcd4")
    m = deg_models[comp]

    # Scatter of actual uncorrupted racing laps
    if not comp_laps.empty:
        fig_deg.add_trace(go.Scatter(
            x=comp_laps["TyreLife"],
            y=comp_laps["FuelCorrectedLapTime"],
            mode="markers",
            name=f"{comp} Telemetry (N={m['sample_size']})",
            marker=dict(color=color, size=5, opacity=0.45)
        ))

    # Fitted linear degradation line
    if m["sample_size"] > 0 or comp in ["MEDIUM", "HARD"]:
        comp_max = int(comp_laps["TyreLife"].max()) if not comp_laps.empty else 35
        age_line = np.linspace(1, max(comp_max, 15), 50)
        pace_line = m["slope"] * age_line + m["intercept"]
        fig_deg.add_trace(go.Scatter(
            x=age_line,
            y=pace_line,
            mode="lines",
            name=f"{comp} Fit ({m['slope']:+.4f}s/lap, R²={m['r2']:.2f})",
            line=dict(color=color, width=2.8)
        ))

fig_deg.update_layout(
    template="plotly_dark",
    xaxis_title="Tire Age (Laps Driven on Set)",
    yaxis_title="Fuel-Corrected Lap Time (seconds)",
    height=400,
    margin=dict(l=30, r=20, t=30, b=30),
    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
)
st.plotly_chart(fig_deg, use_container_width=True)


# ---------------- SECTION 2: STRATEGY RANKINGS & DISTRIBUTIONS ----------------
st.markdown("---")
st.subheader("2. 📊 Strategy Leaderboard & Outcome Distributions")
st.caption(f"Evaluated across {n_sims:,} Monte Carlo trials incorporating pit loss jitter and Safety Car probability ({sc_prob*100:.0f}%).")

col_table, col_box = st.columns([1.1, 1.3])

with col_table:
    st.markdown("**Ranked Candidate Strategies (Expected Race Time)**")
    
    # Leaderboard table formatting
    display_df = leaderboard[[
        "Rank", "name", "stops", "pit_laps", "mean_time", "DeltaToBest", "std_dev", "iqr"
    ]].copy()
    
    display_df["FormattedTime"] = display_df["mean_time"].apply(format_hms)
    display_df["Delta"] = display_df["DeltaToBest"].apply(lambda d: "LEADER" if d == 0.0 else f"+{d:.2f}s")
    display_df["Risk (σ)"] = display_df["std_dev"].apply(lambda s: f"±{s:.2f}s")
    display_df["Spread (IQR)"] = display_df["iqr"].apply(lambda i: f"{i:.2f}s")
    
    view_cols = display_df[["Rank", "name", "stops", "pit_laps", "FormattedTime", "Delta", "Risk (σ)", "Spread (IQR)"]]
    view_cols.columns = ["Rank", "Strategy", "Stops", "Pit Laps", "Expected Time", "Delta", "Risk (σ)", "Spread (IQR)"]
    st.dataframe(view_cols, use_container_width=True, hide_index=True)

with col_box:
    st.markdown("**Outcome Distribution for Top 3 Strategies (Variance Spread)**")
    
    top3_df = leaderboard.head(3)
    best_overall_mean = leaderboard.iloc[0]["mean_time"]
    
    # Build dataframe for distribution box plot
    dist_records = []
    for _, row in top3_df.iterrows():
        strat_label = f"#{row['Rank']} {row['name']}"
        # Measure relative seconds to the fastest expected time for legible axes
        rel_seconds = row["sim_times"] - best_overall_mean
        for val in rel_seconds:
            dist_records.append({
                "Strategy": strat_label,
                "Relative Race Time (seconds)": val,
                "Stops": f"{row['stops']}-Stop"
            })

    df_dist = pd.DataFrame(dist_records)
    
    fig_box = px.box(
        df_dist,
        x="Strategy",
        y="Relative Race Time (seconds)",
        color="Stops",
        color_discrete_map={"1-Stop": "#00E676", "2-Stop": "#FF9100"},
        points=False
    )
    fig_box.update_layout(
        template="plotly_dark",
        yaxis_title="Delta to Nominal Winner (seconds)",
        xaxis_title="",
        height=380,
        margin=dict(l=30, r=20, t=30, b=30),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
    )
    st.plotly_chart(fig_box, use_container_width=True)


# ---------------- SECTION 3: DECISION CALLOUTS ----------------
best_avg = leaderboard.sort_values(by="mean_time").iloc[0]
safest = leaderboard.sort_values(by="std_dev").iloc[0]

col_kpi1, col_kpi2 = st.columns(2)

with col_kpi1:
    st.info(
        f"🥇 **Best on Average (Lowest Expected Time)**\n\n"
        f"**{best_avg['name']}**  \n"
        f"Expected Time: **{format_hms(best_avg['mean_time'])}**  \n"
        f"Pit Laps: `{best_avg['pit_laps']}` | Risk: `±{best_avg['std_dev']:.2f}s`"
    )

with col_kpi2:
    if best_avg["name"] == safest["name"]:
        st.success(
            f"🛡️ **Safest / Lowest Variance**\n\n"
            f"**{safest['name']}** *(Unanimous Winner)*  \n"
            f"Lowest Variance: `±{safest['std_dev']:.2f}s` (IQR: `{safest['iqr']:.2f}s`). Dominates on both pace and safety."
        )
    else:
        time_diff = safest["mean_time"] - best_avg["mean_time"]
        risk_diff = best_avg["std_dev"] - safest["std_dev"]
        st.warning(
            f"🛡️ **Safest / Lowest Variance**\n\n"
            f"**{safest['name']}**  \n"
            f"Risk: `±{safest['std_dev']:.2f}s` (IQR: `{safest['iqr']:.2f}s`).  \n"
            f"Trades `{time_diff:.2f}s` in expected pace to reduce outcome volatility by `±{risk_diff:.2f}s`."
        )


# ---------------- SECTION 4: HISTORICAL VALIDATION REPORT ----------------
st.markdown("---")
st.subheader("3. 📋 Historical Validation & Reality Benchmark")

actual_winner = extract_actual_winner_strategy(session, clean_df)
sim_rank, matched_row, pit_err, matched_name = find_strategy_rank_and_delta(leaderboard, actual_winner, case_cfg.race)
val_info = VALIDATION_WRITEUPS.get(case_cfg.race, {
    "tier": "Benchmark Evaluation",
    "badge_color": "blue",
    "writeup": "Validation data available."
})

val_col_l, val_col_r = st.columns([1, 1.4])

with val_col_l:
    st.markdown(f"**Actual Winner's Strategy ({case_cfg.year} {case_cfg.race})**")
    st.markdown(
        f"""
        <div class="metric-box">
            <b>Winner</b>: {actual_winner['driver']} ({actual_winner['team']})<br>
            <b>Actual Stints</b>: <code>{actual_winner['stints_str']}</code><br>
            <b>Actual Pit Laps</b>: <code>{actual_winner['pit_laps']}</code><br>
            <b>Model Ranking for Winning Plan</b>: <b>Rank #{sim_rank}</b><br>
            <b>Pit Lap Error</b>: {pit_err:.0f} Lap(s)
        </div>
        """,
        unsafe_allow_html=True
    )
    
    tier_label = val_info["tier"]
    if "Tier 1" in tier_label:
        st.success(f"🎯 **{tier_label}**")
    elif "Tier 2" in tier_label:
        st.warning(f"🟡 **{tier_label}**")
    else:
        st.error(f"❌ **{tier_label}**")

with val_col_r:
    st.markdown("**Honest Engineering Analysis & Discrepancy Writeup:**")
    st.markdown(val_info["writeup"])


# ---------------- SECTION 5: MODEL ASSUMPTIONS & LIMITATIONS ----------------
st.markdown("---")
with st.expander("⚠️ Model Assumptions & Engineering Limitations (Read Before Deciding)"):
    st.markdown("""
    This simulator operates strictly on public timing loops and GPS traces from FastF1.
    While effective for identifying compound crossovers and pit windows, key domain simplifications exist:
    
    1. **No Aerodynamic or Dirty Air Modeling**:
       - Following another car within 1.5s reduces front downforce by ~25%, causing thermal surface sliding that accelerates tire degradation.
       - The simulator evaluates **clean-air pace**. On tracks with high overtaking deltas (e.g. Monaco > 2.5s), teams intentionally accept a slower average lap time to avoid traffic.
       
    2. **Fleet-Average vs. Chassis-Specific Conservation**:
       - Degradation curves are fit across the entire grid. Top-tier cars (e.g., Red Bull RB19) generate significantly more downforce with lower slip angles, preserving tires far longer than backmarker teams.
       
    3. **Pre-Race Tire Allocation Asymmetries**:
       - The candidate generator assumes standard Pirelli allocations. It cannot detect if a team sacrificed qualifying to preserve brand-new scrubbed sets for race day (as Red Bull did with Softs in Bahrain 2023).
       
    4. **Unpredictable Weather and Red Flags**:
       - Rain (Monaco Lap 54) or red flags scramble strategy windows in ways stochastic simulations can only model as probability bounds, requiring dynamic real-time re-optimization on pit wall.
    """)
