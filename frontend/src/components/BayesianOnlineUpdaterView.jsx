import React, { useState } from 'react';
import { Brain, Play, RotateCcw, ShieldAlert, Sparkles, TrendingUp, Zap, ChevronRight } from 'lucide-react';

const INITIAL_PRIOR_SLOPE = 0.025;
const INITIAL_PRIOR_VAR = 0.0004; // 0.02^2
const NOISE_SIGMA = 0.22;

export default function BayesianOnlineUpdaterView({ trackId = 'monaco', trackMeta }) {
  const [laps, setLaps] = useState([]);
  const [posteriorSlope, setPosteriorSlope] = useState(INITIAL_PRIOR_SLOPE);
  const [credibleInterval, setCredibleInterval] = useState([-0.0142, 0.0642]);
  const [stintStatus, setStintStatus] = useState('NOMINAL PRE-RACE PRIOR');
  const [isGrainingTriggered, setIsGrainingTriggered] = useState(false);

  // Ingest one more telemetry lap
  const ingestNextLap = (forceGraining = false) => {
    const nextLapNum = laps.length + 1;
    if (nextLapNum > 35) return;

    // Simulate physics: fuel burnoff + true tire wear
    const trueWear = (forceGraining || isGrainingTriggered || nextLapNum >= 12) ? 0.046 : 0.026;
    if (forceGraining) setIsGrainingTriggered(true);

    const basePace = 78.40;
    const fuelCorrectionPerLap = trackMeta?.fuel_burn_rate || 0.035;
    const noise = (Math.random() - 0.5) * 0.35;
    const rawTime = basePace + (trueWear * nextLapNum) - (nextLapNum * fuelCorrectionPerLap) + noise;
    const fuelCorrTime = rawTime + (nextLapNum - 1) * fuelCorrectionPerLap;

    const newLaps = [...laps, { lap: nextLapNum, rawTime, fuelCorrTime, trueWear }];
    setLaps(newLaps);

    // Exact conjugate Bayesian regression update:
    // Sigma_N^-1 = Sigma_0^-1 + (1 / sigma^2) * sum(x_i^2)
    const sigma2 = NOISE_SIGMA * NOISE_SIGMA;
    let sumX2 = 0;
    let sumXY = 0;

    newLaps.forEach(l => {
      const x = l.lap;
      const y = l.fuelCorrTime - basePace; // centered slope
      sumX2 += x * x;
      sumXY += x * y;
    });

    const sigma0_inv = 1.0 / INITIAL_PRIOR_VAR;
    const sigmaN_inv = sigma0_inv + (sumX2 / sigma2);
    const sigmaN = 1.0 / sigmaN_inv;
    const muN = sigmaN * (sigma0_inv * INITIAL_PRIOR_SLOPE + (sumXY / sigma2));

    const postStd = Math.sqrt(sigmaN);
    const ciLow = muN - 1.96 * postStd;
    const ciHigh = muN + 1.96 * postStd;

    setPosteriorSlope(muN);
    setCredibleInterval([ciLow, ciHigh]);

    if (muN > 0.038 && newLaps.length >= 6) {
      setStintStatus('🚨 TACTICAL ALERT: COMPOUND ABLATION DRIFT (PIT WINDOW ADVANCED -4 LAPS)');
    } else if (newLaps.length >= 4) {
      setStintStatus('POSTERIOR CONVERGENCE: NOMINAL LINEAR WEAR REGIME');
    } else {
      setStintStatus('COLLECTING TELEMETRY (PRIOR DOMINATED)');
    }
  };

  const fastForward15Laps = () => {
    resetSimulation();
    let currentLaps = [];
    let statePosterior = INITIAL_PRIOR_SLOPE;
    let stateCI = [-0.0142, 0.0642];

    for (let lap = 1; lap <= 15; lap++) {
      const trueWear = lap >= 10 ? 0.048 : 0.026;
      const basePace = 78.40;
      const fuelRate = trackMeta?.fuel_burn_rate || 0.035;
      const noise = (Math.random() - 0.5) * 0.35;
      const raw = basePace + (trueWear * lap) - (lap * fuelRate) + noise;
      const corr = raw + (lap - 1) * fuelRate;
      currentLaps.push({ lap, rawTime: raw, fuelCorrTime: corr, trueWear });
    }

    const sigma2 = NOISE_SIGMA * NOISE_SIGMA;
    let sumX2 = 0;
    let sumXY = 0;
    currentLaps.forEach(l => {
      sumX2 += l.lap * l.lap;
      sumXY += l.lap * (l.fuelCorrTime - 78.40);
    });

    const sigmaN_inv = (1.0 / INITIAL_PRIOR_VAR) + (sumX2 / sigma2);
    const sigmaN = 1.0 / sigmaN_inv;
    const muN = sigmaN * ((1.0 / INITIAL_PRIOR_VAR) * INITIAL_PRIOR_SLOPE + (sumXY / sigma2));
    const postStd = Math.sqrt(sigmaN);

    setLaps(currentLaps);
    setPosteriorSlope(muN);
    setCredibleInterval([muN - 1.96 * postStd, muN + 1.96 * postStd]);
    setIsGrainingTriggered(true);
    setStintStatus('🚨 TACTICAL ALERT: COMPOUND ABLATION DRIFT (PIT WINDOW ADVANCED -4 LAPS)');
  };

  const resetSimulation = () => {
    setLaps([]);
    setPosteriorSlope(INITIAL_PRIOR_SLOPE);
    setCredibleInterval([-0.0142, 0.0642]);
    setStintStatus('NOMINAL PRE-RACE PRIOR');
    setIsGrainingTriggered(false);
  };

  return (
    <div className="f1-card p-5 flex flex-col gap-4 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.1] pb-3 gap-2">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-cyan-400" />
          <div>
            <h4 className="font-f1 text-sm font-bold text-white tracking-wider uppercase">
              5. IN-RACE BAYESIAN ONLINE LEARNING &bull; LIVE TELEMETRY DEGRADATION DRIFT
            </h4>
            <span className="text-[10px] text-neutral-400">
              Conjugate Gaussian updating (&mu;_N, &Sigma;_N) running per transponder sector trigger
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => ingestNextLap(false)}
            disabled={laps.length >= 35}
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-f1 font-bold text-[11px] uppercase rounded-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            Ingest Lap {laps.length + 1}
          </button>
          <button
            onClick={fastForward15Laps}
            className="px-3 py-1.5 bg-[#FF1801] hover:bg-white text-black font-f1 font-bold text-[11px] uppercase rounded-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-black" />
            Simulate High-Wear Drift
          </button>
          <button
            onClick={resetSimulation}
            className="p-1.5 bg-white/[0.08] hover:bg-white/[0.15] text-neutral-300 rounded-xs transition-all cursor-pointer"
            title="Reset Telemetry Stream"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Status Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#090C12] p-3 rounded-xs border border-white/[0.08]">
          <span className="text-[9px] text-neutral-400 uppercase block font-bold">LAPS OBSERVED (N)</span>
          <strong className="text-xl font-bold text-white mt-0.5 block">{laps.length} LAPS</strong>
          <span className="text-[10px] text-neutral-400">Sample buffer size</span>
        </div>

        <div className="bg-[#090C12] p-3 rounded-xs border border-white/[0.08]">
          <span className="text-[9px] text-neutral-400 uppercase block font-bold">POSTERIOR WEAR SLOPE (&mu;_N)</span>
          <strong className="text-xl font-bold text-cyan-400 mt-0.5 block">
            {posteriorSlope >= 0 ? `+${posteriorSlope.toFixed(4)}` : posteriorSlope.toFixed(4)} s/lap
          </strong>
          <span className="text-[10px] text-neutral-400">Pre-race prior: +{INITIAL_PRIOR_SLOPE.toFixed(3)}s</span>
        </div>

        <div className="bg-[#090C12] p-3 rounded-xs border border-white/[0.08]">
          <span className="text-[9px] text-neutral-400 uppercase block font-bold">95% CREDIBLE INTERVAL</span>
          <strong className="text-sm font-bold text-amber-300 mt-1 block">
            [{credibleInterval[0].toFixed(3)}, {credibleInterval[1].toFixed(3)}]
          </strong>
          <span className="text-[10px] text-neutral-400">Uncertainty envelope</span>
        </div>

        <div className="bg-[#090C12] p-3 rounded-xs border border-white/[0.08]">
          <span className="text-[9px] text-neutral-400 uppercase block font-bold">TACTICAL PIT DECISION</span>
          <strong className={`text-xs font-bold mt-1 block ${stintStatus.includes('🚨') ? 'text-[#FF1801] animate-pulse' : 'text-emerald-400'}`}>
            {stintStatus.includes('🚨') ? 'BOX WINDOW ADVANCED' : 'NOMINAL STINT LENGTH'}
          </strong>
          <span className="text-[10px] text-neutral-400">In-race strategy controller</span>
        </div>
      </div>

      {/* Banner Alert */}
      <div className={`p-3 rounded-xs border flex items-center justify-between gap-3 text-xs ${
        stintStatus.includes('🚨')
          ? 'bg-red-950/40 border-red-700/60 text-red-200 shadow-[0_0_15px_rgba(255,24,1,0.2)]'
          : 'bg-[#0B0F17] border-white/[0.08] text-neutral-300'
      }`}>
        <div className="flex items-center gap-2">
          {stintStatus.includes('🚨') ? (
            <ShieldAlert className="w-4 h-4 text-[#FF1801] shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          )}
          <span>{stintStatus}</span>
        </div>
        <span className="text-[10px] opacity-75 font-mono hidden sm:inline">
          {laps.length > 0 ? `Confidence contraction: ${(100 - (credibleInterval[1] - credibleInterval[0]) / 0.0784 * 100).toFixed(0)}% uncertainty eliminated` : 'Prior initialized'}
        </span>
      </div>

      {/* Live Ingestion Table */}
      {laps.length > 0 && (
        <div className="overflow-x-auto max-h-[160px] overflow-y-auto border border-white/[0.08] rounded-xs bg-black/40">
          <table className="w-full text-left text-[11px] font-mono">
            <thead className="bg-[#090C12] sticky top-0 border-b border-white/[0.08] text-neutral-400 text-[10px]">
              <tr>
                <th className="p-2">STINT LAP</th>
                <th className="p-2">RAW TRANSPONDER PACE</th>
                <th className="p-2">FUEL MASS NORMALIZED</th>
                <th className="p-2">TRUE SURFACE WEAR</th>
                <th className="p-2">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {laps.slice().reverse().map(l => (
                <tr key={l.lap} className="hover:bg-white/[0.03]">
                  <td className="p-2 text-white font-bold">Lap {l.lap}</td>
                  <td className="p-2 text-neutral-300">{l.rawTime.toFixed(3)}s</td>
                  <td className="p-2 text-cyan-400 font-bold">{l.fuelCorrTime.toFixed(3)}s</td>
                  <td className="p-2 text-amber-300">+{l.trueWear.toFixed(3)} s/lap</td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded-xs text-[9px] ${
                      l.trueWear > 0.035 ? 'bg-red-950/60 text-red-300 border border-red-800' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                    }`}>
                      {l.trueWear > 0.035 ? 'SURFACE GRAINING' : 'LAMINAR'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
