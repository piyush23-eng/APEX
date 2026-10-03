import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from 'recharts';

export default function PaceDeltaSimulator({ strategies, degModels, totalLaps = 78, fuelBurnRate = 0.035, pitLoss = 20.25 }) {
  if (!strategies || strategies.length < 2 || !degModels) return null;

  // Pick Rank 1 (optimal) vs Rank 2 (nearest contender) vs 2-stop representative
  const p1 = strategies[0];
  const p2 = strategies[1];
  const twoStop = strategies.find(s => s.stops === 2) || strategies[2];

  // Helper to compute lap time for strategy at lap L
  const getLapTimeForStrat = (strat, lap) => {
    let currentLapInStint = 0;
    let accumulatedLaps = 0;
    let currentCompound = 'MEDIUM';

    for (const stint of strat.stints) {
      if (lap <= accumulatedLaps + stint.length) {
        currentCompound = stint.compound;
        currentLapInStint = lap - accumulatedLaps;
        break;
      }
      accumulatedLaps += stint.length;
    }

    const model = degModels[currentCompound] || { intercept: 80.0, slope: 0.03 };
    // Base lap time + tire deg wear + fuel burn reduction
    let time = model.intercept + model.slope * currentLapInStint - (lap - 1) * fuelBurnRate;

    // Pit in lap penalty
    if (strat.pit_laps.includes(lap)) {
      time += pitLoss;
    }

    return time;
  };

  // Generate cumulative race time delta relative to P1
  const timelineData = useMemo(() => {
    const data = [];
    let cumP1 = 0;
    let cumP2 = 0;
    let cumTwoStop = 0;

    for (let lap = 1; lap <= totalLaps; lap++) {
      const tP1 = getLapTimeForStrat(p1, lap);
      const tP2 = getLapTimeForStrat(p2, lap);
      const tTwo = getLapTimeForStrat(twoStop, lap);

      cumP1 += tP1;
      cumP2 += tP2;
      cumTwoStop += tTwo;

      // Delta in seconds relative to P1 (P1 is always 0 baseline)
      data.push({
        lap,
        p1_delta: 0,
        p2_delta: Number((cumP2 - cumP1).toFixed(2)),
        twoStop_delta: Number((cumTwoStop - cumP1).toFixed(2)),
        p1_time: Number(tP1.toFixed(2)),
        p2_time: Number(tP2.toFixed(2))
      });
    }
    return data;
  }, [p1, p2, twoStop, totalLaps, fuelBurnRate, pitLoss, degModels]);

  return (
    <div className="f1-card p-5 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#23252a] pb-3 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#E10600] inline-block" />
            <h3 className="font-f1 text-lg font-bold text-white tracking-wider">
              Cumulative Gap Simulation (Lap-by-Lap Crossover)
            </h3>
          </div>
          <p className="text-xs font-mono text-neutral-400 mt-0.5">
            Simulated gap (seconds) relative to P1 ({p1.name}). Negative means leading on track; positive means trailing.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#34d399]" /> P1 Baseline ({p1.name.slice(0, 14)})</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#60a5fa]" /> P2 ({p2.name.slice(0, 14)})</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#FFD700]" /> 2-Stop Alt ({twoStop.name.slice(0, 14)})</span>
        </div>
      </div>

      <div className="w-full h-72 bg-[#08090C] border border-[#1b1e26] p-2 rounded-xs">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timelineData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#161820" />
            <XAxis
              dataKey="lap"
              stroke="#555"
              unit="L"
              tick={{ fill: '#737785', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            />
            <YAxis
              stroke="#555"
              unit="s"
              tick={{ fill: '#737785', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            />
            <ReferenceLine y={0} stroke="#34d399" strokeDasharray="4 4" />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-[#0D0F14] border border-[#2b2f3c] p-3 font-mono text-xs shadow-2xl rounded-xs">
                      <div className="font-bold text-white mb-1">LAP #{label}</div>
                      <div className="text-emerald-400">P1 Baseline: 0.00s</div>
                      <div className="text-blue-400">P2 Gap: {payload[0]?.value > 0 ? `+${payload[0]?.value}s` : `${payload[0]?.value}s`}</div>
                      <div className="text-amber-400">2-Stop Gap: {payload[1]?.value > 0 ? `+${payload[1]?.value}s` : `${payload[1]?.value}s`}</div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="p2_delta"
              name="P2 Contender"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="twoStop_delta"
              name="2-Stop Alternate"
              stroke="#FFD700"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[11px] font-mono text-neutral-500 flex justify-between items-center pt-1 border-t border-[#171922]">
        <span>SPIKES INDICATE ON-TRACK PIT STOP TIME LOSS ({pitLoss}s TRANSIT DELTA)</span>
        <span>FUEL EFFECT TUNED: -{fuelBurnRate}s / LAP BURNED</span>
      </div>
    </div>
  );
}
