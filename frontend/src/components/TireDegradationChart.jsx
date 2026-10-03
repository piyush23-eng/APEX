import React, { useMemo, useState } from 'react';
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
  Line,
  ComposedChart
} from 'recharts';
import { Flame, Info, CheckCircle2 } from 'lucide-react';

const COMPOUND_CONFIG = {
  SOFT: { color: '#E10600', name: 'Soft (C3/C4/C5)' },
  MEDIUM: { color: '#FFD700', name: 'Medium (C2/C3/C4)' },
  HARD: { color: '#FFFFFF', name: 'Hard (C1/C2/C3)' }
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isLine = data.isRegression;

    if (isLine) {
      return (
        <div className="bg-[#0E0F13]/95 border border-[#2b2d35] p-3 font-mono text-xs shadow-2xl backdrop-blur-md rounded-xs">
          <div className="text-white font-bold mb-1 uppercase tracking-wider text-[#E10600]">
            FITTED WEAR LINE: {data.compound}
          </div>
          <div className="text-neutral-300">Tyre Age: <span className="text-white font-bold">{data.tyre_life} Laps</span></div>
          <div className="text-neutral-300">Pace: <span className="text-white font-bold">{data.lap_time.toFixed(3)}s</span></div>
        </div>
      );
    }

    return (
      <div className="bg-[#0E0F13]/95 border border-[#2b2d35] p-3 font-mono text-xs shadow-2xl backdrop-blur-md rounded-xs">
        <div className="flex items-center gap-2 mb-1.5 border-b border-[#23252a] pb-1">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: COMPOUND_CONFIG[data.compound]?.color || '#fff' }}
          />
          <span className="font-bold text-white uppercase tracking-wider">{data.compound}</span>
          <span className="text-neutral-500 font-semibold">#{data.driver}</span>
        </div>
        <div className="flex flex-col gap-1 text-neutral-300">
          <div>Tyre Stint Age: <span className="text-white font-bold">{data.tyre_life} Laps</span></div>
          <div>Fuel-Corrected Time: <span className="text-white font-bold">{data.lap_time.toFixed(3)}s</span></div>
          <div className="text-[10px] text-neutral-500">FastF1 Lap #{data.lap_number}</div>
        </div>
      </div>
    );
  }
  return null;
};

