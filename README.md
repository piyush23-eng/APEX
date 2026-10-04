# Formula 1 Race Strategy & Vehicle Telemetry Machine Learning Engine
> **Applied Data Science, Aerodynamics & Stochastic Monte Carlo Optimization for Real-Time Pit-Wall Operations**

[![FastF1 Direct](https://img.shields.io/badge/FastF1-v3.8.3%20SECU%20Direct-e10600?style=flat&logo=formula1)](https://github.com/theOehrly/Fast-F1)
[![Scikit-Learn ML](https://img.shields.io/badge/Scikit--Learn-Huber%20M--Estimator-F7931E?style=flat&logo=scikitlearn)](https://scikit-learn.org/)
[![Bayesian Inference](https://img.shields.io/badge/Bayesian-Online%20Updating-blue?style=flat)](#in-race-bayesian-online-updating)
[![Unit Tests](https://img.shields.io/badge/Tests-6%20Passed%20(0.002s)-00E676?style=flat)](tests/test_physics_and_pipeline.py)
[![React Vite UI](https://img.shields.io/badge/Console-React%20%2B%20Vite%204173-61DAFB?style=flat&logo=react)](frontend/)

---

## 1. Executive Summary & Architecture

This repository delivers an end-to-end Formula 1 vehicle performance, aerodynamics, and race strategy decision engine. Operating directly on official 10Hz CAN-bus telemetry extracted via the **FastF1 API**, the engine bridges vehicle dynamics and pit-wall tactical strategy:
1. **Feature Engineering**: Normalizes raw lap times for fuel mass burn-off ($-0.035$ to $-0.055$ s/lap) to unmask true mechanical compound degradation.
2. **Machine Learning & Robust Statistics**: Replaces naive OLS with Scikit-Learn’s **Huber loss M-estimator** ($\delta=1.345$) to reject high-leverage outliers caused by blue-flag lifts and traffic bunching.
3. **Aerodynamics & Dirty Air**: Couples ground-effect Venturi tunnel downforce loss ($\Delta C_L = -0.35 \cdot e^{-\Delta t / 0.85}$) directly to cornering slip angle and thermal tire wear acceleration in follow mode.
4. **Stochastic Monte Carlo Optimization**: Simulates $N=1,000$ race trajectories per candidate strategy incorporating Bernoulli Safety Car events and Gaussian pit execution jitter ($\mu=2.45\text{s}, \sigma=0.30\text{s}$).
5. **In-Race Bayesian Updating**: Ingests live telemetry lap-by-lap, updating conjugate Gaussian posteriors ($\mu_N, \Sigma_N$) to flag premature degradation cliffs.
6. **Ground-Truth Validation**: Empirically benchmarked against 5 official 2023 FIA Grand Prix outcomes with post-race telemetry audits.

```
                         FASTF1 10Hz CAN-BUS INGESTION
                   (Speed, RPM, Gear, Throttle, Brake, DRS)
                                     │
                                     ▼
                      PHYSICS-BASED FUEL NORMALIZATION
                    T_corr = T_raw + (Lap - 1) * Beta_fuel
                                     │
                  ┌──────────────────┴──────────────────┐
                  ▼                                     ▼
        HUBER M-ESTIMATOR REGRESSION          AERODYNAMIC WAKE COUPLING
         L_delta(r) (delta = 1.345)           Delta_CL = -0.35 * exp(-gap/0.85)
     Tire Degradation Slope (alpha_deg)       Tire Wear Acceleration (1.25x)
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                     VECTORIZED MONTE CARLO SOLVER
                     N = 1,000 Stochastic Iterations
                   Safety Car Injection & Pit Jitter
                                     │
                  ┌──────────────────┴──────────────────┐
                  ▼                                     ▼
         PARETO FRONTIER RANKING             IN-RACE BAYESIAN UPDATER
           Expected Mean E[T]                 Posterior mu_N, Sigma_N
             vs IQR Risk Bound                  Dynamic Undercut Call
                                     │
                                     ▼
                        TACTICAL TELEMETRY CONSOLE
                  (React + Vite + Recharts @ Port 4173)
```

---

## 2. Mathematical Formulations

### 2.1 Dynamic Fuel-Mass Correction
Modern F1 cars start the Grand Prix with up to 110 kg of fuel and consume $\approx 1.5 - 1.8\text{ kg/lap}$. Weight loss yields an empirical pace gain of $-0.035$ to $-0.055\text{ s/lap}$. Uncorrected telemetry confounds mass reduction with rubber degradation. We isolate true mechanical wear:
$$T_{\text{corrected}} = T_{\text{raw}} + (\text{Lap} - 1) \cdot \beta_{\text{fuel}}$$

### 2.2 Huber Loss M-Estimator Robust Regression
Standard Ordinary Least Squares (OLS) minimizes $\sum r_i^2$, making it vulnerable to heavy-tailed positive outliers (traffic lifts, yellow-flag sectors). We solve for wear gradient $\alpha$ via Huber M-estimation:
$$\mathcal{L}_{\delta}(r) = \begin{cases} 
\frac{1}{2} r^2 & \text{for } |r| \le \delta \\
\delta \left(|r| - \frac{1}{2}\delta\right) & \text{for } |r| > \delta
\end{cases} \quad (\delta = 1.345)$$

### 2.3 Aerodynamic Ground-Effect & Dirty-Air Wake Turbulence
Downforce and drag are calculated from aerodynamic dynamic pressure:
$$F_{\text{downforce}} = \frac{1}{2} \rho v^2 C_L A, \quad F_{\text{drag}} = \frac{1}{2} \rho v^2 C_D A$$
When following within a rival chassis turbulent wake ($\Delta t < 1.5\text{s}$), front wing downforce decays exponentially:
$$\Delta C_L(\Delta t) = -0.35 \cdot \exp\left(-\frac{\Delta t}{0.85}\right)$$
This downforce deficit forces the driver to increase cornering slip angle, increasing frictional surface heating and accelerating compound degradation:
$$\alpha_{\text{dirty}} = \alpha_{\text{clean}} \cdot \left(1.0 + 0.35 \cdot \exp\left(-\frac{\Delta t}{0.90}\right)\right)$$

### 2.4 In-Race Bayesian Online Learning
Prior beliefs about tire wear gradient $\mathbf{w} = [\alpha, T_0]^T$ are updated with each completed lap:
$$\mathbf{\Sigma}_N^{-1} = \mathbf{\Sigma}_0^{-1} + \sigma^{-2} \mathbf{X}^T \mathbf{X}$$
$$\boldsymbol{\mu}_N = \mathbf{\Sigma}_N \left(\mathbf{\Sigma}_0^{-1} \boldsymbol{\mu}_0 + \sigma^{-2} \mathbf{X}^T \mathbf{y}\right)$$

---

## 3. Ground-Truth FIA Validation Benchmarks

The simulator was audited against 5 official 2023 FIA Grand Prix outcomes:

| Circuit | Characteristics | Ground-Truth Winner Strategy | Solver Top Prediction | Tier | Analysis Summary |
|---|---|---|---|:---:|---|
| **Monaco** | Street / Track Position Dominant | **VER**: M (55L) $\to$ I (23L) *(Rain L54)* | `1-Stop: M -> H (Extended)` (Pit L37) | **Tier 1** | Matched textbook dry pit window (Ocon P3 stopped Lap 32). Decisively rejected 2-stops (+13.7s slower). |
| **Hungary** | High Thermal Deg / High Downforce | **VER**: M (23L) $\to$ H (28L) $\to$ M (19L) | `2-Stop: M -> H -> M (Balanced)` (Pit L22, L47) | **Tier 1** | Predicted exact 2-stop compound sequence and predicted 1st pit lap within 1 lap (Lap 22 vs Lap 23). |
| **Silverstone** | High-Speed Lateral Shear | **VER**: M (33L) $\to$ S (19L) *(SC Lap 33)* | `1-Stop: M -> H (Extended)` (Pit L25) | **Tier 2** | Pre-race nominal model preferred Medium $\to$ Hard; Haas engine fire deployed SC on Lap 33, granting a free stop on Softs. |
| **Monza** | Temple of Speed / Low Deg | **VER**: M (20L) $\to$ H (31L) | `1-Stop: M -> H (Extended)` (Pit L20) | **Tier 1** | Predicted exact 1-stop strategy and exact winning pit lap (Lap 20). 2-stops rejected (+16s). |
| **Bahrain** | Rough Granite / Rear Traction Deg | **VER**: S (14L) $\to$ S (22L) $\to$ H (21L) | `1-Stop: H -> M (Overcut)` (Pit L39) | **Tier 3** | Fleet regression missed Red Bull's proprietary rear aerodynamic preservation and scrubbed Soft allocation. |

---

## 4. Repository Structure

```
├── api/
│   └── main.py                     # FastAPI backend REST service (/simulate, /aerodynamics, /validate)
├── pipeline/
│   ├── __init__.py                 # Pipeline package exports
│   ├── tire_degradation_huber.py   # Scikit-Learn HuberRegressor M-estimation & outlier masking
│   ├── aero_performance_model.py   # Aerodynamic downforce, drag, DRS, and dirty-air wake decay
│   ├── monte_carlo_solver.py       # Vectorized NumPy stochastic simulation engine (N=1,000)
│   ├── bayesian_tire_updater.py    # In-race online Bayesian inference updating
│   └── run_pipeline.py             # Master CLI pipeline executing end-to-end across circuits
├── notebooks/
│   ├── 01_f1_telemetry_strategy_ml.ipynb  # 13-cell publication-grade notebook with LaTeX derivations
│   └── 01_telemetry_exploration.py        # Standalone exploratory telemetry script
├── tests/
│   └── test_physics_and_pipeline.py       # Automated unit test suite (6 domain physics constraints)
├── src/
│   ├── data_loader.py              # FastF1 session loader, cache manager, and lap cleaner
│   ├── strategy_sim.py             # Strategy data structures and candidate generator
│   ├── tire_model.py               # Robust tire model with TrackTireModel wrapper
│   └── validate.py                 # Ground-truth FIA benchmark audit engine
├── frontend/                       # Interactive telemetry console (React + Vite + Recharts)
│   ├── src/
│   │   ├── components/
│   │   │   ├── FastF1TelemetryChannels.jsx     # 10Hz CAN-bus telemetry trace viewer
│   │   │   ├── LiveTimingTower.jsx             # S1/S2/S3 microsectors & speed traps
│   │   │   ├── UndercutOvercutSimulator.jsx    # Real-time pit window tactical solver
│   │   │   ├── TireThermalTelemetry.jsx        # Carcass operating range & aero wake slider
│   │   │   └── StrategySensitivityHeatmap.jsx  # 2D scenario matrix (wear vs SC probability)
│   │   └── App.jsx                             # Primary mission control console
│   └── package.json
└── requirements.txt
```

---

## 5. Quickstart & CLI Execution

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Full Machine Learning Pipeline
Executes FastF1 telemetry ingestion, Huber regression, aero coupling, and Monte Carlo solver across all 5 Grand Prix targets:
```bash
python -m pipeline.run_pipeline --tracks monaco hungary silverstone monza bahrain --sims 1000
```

### 3. Run Automated Physics & Integrity Tests
```bash
python -m unittest tests/test_physics_and_pipeline.py
```
*Output: `Ran 6 tests in 0.002s - OK`*

### 4. Run In-Race Bayesian Updating Demo
```bash
python pipeline/bayesian_tire_updater.py
```

### 5. Launch Interactive Telemetry Console
```bash
cd frontend
npm install
npm run build
npx vite preview --port 4173
```
*Console live at: `http://localhost:4173/`*
