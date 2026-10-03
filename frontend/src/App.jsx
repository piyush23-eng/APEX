import React, { useState, useMemo } from 'react';
import Circuit3D from './components/Circuit3D';
import TelemetryHub from './components/TelemetryHub';
import {
  Activity,
  Gauge,
  Flame,
  ShieldAlert,
  Cpu,
  Layers,
  Award,
  ChevronDown
} from 'lucide-react';
import f1Data from './f1_api_data.json';

export default function App() {
  const [selectedTrackId, setSelectedTrackId] = useState('monaco');
  const [selectedRank, setSelectedRank] = useState(1);

  const tracks = f1Data.tracks;
  const currentTrackMeta = useMemo(() => {
    return tracks.find(t => t.id === selectedTrackId) || tracks[0];
  }, [tracks, selectedTrackId]);

  const degData = f1Data.degradation[selectedTrackId];
  const simData = f1Data.simulations[selectedTrackId];
  const valData = f1Data.validation[selectedTrackId];

  // Active strategy
  const activeStrategy = useMemo(() => {
    if (!simData || !simData.strategies) return null;
    return simData.strategies.find(s => s.rank === selectedRank) || simData.strategies[0];
  }, [simData, selectedRank]);

  const optimalPitLap = activeStrategy && activeStrategy.pit_laps.length > 0 ? activeStrategy.pit_laps[0] : 32;
  const optimalCompound = activeStrategy && activeStrategy.stints.length > 1 ? activeStrategy.stints[1].compound : 'HARD';

  return (
    <div className="min-h-screen bg-[#060709] text-neutral-200 flex flex-col selection:bg-[#E10600] selection:text-white pb-16">
      {/* Top Telemetry Header */}
      <header className="border-b border-[#21242e] px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between bg-[#0A0C10]/95 backdrop-blur-md sticky top-0 z-50 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-5 h-7 bg-[#E10600] flex items-center justify-center font-f1 text-[11px] text-black font-extrabold shadow-lg">
            F1
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-f1 text-2xl font-extrabold tracking-wider text-white leading-none">
                APEX STRAT
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#E10600]/20 text-[#E10600] border border-[#E10600]/40 font-bold rounded-xs">
                MOTORSPORT DATA SCIENCE SUITE
              </span>
            </div>
            <div className="text-[10px] font-mono text-neutral-400 tracking-widest uppercase mt-0.5">
              FASTF1 TELEMETRY PIPELINE &bull; LINEAR DEGRADATION &bull; MONTE CARLO STOCHASTIC ENGINE
            </div>
          </div>
        </div>

        {/* Status Indicators & Live Tickers */}
        <div className="flex items-center gap-4 font-mono text-xs">
          <div className="flex items-center gap-2 px-3 py-1 bg-[#12151B] border border-[#23252a] rounded-xs text-neutral-300">
            <Cpu className="w-3.5 h-3.5 text-[#E10600]" />
            <span>FASTF1 CACHE: <strong className="text-white">SYNCHRONIZED</strong></span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#12151B] border border-[#23252a] rounded-xs text-neutral-300">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>SIMULATIONS: <strong className="text-white">N=1,000 / TRACK</strong></span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
        {/* Top Grand Prix Selector & Tactical KPI Deck */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="f1-card p-4 flex flex-col justify-between">
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-semibold">
              GRAND PRIX CIRCUIT TARGET
            </span>
            <select
              value={selectedTrackId}
              onChange={(e) => {
                setSelectedTrackId(e.target.value);
                setSelectedRank(1);
              }}
              className="bg-[#07080B] border border-[#33353e] text-white font-f1 font-bold text-lg uppercase px-3 py-2 focus:outline-none focus:border-[#E10600] mt-1.5 cursor-pointer rounded-xs"
            >
              {tracks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.year})
                </option>
              ))}
            </select>
          </div>

          <div className="f1-card p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-semibold">
                HISTORICAL SAFETY CAR RATE
              </span>
              <div className="font-mono text-3xl font-extrabold text-white mt-0.5">
                {(currentTrackMeta.historical_sc_rate * 100).toFixed(0)}<span className="text-[#E10600] text-xl font-bold">%</span>
              </div>
              <div className="text-[10px] font-mono text-neutral-500 mt-0.5">Stochastic Deployment Window</div>
            </div>
            <ShieldAlert className="w-8 h-8 text-[#E10600] opacity-80" />
          </div>

          <div className="f1-card p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-semibold">
                EMPIRICAL PIT LOSS DELTA
              </span>
              <div className="font-mono text-3xl font-extrabold text-white mt-0.5">
                {currentTrackMeta.green_pit_loss.toFixed(1)}<span className="text-neutral-500 text-sm font-normal">s</span> / {currentTrackMeta.sc_pit_loss.toFixed(1)}<span className="text-neutral-500 text-sm font-normal">s</span>
              </div>
              <div className="text-[10px] font-mono text-emerald-400 mt-0.5">Green Transit / Under SC</div>
            </div>
            <Gauge className="w-8 h-8 text-neutral-400 opacity-80" />
          </div>

          <div className="f1-card p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-semibold">
                MODEL-RANKED #1 COMPOUND
              </span>
              <div className="font-mono text-3xl font-extrabold text-white mt-0.5 flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-white border border-neutral-400 inline-block shadow-sm" />
                {optimalCompound}
              </div>
              <div className="text-[10px] font-mono text-neutral-500 mt-0.5">Optimal Box Window: Lap {optimalPitLap}</div>
            </div>
            <Flame className="w-8 h-8 text-[#E10600] opacity-80" />
          </div>
        </div>

        {/* 3D Dynamic Circuit Spline Hero */}
        <section>
          <Circuit3D
            trackId={selectedTrackId}
            trackName={currentTrackMeta.name}
            pitLap={optimalPitLap}
            tireCompound={optimalCompound}
          />
        </section>

        {/* Integrated Telemetry Hub (Strategy Deck, Tire Signal, Lap Gap, Benchmark) */}
        <section>
          <TelemetryHub
            trackMeta={currentTrackMeta}
            degData={degData}
            simData={simData}
            valData={valData}
            selectedRank={selectedRank}
            onSelectRank={(r) => setSelectedRank(r)}
          />
        </section>
      </main>

      {/* Engineering Footer */}
      <footer className="border-t border-[#1b1e26] px-6 py-6 text-center text-xs font-mono text-neutral-500 bg-[#090B0E] flex flex-col md:flex-row items-center justify-between max-w-7xl mx-auto w-full gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#E10600]" />
          <span>PORTFOLIO SPECIFICATION: STATISTICAL TIRE MODELING &bull; MONTE CARLO SIMULATION &bull; FASTF1 API</span>
        </div>
        <div className="text-neutral-400">
          DESIGNED FOR FORMULA 1 RACE STRATEGY &amp; APPLIED DATA SCIENCE INTERVIEWS
        </div>
      </footer>
    </div>
  );
}
