import React from 'react';
import { Award, CheckCircle2, AlertTriangle, ShieldAlert, FileText, Check, ChevronRight } from 'lucide-react';

const COMPOUND_COLORS = {
  SOFT: '#E10600',
  MEDIUM: '#FFD700',
  HARD: '#FFFFFF',
  INTERMEDIATE: '#39B54A',
  WET: '#00AEEF'
};

export default function ValidationReport({ valData }) {
  if (!valData) return null;

  const { track, year, winner, model_match, analysis_writeup } = valData;

  const isExactP1 = model_match.rank === 1;
  const isTopTier = model_match.rank <= 3;

  return (
    <div className="bg-[#0E0F13] border border-[#23252a] p-5 flex flex-col gap-5 rounded-sm shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#23252a] pb-4 gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 bg-[#E10600] inline-block" />
            <h3 className="font-heading text-xl uppercase tracking-wider font-extrabold text-white">
              Ground-Truth Historical Validation &bull; {track} ({year})
            </h3>
          </div>
          <p className="text-xs font-mono text-neutral-400 mt-1">
            Empirical benchmark comparing model-recommended pit sequences against actual race-winning strategies
          </p>
        </div>

        {/* Tier Status Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-xs font-mono font-extrabold uppercase border rounded-xs tracking-wider ${
            isExactP1
              ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-400'
              : isTopTier
              ? 'bg-blue-950/80 border-blue-500/70 text-blue-400'
              : 'bg-amber-950/80 border-amber-500/70 text-amber-400'
          }`}>
            {model_match.tier} &bull; Model Rank #{model_match.rank}
          </span>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Actual Historical Winner Box */}
        <div className="bg-[#13151A] border border-[#23252a] p-4 flex flex-col justify-between rounded-xs">
          <div className="flex items-center justify-between border-b border-[#1f2127] pb-2 mb-3">
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest font-semibold">
              ACTUAL GRAND PRIX WINNER
            </span>
            <span className="font-mono text-xs font-bold text-white px-2 py-0.5 bg-[#1a1c22] border border-[#2c2e38] rounded-xs">
              {winner.team}
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-3">
            <span className="font-heading text-3xl font-extrabold text-white uppercase tracking-wide">
              {winner.driver}
            </span>
            <span className="text-xs font-mono text-neutral-400 font-medium">
              {winner.stops}-STOP STRATEGY
            </span>
          </div>

          {/* Stints */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {winner.stints.map((st, idx) => (
              <React.Fragment key={idx}>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0B0C0E] border border-[#262830] text-xs font-mono rounded-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: COMPOUND_COLORS[st.compound] || '#fff' }}
                  />
                  <span className="text-white font-bold">{st.compound}</span>
                  <span className="text-neutral-400 font-medium">({st.length} Laps)</span>
                </div>
                {idx < winner.stints.length - 1 && (
                  <span className="text-xs font-mono text-[#E10600] font-bold">&rarr;</span>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="text-xs font-mono text-neutral-400 pt-2 border-t border-[#1a1b20] flex items-center justify-between">
            <span>Actual Real-World Pit Lap:</span>
            <span className="text-white font-bold">{winner.pit_laps.length > 0 ? `Lap ${winner.pit_laps.join(', ')}` : 'No Stops'}</span>
          </div>
        </div>

        {/* Model Prediction Box */}
        <div className="bg-[#13151A] border border-[#23252a] p-4 flex flex-col justify-between rounded-xs">
          <div className="flex items-center justify-between border-b border-[#1f2127] pb-2 mb-3">
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest font-semibold">
              MONTE CARLO SIMULATOR PREDICTION
            </span>
            <span className="font-mono text-xs font-extrabold text-[#E10600] px-2 py-0.5 bg-[#E10600]/10 border border-[#E10600]/40 rounded-xs">
              RANK #{model_match.rank} OF 10
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-3">
            <span className="font-heading text-2xl font-extrabold text-white uppercase tracking-wide">
              {model_match.matched_strategy_name || "Optimal Strategy Sequence"}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-3 font-mono text-xs">
            <span className="text-neutral-400">Pit Window Timing Offset:</span>
            <span className="text-white font-bold px-2 py-0.5 bg-[#1c1e26] border border-[#2d2f3b] rounded-xs">
              {model_match.pit_error_laps} Laps Delta
            </span>
          </div>

          <div className="text-xs font-mono pt-2 border-t border-[#1a1b20] flex items-center justify-between">
            <span className="text-neutral-400">Tactical Alignment:</span>
            <span className={`font-bold ${isTopTier ? "text-emerald-400" : "text-amber-400"}`}>
              {isExactP1 ? "EXACT #1 STRATEGY MATCH" : isTopTier ? "HIGH CONFIDENCE STRATEGY WINDOW" : "TACTICAL DIVERGENCE DETECTED"}
            </span>
          </div>
        </div>
      </div>

      {/* Engineering Diagnostic Writeup */}
      <div className="bg-[#0B0C0E] border border-[#1f2127] p-4 rounded-xs">
        <div className="text-xs font-mono uppercase tracking-widest text-[#E10600] font-bold mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#E10600]" />
          TELEMETRY &amp; TACTICAL RACING DIAGNOSTIC REPORT
        </div>
        <p className="text-xs font-mono text-neutral-300 leading-relaxed">
          {analysis_writeup}
        </p>
      </div>
    </div>
  );
}
