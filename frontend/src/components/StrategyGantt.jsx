import React from 'react';

const TIRE_COLORS = {
  SOFT: { fill: '#E10600', text: '#FFFFFF', bg: 'rgba(225, 6, 0, 0.25)', border: '#E10600' },
  MEDIUM: { fill: '#FFD700', text: '#000000', bg: 'rgba(255, 215, 0, 0.25)', border: '#FFD700' },
  HARD: { fill: '#F0F2F6', text: '#000000', bg: 'rgba(240, 242, 246, 0.25)', border: '#FFFFFF' }
};

export default function StrategyGantt({ strategies, totalLaps = 78, selectedRank, onSelectStrategy }) {
  if (!strategies || strategies.length === 0) return null;

  const ticks = [];
  const step = totalLaps > 60 ? 10 : 5;
  for (let l = 0; l <= totalLaps; l += step) {
    ticks.push(l);
  }

  return (
    <div className="f1-card p-5 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#23252a] pb-3 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#E10600] inline-block" />
            <h3 className="font-f1 text-lg font-bold text-white tracking-wider">
              Race Stint Timeline &amp; Pit Windows (Gantt Architecture)
            </h3>
          </div>
          <p className="text-xs font-mono text-neutral-400 mt-0.5">
            Comparative tire compound life, mandatory crossover thresholds, and pit box timing across all 10 strategies
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#E10600]" /> SOFT</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FFD700]" /> MEDIUM</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-white" /> HARD</span>
        </div>
      </div>

      {/* Axis Laps Header */}
      <div className="relative w-full h-6 border-b border-[#1f222a] mt-1">
        <div className="absolute left-0 w-44 text-[10px] font-mono text-neutral-500 uppercase">
          STRATEGY CANDIDATE
        </div>
        <div className="absolute left-48 right-0 h-full flex justify-between items-center text-[10px] font-mono text-neutral-400">
          {ticks.map(t => (
            <span key={t} className="relative">
              L{t}
              <span className="absolute top-4 left-1/2 w-px h-2 bg-[#2d313c]" />
            </span>
          ))}
        </div>
      </div>

      {/* Gantt Strategy Rows */}
      <div className="flex flex-col gap-2 pt-1">
        {strategies.map((strat) => {
          const isSelected = strat.rank === selectedRank;
          const isP1 = strat.rank === 1;

          return (
            <div
              key={strat.rank}
              onClick={() => onSelectStrategy && onSelectStrategy(strat)}
              className={`flex items-center p-2 rounded-xs border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#181C25] border-[#E10600] shadow-md'
                  : 'bg-[#0E1015] border-[#1d2028] hover:border-[#383d4c]'
              }`}
            >
              {/* Left Label */}
              <div className="w-44 flex items-center gap-2.5 shrink-0">
                <span className={`w-6 h-6 flex items-center justify-center font-mono font-bold text-xs rounded-xs ${
                  isP1 ? 'bg-[#E10600] text-black font-extrabold' : 'bg-[#191C24] text-neutral-300'
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

              {/* Gantt Stint Track Ribbon */}
              <div className="flex-1 ml-4 h-7 bg-[#07080B] rounded-xs relative flex items-center overflow-hidden border border-[#1e212b]">
                {strat.stints.map((stint, sIdx) => {
                  const widthPercent = (stint.length / totalLaps) * 100;
                  const conf = TIRE_COLORS[stint.compound] || TIRE_COLORS.HARD;

                  return (
                    <div
                      key={sIdx}
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: conf.bg,
                        borderColor: conf.border
                      }}
                      className="h-full border-r relative flex items-center justify-center group"
                    >
                      <span
                        style={{ color: conf.fill }}
                        className="font-mono text-[11px] font-bold tracking-tight px-1 truncate"
                      >
                        {stint.compound[0]} &bull; {stint.length}L
                      </span>
                    </div>
                  );
                })}

                {/* Pit Stop Markers */}
                {strat.pit_laps.map((lap, pIdx) => {
                  const leftPercent = (lap / totalLaps) * 100;
                  return (
                    <div
                      key={pIdx}
                      style={{ left: `${leftPercent}%` }}
                      className="absolute top-0 bottom-0 w-1 bg-white flex items-center justify-center shadow-lg z-10"
                      title={`Pit Stop: Lap ${lap}`}
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
  );
}
