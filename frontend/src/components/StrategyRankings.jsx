import React, { useState } from 'react';
import { Clock, AlertTriangle, ShieldCheck, Zap, BarChart3, TrendingUp, Sliders } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid
} from 'recharts';

const COMPOUND_COLORS = {
  SOFT: '#E10600',
  MEDIUM: '#FFD700',
  HARD: '#FFFFFF',
  INTERMEDIATE: '#39B54A',
  WET: '#00AEEF'
};

export default function StrategyRankings({ strategies, onSelectStrategy, selectedRank = 1 }) {
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'distribution'

  if (!strategies || strategies.length === 0) return null;

  // Chart data: delta to best and IQR
  const chartData = strategies.map(s => ({
    name: s.name.replace('1-Stop: ', '').replace('2-Stop: ', ''),
    rank: s.rank,
    delta: s.delta_to_best,
    std_dev: s.std_dev,
    stops: s.stops,
    formatted_mean: s.formatted_mean,
    sc_benefit: (s.sc_benefit_prob * 100).toFixed(0)
  }));

  return (
    <div className="bg-[#0E0F13] border border-[#23252a] p-5 flex flex-col gap-5 rounded-sm shadow-xl">
      {/* Header and Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#23252a] pb-4 gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 bg-[#E10600] inline-block" />
            <h3 className="font-heading text-xl uppercase tracking-wider font-extrabold text-white">
              Monte Carlo Ranked Outcomes (N=1,000 Iterations)
            </h3>
          </div>
          <p className="text-xs font-mono text-neutral-400 mt-1">
            Simulated total race durations incorporating stochastic lap pace, pit lane transit delta, and Safety Car probabilities
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 border font-bold uppercase cursor-pointer transition-all ${
              viewMode === 'table'
                ? 'bg-[#E10600] text-black border-[#E10600]'
                : 'bg-[#141519] text-neutral-400 border-[#2b2d35] hover:text-white'
            }`}
          >
            TABLE LEADERBOARD
          </button>
          <button
            onClick={() => setViewMode('distribution')}
            className={`px-3 py-1.5 border font-bold uppercase cursor-pointer transition-all ${
              viewMode === 'distribution'
                ? 'bg-[#E10600] text-black border-[#E10600]'
                : 'bg-[#141519] text-neutral-400 border-[#2b2d35] hover:text-white'
            }`}
          >
            DELTA BAR CHART
          </button>
        </div>
      </div>

      {viewMode === 'distribution' ? (
        /* Delta to Best Bar Chart */
        <div className="w-full h-80 bg-[#0B0C0E] border border-[#1d1e24] p-3 rounded-xs flex flex-col justify-between">
          <div className="text-xs font-mono text-neutral-400 flex items-center justify-between mb-2">
            <span>DELTA TO FASTEST AVERAGE (SECONDS)</span>
            <span className="text-neutral-500">LOWER IS FASTER</span>
          </div>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#191a20" />
                <XAxis
                  dataKey="name"
                  angle={-25}
                  textAnchor="end"
                  tick={{ fill: '#808080', fontSize: 10, fontFamily: 'Barlow Condensed' }}
                />
                <YAxis
                  tick={{ fill: '#808080', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  unit="s"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#0e0f13] border border-[#2b2d35] p-3 font-mono text-xs shadow-2xl">
                          <div className="text-white font-bold uppercase mb-1">Rank #{d.rank}: {d.name}</div>
                          <div className="text-neutral-300">Delta to P1: <span className="text-[#E10600] font-bold">+{d.delta.toFixed(2)}s</span></div>
                          <div className="text-neutral-300">Mean Finish: <span className="text-white">{d.formatted_mean}</span></div>
                          <div className="text-neutral-400 text-[10px]">Variance: &sigma; {d.std_dev.toFixed(1)}s &bull; SC Benefit: {d.sc_benefit}%</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="delta" fill="#E10600">
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.rank === 1 ? '#34d399' : entry.stops === 1 ? '#E10600' : '#FFD700'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-neutral-500 pt-2 border-t border-[#1a1b20]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#34d399]" /> P1 FASTEST</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E10600]" /> 1-STOP VARIANT</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#FFD700]" /> 2-STOP VARIANT</span>
          </div>
        </div>
      ) : (
        /* Detailed Table Leaderboard */
        <div className="flex flex-col gap-2.5 overflow-x-auto">
          {strategies.map((strat) => {
            const isSelected = strat.rank === selectedRank;
            const isFastest = strat.rank === 1;

            return (
              <div
                key={strat.rank}
                onClick={() => onSelectStrategy && onSelectStrategy(strat)}
                className={`p-3.5 border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xs ${
                  isSelected
                    ? 'bg-[#181A20] border-[#E10600] shadow-lg'
                    : 'bg-[#13151A] border-[#22242b] hover:border-[#383b47]'
                }`}
              >
                {/* Left Column */}
                <div className="flex items-center gap-3.5 min-w-[290px]">
                  <span
                    className={`w-8 h-8 flex items-center justify-center font-mono font-bold text-sm rounded-xs ${
                      isFastest
                        ? 'bg-[#E10600] text-black font-extrabold shadow-md'
                        : 'bg-[#1a1c22] text-neutral-300 border border-[#2b2d35]'
                    }`}
                  >
                    #{strat.rank}
                  </span>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-lg font-bold uppercase text-white tracking-wide">
                        {strat.name}
                      </span>
                      {isFastest && (
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 uppercase font-bold rounded-xs">
                          OPTIMAL EXPECTED VALUE
                        </span>
                      )}
                    </div>

                    {/* Stint Compound Visualizer */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {strat.stints.map((st, sIdx) => (
                        <React.Fragment key={sIdx}>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0B0C0E] border border-[#262830] text-[11px] font-mono rounded-xs">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: COMPOUND_COLORS[st.compound] || '#fff' }}
                            />
                            <span className="text-white font-bold">{st.compound}</span>
                            <span className="text-neutral-400">({st.length}L)</span>
                          </div>
                          {sIdx < strat.stints.length - 1 && (
                            <span className="text-xs font-mono text-[#E10600] font-bold">&rarr;</span>
                          )}
                        </React.Fragment>
                      ))}
                      <span className="text-[11px] font-mono text-neutral-400 ml-2">
                        Box Lap: <strong className="text-white">[{strat.pit_laps.join(', ')}]</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-7 font-mono text-xs">
                  <div>
                    <div className="text-[10px] uppercase text-neutral-500">MEAN TIME</div>
                    <div className="font-bold text-white text-base mt-0.5">{strat.formatted_mean}</div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase text-neutral-500">GAP TO P1</div>
                    <div className={`font-bold text-base mt-0.5 ${strat.delta_to_best === 0 ? 'text-emerald-400' : 'text-neutral-300'}`}>
                      {strat.delta_to_best === 0 ? '0.00s' : `+${strat.delta_to_best.toFixed(2)}s`}
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <div className="text-[10px] uppercase text-neutral-500">IQR SPREAD (p25-p75)</div>
                    <div className="text-neutral-300 font-medium mt-0.5">&plusmn;{(strat.iqr / 2).toFixed(1)}s</div>
                  </div>

                  <div className="hidden md:block">
                    <div className="text-[10px] uppercase text-neutral-500">SC BENEFIT CHANCE</div>
                    <div className="text-amber-400 font-bold mt-0.5">{(strat.sc_benefit_prob * 100).toFixed(0)}%</div>
                  </div>
                </div>

                {/* Variance Bar */}
                <div className="flex items-center gap-2.5">
                  <div className="w-24 bg-[#1e2027] h-2.5 relative overflow-hidden rounded-xs">
                    <div
                      className="bg-[#E10600] h-full"
                      style={{ width: `${Math.min(100, Math.max(15, (strat.std_dev / 12) * 100))}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400 min-w-[45px]">
                    &sigma; {strat.std_dev.toFixed(1)}s
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
