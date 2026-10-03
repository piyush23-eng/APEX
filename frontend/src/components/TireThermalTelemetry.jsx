import React, { useState } from 'react';
import {
  Flame,
  Gauge,
  Thermometer,
  ShieldCheck,
  TrendingDown,
  Layers,
  Zap,
  Info
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

  const specs = extData.tire_specs[trackId] || extData.tire_specs.monaco;
  const currentSpec = specs[selectedComp] || specs.MEDIUM;

  // Estimated penalty calculation
  const slope = selectedComp === 'SOFT' ? 0.052 : selectedComp === 'MEDIUM' ? 0.038 : 0.024;
  const linearPenalty = Number((simLapAge * slope).toFixed(2));
  const isPastCliff = simLapAge > currentSpec.deg_cliff_lap;
  const cliffPenalty = isPastCliff ? Number(((simLapAge - currentSpec.deg_cliff_lap) * 0.12).toFixed(2)) : 0;
  const totalPenalty = Number((linearPenalty + cliffPenalty).toFixed(2));
  const remainingRubberPct = Math.max(10, Math.round(100 - (simLapAge / currentSpec.deg_cliff_lap) * 75));

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
          <span className="text-[9px] text-neutral-400 uppercase block font-bold">PIRELLI ALLOCATION</span>
          <strong className="text-xl font-bold text-white mt-0.5 block flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: COMPOUND_COLORS[selectedComp] }}
            />
            {selectedComp} ({currentSpec.compound})
          </strong>
          <span className="text-[10px] text-neutral-300">Peak Window: {currentSpec.peak_laps} Laps</span>
        </div>

        <div className="bg-[#090C12] p-3 rounded-xs border border-white/[0.1]">
          <span className="text-[9px] text-neutral-400 uppercase block font-bold">OPTIMAL CARCASS TEMP</span>
          <strong className="text-xl font-bold text-amber-400 mt-0.5 block">
            {currentSpec.working_range}
          </strong>
          <span className="text-[10px] text-neutral-300">Thermal degradation threshold</span>
        </div>

        <div className="bg-[#090C12] p-3 rounded-xs border border-white/[0.1]">
          <span className="text-[9px] text-neutral-400 uppercase block font-bold">DEGRADATION CLIFF LAP</span>
          <strong className="text-xl font-bold text-[#FF1801] mt-0.5 block">
            LAP {currentSpec.deg_cliff_lap}
          </strong>
          <span className="text-[10px] text-neutral-300">Non-linear performance dropoff</span>
        </div>

        <div className="bg-[#090C12] p-3 rounded-xs border border-white/[0.1]">
          <span className="text-[9px] text-neutral-400 uppercase block font-bold">RUBBER LOSS RATE</span>
          <strong className="text-xl font-bold text-[#00E676] mt-0.5 block">
            {currentSpec.rubber_loss_um}
          </strong>
          <span className="text-[10px] text-neutral-300">Graining Risk: {currentSpec.graining_risk}</span>
        </div>
      </div>

      {/* Interactive Stint Degradation Calculator */}
      <div className="bg-[#080A0E] p-4 rounded-xs border border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs">
        <div className="flex-1 w-full">
          <div className="flex justify-between text-neutral-300 mb-1.5">
            <span>SIMULATE STINT AGE: <strong className="text-white">{simLapAge} LAPS</strong></span>
            <span>REMAINING TREAD: <strong className={remainingRubberPct < 30 ? 'text-[#FF1801]' : 'text-[#00E676]'}>{remainingRubberPct}%</strong></span>
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
            <span>Lap 1 (New)</span>
            <span>Cliff: Lap {currentSpec.deg_cliff_lap}</span>
            <span>Lap 60 (Exhausted)</span>
          </div>
        </div>

        <div className="bg-[#121620] px-4 py-2 rounded-xs border border-white/[0.08] shrink-0 text-right">
          <span className="text-[9px] text-neutral-500 uppercase block">PACE DEFICIT RELATIVE TO T0</span>
          <strong className="text-2xl font-bold text-white block">
            +{totalPenalty}s<span className="text-xs text-neutral-400">/lap</span>
          </strong>
          {isPastCliff ? (
            <span className="text-[10px] text-[#FF1801] font-bold uppercase animate-pulse">
              CLIFF REACHED (+{cliffPenalty}s EXTRA)
            </span>
          ) : (
            <span className="text-[10px] text-emerald-400 uppercase">
              LINEAR WEAR ZONE
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
