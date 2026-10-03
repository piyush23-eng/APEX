import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';
import {
  Activity,
  Zap,
  Gauge,
  Flame,
  ArrowRight,
  TrendingDown,
  Layers,
  ChevronRight,
  Sliders,
  Compass
} from 'lucide-react';
import extData from '../telemetry_extended_data.json';

const CustomTelemetryTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-[#090C12] border border-white/[0.15] p-3 font-mono text-xs shadow-2xl rounded-xs">
        <div className="flex items-center justify-between border-b border-white/[0.1] pb-1.5 mb-1.5 gap-4">
          <strong className="text-white">DISTANCE: {d.dist}m</strong>
          {d.corner && (
            <span className="px-1.5 py-0.2 bg-[#FF1801] text-black font-extrabold text-[10px] rounded-xs uppercase">
              {d.corner}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <span className="text-neutral-500 text-[10px] block">D1 SPEED</span>
            <strong className="text-white text-sm">{d.speed_d1} <span className="text-[10px] text-neutral-400">km/h</span></strong>
          </div>
          <div>
            <span className="text-neutral-500 text-[10px] block">D2 SPEED</span>
            <strong className="text-cyan-400 text-sm">{d.speed_d2} <span className="text-[10px] text-neutral-400">km/h</span></strong>
          </div>
          <div>
            <span className="text-neutral-500 text-[10px] block">THROTTLE / BRAKE</span>
            <strong className="text-[#00E676]">{d.throttle_d1}%</strong> / <strong className="text-[#FF1801]">{d.brake_d1}%</strong>
          </div>
          <div>
            <span className="text-neutral-500 text-[10px] block">GEAR / RPM</span>
            <strong className="text-amber-400">G{d.gear_d1}</strong> &bull; <span className="text-neutral-300">{d.rpm_d1}</span>
          </div>
          <div>
            <span className="text-neutral-500 text-[10px] block">LATERAL LOAD</span>
            <strong className="text-purple-400">{d.lat_g} G</strong>
          </div>
          <div>
            <span className="text-neutral-500 text-[10px] block">DRS STATUS</span>
            <strong className={d.drs_d1 ? 'text-[#00E676]' : 'text-neutral-500'}>
              {d.drs_d1 ? 'OPEN (ACTIVE)' : 'CLOSED'}
            </strong>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function FastF1TelemetryChannels({ trackId = 'monaco', trackName = 'Monaco' }) {
  const [activeChannel, setActiveChannel] = useState('ALL'); // 'ALL' | 'SPEED' | 'PEDALS' | 'GEAR'
  const [cursorPoint, setCursorPoint] = useState(null);

  const trackTelemetry = extData.telemetry_traces[trackId] || extData.telemetry_traces.monaco;
  const channels = trackTelemetry.channels || [];

  const currentDisplay = cursorPoint || channels[channels.length - 1] || {};

  return (
    <div className="f1-card p-5 flex flex-col gap-4">
      {/* Telemetry Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-white/[0.08] pb-3 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#FF1801] inline-block shadow-[0_0_8px_#FF1801] animate-pulse" />
            <h3 className="font-f1 text-xl font-bold text-white tracking-wider">
              FastF1 High-Frequency Synchronized Telemetry Channels
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-[#FF1801]/20 text-[#FF2B16] border border-[#FF1801]/40 font-bold rounded-xs">
              0.1s TELEMETRY SAMPLING
            </span>
          </div>
          <p className="text-xs font-mono text-neutral-400 mt-0.5">
            Head-to-head lap trace comparing <strong className="text-white">{trackTelemetry.driver1}</strong> ({trackTelemetry.d1_lap}) vs <strong className="text-cyan-400">{trackTelemetry.driver2}</strong> ({trackTelemetry.d2_lap})
          </p>
        </div>

        {/* Channel Filters */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-neutral-500 text-[10px] uppercase font-bold">TELEMETRY VIEW:</span>
          {[
            { id: 'ALL', label: 'FULL STACK' },
            { id: 'SPEED', label: 'SPEED (KM/H)' },
            { id: 'PEDALS', label: 'THROTTLE / BRAKE' },
            { id: 'GEAR', label: 'GEAR / RPM / G' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveChannel(f.id)}
              className={`px-3 py-1 font-bold uppercase rounded-xs transition-all cursor-pointer ${
                activeChannel === f.id
                  ? 'bg-[#FF1801] text-black font-extrabold shadow-[0_0_10px_rgba(255,24,1,0.5)]'
                  : 'bg-[#0E1015] border border-white/[0.08] text-neutral-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Real-Time Telemetry Data Strip (Scrubbed Point) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 bg-[#080A0E] border border-white/[0.08] p-3 rounded-xs font-mono text-xs">
        <div>
          <span className="text-[9px] text-neutral-500 block uppercase font-bold">DISTANCE</span>
          <strong className="text-white text-sm">{currentDisplay.dist || 0} m</strong>
        </div>
        <div>
          <span className="text-[9px] text-neutral-500 block uppercase font-bold">VER SPEED (RED BULL)</span>
          <strong className="text-[#FF1801] text-sm">{currentDisplay.speed_d1 || 0} km/h</strong>
        </div>
        <div>
          <span className="text-[9px] text-neutral-500 block uppercase font-bold">CHASER SPEED</span>
          <strong className="text-cyan-400 text-sm">{currentDisplay.speed_d2 || 0} km/h</strong>
        </div>
        <div>
          <span className="text-[9px] text-neutral-500 block uppercase font-bold">THROTTLE / BRAKE</span>
          <strong className="text-[#00E676]">{currentDisplay.throttle_d1 || 0}%</strong> / <strong className="text-[#FF1801]">{currentDisplay.brake_d1 || 0}%</strong>
        </div>
        <div>
          <span className="text-[9px] text-neutral-500 block uppercase font-bold">GEAR / RPM</span>
          <strong className="text-amber-400">G{currentDisplay.gear_d1 || 7}</strong> &bull; <span className="text-neutral-300">{currentDisplay.rpm_d1 || 11200}</span>
        </div>
        <div>
          <span className="text-[9px] text-neutral-500 block uppercase font-bold">DRS / APEX</span>
          <strong className={currentDisplay.drs_d1 ? 'text-[#00E676]' : 'text-neutral-500'}>
            {currentDisplay.corner ? currentDisplay.corner : currentDisplay.drs_d1 ? 'DRS OPEN' : 'NORMAL'}
          </strong>
        </div>
      </div>

      {/* CHANNEL 1: SPEED OVERLAY */}
      {(activeChannel === 'ALL' || activeChannel === 'SPEED') && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
            <span className="flex items-center gap-2">
              <strong className="text-white font-f1 uppercase">CHANNEL 1 &bull; VEHICLE SPEED (KM/H)</strong>
              <span className="text-[10px] text-neutral-500">FastF1 Pitot Tube &amp; Wheel Speed Sensors</span>
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-white font-bold">
                <span className="w-3 h-0.5 bg-[#FF1801]" /> VERSTAPPEN
              </span>
              <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <span className="w-3 h-0.5 bg-cyan-400" /> CHASER
              </span>
            </div>
          </div>

          <div className="w-full h-44 bg-[#06080C] border border-white/[0.08] p-1 rounded-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={channels}
                margin={{ top: 10, right: 15, bottom: 5, left: 0 }}
                onMouseMove={(e) => {
                  if (e && e.activePayload && e.activePayload.length) {
                    setCursorPoint(e.activePayload[0].payload);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="#141824" />
                <XAxis dataKey="dist" unit="m" stroke="#555" tick={{ fill: '#777', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                <YAxis domain={['dataMin - 15', 'dataMax + 10']} unit=" km/h" stroke="#555" tick={{ fill: '#777', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                <Tooltip content={<CustomTelemetryTooltip />} />
                <Line type="monotone" dataKey="speed_d1" name="Verstappen" stroke="#FF1801" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="speed_d2" name="Chaser" stroke="#00D2BE" strokeWidth={1.8} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* CHANNEL 2: THROTTLE & BRAKE PEDALS */}
      {(activeChannel === 'ALL' || activeChannel === 'PEDALS') && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
            <span className="flex items-center gap-2">
              <strong className="text-white font-f1 uppercase">CHANNEL 2 &bull; THROTTLE (%) &amp; BRAKE PRESSURE (%)</strong>
              <span className="text-[10px] text-neutral-500">ECU Drive-by-Wire Potentiometer &amp; Hydraulic Pressure</span>
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[#00E676] font-bold">
                <span className="w-3 h-0.5 bg-[#00E676]" /> 100% THROTTLE
              </span>
              <span className="flex items-center gap-1.5 text-[#FF1801] font-bold">
                <span className="w-3 h-0.5 bg-[#FF1801]" /> 100% BRAKE
              </span>
            </div>
          </div>

          <div className="w-full h-36 bg-[#06080C] border border-white/[0.08] p-1 rounded-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={channels}
                margin={{ top: 8, right: 15, bottom: 5, left: 0 }}
                onMouseMove={(e) => {
                  if (e && e.activePayload && e.activePayload.length) {
                    setCursorPoint(e.activePayload[0].payload);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="#141824" />
                <XAxis dataKey="dist" unit="m" stroke="#555" tick={{ fill: '#777', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                <YAxis domain={[0, 100]} unit="%" stroke="#555" tick={{ fill: '#777', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                <Tooltip content={<CustomTelemetryTooltip />} />
                <Area type="monotone" dataKey="throttle_d1" name="Throttle" stroke="#00E676" fill="#00E676" fillOpacity={0.18} strokeWidth={1.8} isAnimationActive={false} />
                <Area type="monotone" dataKey="brake_d1" name="Brake" stroke="#FF1801" fill="#FF1801" fillOpacity={0.35} strokeWidth={1.8} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* CHANNEL 3: GEAR, RPM & LATERAL G */}
      {(activeChannel === 'ALL' || activeChannel === 'GEAR') && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
            <span className="flex items-center gap-2">
              <strong className="text-white font-f1 uppercase">CHANNEL 3 &bull; GEAR SELECTION &amp; LATERAL G ACCELERATION</strong>
              <span className="text-[10px] text-neutral-500">Seamless-Shift 8-Speed Gearbox &amp; IMU Accelerometer</span>
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                <span className="w-3 h-0.5 bg-amber-400" /> GEAR (1-8)
              </span>
              <span className="flex items-center gap-1.5 text-purple-400 font-bold">
                <span className="w-3 h-0.5 bg-purple-400" /> LATERAL G-LOAD
              </span>
            </div>
          </div>

          <div className="w-full h-32 bg-[#06080C] border border-white/[0.08] p-1 rounded-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={channels}
                margin={{ top: 8, right: 15, bottom: 5, left: 0 }}
                onMouseMove={(e) => {
                  if (e && e.activePayload && e.activePayload.length) {
                    setCursorPoint(e.activePayload[0].payload);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="#141824" />
                <XAxis dataKey="dist" unit="m" stroke="#555" tick={{ fill: '#777', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                <YAxis domain={[0, 8]} ticks={[1, 2, 3, 4, 5, 6, 7, 8]} stroke="#555" tick={{ fill: '#777', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                <Tooltip content={<CustomTelemetryTooltip />} />
                <Line type="stepAfter" dataKey="gear_d1" name="Gear" stroke="#FFD700" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="lat_g" name="Lateral G" stroke="#B026FF" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
