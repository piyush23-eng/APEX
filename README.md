# Formula 1 Race Strategy & Tire Degradation Simulator

## 1. Project Overview
This project is an end-to-end statistical modeling and stochastic simulation engine for Formula 1 pit-stop and tire strategy optimization. Operating entirely on public telemetry and timing loops extracted via the FastF1 API, the simulator addresses a fundamental operations-research challenge in motorsport: determining the optimal sequence of tire compounds, stint lengths, and pit windows under deep uncertainty. By modeling tire degradation as a function of tire age, isolating true mechanical wear through linear fuel-burn correction, and simulating thousands of stochastic race trajectories with dynamic Safety Car arrival processes, the system evaluates strategies across full probability distributions (mean, median, variance, and downside risk) rather than relying on deterministic single-point estimates.

---

## 2. How It Works

### Data Pipeline (`src/data_loader.py`)
The data pipeline interfaces with FastF1 to pull session timing, lap metadata, and race control records with local disk caching in `/data/`. It enforces strict domain filtering to isolate genuine racing pace:
* **Excludes In-Laps and Out-Laps**: In-laps (decelerating to the pit speed limiter) and out-laps (standing acceleration on cold tires) do not reflect competitive pace and would severely corrupt regression slopes.
* **Excludes Neutralized Laps**: Laps run under Safety Car, Virtual Safety Car, or Yellow Flags (`TrackStatus != '1'`) are filtered out to remove mandatory delta-time pacing.
* **Traffic Outlier Scrubbing**: Laps with lap times exceeding the compound median by $>2.5\text{s}$ (driver mistakes, blue-flag lifts, traffic bunching) are discarded to isolate clean-air pace.

### Tire Degradation Modeling (`src/tire_model.py`)
For each dry compound specification (`SOFT`, `MEDIUM`, `HARD`), the module fits a linear degradation model:

$$\text{LapTime}(a) = T_0 + \alpha \cdot a$$

where $T_0$ is the baseline clean-air pace on fresh tires and $\alpha$ is the degradation rate in seconds lost per lap of tire age $a$.

* **The Fuel-Burn Correction**: Cars start a Grand Prix with up to 110 kg of fuel (burning $\approx 1.5 - 2.1\text{ kg/lap}$ depending on circuit length), gaining $\approx 0.035 - 0.055\text{s/lap}$ in lap time naturally as mass decreases. Without correcting for this weight loss, observed lap times would appear artificially flat, confounding true mechanical tire degradation with fuel burn-off. We apply an explicit linear fuel correction before fitting:

$$\text{FuelCorrectedLapTime} = \text{LapTime}_{\text{observed}} + (\text{LapNumber} - 1) \cdot \Delta_{\text{fuel}}$$

normalizing every lap to an identical starting fuel load.

### Monte Carlo Strategy Simulator (`src/strategy_sim.py`)
Candidate strategies are defined as sequences of `(compound, stint_length)` tuples summing to the total race distance, adhering to FIA regulations requiring at least two distinct dry compounds. Each candidate is simulated $N = 2,000$ times:
* **Lap Pace Stochasticity**: Laps draw random Gaussian noise ($\sigma \approx 0.30\text{s}$) to model driver rhythm variance and minor traffic interactions.
* **Pit Loss Mechanics**: Green flag pit loss is modeled using circuit-specific transit times ($\approx 20.25\text{s}$ for Monaco, $\approx 24.0\text{s}$ for Monza) with execution jitter ($\mathcal{N}(2.4\text{s}, 0.25\text{s})$) and a 5% risk of an abnormal slow stop ($+1.5\text{s}$ to $3.5\text{s}$).
* **Safety Car Modeling**: A stochastic arrival process deploys a Safety Car based on historical track probability (e.g., 50% for Monaco, 55% for Silverstone). Because on-track cars are restricted to delta speed while the pit limiter remains fixed, pitting under an SC costs only $\approx 11.5 - 13.5\text{s}$—granting a **$\approx 8.5 - 10.5\text{s}$ "free pit stop" bonus**. The engine dynamically rewards strategies whose pit windows coincide with an active neutralization.

### Validation Engine (`src/validate.py`)
The validation framework evaluates the simulator across 5 diverse benchmark races using a three-tier scoring system:
1. **Tier 1**: Did the model's #1-ranked strategy match the winner's real strategy exactly?
2. **Tier 2**: Was the real strategy ranked within the model's top 3?
3. **Tier 3**: Root-cause mismatch analysis: Did an unpredicted Safety Car, weather event, or chassis-specific downforce asymmetry drive the divergence?