export default function TireDegradationChart({ degData }) {
  const [activeCompoundFilter, setActiveCompoundFilter] = useState('ALL');

  if (!degData) return null;

  const { models, scatter_points, fuel_burn_rate, track } = degData;

  const filteredPoints = useMemo(() => {
    if (activeCompoundFilter === 'ALL') return scatter_points;
    return scatter_points.filter(p => p.compound === activeCompoundFilter);
  }, [scatter_points, activeCompoundFilter]);

  const softPoints = useMemo(() => filteredPoints.filter(p => p.compound === 'SOFT'), [filteredPoints]);
  const mediumPoints = useMemo(() => filteredPoints.filter(p => p.compound === 'MEDIUM'), [filteredPoints]);
  const hardPoints = useMemo(() => filteredPoints.filter(p => p.compound === 'HARD'), [filteredPoints]);

  return (
    <div className="bg-[#0E0F13] border border-[#23252a] p-5 flex flex-col gap-5 rounded-sm shadow-xl">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-[#23252a] pb-4 gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 bg-[#E10600] inline-block" />
            <h3 className="font-heading text-xl uppercase tracking-wider font-extrabold text-white">
              Tire Degradation Curves &amp; Empirical Telemetry Signal
            </h3>
          </div>
          <p className="text-xs font-mono text-neutral-400 mt-1">
            Standardized lap-time delta vs. tyre stint age post fuel burn-off correction (-{fuel_burn_rate}s / lap)
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {['ALL', 'SOFT', 'MEDIUM', 'HARD'].map((comp) => {
            const isActive = activeCompoundFilter === comp;
            return (
              <button
                key={comp}
                onClick={() => setActiveCompoundFilter(comp)}
                className={`px-3 py-1.5 border uppercase font-bold tracking-wider transition-all cursor-pointer text-xs ${
                  isActive
                    ? 'bg-[#E10600] border-[#E10600] text-black font-extrabold shadow-md'
                    : 'bg-[#141519] border-[#2b2d35] text-neutral-400 hover:text-white hover:border-[#454854]'
                }`}
              >
                {comp}
              </button>
            );
          })}
        </div>
      </div>

      {/* Regression KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {['SOFT', 'MEDIUM', 'HARD'].map((comp) => {
          const m = models[comp];
          if (!m) return null;
          const conf = COMPOUND_CONFIG[comp];

          return (
            <div
              key={comp}
              className="bg-[#13151A] border border-[#23252a] p-3.5 flex flex-col justify-between rounded-xs"
            >
              <div className="flex items-center justify-between border-b border-[#1f2127] pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: conf.color }}
                  />
                  <span className="font-heading text-base font-bold text-white tracking-wider">
                    {comp}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#1b1d24] text-neutral-400 border border-[#2a2c35]">
                  N={m.sample_size} LAPS
                </span>
              </div>

              <div className="flex items-baseline justify-between font-mono">
                <div>
                  <div className="text-[10px] text-neutral-500 uppercase">WEAR RATE (&alpha;)</div>
                  <div className="text-xl font-bold text-white mt-0.5">
                    +{m.slope.toFixed(3)}<span className="text-xs text-neutral-400">s/lap</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-neutral-500 uppercase">FIT QUALITY (R&sup2;)</div>
                  <div className="text-lg font-bold text-neutral-200 mt-0.5">
                    {m.r2.toFixed(3)}
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[10px] font-mono text-neutral-400 flex items-center justify-between pt-1 border-t border-[#1a1b20]">
                <span>Base Pace (T0): {m.intercept.toFixed(2)}s</span>
                <span className="text-emerald-400">Huber Clean Air</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Scatter Telemetry Chart */}
      <div className="w-full h-80 bg-[#0B0C0E] border border-[#1d1e24] p-2 rounded-xs">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 15, right: 25, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#181920" />
            <XAxis
              type="number"
              dataKey="tyre_life"
              name="Stint Age"
              unit=" laps"
              stroke="#525252"
              tick={{ fill: '#808080', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              domain={[0, 48]}
            />
            <YAxis
              type="number"
              dataKey="lap_time"
              name="Fuel-Corrected Lap Time"
              unit="s"
              stroke="#525252"
              tick={{ fill: '#808080', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              domain={['dataMin - 0.8', 'dataMax + 0.8']}
            />
            <ZAxis range={[20, 32]} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 8, fontFamily: 'Barlow Condensed', textTransform: 'uppercase', fontSize: 12 }}
            />

            {(activeCompoundFilter === 'ALL' || activeCompoundFilter === 'SOFT') && (
              <Scatter
                name="SOFT Telemetry Laps"
                data={softPoints}
                fill="#E10600"
                opacity={0.7}
              />
            )}
            {(activeCompoundFilter === 'ALL' || activeCompoundFilter === 'MEDIUM') && (
              <Scatter
                name="MEDIUM Telemetry Laps"
                data={mediumPoints}
                fill="#FFD700"
                opacity={0.7}
              />
            )}
            {(activeCompoundFilter === 'ALL' || activeCompoundFilter === 'HARD') && (
              <Scatter
                name="HARD Telemetry Laps"
                data={hardPoints}
                fill="#FFFFFF"
                opacity={0.75}
              />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Scientific Methodology Footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] font-mono text-neutral-500 pt-2 border-t border-[#1a1b20] gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-neutral-400" />
          <span>STATISTICAL CRITERIA: In/Out Laps Discarded &bull; VSC/SC Delta Removed &bull; Traffic Lifts Clipped (&gt;2.5s)</span>
        </div>
        <span className="text-neutral-400 font-semibold">TOTAL VALIDATED TELEMETRY SAMPLES: {scatter_points.length}</span>
      </div>
    </div>
  );
}
