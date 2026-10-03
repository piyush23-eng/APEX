import React, { useState, useMemo, useEffect } from 'react';
import FastF1TelemetryChannels from './components/FastF1TelemetryChannels';
import LiveTimingTower from './components/LiveTimingTower';
import UndercutOvercutSimulator from './components/UndercutOvercutSimulator';
import TireThermalTelemetry from './components/TireThermalTelemetry';
import TelemetryHub from './components/TelemetryHub';
import {
  Activity,
  Gauge,
  Flame,
  ShieldAlert,
  Cpu,
  Layers,
  Award,
  ChevronDown,
  Sliders,
  Radio,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  Wind,
  Thermometer,
  CloudRain,
  Play,
  RotateCcw,
  Sparkles,
  X,
  Clock,
  Compass,
  Zap,
  BarChart3
} from 'lucide-react';
import f1Data from './f1_api_data.json';

const RADIO_MESSAGES = [
  { time: 'LAP 32', sender: 'GP (LAMBIASE)', text: 'Max, we are seeing linear degradation on Mediums at +0.038s/lap. Target window remains lap 34 to 38.' },
  { time: 'LAP 34', sender: 'MAX VERSTAPPEN', text: 'Tires are still good, balance is neutral. I can extend 2 more laps if we need gap to Perez.' },
  { time: 'LAP 35', sender: 'RACE CONTROL', text: 'YELLOW FLAG Sector 2. Incident at Turn 8. Safety Car on standby.' },
  { time: 'LAP 36', sender: 'BONO (MERCEDES)', text: 'Lewis, box box, box box. Safety Car deployed. Free pit window is active.' },
  { time: 'LAP 37', sender: 'FERRARI STRATEGY', text: 'We are checking Plan C. Mediums will be vulnerable to the undercut if we stay out.' },
  { time: 'LAP 39', sender: 'HUGH BIRD', text: 'Checo, hard tires to the end. Expecting delta to P1 to shrink by 0.3s per lap on fresh rubber.' }
];