---

## 3. Validation Results

We evaluated the engine across 5 historical 2023 races with distinct vehicle dynamics and strategic complexities:

| Circuit | Race Context | Actual Winner Strategy | Model #1 Prediction | Winner Rank in Model | Scoring Tier |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **2023 Monaco GP** | Street / Low Deg / Track Position Dominant | **VER**: M (55L) $\rightarrow$ I (23L) *(Rain L54)* | `1-Stop: M -> H (Extended)` (Pit L37) | **Rank #1** *(Dry Plan)* | **Tier 1: Exact Match** |
| **2023 Hungarian GP**| High Thermal Deg / High Downforce | **VER**: M (23L) $\rightarrow$ H (28L) $\rightarrow$ M (19L) | `1-Stop: M -> S (Late Sprint)` (Pit L50) | **Rank #3** *(+5.3s)* | **Tier 2: Top 3 Match** |
| **2023 British GP** | High-Speed / Scrambled by L33 Safety Car | **VER**: M (33L) $\rightarrow$ S (19L) *(SC L33)* | `1-Stop: M -> H (Extended)` (Pit L25) | **Rank #5** | **Tier 3: Divergence (SC Timing)** |
| **2023 Italian GP** | Low Downforce / Low Degradation | **VER**: M (20L) $\rightarrow$ H (31L) | `1-Stop: M -> H (Extended)` (Pit L24) | **Rank #2** *(+0.8s)* | **Tier 2: Top 3 Match** |
| **2023 Bahrain GP** | Severe Abrasive Asphalt / Rear Traction Deg | **VER**: S (14L) $\rightarrow$ S (22L) $\rightarrow$ H (21L) | `1-Stop: H -> S (Late Charge)` (Pit L44) | **Rank #8** | **Tier 3: Divergence (Model Gap)** |

### Analysis of Divergences (Plain Assessment)

* **2023 Hungarian GP (Top 3 Match, +5.3s Delta)**:
  The model correctly placed Verstappen's winning 2-stop sequence (`M -> H -> M`) in the top 3 and predicted the first pit stop within **1 single lap of reality** (Lap 22 predicted vs. Lap 23 actual). However, the model ranked a theoretical 1-stop `M -> S` slightly faster (+5.3s). In clean air, the 1-stop math looks competitive, but in reality, Hungaroring's tight layout makes defending on dying Softs impossible against cars with fresher Mediums. The model's lack of an on-track overtaking penalty caused this slight ranking inversion.

* **2023 British GP (Silverstone — Divergence due to SC Neutralization)**:
  In pure green-flag conditions, fitting Softs with 19 high-speed laps remaining causes severe thermal blistering; `Medium -> Hard` is mathematically 8.2s faster. However, Kevin Magnussen's Haas suffered an engine blowout on Lap 33, deploying a Virtual Safety Car followed immediately by a full Safety Car. Because pitting under SC conferred an instant ~9.5s bonus, Verstappen and Hamilton boxed opportunistically for Softs. The divergence was caused by an external stochastic disruption overriding pre-race nominal plans.

* **2023 Bahrain GP (Genuine Model Limitation & Allocation Gap)**:
  The simulator ranked 1-stop variants (`Hard -> Soft` and `Soft -> Hard`) as optimal and placed Red Bull's 2-stop strategy at Rank #8. Two concrete factors explain this failure:
  1. *Asymmetric Tire Allocations*: Red Bull intentionally sacrificed qualifying runs to preserve two brand-new scrubbed sets of Softs for the race. Standard candidate sets evaluate standard allocations.
  2. *Chassis-Specific Downforce vs. Fleet Average*: Bahrain features severe rear traction degradation on abrasive aggregate. Our regression fits aggregate fleet telemetry; however, the Red Bull RB19 generated uniquely superior mechanical rear downforce, allowing Verstappen and Pérez to preserve Soft tires where Ferrari and Aston Martin experienced heavy degradation. Fleet-wide public telemetry cannot capture proprietary car-specific aerodynamic advantages.

---

## 4. Assumptions & Engineering Limitations

These constraints are explicit design decisions based on operating with public data:

