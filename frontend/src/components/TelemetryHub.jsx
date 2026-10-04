import React, { useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  ReferenceLine
} from 'recharts';
import {
  Activity,
  Layers,
  Clock,
  ShieldAlert,
  Flame,
  Gauge,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Info,
  Zap,
  Filter,
  BarChart2,
  Compass,
  Brain
} from 'lucide-react';
import BayesianOnlineUpdaterView from './BayesianOnlineUpdaterView';

const COMPOUND_COLORS = {
  SOFT: '#E10600',
  MEDIUM: '#FFD700',
  HARD: '#FFFFFF'
};

const CustomScatterTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-[#0c0e14] border border-[#262a36] p-2.5 font-mono text-xs shadow-2xl rounded-xs">
        <div className="flex items-center gap-2 mb-1 border-b border-[#1b1f28] pb-1">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: COMPOUND_COLORS[d.compound] }}
          />
          <strong className="text-white uppercase">{d.compound}</strong>
          <span className="text-neutral-500">#{d.driver}</span>
        </div>
        <div className="text-neutral-300">Stint Age: <strong className="text-white">{d.tyre_life} Laps</strong></div>
        <div className="text-neutral-300">Fuel-Corrected Pace: <strong className="text-white">{d.lap_time.toFixed(3)}s</strong></div>
        <div className="text-[10px] text-neutral-400">FastF1 CAN-Bus Lap #{d.lap_number}</div>
      </div>
    );
  }
  return null;
};

