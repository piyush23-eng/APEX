import React, { useState } from 'react';
import {
  Clock,
  Gauge,
  Flame,
  Award,
  ChevronDown,
  Layers,
  Zap,
  ShieldCheck,
  Search
} from 'lucide-react';
import extData from '../telemetry_extended_data.json';

const STATUS_BADGE = {
  purple: 'text-[#D67AFF] bg-[#B026FF]/15 border border-[#B026FF]/40 font-extrabold',
  green: 'text-[#00E676] bg-[#00E676]/15 border border-[#00E676]/40 font-bold',
  yellow: 'text-neutral-400 bg-white/[0.04] border border-white/[0.08]'
};

export default function LiveTimingTower({ trackId = 'monaco', trackName = 'Monaco' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const rows = extData.timing_sheets[trackId] || extData.timing_sheets.monaco || [];

  const filteredRows = rows.filter(r =>
    r.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.team.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="f1-card p-5 flex flex-col gap-4">
      {/* Timing Tower Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.08] pb-3 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#FF1801] inline-block shadow-[0_0_8px_#FF1801]" />
            <h3 className="font-f1 text-xl font-bold text-white tracking-wider">
              Official FIA Live Timing &amp; Sector Split Matrix
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-white/[0.06] text-neutral-300 border border-white/[0.1] rounded-xs uppercase">
              {trackName}
            </span>
          </div>
          <p className="text-xs font-mono text-neutral-400 mt-0.5">
            Microsector telemetry, stint compound sequence, and pit stop stationary duration
          </p>
        </div>

        {/* Legend & Search */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-xs hidden md:flex">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-[#B026FF]" />
              <span className="text-[#D67AFF]">OVERALL BEST</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-[#00E676]" />
              <span className="text-[#00E676]">PERSONAL BEST</span>
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search driver/team..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#090B0E] border border-white/[0.1] text-xs font-mono text-white pl-8 pr-3 py-1.5 rounded-xs focus:outline-none focus:border-[#FF1801] placeholder-neutral-600"
            />
          </div>
        </div>
      </div>

      {/* Timing Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/[0.1] text-[10px] text-neutral-400 uppercase tracking-wider bg-[#07090D]">
              <th className="py-2.5 px-3">POS</th>
              <th className="py-2.5 px-3">NO</th>
              <th className="py-2.5 px-3">DRIVER / TEAM</th>
              <th className="py-2.5 px-3">STINT STRATEGY</th>
              <th className="py-2.5 px-3 text-right">TOTAL TIME / GAP</th>
              <th className="py-2.5 px-3 text-right">INTERVAL</th>
              <th className="py-2.5 px-3 text-right">BEST LAP</th>
              <th className="py-2.5 px-2 text-center">SECTOR 1</th>
              <th className="py-2.5 px-2 text-center">SECTOR 2</th>
              <th className="py-2.5 px-2 text-center">SECTOR 3</th>
              <th className="py-2.5 px-3 text-right">SPEED TRAP</th>
              <th className="py-2.5 px-2 text-center">PITS</th>
              <th className="py-2.5 px-3 text-right">PIT STOP (S)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filteredRows.map((row) => (
              <tr
                key={row.pos}
                className="hover:bg-white/[0.03] transition-colors group"
              >
                {/* POS */}
                <td className="py-2 px-3">
                  <span className={`w-5 h-5 flex items-center justify-center font-bold text-xs rounded-xs ${
                    row.pos === 1
                      ? 'bg-[#FF1801] text-black font-extrabold'
                      : row.pos <= 3
                      ? 'bg-white/10 text-white font-bold'
                      : 'text-neutral-400'
                  }`}>
                    {row.pos}
                  </span>
                </td>

                {/* NO */}
                <td className="py-2 px-3 text-neutral-500 font-bold">
                  #{row.no}
                </td>

                {/* DRIVER / TEAM */}
                <td className="py-2 px-3">
                  <div className="font-f1 font-bold text-white text-sm tracking-wide">
                    {row.driver}
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    {row.team}
                  </div>
                </td>

                {/* STINT STRATEGY */}
                <td className="py-2 px-3">
                  <span className="px-2 py-0.5 bg-[#0A0D14] border border-white/[0.08] text-[11px] text-neutral-200 rounded-xs">
                    {row.stint}
                  </span>
                </td>

                {/* GAP */}
                <td className="py-2 px-3 text-right font-bold text-white">
                  {row.gap}
                </td>

                {/* INTERVAL */}
                <td className="py-2 px-3 text-right text-neutral-400">
                  {row.int}
                </td>

                {/* BEST LAP */}
                <td className="py-2 px-3 text-right font-bold text-white">
                  {row.best_lap}
                </td>

                {/* S1 */}
                <td className="py-2 px-2 text-center">
                  <span className={`px-1.5 py-0.5 text-[11px] rounded-xs ${STATUS_BADGE[row.s1_stat] || ''}`}>
                    {row.s1}
                  </span>
                </td>

                {/* S2 */}
                <td className="py-2 px-2 text-center">
                  <span className={`px-1.5 py-0.5 text-[11px] rounded-xs ${STATUS_BADGE[row.s2_stat] || ''}`}>
                    {row.s2}
                  </span>
                </td>

                {/* S3 */}
                <td className="py-2 px-2 text-center">
                  <span className={`px-1.5 py-0.5 text-[11px] rounded-xs ${STATUS_BADGE[row.s3_stat] || ''}`}>
                    {row.s3}
                  </span>
                </td>

                {/* SPEED TRAP */}
                <td className="py-2 px-3 text-right text-neutral-200 font-bold">
                  {row.speed_trap} <span className="text-[10px] text-neutral-500 font-normal">km/h</span>
                </td>

                {/* PITS */}
                <td className="py-2 px-2 text-center text-neutral-300">
                  {row.pits}
                </td>

                {/* PIT TIME */}
                <td className="py-2 px-3 text-right font-bold text-emerald-400">
                  {row.pit_time.toFixed(2)}s
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