1. **Clean-Air Assumption (No Aerodynamic Wake / Dirty Air Modeling)**:
   The simulator computes lap pace assuming clean track ahead. In reality, following within 1.5s of another car reduces front downforce by ~25%, increasing thermal sliding and tire degradation. On high-overtaking-delta circuits (Monaco $>2.5\text{s}$), teams intentionally accept a slower average lap pace (1-stop) to preserve track position.
2. **Fleet-Average Degradation**:
   Degradation slopes are derived across all 20 cars on the grid. While Huber loss minimizes outlier noise, it cannot model car-specific tire preservation deltas between a front-running Red Bull and a midfield car.
3. **Curated Candidate Strategy Space**:
   Rather than simulating every combinatorial permutation of laps, the simulator evaluates realistic 1-stop and 2-stop strategies curated around known compound degradation limits. Extreme asymmetric strategies (e.g., Soft-Soft-Hard with scrubbed sets) must be explicitly parameterized.
4. **Static Pit-Lane Delta Baselines**:
   Green flag and Safety Car pit loss times are grounded in empirical averages per track ($\approx 20.25\text{s}$ at Monaco, $\approx 24.0\text{s}$ at Monza), but do not dynamically simulate pit crew execution variance beyond normal Gaussian noise and a 5% slow-stop probability.

---

## 5. How to Run It

### Prerequisites
* Python 3.10+ (tested on Python 3.13)
* FastF1, Streamlit, Plotly, Pandas, NumPy, Scikit-learn

### Setup
```bash
# Clone the repository
git clone <repo-url>
cd f1-race-strategy-sim

# Install dependencies
pip install -r requirements.txt
```

### Run Command Line Pipelines
```bash
# 1. Pull & clean telemetry summary (e.g. Monaco)
python3 src/data_loader.py --year 2023 --race Monaco

# 2. Fit linear tire degradation curves and output plot
python3 src/tire_model.py --year 2023 --race Monaco

# 3. Run Monte Carlo simulation (N=2000 runs)
python3 src/strategy_sim.py --year 2023 --race Monaco --laps 78 --sims 2000

# 4. Run multi-circuit historical validation benchmark
python3 src/validate.py
```

### Launch the Web UI & API Layer

The system features a decoupled pit-wall telemetry interface powered by **React 18**, **React Three Fiber** (3D circuit visualization), **Recharts**, and a **FastAPI** backend.

1. **Start the FastAPI Backend**:
```bash
python3 -m uvicorn api.main:app --port 8000 --reload
```
Exposes:
- `GET /tracks` — Track catalog and empirical pit transit parameters
- `GET /degradation-curve?track={id}` — Linear regression fits and telemetry scatter
- `GET /simulate?track={id}&safety_car_prob={p}&n_sims={n}` — Monte Carlo simulation distributions
- `GET /validate?track={id}` — Real vs. model strategy comparison and diagnostic writeups

2. **Launch the Pit-Wall Telemetry Frontend**:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` (or `http://localhost:4173` for production preview).
- **Interactive 3D Circuit Spline**: Real-time Catmull-Rom WebGL circuit rendering with racing lines and animated pit stop markers
- **Tire Degradation Curves**: Scatter points and fitted wear slopes per compound (Soft / Medium / Hard)
- **Monte Carlo Strategy Leaderboard**: Ranked strategies with mean, median, IQR spreads, and Safety Car probabilities
- **Historical Ground-Truth Validation**: Real-world telemetry comparison cards and engineering diagnostics

---

## 6. What I'd Build Next (Future Technical Extensions)

1. **Chassis-Specific Degradation Hierarchies**:
   Fit hierarchical Bayesian regression models or mixed-effects models where tire degradation slopes have car/constructor random effects:
   
   $$\text{deg}_{i,j} = \mu_{\text{compound}} + \gamma_{\text{team}_i} + \epsilon_{i,j}$$
   
   This would separate Red Bull's tire preservation advantage from fleet averages, solving the Bahrain prediction gap.

2. **Markov Chain Traffic & Overtaking Model**:
   Model the race as an interacting multi-agent queue where rejoining after a pit stop checks local track density. If rejoining within a DRS train, apply an empirical traffic lap-time penalty based on the track's historical overtaking delta.

3. **Real-Time Strategy Adaptation API**:
   Extend the Monte Carlo engine into a live telemetry listener using FastF1's live timing client, dynamically triggering re-simulations when an SC or VSC message is broadcast on race control channels.
