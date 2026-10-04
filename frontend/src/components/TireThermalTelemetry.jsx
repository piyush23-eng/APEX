import React, { useState } from 'react';
import {
  Flame,
  Gauge,
  Thermometer,
  ShieldCheck,
  TrendingDown,
  Layers,
  Zap,
  Info,
  Wind
} from 'lucide-react';
import extData from '../telemetry_extended_data.json';

const COMPOUND_COLORS = {
  SOFT: '#FF1801',
  MEDIUM: '#FFF200',
  HARD: '#FFFFFF'
};

export default function TireThermalTelemetry({ trackId = 'monaco', trackMeta }) {
  const [selectedComp, setSelectedComp] = useState('MEDIUM');
  const [simLapAge, setSimLapAge] = useState(18);
  const [followGap, setFollowGap] = useState(1.0); // Following interval behind leading car (s)

  const specs = extData.tire_specs[trackId] || extData.tire_specs.monaco;
  const currentSpec = specs[selectedComp] || specs.MEDIUM;

  // Aerodynamic wake decay calculations: Delta_CL = -35% * exp(-gap / 0.85)
  const downforceLossPct = Math.min(38.0, 35.0 * Math.exp(-followGap / 0.85));
  const dirtyWearMultiplier = Number((1.0 + 0.35 * Math.exp(-followGap / 0.90)).toFixed(2));

  // Estimated penalty calculation incorporating thermal degradation and dirty air
  const slope = (selectedComp === 'SOFT' ? 0.052 : selectedComp === 'MEDIUM' ? 0.038 : 0.024) * dirtyWearMultiplier;
  const linearPenalty = Number((simLapAge * slope).toFixed(2));
  const isPastCliff = simLapAge > currentSpec.deg_cliff_lap;
  const cliffPenalty = isPastCliff ? Number(((simLapAge - currentSpec.deg_cliff_lap) * 0.12).toFixed(2)) : 0;
  const totalPenalty = Number((linearPenalty + cliffPenalty).toFixed(2));
  const remainingRubberPct = Math.max(10, Math.round(100 - (simLapAge / currentSpec.deg_cliff_lap) * 75 * dirtyWearMultiplier));

  return (
    <div className="f1-card p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.1] pb-3 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#FF1801] inline-block shadow-[0_0_8px_#FF1801]" />
            <h3 className="font-f1 text-xl font-bold text-white tracking-wider">
              4. PIRELLI COMPOUND PHYSICS &bull; THERMAL DEGRADATION CLIFFS
            </h3>
          </div>
          <p className="text-xs font-mono text-neutral-300 mt-1">
            Physical rubber compound specifications, carcass thermal operating windows, volumetric wear rates, and non-linear degradation cliffs
          </p>
        </div>

        {/* Compound Selector Pills */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {['SOFT', 'MEDIUM', 'HARD'].map(comp => (
            <button
              key={comp}
              onClick={() => setSelectedComp(comp)}
              className={`f1-compound-pill ${selectedComp === comp ? 'f1-compound-pill-active' : ''}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block mr-1.5 shadow-xs"
                style={{ backgroundColor: COMPOUND_COLORS[comp] }}
              />
              {comp}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Physical Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
        <div className="bg-[#090C12] p-3 rounded-xs border border-white/[0.1]">
          <span className="text-[9px] text-neutral-400 uppercase block font-bold">COMPOUND CODE &amp; GRADE</span>
          <strong className="text-xl font-bold text-white mt-0.5 block flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: COMPOUND_COLORS[selectedComp] }}
            />
            {selectedComp} ({currentSpec.compound})
          </strong>
          <span className="text-[10px] text-neutral-300">Peak Thermal Grip: {currentSpec.peak_laps} Laps</span>
        </div>

        <div className="bg-[#090C12] p-3 rounded-xs border border-white/[0.1]">
          <span className="text-[9px] text-neutral-400 uppercase block font-bold">CARCASS BULK THERMAL WINDOW</span>
          <strong className="text-xl font-bold text-amber-400 mt-0.5 block">
            {currentSpec.working_range}
          </strong>
          <span className="text-[10px] text-neutral-300">Optimum viscoelastic hysteresis range</span>
        </div>

        <div className="bg-[#090C12] p-3 rounded-xs border border-white/[0.1]">
          <span className="text-[9px] text-neutral-400 uppercase block font-bold">CRITICAL DEGRADATION CLIFF (L_crit)</span>
          <strong className="text-xl font-bold text-[#FF1801] mt-0.5 block">
            LAP {currentSpec.deg_cliff_lap}
          </strong>
          <span className="text-[10px] text-neutral-300">Thermal ablation &amp; delamination threshold</span>
        </div>

        <div className="bg-[#090C12] p-3 rounded-xs border border-white/[0.1]">
          <span className="text-[9px] text-neutral-400 uppercase block font-bold">VOLUMETRIC RUBBER ABLATION RATE</span>
          <strong className="text-xl font-bold text-[#00E676] mt-0.5 block">
            {currentSpec.rubber_loss_um}
          </strong>
          <span className="text-[10px] text-neutral-300">Cold Tear / Graining Risk: {currentSpec.graining_risk}</span>
        </div>
      </div>

      {/* Interactive Stint Degradation Calculator */}
      <div className="bg-[#080A0E] p-4 rounded-xs border border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs">
        <div className="flex-1 w-full">
          <div className="flex justify-between text-neutral-300 mb-1.5">
            <span>SIMULATE STINT AGING: <strong className="text-white">{simLapAge} LAPS</strong></span>
            <span>RESIDUAL USABLE TREAD DEPTH: <strong className={remainingRubberPct < 30 ? 'text-[#FF1801]' : 'text-[#00E676]'}>{remainingRubberPct}%</strong></span>
          </div>
          <input
            type="range"
            min="1"
            max="60"
            value={simLapAge}
            onChange={(e) => setSimLapAge(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[9px] text-neutral-500 mt-1">
            <span>Lap 1 (New Scrubbed)</span>
            <span>Critical Cliff: Lap {currentSpec.deg_cliff_lap}</span>
            <span>Lap 60 (Structural Failure)</span>
          </div>
        </div>

        <div className="bg-[#121620] px-4 py-2 rounded-xs border border-white/[0.08] shrink-0 text-right">
          <span className="text-[9px] text-neutral-500 uppercase block">CUMULATIVE PACE DEFICIT (&Delta;t_deg)</span>
          <strong className="text-2xl font-bold text-white block">
            +{totalPenalty}s<span className="text-xs text-neutral-400">/lap</span>
          </strong>
          {isPastCliff ? (
            <span className="text-[10px] text-[#FF1801] font-bold uppercase animate-pulse">
              CRITICAL CLIFF CROSSED: NON-LINEAR THERMAL ABLATION (+{cliffPenalty}s)
            </span>
          ) : (
            <span className="text-[10px] text-emerald-400 uppercase">
              LINEAR WEAR REGIME (HUBER FIT)
            </span>
          )}
        </div>
      </div>

      {/* Aerodynamic Development & Dirty-Air Wake Turbulence (JD Core: Aero x Performance x Strategy) */}
      <div className="bg-[#080A0E] p-4 rounded-xs border border-white/[0.08] flex flex-col gap-3 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.08] pb-2 gap-2">
          <div className="flex items-center gap-2">
            <Wind className="w-4 h-4 text-cyan-400" />
            <strong className="text-white font-f1 uppercase tracking-wider text-sm">
              Aerodynamic Development &bull; Turbulent Wake Degradation Coupling
            </strong>
          </div>
          <span className="text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-800/50 px-2 py-0.5 rounded-xs font-bold uppercase">
            Venturi Tunnel Ground-Effect Model
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex justify-between text-neutral-300 mb-1">
              <span>FOLLOWING INTERVAL (&Delta;t_gap)</span>
              <strong className="text-cyan-400 text-sm">{followGap.toFixed(1)}s</strong>
            </div>
            <input
              type="range"
              min="0.3"
              max="3.0"
              step="0.1"
              value={followGap}
              onChange={(e) => setFollowGap(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-neutral-400 mt-1">
              <span>0.3s (Turbulent Train)</span>
              <span className={followGap < 1.0 ? 'text-[#FF1801] font-bold' : followGap < 1.8 ? 'text-amber-400 font-bold' : 'text-[#00E676] font-bold'}>
                {followGap < 0.9 ? 'DIRTY AIR: Severe Downforce Loss' : followGap < 1.8 ? 'TURBULENT WAKE: High Slip' : 'CLEAN AIR: Optimal Laminar'}
              </span>
              <span>3.0s (Clean Air)</span>
            </div>
          </div>

          <div className="bg-[#0D111A] p-3 rounded-xs border border-white/[0.06] flex flex-col justify-between">
            <span className="text-[9px] text-neutral-400 uppercase font-bold">AERODYNAMIC DOWNFORCE LOSS</span>
            <div className="text-2xl font-bold text-[#FF1801] mt-0.5">
              -{downforceLossPct.toFixed(1)}%
            </div>
            <span className="text-[10px] text-neutral-400">Front wing vortex authority decay</span>
          </div>

          <div className="bg-[#0D111A] p-3 rounded-xs border border-white/[0.06] flex flex-col justify-between">
            <span className="text-[9px] text-neutral-400 uppercase font-bold">DIRTY-AIR WEAR MULTIPLIER</span>
            <div className="text-2xl font-bold text-amber-400 mt-0.5">
              {dirtyWearMultiplier.toFixed(2)}x
            </div>
            <span className="text-[10px] text-neutral-400">Micro-slip thermal graining acceleration</span>
          </div>
        </div>
      </div>
    </div>
  );
}
