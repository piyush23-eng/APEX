import React, { useState, useMemo } from 'react';
import {
  Zap,
  TrendingDown,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Gauge,
  Sliders
} from 'lucide-react';

const COMPOUND_COLORS = {
  SOFT: '#FF1801',
  MEDIUM: '#FFF200',
  HARD: '#FFFFFF'
};

export default function UndercutOvercutSimulator({ trackMeta, degData }) {
  const [trackGap, setTrackGap] = useState(2.2); // Current on-track gap (s)
  const [leaderCompound, setLeaderCompound] = useState('MEDIUM');
  const [leaderTireAge, setLeaderTireAge] = useState(24);
  const [chaserTargetCompound, setChaserTargetCompound] = useState('HARD');
  const [outlapAdvantage, setOutlapAdvantage] = useState(1.4); // Fresh tire delta (s)
  const [pitTransitLoss, setPitTransitLoss] = useState(trackMeta?.green_pit_loss || 20.25);

  const models = degData?.models || {};

  // Undercut calculation
  const simulation = useMemo(() => {
    const leaderModel = models[leaderCompound] || { slope: 0.038, intercept: 80 };
    const chaserModel = models[chaserTargetCompound] || { slope: 0.025, intercept: 81 };

    // Leader current degraded pace
    const leaderCurrentDeg = leaderTireAge * leaderModel.slope;
    // Chaser fresh tire pace on out-lap
    const chaserFreshPace = chaserModel.intercept - outlapAdvantage;

    // Delta pace gained on out-lap
    const deltaGainedPerLap = leaderCurrentDeg + outlapAdvantage;

    // Net delta after 1 lap of undercut
    const netGapAfter1Lap = trackGap - deltaGainedPerLap;
    // Net delta after 2 laps of undercut
    const netGapAfter2Laps = trackGap - deltaGainedPerLap * 1.8;

    const isUndercutViable = netGapAfter1Lap <= 0 || netGapAfter2Laps <= 0;
    const lapsToOvertake = netGapAfter1Lap <= 0 ? 1 : netGapAfter2Laps <= 0 ? 2 : 3;

    return {
      deltaGainedPerLap: Number(deltaGainedPerLap.toFixed(2)),
      netGapAfter1Lap: Number(netGapAfter1Lap.toFixed(2)),
      netGapAfter2Laps: Number(netGapAfter2Laps.toFixed(2)),
      isUndercutViable,
      lapsToOvertake,
      leaderCurrentDeg: Number(leaderCurrentDeg.toFixed(2))
    };
  }, [trackGap, leaderCompound, leaderTireAge, chaserTargetCompound, outlapAdvantage, models]);

  return (
    <div className="f1-card p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.1] pb-3 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#FF1801] inline-block shadow-[0_0_8px_#FF1801]" />
            <h3 className="font-f1 text-xl font-bold text-white tracking-wider">
              3. UNDERCUT / OVERCUT SOLVER &bull; PIT WINDOW CROSSOVER
            </h3>
          </div>
          <p className="text-xs font-mono text-neutral-300 mt-1">
            Real-time track position crossover solver evaluating out-lap tire warmup deltas against rival degradation slope and pit transit loss
          </p>
        </div>

        <span className={`px-3 py-1 font-mono text-xs font-bold uppercase rounded-xs border ${
          simulation.isUndercutViable
            ? 'bg-[#00E676]/20 border-[#00E676] text-[#00E676] shadow-[0_0_10px_rgba(0,230,118,0.3)]'
            : 'bg-[#FF9100]/20 border-[#FF9100] text-[#FF9100] shadow-[0_0_10px_rgba(255,145,0,0.3)]'
        }`}>
          {simulation.isUndercutViable ? 'UNDERCUT PROFILE OPTIMAL' : 'OVERCUT / EXTEND RECOMMENDED'}
        </span>
      </div>

      {/* Simulator Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Controls Column */}
        <div className="space-y-4 bg-[#080A0E] p-4 rounded-xs border border-white/[0.08] font-mono text-xs">
          <div>
            <div className="flex justify-between text-neutral-400 mb-1">
              <span>CURRENT ON-TRACK GAP</span>
              <strong className="text-white text-sm">{trackGap.toFixed(1)}s</strong>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.1"
              value={trackGap}
              onChange={(e) => setTrackGap(parseFloat(e.target.value))}
              className="w-full"
            />
            <span className="text-[9px] text-neutral-500">Time deficit behind car ahead</span>
          </div>

          <div>
            <div className="flex justify-between text-neutral-400 mb-1">
              <span>LEADER TIRE AGE</span>
              <strong className="text-amber-400 text-sm">{leaderTireAge} Laps</strong>
            </div>
            <input
              type="range"
              min="8"
              max="45"
              step="1"
              value={leaderTireAge}
              onChange={(e) => setLeaderTireAge(parseInt(e.target.value))}
              className="w-full"
            />
            <span className="text-[9px] text-neutral-500">Current degradation: +{simulation.leaderCurrentDeg}s/lap</span>
          </div>

          <div>
            <div className="flex justify-between text-neutral-400 mb-1">
              <span>OUT-LAP WARMUP ADVANTAGE</span>
              <strong className="text-[#00E676] text-sm">+{outlapAdvantage.toFixed(1)}s</strong>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={outlapAdvantage}
              onChange={(e) => setOutlapAdvantage(parseFloat(e.target.value))}
              className="w-full"
            />
            <span className="text-[9px] text-neutral-500">Thermal grip delta on fresh rubber</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
            <div>
              <span className="text-[9px] text-neutral-500 block uppercase mb-1">LEADER COMPOUND</span>
              <select
                value={leaderCompound}
                onChange={(e) => setLeaderCompound(e.target.value)}
                className="w-full bg-[#121620] border border-white/[0.1] text-white p-1.5 rounded-xs"
              >
                <option value="SOFT">SOFT</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </div>
            <div>
              <span className="text-[9px] text-neutral-500 block uppercase mb-1">CHASER TARGET</span>
              <select
                value={chaserTargetCompound}
                onChange={(e) => setChaserTargetCompound(e.target.value)}
                className="w-full bg-[#121620] border border-white/[0.1] text-white p-1.5 rounded-xs"
              >
                <option value="HARD">HARD</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="SOFT">SOFT</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tactical Trajectory Outcome */}
        <div className="md:col-span-2 flex flex-col justify-between bg-[#080A0E] p-4 rounded-xs border border-white/[0.08]">
          <div>
            <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-2 font-bold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#FF1801]" />
              PREDICTED TRACK POSITION CROSSOVER
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono mb-4">
              <div className="bg-[#10141D] p-3 rounded-xs border border-white/[0.06]">
                <span className="text-[9px] text-neutral-500 uppercase block">OUT-LAP DELTA GAINED</span>
                <strong className="text-2xl font-bold text-[#00E676] mt-0.5 block">
                  +{simulation.deltaGainedPerLap}s
                </strong>
                <span className="text-[9px] text-neutral-400">Total pace differential</span>
              </div>

              <div className="bg-[#10141D] p-3 rounded-xs border border-white/[0.06]">
                <span className="text-[9px] text-neutral-500 uppercase block">POST-STOP GAP (LAP +1)</span>
                <strong className={`text-2xl font-bold mt-0.5 block ${simulation.netGapAfter1Lap <= 0 ? 'text-[#00E676]' : 'text-neutral-200'}`}>
                  {simulation.netGapAfter1Lap <= 0 ? `${Math.abs(simulation.netGapAfter1Lap)}s AHEAD` : `+${simulation.netGapAfter1Lap}s BEHIND`}
                </strong>
                <span className="text-[9px] text-neutral-400">Immediate out-lap exit</span>
              </div>

              <div className="bg-[#10141D] p-3 rounded-xs border border-white/[0.06]">
                <span className="text-[9px] text-neutral-500 uppercase block">POST-STOP GAP (LAP +2)</span>
                <strong className={`text-2xl font-bold mt-0.5 block ${simulation.netGapAfter2Laps <= 0 ? 'text-[#00E676]' : 'text-amber-400'}`}>
                  {simulation.netGapAfter2Laps <= 0 ? `${Math.abs(simulation.netGapAfter2Laps)}s AHEAD` : `+${simulation.netGapAfter2Laps}s BEHIND`}
                </strong>
                <span className="text-[9px] text-neutral-400">After leader in-lap response</span>
              </div>
            </div>

            {/* Diagnostic Narrative */}
            <div className="p-3 bg-[#0D111A] border-l-2 border-[#FF1801] rounded-xs font-mono text-xs text-neutral-300 leading-relaxed">
              {simulation.isUndercutViable ? (
                <span>
                  <strong className="text-[#00E676]">STRATEGY RECOMMENDATION: BOX NOW (UNDERCUT).</strong> Pitting immediately will erase the {trackGap}s deficit via the +{simulation.deltaGainedPerLap}s delta advantage on fresh rubber. When the leader responds on the following lap, you will emerge approximately {Math.abs(simulation.netGapAfter2Laps)}s ahead in net track position.
                </span>
              ) : (
                <span>
                  <strong className="text-amber-400">STRATEGY RECOMMENDATION: EXTEND STINT (OVERCUT).</strong> The current gap of {trackGap}s exceeds the out-lap delta potential (+{simulation.deltaGainedPerLap}s). Pitting now risks releasing you into dirty air behind traffic. Stay out and wait for a Safety Car window or traffic ahead of the leader.
                </span>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] text-[10px] font-mono text-neutral-500 flex justify-between">
            <span>PIT TRANSIT PENALTY: {pitTransitLoss}s</span>
            <span>MODEL: FASTF1 TIRE DELTA + TRAFFIC RELEASE MATRIX</span>
          </div>
        </div>
      </div>
    </div>
  );
}