export default function App() {
  const [selectedTrackId, setSelectedTrackId] = useState('monaco');
  const [selectedRank, setSelectedRank] = useState(1);
  const [raceFlag, setRaceFlag] = useState('GREEN'); // 'GREEN' | 'SC' | 'VSC' | 'RED'
  const [primaryTelemetryTab, setPrimaryTelemetryTab] = useState('CHANNELS'); // 'CHANNELS' | 'TIMING' | 'UNDERCUT' | 'TIRES'
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showWhitepaperModal, setShowWhitepaperModal] = useState(false);

  // Simulation Controls & Overrides
  const [scProbOverride, setScProbOverride] = useState(0.55);
  const [wearMultiplier, setWearMultiplier] = useState(1.0);
  const [pitLossOverride, setPitLossOverride] = useState(20.2);
  const [simCount, setSimCount] = useState(1000);
  const [isSimulating, setIsSimulating] = useState(false);
  const [radioIdx, setRadioIdx] = useState(0);

  // Cycle radio messages every 7 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setRadioIdx(prev => (prev + 1) % RADIO_MESSAGES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const tracks = f1Data.tracks;
  const currentTrackMeta = useMemo(() => {
    return tracks.find(t => t.id === selectedTrackId) || tracks[0];
  }, [tracks, selectedTrackId]);

  // Adjust defaults when track changes
  useEffect(() => {
    if (currentTrackMeta) {
      setScProbOverride(currentTrackMeta.historical_sc_rate);
      setPitLossOverride(currentTrackMeta.green_pit_loss);
    }
  }, [currentTrackMeta]);

  // React to raceFlag toggle
  useEffect(() => {
    if (raceFlag === 'SC') {
      setPitLossOverride(currentTrackMeta?.sc_pit_loss || 11.8);
    } else if (raceFlag === 'VSC') {
      setPitLossOverride(14.5);
    } else if (raceFlag === 'GREEN') {
      setPitLossOverride(currentTrackMeta?.green_pit_loss || 20.2);
    }
  }, [raceFlag, currentTrackMeta]);

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

  // Trigger simulated Monte Carlo batch
  const handleRunSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#050608] text-[#F5F7FA] flex flex-col selection:bg-[#FF1801] selection:text-white pb-16">
      {/* Top Telemetry Mission Control Header */}
      <header className="border-b border-white/[0.08] px-6 py-3 flex flex-col md:flex-row md:items-center justify-between bg-[#0A0C11]/95 backdrop-blur-md sticky top-0 z-50 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-6 h-8 bg-[#FF1801] flex items-center justify-center font-orbitron text-xs text-white font-black shadow-[0_0_12px_rgba(255,24,1,0.6)]">
            F1
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-orbitron text-xl font-black tracking-wider text-white leading-none">
                APEX STRAT
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-[#FF1801]/15 text-[#FF2B16] border border-[#FF1801]/40 font-bold rounded-xs">
                PIT-WALL TELEMETRY ENGINE
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-white/[0.06] text-neutral-400 border border-white/[0.08] rounded-xs hidden sm:inline">
                BUILD v2.4 PRO
              </span>
            </div>
            <div className="text-[10px] font-mono text-neutral-400 tracking-widest uppercase mt-0.5">
              FASTF1 TELEMETRY PIPELINE &bull; HUBER M-ESTIMATOR &bull; MONTE CARLO STOCHASTIC SOLVER
            </div>
          </div>
        </div>

        {/* Live Race Control Flag Switcher */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1 bg-[#050608] p-1 border border-white/[0.08] rounded-xs">
            <span className="text-[10px] text-neutral-500 uppercase px-2 font-bold">RACE CONTROL:</span>
            <button
              onClick={() => setRaceFlag('GREEN')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-xs cursor-pointer transition-all ${
                raceFlag === 'GREEN'
                  ? 'bg-[#00E676] text-black font-extrabold shadow-[0_0_10px_#00E676]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              GREEN
            </button>
            <button
              onClick={() => setRaceFlag('SC')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-xs cursor-pointer transition-all ${
                raceFlag === 'SC'
                  ? 'bg-[#FF9100] text-black font-extrabold shadow-[0_0_12px_#FF9100] animate-sc-beacon'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              SC (SAFETY CAR)
            </button>
            <button
              onClick={() => setRaceFlag('VSC')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-xs cursor-pointer transition-all ${
                raceFlag === 'VSC'
                  ? 'bg-[#FFF200] text-black font-extrabold shadow-[0_0_10px_#FFF200]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              VSC
            </button>
          </div>

          {/* Quick Actions */}
          <button
            onClick={() => setShowConfigModal(!showConfigModal)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10141D] hover:bg-[#181E2C] border border-white/[0.1] rounded-xs text-neutral-300 cursor-pointer font-f1 text-xs"
          >
            <Sliders className="w-3.5 h-3.5 text-[#FF1801]" />
            <span>CALIBRATION</span>
          </button>

          <button
            onClick={() => setShowWhitepaperModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10141D] hover:bg-[#181E2C] border border-white/[0.1] rounded-xs text-neutral-300 cursor-pointer font-f1 text-xs"
          >
            <FileText className="w-3.5 h-3.5 text-neutral-400" />
            <span>MODEL SPECS</span>
          </button>
        </div>
      </header>

      {/* Safety Car Dynamic Tactical Alert Banner */}
      {raceFlag === 'SC' && (
        <div className="bg-[#1C1204] border-b border-[#FF9100] px-6 py-2 flex items-center justify-between text-xs font-mono text-[#FF9100] shadow-[0_4px_20px_rgba(255,145,0,0.25)]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF9100] animate-sc-beacon" />
            <strong className="tracking-wide">TACTICAL OPPORTUNITY: SAFETY CAR DEPLOYED</strong>
            <span className="text-neutral-300 hidden md:inline">
              &bull; Pack pace neutralized to 60% throttle. Pit transit penalty drops from {currentTrackMeta.green_pit_loss}s to {currentTrackMeta.sc_pit_loss}s.
            </span>
          </div>
          <span className="bg-[#FF9100] text-black font-bold px-2 py-0.5 rounded-xs uppercase">
            EXPECTED DELTA SAVING: +{(currentTrackMeta.green_pit_loss - currentTrackMeta.sc_pit_loss).toFixed(1)}s
          </span>
        </div>
      )}

      {/* Environmental & Live Session Bar */}
      <div className="bg-[#080A0E] border-b border-white/[0.05] px-6 py-1.5 flex flex-wrap items-center justify-between text-[11px] font-mono text-neutral-400 gap-3">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5">
            <Thermometer className="w-3.5 h-3.5 text-[#FF1801]" />
            <span>TRACK: <strong className="text-white">44.8°C</strong></span>
          </span>
          <span className="flex items-center gap-1.5">
            <Thermometer className="w-3.5 h-3.5 text-neutral-400" />
            <span>AIR: <strong className="text-white">28.6°C</strong></span>
          </span>
          <span className="flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-cyan-400" />
            <span>WIND: <strong className="text-white">2.8 M/S SSE</strong></span>
          </span>
          <span className="flex items-center gap-1.5">
            <CloudRain className="w-3.5 h-3.5 text-neutral-500" />
            <span>RAIN PROB: <strong className="text-white">0% (DRY)</strong></span>
          </span>
          <span className="hidden lg:inline text-neutral-500">|</span>
          <span className="hidden lg:inline text-neutral-300">
            TRACK EVOLUTION: <strong className="text-emerald-400">+0.22s/STINT</strong>
          </span>
        </div>

        {/* Live Radio Stream Transcript */}
        <div className="flex items-center gap-2 text-[11px] truncate max-w-xl">
          <Volume2 className="w-3.5 h-3.5 text-[#FF1801] shrink-0 animate-pulse" />
          <span className="text-[#FF1801] font-bold shrink-0">{RADIO_MESSAGES[radioIdx].time} [{RADIO_MESSAGES[radioIdx].sender}]:</span>
          <span className="text-neutral-300 truncate italic">"{RADIO_MESSAGES[radioIdx].text}"</span>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
        {/* Top Grand Prix Selector Header Bar */}
        <div className="f1-card p-5 border-l-4 border-l-[#FF1801] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xs bg-[#FF1801]/20 border border-[#FF1801] flex items-center justify-center text-white shrink-0 shadow-[0_0_15px_rgba(255,24,1,0.4)]">
              <Compass className="w-6 h-6 text-[#FF1801]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF1801] shadow-[0_0_8px_#FF1801]" />
                <span className="text-xs font-mono text-white uppercase tracking-wider font-extrabold">
                  GRAND PRIX CIRCUIT TARGET:
                </span>
                <span className="font-f1 text-white font-extrabold text-xl tracking-wide uppercase">
                  {currentTrackMeta.name} ({currentTrackMeta.year})
                </span>
              </div>
              <div className="text-xs font-mono text-neutral-300 mt-1">
                {currentTrackMeta.track_type} &bull; <strong className="text-white">{currentTrackMeta.laps} LAPS</strong> ({currentTrackMeta.circuit_length_km} KM) &bull; GREEN PIT LOSS: <strong className="text-white">{currentTrackMeta.green_pit_loss}s</strong>
              </div>
            </div>
          </div>

          {/* Dual Selection: 5 Direct Buttons + High-Visibility Dropdown */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Quick-Click Circuit Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
              {tracks.map(t => {
                const isSelected = t.id === selectedTrackId;
                const flag = t.id === 'monaco' ? '🇲🇨' : t.id === 'hungary' ? '🇭🇺' : t.id === 'silverstone' ? '🇬🇧' : t.id === 'monza' ? '🇮🇹' : '🇧🇭';
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTrackId(t.id);
                      setSelectedRank(1);
                    }}
                    className={`px-3 py-2 font-bold uppercase rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#FF1801] text-black font-extrabold shadow-[0_0_15px_rgba(255,24,1,0.6)] scale-[1.03]'
                        : 'bg-[#0E121A] border border-white/[0.15] text-neutral-200 hover:text-white hover:border-[#FF1801]'
                    }`}
                  >
                    <span>{flag}</span>
                    <span>{t.race.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>

            {/* High-Visibility Custom Select Fallback */}
            <div className="w-full sm:w-56 shrink-0">
              <select
                value={selectedTrackId}
                onChange={(e) => {
                  setSelectedTrackId(e.target.value);
                  setSelectedRank(1);
                }}
                className="f1-select"
                aria-label="Grand Prix Circuit Target"
              >
                {tracks.map(t => {
                  const flag = t.id === 'monaco' ? '🇲🇨' : t.id === 'hungary' ? '🇭🇺' : t.id === 'silverstone' ? '🇬🇧' : t.id === 'monza' ? '🇮🇹' : '🇧🇭';
                  return (
                    <option key={t.id} value={t.id}>
                      {flag} {t.name.toUpperCase()} ({t.year})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* 3-Column Tactical KPI Deck */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="f1-card p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-neutral-300 uppercase tracking-wider font-bold">
                SAFETY CAR PROBABILITY
              </span>
              <div className="font-mono text-3xl font-extrabold text-white mt-0.5">
                {(scProbOverride * 100).toFixed(0)}<span className="text-[#FF1801] text-xl font-bold">%</span>
              </div>
              <div className="text-xs font-mono text-neutral-400 mt-0.5">
                Historical Deployment Window
              </div>
            </div>
            <ShieldAlert className="w-9 h-9 text-[#FF1801] opacity-90" />
          </div>

          <div className="f1-card p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-neutral-300 uppercase tracking-wider font-bold">
                ACTIVE PIT LOSS TRANSIT
              </span>
              <div className="font-mono text-3xl font-extrabold text-white mt-0.5">
                {pitLossOverride.toFixed(1)}<span className="text-neutral-400 text-sm font-normal">s</span>
              </div>
              <div className="text-xs font-mono text-emerald-400 font-bold mt-0.5">
                {raceFlag === 'GREEN' ? 'Full Racing Pace' : 'Under Safety Car Delta'}
              </div>
            </div>
            <Gauge className="w-9 h-9 text-neutral-300 opacity-90" />
          </div>

          <div className="f1-card p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-neutral-300 uppercase tracking-wider font-bold">
                RECOMMENDED COMPOUND
              </span>
              <div className="font-mono text-3xl font-extrabold text-white mt-0.5 flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full inline-block shadow-md"
                  style={{
                    backgroundColor: optimalCompound === 'SOFT' ? '#FF1801' : optimalCompound === 'MEDIUM' ? '#FFF200' : '#FFFFFF'
                  }}
                />
                {optimalCompound}
              </div>
              <div className="text-xs font-mono text-neutral-400 mt-0.5">
                Optimal Box Window: <strong className="text-white">Lap {optimalPitLap}</strong>
              </div>
            </div>
            <Flame className="w-9 h-9 text-[#FF1801] opacity-90" />
          </div>
        </div>

        {/* Calibration Drawer (Collapsible) */}
        {showConfigModal && (
          <div className="f1-card p-5 bg-[#0C1018] border-l-4 border-l-[#FF1801] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#FF1801]" />
                <h4 className="font-f1 text-sm font-bold text-white uppercase tracking-wider">
                  Tactical Sensitivity &amp; Monte Carlo Engine Calibration
                </h4>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 font-mono text-xs">
              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>SAFETY CAR RATE</span>
                  <strong className="text-white">{(scProbOverride * 100).toFixed(0)}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={scProbOverride}
                  onChange={(e) => setScProbOverride(parseFloat(e.target.value))}
                  className="w-full"
                />
                <span className="text-[9px] text-neutral-500">Historical: {(currentTrackMeta.historical_sc_rate * 100).toFixed(0)}%</span>
              </div>

              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>TIRE WEAR MULTIPLIER</span>
                  <strong className="text-white">{wearMultiplier.toFixed(2)}x</strong>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.5"
                  step="0.05"
                  value={wearMultiplier}
                  onChange={(e) => setWearMultiplier(parseFloat(e.target.value))}
                  className="w-full"
                />
                <span className="text-[9px] text-neutral-500">Track Temperature Sensitivity</span>
              </div>

              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>PIT STOP TRANSIT LOSS</span>
                  <strong className="text-white">{pitLossOverride.toFixed(1)}s</strong>
                </div>
                <input
                  type="range"
                  min="16"
                  max="28"
                  step="0.5"
                  value={pitLossOverride}
                  onChange={(e) => setPitLossOverride(parseFloat(e.target.value))}
                  className="w-full"
                />
                <span className="text-[9px] text-neutral-500">Pit Lane Speed Limiter Delta</span>
              </div>

              <div className="flex flex-col justify-end">
                <button
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  className="w-full py-2 bg-[#FF1801] hover:bg-white text-black font-f1 font-black text-xs uppercase rounded-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(255,24,1,0.4)]"
                >
                  {isSimulating ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      SOLVING {simCount} ITERATIONS...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-black" />
                      RE-RUN VECTORIZED SOLVER
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PRIMARY TELEMETRY CONSOLE (Replacing 3D with authentic pit-wall telemetry modules) */}
        <section className="flex flex-col gap-4">
          {/* Telemetry Switcher Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-2">
            <div className="flex items-center gap-2">
              {[
                { id: 'CHANNELS', label: '1. FastF1 Channel Traces', icon: Activity },
                { id: 'TIMING', label: '2. Live Timing & Sector Matrix', icon: Clock },
                { id: 'UNDERCUT', label: '3. Undercut / Overcut Solver', icon: Zap },
                { id: 'TIRES', label: '4. Pirelli Compound Physics', icon: Flame }
              ].map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setPrimaryTelemetryTab(t.id)}
                    className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all rounded-xs cursor-pointer ${
                      primaryTelemetryTab === t.id
                        ? 'bg-white text-black font-extrabold shadow-[0_0_15px_rgba(255,255,255,0.4)]'
                        : 'bg-[#0E1015] border border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/[0.2]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
              <span>LIVE TELEMETRY STREAM: <strong className="text-white">ACTIVE</strong></span>
            </div>
          </div>

          {/* Active Telemetry Component View */}
          {primaryTelemetryTab === 'CHANNELS' && (
            <FastF1TelemetryChannels
              trackId={selectedTrackId}
              trackName={currentTrackMeta.name}
            />
          )}

          {primaryTelemetryTab === 'TIMING' && (
            <LiveTimingTower
              trackId={selectedTrackId}
              trackName={currentTrackMeta.name}
            />
          )}

          {primaryTelemetryTab === 'UNDERCUT' && (
            <UndercutOvercutSimulator
              trackMeta={currentTrackMeta}
              degData={degData}
            />
          )}

          {primaryTelemetryTab === 'TIRES' && (
            <TireThermalTelemetry
              trackId={selectedTrackId}
              trackMeta={currentTrackMeta}
            />
          )}
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
      <footer className="border-t border-white/[0.08] px-6 py-6 text-center text-xs font-mono text-neutral-500 bg-[#07090D] flex flex-col md:flex-row items-center justify-between max-w-7xl mx-auto w-full gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FF1801]" />
          <span>MOTORSPORT SPECIFICATION: HUBER REGRESSION &bull; MONTE CARLO STOCHASTICS &bull; FASTF1 API</span>
        </div>
        <div className="text-neutral-400">
          ENGINEERED FOR FORMULA 1 RACE STRATEGY &amp; APPLIED DATA SCIENCE INTERVIEWS
        </div>
      </footer>

      {/* Model Specifications & Mathematical Whitepaper Modal */}
      {showWhitepaperModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="f1-card max-w-3xl w-full p-6 max-h-[85vh] overflow-y-auto flex flex-col gap-4 border border-white/[0.15]">
            <div className="flex items-center justify-between border-b border-white/[0.1] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 bg-[#FF1801] rounded-xs" />
                <h3 className="font-f1 text-xl font-bold text-white">
                  Mathematical Architecture &amp; Engineering Specifications
                </h3>
              </div>
              <button
                onClick={() => setShowWhitepaperModal(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs text-neutral-300 leading-relaxed">
              <div className="bg-[#0A0D14] p-3.5 rounded-xs border border-white/[0.06]">
                <strong className="text-white font-f1 text-sm block mb-1">1. DYNAMIC FUEL MASS CORRECTION</strong>
                <p>
                  Modern F1 cars start the Grand Prix with up to 110 kg of fuel. Fuel burn-off rate is approximately 1.5 to 1.8 kg/lap, which yields an empirical lap-time reduction of -0.035s to -0.055s per lap purely from mass decrease.
                  Uncorrected telemetry confounds mass decrease with tire wear. We apply the normalization:
                </p>
                <div className="p-2 bg-black/60 rounded-xs text-[#00E676] font-mono mt-1.5">
                  T_corrected = T_raw + (Lap - TotalLaps) * Beta_fuel
                </div>
              </div>

              <div className="bg-[#0A0D14] p-3.5 rounded-xs border border-white/[0.06]">
                <strong className="text-white font-f1 text-sm block mb-1">2. HUBER M-ESTIMATOR LOSS FUNCTION</strong>
                <p>
                  Ordinary Least Squares (OLS) is highly vulnerable to telemetry outliers caused by traffic lifts, blue flag slowdowns, and yellow flag sectors. We fit tire wear slopes using Huber loss (delta = 1.345), which transitions from quadratic error for small residuals to linear error for large residuals:
                </p>
                <div className="p-2 bg-black/60 rounded-xs text-amber-300 font-mono mt-1.5">
                  L_delta(r) = 0.5 * r^2 (for |r| &lt;= 1.345) else 1.345 * (|r| - 0.5 * 1.345)
                </div>
              </div>

              <div className="bg-[#0A0D14] p-3.5 rounded-xs border border-white/[0.06]">
                <strong className="text-white font-f1 text-sm block mb-1">3. STOCHASTIC SAFETY CAR PIT WINDOW DELTA</strong>
                <p>
                  Pit lane transit under green flag conditions incurs a stationary pit stop plus transit speed limiter delta of 20.25s against cars traveling at 300+ km/h. Under Safety Car conditions, the pack is neutralized to ~60% throttle pace, reducing the net pit stop time loss to ~11.75s—granting an 8.5s to 11.8s tactical bonus.
                </p>
              </div>

              <div className="bg-[#0A0D14] p-3.5 rounded-xs border border-white/[0.06]">
                <strong className="text-white font-f1 text-sm block mb-1">4. MODEL LIMITATIONS &amp; KNOWN ASSUMPTIONS</strong>
                <ul className="list-disc list-inside space-y-1 text-neutral-400 mt-1">
                  <li>No dynamic wake / dirty-air aerodynamic loss modeling behind rival cars.</li>
                  <li>No driver skill differentiation (calibrated to front-runner telemetry baseline).</li>
                  <li>Pit stop stationary time fixed at 2.5s with Gaussian noise (sigma = 0.30s).</li>
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.1] flex justify-end">
              <button
                onClick={() => setShowWhitepaperModal(false)}
                className="px-4 py-1.5 bg-[#FF1801] text-black font-f1 font-bold text-xs uppercase rounded-xs cursor-pointer hover:bg-white"
              >
                Close Specification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
