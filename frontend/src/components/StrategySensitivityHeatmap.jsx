import React, { useMemo } from 'react';
import { Grid, Sparkles, AlertCircle, ArrowUpRight } from 'lucide-react';
import f1Data from '../f1_api_data.json';

const SC_PROBS = [0.0, 0.25, 0.50, 0.75];
const WEAR_MULTS = [0.8, 1.0, 1.2, 1.4, 1.6];

export default function StrategySensitivityHeatmap({
  trackId = 'monaco',
  currentWearMult = 1.0,
  currentScProb = 0.50,
  onApplyScenario
}) {
  const track = f1Data.tracks.find(t => t.id === trackId) || f1Data.tracks[0];
  const degModels = f1Data.degradation[trackId]?.models || {};
  const baseStrategies = f1Data.simulations[trackId]?.strategies || [];

  // 2D Matrix Computation: Evaluates best strategy for each (wear_mult, sc_prob) pair
  const gridResults = useMemo(() => {
    if (!baseStrategies.length || !track) return [];

    const fuelRate = track.fuel_burn_rate || 0.035;
    const greenLoss = track.green_pit_loss || 20.25;
    const scLoss = track.sc_pit_loss || 11.75;

    return WEAR_MULTS.map(wear => {
      const row = SC_PROBS.map(scProb => {
        const effectivePitLoss = greenLoss * (1 - scProb) + scLoss * scProb;

        let bestStrat = null;
        let bestTime = Infinity;
        let secondBestTime = Infinity;

        baseStrategies.forEach(strat => {
          let time = 0;
          let currentLap = 0;

          strat.stints.forEach(stint => {
            const m = degModels[stint.compound] || { slope: 0.035, intercept: 80, deg_cliff_lap: 35 };
            const effectiveSlope = m.slope * wear;

            for (let lap = 1; lap <= stint.length; lap++) {
              const lapIdx = currentLap + lap - 1;
              let lapTime = m.intercept + (effectiveSlope * lap) - (lapIdx * fuelRate);
              if (lap > m.deg_cliff_lap) {
                const excess = lap - m.deg_cliff_lap;
                lapTime += 0.12 * Math.pow(excess, 1.35);
              }
              time += lapTime;
            }
            currentLap += stint.length;
          });

          time += (strat.stops || (strat.stints.length - 1)) * effectivePitLoss;

          if (time < bestTime) {
            secondBestTime = bestTime;
            bestTime = time;
            bestStrat = strat;
          } else if (time < secondBestTime) {
            secondBestTime = time;
          }
        });

        const advantageSec = secondBestTime < Infinity ? Math.abs(secondBestTime - bestTime) : 0;
        const isOneStop = bestStrat ? (bestStrat.stops === 1 || bestStrat.stints.length === 2) : true;

        return {
          wear,
          scProb,
          strategyName: bestStrat ? bestStrat.name : '1-Stop M->H',
          stops: bestStrat ? bestStrat.stops : 1,
          isOneStop,
          advantageSec: Number(advantageSec.toFixed(1)),
          isCurrentActive: Math.abs(wear - currentWearMult) < 0.1 && Math.abs(scProb - currentScProb) < 0.15
        };
      });
      return { wear, cells: row };
    });
  }, [baseStrategies, degModels, track, currentWearMult, currentScProb]);

  return (
    <div className="f1-card p-5 flex flex-col gap-4 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.1] pb-3 gap-2">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-amber-400" />
          <h4 className="font-f1 text-sm font-bold text-white tracking-wider uppercase">
            Tactical Strategy Sensitivity Surface &bull; Decision Boundary Crossover Matrix
          </h4>
        </div>
        <span className="text-[10px] text-neutral-400 bg-white/[0.05] border border-white/[0.1] px-2 py-0.5 rounded-xs">
          20 Stochastic Scenarios Evaluated Live
        </span>
      </div>

      <p className="text-[11px] text-neutral-300">
        Simulates how track temperature degradation (&lambda;) and Safety Car likelihood (P_sc) shift the optimal call between 1-stop endurance and 2-stop attack. Click any cell to calibrate the solver.
      </p>

      {/* Heatmap Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr>
              <th className="p-2 border border-white/[0.08] text-neutral-400 text-[10px] bg-black/40 text-left">
                THERMAL DEG (&lambda;) &darr; \ P(SC) &rarr;
              </th>
              {SC_PROBS.map(sc => (
                <th key={sc} className="p-2 border border-white/[0.08] text-white text-[11px] bg-black/40 font-bold">
                  {Math.round(sc * 100)}% SC Prob
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gridResults.map(row => (
              <tr key={row.wear}>
                <td className="p-2 border border-white/[0.08] text-white font-bold text-left bg-black/30">
                  {row.wear.toFixed(1)}x {row.wear === 1.0 && <span className="text-emerald-400 text-[9px] font-normal">(Nominal)</span>}
                </td>
                {row.cells.map(cell => {
                  const is1Stop = cell.isOneStop;
                  const bgClass = is1Stop
                    ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/50'
                    : 'bg-red-950/30 border-red-800/40 text-red-300 hover:bg-red-900/50';

                  return (
                    <td
                      key={cell.scProb}
                      onClick={() => onApplyScenario && onApplyScenario(cell.scProb, cell.wear)}
                      className={`p-2 border cursor-pointer transition-all ${bgClass} ${
                        cell.isCurrentActive ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)] font-bold' : ''
                      }`}
                      title={`Click to apply: Wear ${cell.wear}x, SC ${Math.round(cell.scProb * 100)}%`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-f1 text-[11px] font-bold block truncate max-w-[120px]">
                          {cell.strategyName.replace('1-Stop: ', '').replace('2-Stop: ', '')}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5 text-[9px] opacity-80">
                          <span className={is1Stop ? 'text-emerald-400' : 'text-red-400'}>
                            {cell.stops}-STOP
                          </span>
                          <span>&bull;</span>
                          <span>+{cell.advantageSec}s edge</span>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend & Insight */}
      <div className="flex flex-wrap items-center justify-between text-[10px] text-neutral-400 pt-2 border-t border-white/[0.08] gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/80" />
            <span>1-Stop Optimal Regime (Low wear / Clean air)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-red-500/80" />
            <span>2-Stop Optimal Regime (High thermal degradation &ge; 1.4x)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs ring-1 ring-amber-400 bg-amber-400/20" />
            <span>Current Active Tactical Baseline</span>
          </div>
        </div>
      </div>
    </div>
  );
}