export default function TelemetryHub({
  trackMeta,
  degData,
  simData,
  valData,
  selectedRank,
  onSelectRank,
  initialView = null,
  hideNav = false
}) {
  const [activeSubTab, setActiveSubTab] = useState(initialView || 'STRATEGY_DECK');
  const [compoundFilter, setCompoundFilter] = useState('ALL');

  React.useEffect(() => {
    if (initialView) {
      setActiveSubTab(initialView);
    }
  }, [initialView]);

  const strategies = simData?.strategies || [];
  const models = degData?.models || {};
  const scatter = degData?.scatter_points || [];

  // Filtered scatter points
  const filteredScatter = compoundFilter === 'ALL'
    ? scatter
    : scatter.filter(p => p.compound === compoundFilter);

  // Active strategy
  const activeStrat = strategies.find(s => s.rank === selectedRank) || strategies[0];

  // Cumulative Lap Delta Calculation for Gap Chart
  const paceDeltaData = React.useMemo(() => {
    if (strategies.length < 2) return [];
    const p1 = strategies[0];
    const p2 = strategies[1];
    const pAlt = strategies.find(s => s.stops === 2) || strategies[2];
    if (!p1 || !p2 || !pAlt) return [];

    const getLapTime = (strat, lap) => {
      let lapInStint = 0;
      let acc = 0;
      let comp = 'MEDIUM';
      for (const st of strat.stints) {
        if (lap <= acc + st.length) {
          comp = st.compound;
          lapInStint = lap - acc;
          break;
        }
        acc += st.length;
      }
      const m = models[comp] || { intercept: 80, slope: 0.03 };
      let t = m.intercept + m.slope * lapInStint - (lap - 1) * trackMeta.fuel_burn_rate;
      if (strat.pit_laps.includes(lap)) t += trackMeta.green_pit_loss;
      return t;
    };

    const data = [];
    let cum1 = 0, cum2 = 0, cumAlt = 0;
    for (let l = 1; l <= trackMeta.laps; l++) {
      cum1 += getLapTime(p1, l);
      cum2 += getLapTime(p2, l);
      cumAlt += getLapTime(pAlt, l);
      data.push({
        lap: l,
        p1_delta: 0,
        p2_delta: Number((cum2 - cum1).toFixed(2)),
        alt_delta: Number((cumAlt - cum1).toFixed(2))
      });
    }
    return data;
  }, [strategies, models, trackMeta]);

  // Best on average vs safest / lowest variance
  const bestOnAverage = strategies[0];
  const safestStrategy = React.useMemo(() => {
    if (!strategies.length) return null;
    return [...strategies].sort((a, b) => a.iqr - b.iqr)[0];
  }, [strategies]);

  // Fitted regression line points for overlay
  const regressionLines = React.useMemo(() => {
    const lines = {};
    ['SOFT', 'MEDIUM', 'HARD'].forEach(comp => {
      const m = models[comp];
      if (m) {
        lines[comp] = [
          { tyre_life: 1, lap_time: Number((m.intercept + m.slope * 1).toFixed(3)) },
          { tyre_life: comp === 'SOFT' ? 24 : comp === 'MEDIUM' ? 36 : 46, lap_time: Number((m.intercept + m.slope * (comp === 'SOFT' ? 24 : comp === 'MEDIUM' ? 36 : 46)).toFixed(3)) }
        ];
      }
    });
    return lines;
  }, [models]);

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-navigation Controls */}
      {!hideNav && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.1] pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'STRATEGY_DECK', label: '1. MONTE CARLO RACE STRATEGY SOLVER' },
              { id: 'TIRE_SIGNAL', label: '2. HUBER LOSS TIRE DEGRADATION REGRESSION' },
              { id: 'GAP_DELTA', label: '3. CUMULATIVE RACE TIME GAP DELTA TO P1' },
              { id: 'VALIDATION', label: '4. FIA OFFICIAL RACE GROUND-TRUTH VALIDATION' },
              { id: 'BAYESIAN', label: '5. IN-RACE BAYESIAN ONLINE LEARNING' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`f1-hub-tab-btn ${activeSubTab === tab.id ? 'f1-hub-tab-btn-active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-neutral-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" /> VECTORIZED SOLVER: N=1,000 RUNS
            </span>
            <span className="text-neutral-600">|</span>
            <span>DYNAMIC FUEL MASS CORRECTION: -{trackMeta.fuel_burn_rate}s/LAP</span>
          </div>
        </div>
      )}

      {/* VIEW 1: STRATEGY DECK (Gantt + Ranked Table + Delta Bars) */}
      {activeSubTab === 'STRATEGY_DECK' && (
        <div className="flex flex-col gap-6">
          {/* Tactical Divergence Callout Banner (Best Average vs Safest) */}
          {bestOnAverage && safestStrategy && (
            bestOnAverage.rank !== safestStrategy.rank ? (
              <div className="bg-[#141208] border-l-4 border-l-[#FF9100] border border-[#2e2612] p-4 rounded-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#FF9100]/20 flex items-center justify-center text-[#FF9100] shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-f1 text-white font-bold text-sm tracking-wide">
                      TACTICAL DIVERGENCE: OPTIMAL EXPECTED FINISH (E[T]) vs. MINIMUM VARIANCE (IQR)
                    </div>
                    <div className="text-xs font-mono text-neutral-300 mt-0.5">
                      <strong className="text-white">#{bestOnAverage.rank} {bestOnAverage.name}</strong> achieves the fastest mean race time ({bestOnAverage.formatted_mean}), but <strong className="text-amber-400">#{safestStrategy.rank} {safestStrategy.name}</strong> provides tighter stochastic risk bounds (IQR &plusmn;{(safestStrategy.iqr / 2).toFixed(1)}s vs &plusmn;{(bestOnAverage.iqr / 2).toFixed(1)}s).
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectRank(bestOnAverage.rank)}
                    className="px-3 py-1.5 font-mono text-xs font-bold bg-[#FF1801] text-black uppercase rounded-xs cursor-pointer hover:bg-white"
                  >
                    Select #1 Optimal Mean
                  </button>
                  <button
                    onClick={() => onSelectRank(safestStrategy.rank)}
                    className="px-3 py-1.5 font-mono text-xs font-bold bg-[#FF9100] text-black uppercase rounded-xs cursor-pointer hover:bg-white"
                  >
                    Select #{safestStrategy.rank} Min Variance
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#08140E] border-l-4 border-l-[#00E676] border border-[#162e20] p-3.5 rounded-xs flex items-center gap-3 shadow-lg">
                <CheckCircle2 className="w-5 h-5 text-[#00E676] shrink-0" />
                <div className="text-xs font-mono text-neutral-300">
                  <strong className="text-[#00E676] font-bold">TACTICAL CONSENSUS:</strong> Candidate #{bestOnAverage.rank} ({bestOnAverage.name}) dominates Pareto frontier—fastest expected finish ({bestOnAverage.formatted_mean}) and lowest stochastic variance (IQR &plusmn;{(bestOnAverage.iqr / 2).toFixed(1)}s).
                </div>
              </div>
            )
          )}

          {/* Visual Stint Gantt Timeline */}
          <div className="f1-card p-5 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.1] pb-3 gap-2">
              <div>
                <h3 className="font-f1 text-lg font-bold text-white tracking-wider uppercase">
                  STINT TRAJECTORY &amp; MANDATORY TIRE REGULATION TIMELINE
                </h3>
                <p className="text-xs font-mono text-neutral-300 mt-1">
                  Compound stint duration, tire cliff boundaries, and optimal pit entry windows across all 10 candidate strategies
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FF1801]" /> SOFT</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FFF200]" /> MEDIUM</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-white" /> HARD</span>
              </div>
            </div>

            {/* Gantt Rows */}
            <div className="flex flex-col gap-2 pt-1">
              {strategies.map((strat) => {
                const isSelected = strat.rank === selectedRank;
                const isP1 = strat.rank === 1;

                return (
                  <div
                    key={strat.rank}
                    onClick={() => onSelectRank(strat.rank)}
                    className={`flex items-center p-2 rounded-xs border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#181C25] border-[#FF1801] shadow-md'
                        : 'bg-[#0B0D12] border-[#1c1f28] hover:border-[#383d4c]'
                    }`}
                  >
                    <div className="w-44 flex items-center gap-2.5 shrink-0">
                      <span className={`w-6 h-6 flex items-center justify-center font-mono font-bold text-xs rounded-xs ${
                        isP1 ? 'bg-[#FF1801] text-black font-extrabold' : 'bg-[#181A22] text-neutral-300'
                      }`}>
                        #{strat.rank}
                      </span>
                      <div className="flex flex-col truncate">
                        <span className="font-f1 text-xs font-bold text-white truncate">
                          {strat.name.replace('1-Stop: ', '1S: ').replace('2-Stop: ', '2S: ')}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          {strat.delta_to_best === 0 ? 'P1 OPTIMAL' : `+${strat.delta_to_best.toFixed(2)}s`}
                        </span>
                      </div>
                    </div>

                    {/* Stint Ribbons */}
                    <div className="flex-1 ml-4 h-7 bg-[#060709] rounded-xs relative flex items-center overflow-hidden border border-[#1b1e28]">
                      {strat.stints.map((st, sIdx) => {
                        const width = (st.length / trackMeta.laps) * 100;
                        const cColor = COMPOUND_COLORS[st.compound] || '#fff';
                        return (
                          <div
                            key={sIdx}
                            style={{
                              width: `${width}%`,
                              backgroundColor: `${cColor}22`,
                              borderColor: cColor
                            }}
                            className="h-full border-r relative flex items-center justify-center px-1"
                          >
                            <span
                              style={{ color: cColor }}
                              className="font-mono text-[11px] font-bold truncate"
                            >
                              {st.compound[0]} &bull; {st.length}L
                            </span>
                          </div>
                        );
                      })}

                      {/* Pit stop flags */}
                      {strat.pit_laps.map((lap, pIdx) => {
                        const left = (lap / trackMeta.laps) * 100;
                        return (
                          <div
                            key={pIdx}
                            style={{ left: `${left}%` }}
                            className="absolute top-0 bottom-0 w-1 bg-white flex items-center justify-center"
                          >
                            <span className="absolute -top-3.5 bg-black text-[9px] font-mono text-white px-1 border border-neutral-700 rounded-xs">
                              L{lap}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strategy Leaderboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategies.map((strat) => {
              const isSelected = strat.rank === selectedRank;
              const isP1 = strat.rank === 1;

              return (
                <div
                  key={strat.rank}
                  onClick={() => onSelectRank(strat.rank)}
                  className={`f1-card p-4 flex flex-col justify-between cursor-pointer transition-all ${
                    isSelected ? 'f1-card-active' : 'hover:border-[#383d4c]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-[#1b1e26] pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 flex items-center justify-center font-mono font-bold text-xs rounded-xs ${
                          isP1 ? 'bg-[#E10600] text-black font-extrabold' : 'bg-[#191C24] text-neutral-300'
                        }`}>
                          #{strat.rank}
                        </span>
                        <span className="font-f1 text-base font-bold text-white tracking-wide">
                          {strat.name}
                        </span>
                      </div>
                      <span className={`font-mono text-xs font-bold ${strat.delta_to_best === 0 ? 'text-emerald-400' : 'text-neutral-300'}`}>
                        {strat.delta_to_best === 0 ? 'P1 BENCHMARK' : `+${strat.delta_to_best.toFixed(2)}s`}
                      </span>
                    </div>

                    {/* Stint Pills */}
                    <div className="flex items-center gap-2 mb-3">
                      {strat.stints.map((st, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0B0C10] border border-[#21242e] text-xs font-mono rounded-xs"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: COMPOUND_COLORS[st.compound] }}
                          />
                          <span className="text-white font-bold">{st.compound}</span>
                          <span className="text-neutral-400">({st.length}L)</span>
                        </div>
                      ))}
                      <span className="text-xs font-mono text-neutral-500 ml-auto">
                        Pit Laps: [{strat.pit_laps.join(', ')}]
                      </span>
                    </div>
                  </div>

                  {/* Quantitative Stats Bar */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1a1d25] font-mono text-xs">
                    <div>
                      <div className="text-[10px] text-neutral-400">EXPECTED FINISH (E[T])</div>
                      <div className="text-white font-bold text-sm mt-0.5">{strat.formatted_mean}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-400">IQR DISPERSION (Q3-Q1)</div>
                      <div className="text-neutral-300 font-medium mt-0.5">&plusmn;{(strat.iqr / 2).toFixed(1)}s</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-400">P(SAFETY CAR BONUS)</div>
                      <div className="text-amber-400 font-bold mt-0.5">{(strat.sc_benefit_prob * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: TIRE DEGRADATION SIGNAL */}
      {activeSubTab === 'TIRE_SIGNAL' && (
        <div className="flex flex-col gap-6">
          {/* Filter Pills and Regression Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {['SOFT', 'MEDIUM', 'HARD'].map(comp => {
              const m = models[comp];
              if (!m) return null;
              return (
                <div key={comp} className="f1-card p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-[#1d2028] pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: COMPOUND_COLORS[comp] }}
                      />
                      <span className="font-f1 text-base font-bold text-white tracking-wider">{comp}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-[#181B22] text-neutral-300 border border-[#252934]">
                      N={m.sample_size} VALID TELEMETRY LAPS
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <div>
                      <div className="text-[10px] text-neutral-400 uppercase">EMPIRICAL DEGRADATION RATE (&alpha;_deg)</div>
                      <div className="text-2xl font-bold text-white mt-0.5">
                        +{m.slope.toFixed(4)}<span className="text-xs text-neutral-400">s/lap</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-neutral-400 uppercase">COEFFICIENT OF DETERMINATION (R&sup2;)</div>
                      <div className="text-xl font-bold text-neutral-200 mt-0.5">{m.r2.toFixed(3)}</div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-neutral-400 mt-2 pt-1 border-t border-[#181b22] flex justify-between">
                    <span>Fresh Base Pace (&beta;0): {m.intercept.toFixed(2)}s</span>
                    <span className="text-emerald-400 font-semibold">Fuel Mass Corrected (-{trackMeta.fuel_burn_rate}s/L)</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scatter Chart */}
          <div className="f1-card p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.1] pb-3 gap-2">
              <div>
                <h3 className="font-f1 text-lg font-bold text-white tracking-wider uppercase">
                  FASTF1 EMPIRICAL TIRE WEAR TELEMETRY VS. HUBER LOSS M-ESTIMATOR FIT
                </h3>
                <p className="text-xs font-mono text-neutral-300 mt-1">
                  Fuel-mass-corrected lap times as a function of stint age. Outliers (&gt;2.5s), yellow-flag sectors, and VSC anomalies filtered using robust Huber loss M-estimation (&delta;=1.345).
                </p>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-2 font-mono text-xs">
                {['ALL', 'SOFT', 'MEDIUM', 'HARD'].map(comp => (
                  <button
                    key={comp}
                    onClick={() => setCompoundFilter(comp)}
                    className={`f1-channel-pill ${compoundFilter === comp ? 'f1-channel-pill-active' : ''}`}
                  >
                    {comp}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full h-80 bg-[#08090C] border border-[#1b1e26] p-2 rounded-xs">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 15, right: 25, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#161820" />
                  <XAxis
                    type="number"
                    dataKey="tyre_life"
                    name="Stint Age"
                    unit=" laps"
                    stroke="#555"
                    tick={{ fill: '#808080', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    domain={[0, 48]}
                  />
                  <YAxis
                    type="number"
                    dataKey="lap_time"
                    name="Pace"
                    unit="s"
                    stroke="#555"
                    tick={{ fill: '#808080', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    domain={['dataMin - 1', 'dataMax + 1']}
                  />
                  <ZAxis range={[20, 32]} />
                  <Tooltip content={<CustomScatterTooltip />} />
                  <Legend wrapperStyle={{ fontFamily: 'Chakra Petch', textTransform: 'uppercase', fontSize: 12 }} />

                  {/* Scatter Points */}
                  {(compoundFilter === 'ALL' || compoundFilter === 'SOFT') && (
                    <Scatter name="SOFT Telemetry" data={filteredScatter.filter(p => p.compound === 'SOFT')} fill="#FF1801" opacity={0.65} />
                  )}
                  {(compoundFilter === 'ALL' || compoundFilter === 'MEDIUM') && (
                    <Scatter name="MEDIUM Telemetry" data={filteredScatter.filter(p => p.compound === 'MEDIUM')} fill="#FFF200" opacity={0.65} />
                  )}
                  {(compoundFilter === 'ALL' || compoundFilter === 'HARD') && (
                    <Scatter name="HARD Telemetry" data={filteredScatter.filter(p => p.compound === 'HARD')} fill="#FFFFFF" opacity={0.7} />
                  )}

                  {/* Huber Regression Fitted Curves */}
                  {(compoundFilter === 'ALL' || compoundFilter === 'SOFT') && regressionLines.SOFT && (
                    <Scatter name="SOFT Model (Huber)" data={regressionLines.SOFT} line={{ stroke: '#FF1801', strokeWidth: 2.5 }} shape={() => null} />
                  )}
                  {(compoundFilter === 'ALL' || compoundFilter === 'MEDIUM') && regressionLines.MEDIUM && (
                    <Scatter name="MEDIUM Model (Huber)" data={regressionLines.MEDIUM} line={{ stroke: '#FFF200', strokeWidth: 2.5 }} shape={() => null} />
                  )}
                  {(compoundFilter === 'ALL' || compoundFilter === 'HARD') && regressionLines.HARD && (
                    <Scatter name="HARD Model (Huber)" data={regressionLines.HARD} line={{ stroke: '#FFFFFF', strokeWidth: 2.5 }} shape={() => null} />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: GAP DELTA */}
      {activeSubTab === 'GAP_DELTA' && (
        <div className="f1-card p-5 flex flex-col gap-4">
          <div className="border-b border-white/[0.1] pb-3">
            <h3 className="font-f1 text-lg font-bold text-white tracking-wider uppercase">
              CUMULATIVE RACE TIME GAP DELTA RELATIVE TO OPTIMAL BENCHMARK P1
            </h3>
            <p className="text-xs font-mono text-neutral-300 mt-1">
              Lap-by-lap cumulative race time differential relative to P1. Negative values indicate on-track lead; positive values indicate cumulative time deficit.
            </p>
          </div>

          <div className="w-full h-80 bg-[#08090C] border border-[#1b1e26] p-2 rounded-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={paceDeltaData} margin={{ top: 15, right: 25, bottom: 15, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#161820" />
                <XAxis dataKey="lap" unit="L" stroke="#555" tick={{ fill: '#888', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                <YAxis unit="s" stroke="#555" tick={{ fill: '#888', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                <ReferenceLine y={0} stroke="#00E676" strokeDasharray="4 4" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#0c0e14] border border-[#262a36] p-2.5 font-mono text-xs shadow-2xl rounded-xs">
                          <div className="font-bold text-white mb-1">LAP #{label}</div>
                          <div className="text-emerald-400">P1 Benchmark: 0.00s</div>
                          <div className="text-blue-400">P2 Contender Gap: +{payload[0]?.value}s</div>
                          <div className="text-amber-400">2-Stop Alternate Gap: +{payload[1]?.value}s</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="p2_delta" name="P2 Contender" stroke="#60a5fa" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="alt_delta" name="2-Stop Alternate" stroke="#FFD700" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* VIEW 4: VALIDATION BENCHMARK */}
      {activeSubTab === 'VALIDATION' && valData && (
        <div className="f1-card p-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.1] pb-3 gap-2">
            <div>
              <h3 className="font-f1 text-lg font-bold text-white tracking-wider uppercase">
                FIA OFFICIAL RACE VALIDATION BENCHMARK &bull; {valData.track.toUpperCase()} ({valData.year})
              </h3>
              <p className="text-xs font-mono text-neutral-300 mt-1">
                Post-race ground-truth audit comparing actual pit wall telemetry against Monte Carlo solver candidate rankings
              </p>
            </div>
            <span className={`px-3 py-1 font-mono text-xs font-bold uppercase rounded-xs border ${
              valData.model_match.rank === 1
                ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-400'
                : valData.model_match.rank <= 3
                ? 'bg-blue-950/80 border-blue-500/70 text-blue-400'
                : 'bg-amber-950/80 border-amber-500/70 text-amber-400'
            }`}>
              {valData.model_match.tier} &bull; Model Rank #{valData.model_match.rank}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#090C12] border border-white/[0.1] p-4 rounded-xs">
              <div className="text-[10px] font-mono text-neutral-400 uppercase mb-1 font-bold">FIA OFFICIAL RACE WINNER (EMPIRICAL GROUND TRUTH)</div>
              <div className="font-f1 text-2xl font-bold text-white mb-2">{valData.winner.driver} &bull; {valData.winner.team}</div>
              <div className="flex items-center gap-2 mb-2">
                {valData.winner.stints.map((st, i) => (
                  <span key={i} className="px-2 py-0.5 bg-[#121620] border border-white/[0.12] text-xs font-mono text-white rounded-xs">
                    {st.compound} ({st.length}L)
                  </span>
                ))}
              </div>
              <div className="text-xs font-mono text-neutral-300">Official Race Pit Lap: <strong className="text-white">{valData.winner.pit_laps.join(', ') || 'None'}</strong></div>
            </div>

            <div className="bg-[#090C12] border border-white/[0.1] p-4 rounded-xs">
              <div className="text-[10px] font-mono text-neutral-400 uppercase mb-1 font-bold">SOLVER CANDIDATE ALIGNMENT</div>
              <div className="font-f1 text-xl font-bold text-[#FF1801] mb-2">{valData.model_match.matched_strategy_name}</div>
              <div className="text-xs font-mono text-neutral-300 mb-2">Pit Window Discrepancy: <strong className="text-white">{valData.model_match.pit_error_laps} Laps Delta</strong></div>
              <div className="text-xs font-mono text-[#00E676] font-bold">Calibration Accuracy: Rank #{valData.model_match.rank} of 10 Candidates on Pareto Frontier</div>
            </div>
          </div>

          <div className="bg-[#090C12] border border-white/[0.1] p-4 rounded-xs">
            <div className="text-xs font-mono text-[#FF1801] uppercase font-bold mb-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> POST-RACE TELEMETRY &amp; STRATEGY AUDIT LOG
            </div>
            <p className="text-xs font-mono text-neutral-200 leading-relaxed">
              {valData.analysis_writeup}
            </p>
          </div>
        </div>
      )}

      {/* VIEW 5: IN-RACE BAYESIAN ONLINE LEARNING & DRIFT CONTROLLER */}
      {activeSubTab === 'BAYESIAN' && (
        <BayesianOnlineUpdaterView
          trackId={trackMeta.id}
          trackMeta={trackMeta}
        />
      )}
    </div>
  );
}
