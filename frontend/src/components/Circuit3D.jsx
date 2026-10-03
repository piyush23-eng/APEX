import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Eye, Activity, Gauge, Flame, ShieldAlert, Zap, Compass, RotateCw } from 'lucide-react';

// Real-world circuit configurations with telemetry waypoints
const CIRCUITS_3D = {
  monaco: {
    name: "Circuit de Monaco",
    country: "Monaco",
    circuit_type: "Street Course • Maximum Downforce",
    length_km: 3.337,
    turns: 19,
    drs_zones: 1,
    cameraPos: [0, 26, 26],
    cameraTarget: [0, 0, 0],
    waypoints: [
      [0, 0, 10], [2, 0.4, 15], [6, 1.8, 14], [9, 2.5, 11], [11, 2.4, 7],
      [9, 1.8, 3], [6, 1.0, 1.5], [8, 0.6, -1], [11, 0.2, -3], [9, 0.0, -8],
      [5, -0.2, -14], [1, -0.2, -15], [-3, -0.2, -12], [-6, -0.2, -8],
      [-8, -0.1, -4], [-9, 0.0, 0], [-7, 0.0, 5], [-3, 0.0, 7], [0, 0, 10]
    ],
    pitStopPos: [0.5, 0.1, 10.5],
    sectors: [
      { name: "S1 CASINO", pos: [11, 2.4, 7], speed: "165 km/h", gear: "4th", gForce: "2.8G" },
      { name: "S2 TUNNEL", pos: [5, -0.2, -14], speed: "290 km/h", gear: "7th", gForce: "1.2G" },
      { name: "S3 RASCASSE", pos: [-7, 0.0, 5], speed: "75 km/h", gear: "2nd", gForce: "2.1G" }
    ]
  },
  hungary: {
    name: "Hungaroring",
    country: "Hungary",
    circuit_type: "Permanent Twisty • High Thermal Degradation",
    length_km: 4.381,
    turns: 14,
    drs_zones: 2,
    cameraPos: [0, 26, 24],
    cameraTarget: [0, 0, 0],
    waypoints: [
      [-10, 0, 8], [-6, 0.2, 12], [-1, 0.4, 13], [5, 0.2, 11], [9, -0.2, 7],
      [11, -0.4, 1], [8, -0.3, -4], [3, -0.1, -8], [-2, 0.2, -11], [-7, 0.3, -9],
      [-11, 0.1, -4], [-8, 0.0, 0], [-10, 0, 8]
    ],
    pitStopPos: [-8, 0.05, 9],
    sectors: [
      { name: "S1 T1 BRAKE", pos: [5, 0.2, 11], speed: "115 km/h", gear: "3rd", gForce: "4.2G" },
      { name: "S2 CHICANE", pos: [3, -0.1, -8], speed: "140 km/h", gear: "3rd", gForce: "3.6G" },
      { name: "S3 CAROUSEL", pos: [-11, 0.1, -4], speed: "195 km/h", gear: "5th", gForce: "3.1G" }
    ]
  },
  silverstone: {
    name: "Silverstone Circuit",
    country: "United Kingdom",
    circuit_type: "High-Speed Lateral • Maggotts & Becketts",
    length_km: 5.891,
    turns: 18,
    drs_zones: 2,
    cameraPos: [0, 28, 26],
    cameraTarget: [0, 0, 0],
    waypoints: [
      [0, 0, 12], [5, 0.1, 14], [10, 0.2, 11], [14, 0.1, 5], [12, -0.1, -2],
      [7, -0.2, -8], [0, -0.2, -13], [-6, -0.1, -11], [-11, 0.0, -5], [-13, 0.1, 2],
      [-9, 0.1, 8], [-4, 0.0, 10], [0, 0, 12]
    ],
    pitStopPos: [1, 0.05, 12.5],
    sectors: [
      { name: "S1 COPSE", pos: [10, 0.2, 11], speed: "295 km/h", gear: "7th", gForce: "5.1G" },
      { name: "S2 BECKETTS", pos: [7, -0.2, -8], speed: "250 km/h", gear: "6th", gForce: "4.8G" },
      { name: "S3 STOWE", pos: [-11, 0.0, -5], speed: "210 km/h", gear: "5th", gForce: "3.9G" }
    ]
  },
  monza: {
    name: "Autodromo Nazionale Monza",
    country: "Italy",
    circuit_type: "Temple of Speed • Minimum Downforce",
    length_km: 5.793,
    turns: 11,
    drs_zones: 2,
    cameraPos: [0, 26, 26],
    cameraTarget: [0, 0, 0],
    waypoints: [
      [-12, 0, 6], [-4, 0.1, 12], [4, 0.1, 14], [12, 0.0, 10], [14, -0.1, 2],
      [11, -0.2, -7], [4, -0.2, -13], [-5, -0.1, -12], [-12, 0.0, -6], [-14, 0.0, 0],
      [-12, 0, 6]
    ],
    pitStopPos: [-10, 0.05, 7.5],
    sectors: [
      { name: "S1 VARIANTE 1", pos: [4, 0.1, 14], speed: "78 km/h", gear: "1st", gForce: "5.4G" },
      { name: "S2 LESMO 2", pos: [11, -0.2, -7], speed: "260 km/h", gear: "6th", gForce: "3.7G" },
      { name: "S3 PARABOLICA", pos: [-5, -0.1, -12], speed: "220 km/h", gear: "5th", gForce: "4.2G" }
    ]
  },
  bahrain: {
    name: "Bahrain International Circuit",
    country: "Bahrain",
    circuit_type: "Abrasive Aggregate • Rear Traction Wear",
    length_km: 5.412,
    turns: 15,
    drs_zones: 3,
    cameraPos: [0, 26, 26],
    cameraTarget: [0, 0, 0],
    waypoints: [
      [-11, 0, 9], [-5, 0.2, 13], [2, 0.3, 13], [8, 0.1, 9], [12, -0.1, 3],
      [9, -0.3, -4], [3, -0.3, -10], [-4, -0.2, -12], [-10, -0.1, -7], [-12, 0.0, 0],
      [-11, 0, 9]
    ],
    pitStopPos: [-9, 0.05, 10],
    sectors: [
      { name: "S1 T1 HAIRPIN", pos: [2, 0.3, 13], speed: "82 km/h", gear: "2nd", gForce: "4.5G" },
      { name: "S2 T10 LOCKUP", pos: [9, -0.3, -4], speed: "95 km/h", gear: "2nd", gForce: "3.2G" },
      { name: "S3 MAIN STRAIGHT", pos: [-10, -0.1, -7], speed: "235 km/h", gear: "6th", gForce: "2.4G" }
    ]
  }
};

function getHeatmapColor(t, mode) {
  if (mode === 'wear') {
    // Green (0-40% grip) -> Yellow (40-75% wear) -> High-Vis Red (75-100% cliff)
    if (t < 0.45) {
      return new THREE.Color().lerpColors(new THREE.Color('#10b981'), new THREE.Color('#f59e0b'), t / 0.45);
    } else {
      return new THREE.Color().lerpColors(new THREE.Color('#f59e0b'), new THREE.Color('#ef4444'), (t - 0.45) / 0.55);
    }
  } else {
    // Speed Mode: Cyan (<130 km/h) -> Gold (130-240) -> Hot Red (>240)
    if (t < 0.5) {
      return new THREE.Color().lerpColors(new THREE.Color('#06b6d4'), new THREE.Color('#f59e0b'), t * 2);
    } else {
      return new THREE.Color().lerpColors(new THREE.Color('#f59e0b'), new THREE.Color('#ef4444'), (t - 0.5) * 2);
    }
  }
}

function TrackSplineMesh({ points, mode }) {
  const curve = useMemo(() => {
    const vectors = points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(vectors, true, 'centripetal');
  }, [points]);

  // High-visibility asphalt ribbon
  const tubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 280, 0.45, 12, true);
  }, [curve]);

  // Vertex-colored racing line glow
  const lineGeometry = useMemo(() => {
    const numPoints = 400;
    const dense = curve.getPoints(numPoints);
    const colors = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const factor = mode === 'wear' 
        ? Math.min(1, Math.max(0, t * 0.95 + 0.05))
        : (Math.sin(t * Math.PI * 6) + 1) / 2;
      const c = getHeatmapColor(factor, mode);
      colors.push(c.r, c.g, c.b);
    }
    const geom = new THREE.BufferGeometry().setFromPoints(dense);
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geom;
  }, [curve, mode]);

  return (
    <group>
      {/* Asphalt Surface */}
      <mesh geometry={tubeGeometry}>
        <meshStandardMaterial
          color="#1a1d24"
          roughness={0.6}
          metalness={0.4}
        />
      </mesh>

      {/* High-Visibility Vertex-Colored Racing Line */}
      <line geometry={lineGeometry}>
        <lineBasicMaterial
          vertexColors={true}
          linewidth={3.5}
          transparent
          opacity={0.95}
        />
      </line>
    </group>
  );
}

function TelemetryCar({ points, onTelemetryUpdate }) {
  const carRef = useRef();
  const curve = useMemo(() => {
    const vectors = points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(vectors, true, 'centripetal');
  }, [points]);

  useFrame((state) => {
    const t = (state.clock.getElapsedTime() * 0.04) % 1;
    const pos = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);

    if (carRef.current) {
      carRef.current.position.copy(pos);
      carRef.current.position.y += 0.22;
      carRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    }

    if (onTelemetryUpdate && Math.floor(state.clock.getElapsedTime() * 12) % 3 === 0) {
      const speedKm = Math.round(180 + Math.sin(t * Math.PI * 6) * 125);
      const throttlePct = Math.round(Math.max(15, Math.min(100, 50 + Math.sin(t * Math.PI * 6) * 60)));
      const tireWearPct = Math.round(t * 80 + 12);
      const gear = speedKm > 260 ? '7th' : speedKm > 200 ? '6th' : speedKm > 140 ? '4th' : '2nd';
      const drs = speedKm > 270;
      onTelemetryUpdate({ speedKm, throttlePct, tireWearPct, gear, drs, lapProgress: Math.round(t * 100) });
    }
  });

  return (
    <group ref={carRef}>
      {/* Aerodynamic Chassis */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.38, 0.14, 0.8]} />
        <meshStandardMaterial color="#E10600" metalness={0.9} roughness={0.15} emissive="#E10600" emissiveIntensity={0.8} />
      </mesh>
      {/* Rear Wing */}
      <mesh position={[0, 0.14, -0.36]}>
        <boxGeometry args={[0.48, 0.09, 0.06]} />
        <meshStandardMaterial color="#FFFFFF" metalness={0.5} roughness={0.2} />
      </mesh>
      {/* Front Wing */}
      <mesh position={[0, -0.02, 0.4]}>
        <boxGeometry args={[0.54, 0.04, 0.14]} />
        <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Rear Rain Light */}
      <pointLight color="#E10600" intensity={4} distance={8} position={[0, 0.1, -0.45]} />
    </group>
  );
}

function PitWindowMarker({ position }) {
  const markerRef = useRef();
  const ringRef = useRef();
  const beamRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (markerRef.current) {
      markerRef.current.position.y = position[1] + 0.8 + Math.sin(t * 3.5) * 0.15;
      markerRef.current.rotation.y = t * 2.5;
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = -Math.PI / 2;
      const s = 1 + Math.sin(t * 3.5) * 0.25;
      ringRef.current.scale.set(s, s, s);
    }
    if (beamRef.current) {
      beamRef.current.material.opacity = 0.35 + Math.sin(t * 4) * 0.15;
    }
  });

  return (
    <group position={position}>
      {/* Ground Pulse Ring */}
      <mesh ref={ringRef} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.7, 1.05, 32]} />
        <meshBasicMaterial color="#FF1801" side={THREE.DoubleSide} transparent opacity={0.8} />
      </mesh>

      {/* Holographic Vertical Laser Beam */}
      <mesh ref={beamRef} position={[0, 4, 0]}>
        <cylinderGeometry args={[0.08, 0.3, 8, 16, 1, true]} />
        <meshBasicMaterial color="#FF1801" transparent opacity={0.4} wireframe />
      </mesh>

      {/* Rotating Diamond Beacon */}
      <mesh ref={markerRef} position={[0, 0.8, 0]}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color="#FF1801"
          emissive="#FF1801"
          emissiveIntensity={2.0}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>
      <pointLight color="#FF1801" intensity={5} distance={12} position={[0, 1.2, 0]} />
    </group>
  );
}

function GroundCoordinateGrid() {
  return (
    <group position={[0, -0.6, 0]}>
      <gridHelper args={[60, 30, '#FF1801', '#121622']} />
    </group>
  );
}


function SectorMarkers({ sectors }) {
  return (
    <group>
      {sectors.map((sec, idx) => (
        <group key={idx} position={sec.pos}>
          <mesh position={[0, 0.25, 0]}>
            <sphereGeometry args={[0.28, 16, 16]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.0} />
          </mesh>
          <pointLight color="#FFFFFF" intensity={1.5} distance={4} position={[0, 0.5, 0]} />
        </group>
      ))}
    </group>
  );
}

export default function Circuit3D({
  trackId = "monaco",
  pitLap = 32,
  tireCompound = "HARD"
}) {
  const activeCircuit = CIRCUITS_3D[trackId] || CIRCUITS_3D.monaco;
  const [renderMode, setRenderMode] = useState('wear'); // 'wear' | 'speed'
  const [carLive, setCarLive] = useState({
    speedKm: 275,
    throttlePct: 95,
    tireWearPct: 35,
    gear: '7th',
    drs: true,
    lapProgress: 42
  });

  return (
    <div className="f1-card flex flex-col p-5 gap-4">
      {/* Top Header with Context & Mode Toggles */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-[#212530] pb-3 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#E10600] inline-block live-indicator" />
            <h3 className="font-f1 text-xl font-bold text-white tracking-wider">
              3D Real-Time Spline &amp; Dynamic Degradation Heatmap
            </h3>
          </div>
          <p className="text-xs font-mono text-neutral-400 mt-0.5">
            Interactive WebGL trajectory projecting live tire thermal stress gradients, apex velocities, and the optimal pit box trigger
          </p>
        </div>

        {/* Heatmap Mode Toggles */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-neutral-500 text-[11px] uppercase mr-1">HEATMAP GRADIENT:</span>
          <button
            onClick={() => setRenderMode('wear')}
            className={`px-3 py-1 font-bold uppercase rounded-xs transition-all cursor-pointer ${
              renderMode === 'wear'
                ? 'bg-[#E10600] text-black font-extrabold shadow-sm'
                : 'bg-[#0E1015] border border-[#21242e] text-neutral-400 hover:text-white'
            }`}
          >
            TIRE DEGRADATION (THERMAL)
          </button>
          <button
            onClick={() => setRenderMode('speed')}
            className={`px-3 py-1 font-bold uppercase rounded-xs transition-all cursor-pointer ${
              renderMode === 'speed'
                ? 'bg-[#E10600] text-black font-extrabold shadow-sm'
                : 'bg-[#0E1015] border border-[#21242e] text-neutral-400 hover:text-white'
            }`}
          >
            CORNER VELOCITY (KM/H)
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Box */}
      <div className="relative w-full h-[480px] bg-[#050608] border border-[#1b1e26] rounded-xs overflow-hidden select-none">
        <Canvas
          camera={{ position: activeCircuit.cameraPos, fov: 40 }}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        >
          <color attach="background" args={['#050608']} />
          <ambientLight intensity={0.9} />
          <directionalLight position={[15, 30, 15]} intensity={1.8} />
          <directionalLight position={[-15, -20, -10]} intensity={0.5} />
          <pointLight position={activeCircuit.pitStopPos} intensity={4} color="#E10600" distance={16} />

          {/* Spline Mesh, Telemetry Car & Markers */}
          <TrackSplineMesh points={activeCircuit.waypoints} mode={renderMode} />
          <TelemetryCar points={activeCircuit.waypoints} onTelemetryUpdate={setCarLive} />
          <PitWindowMarker position={activeCircuit.pitStopPos} />
          <SectorMarkers sectors={activeCircuit.sectors} />
          <GroundCoordinateGrid />

          <OrbitControls
            enablePan={false}
            maxPolarAngle={Math.PI / 2.1}
            minDistance={12}
            maxDistance={55}
            autoRotate={true}
            autoRotateSpeed={0.35}
          />
        </Canvas>

        {/* Floating Telemetry HUD (Top-Left) */}
        <div className="absolute top-3 left-3 pointer-events-none flex flex-col gap-1.5 bg-[#0A0C10]/95 backdrop-blur-md border border-[#212530] p-3.5 rounded-xs shadow-2xl">
          <div className="flex items-center gap-2 border-b border-[#1b1e26] pb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E10600] animate-pulse" />
            <strong className="font-f1 text-sm text-white tracking-wide">{activeCircuit.name}</strong>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#1b1f28] text-neutral-300 rounded-xs">
              {activeCircuit.country}
            </span>
          </div>

          <div className="font-mono text-[10px] text-neutral-400">
            {activeCircuit.length_km} KM &bull; {activeCircuit.turns} TURNS &bull; {activeCircuit.drs_zones} DRS ZONES
          </div>

          {/* Live Telemetry Ticker */}
          <div className="grid grid-cols-2 gap-2 mt-1 font-mono text-xs">
            <div className="bg-[#12151B] px-2.5 py-1 rounded-xs border border-[#1f232d]">
              <span className="text-[9px] text-neutral-500 block uppercase">VELOCITY</span>
              <strong className="text-white text-base">{carLive.speedKm} <span className="text-[10px] text-neutral-400">km/h</span></strong>
            </div>
            <div className="bg-[#12151B] px-2.5 py-1 rounded-xs border border-[#1f232d]">
              <span className="text-[9px] text-neutral-500 block uppercase">THROTTLE</span>
              <strong className="text-emerald-400 text-base">{carLive.throttlePct}%</strong>
            </div>
            <div className="bg-[#12151B] px-2.5 py-1 rounded-xs border border-[#1f232d]">
              <span className="text-[9px] text-neutral-500 block uppercase">GEAR / DRS</span>
              <strong className="text-neutral-200 text-sm">{carLive.gear} {carLive.drs ? <span className="text-emerald-400 font-bold ml-1">DRS</span> : ''}</strong>
            </div>
            <div className="bg-[#12151B] px-2.5 py-1 rounded-xs border border-[#1f232d]">
              <span className="text-[9px] text-neutral-500 block uppercase">TIRE WEAR</span>
              <strong className={carLive.tireWearPct > 65 ? "text-[#FF1801] text-sm" : "text-amber-400 text-sm"}>
                {carLive.tireWearPct}%
              </strong>
            </div>
          </div>

          {/* F1 Steering Wheel Shift Lights (15 LEDs) */}
          <div className="flex items-center justify-between gap-0.5 mt-1 bg-black/80 px-2 py-1 rounded-xs border border-[#21242e]">
            {[...Array(5)].map((_, i) => (
              <span
                key={`g-${i}`}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  carLive.speedKm > 130 + i * 15
                    ? 'bg-[#00E676] shadow-[0_0_6px_#00E676]'
                    : 'bg-[#00E676]/20'
                }`}
              />
            ))}
            {[...Array(5)].map((_, i) => (
              <span
                key={`y-${i}`}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  carLive.speedKm > 200 + i * 12
                    ? 'bg-[#FFF200] shadow-[0_0_6px_#FFF200]'
                    : 'bg-[#FFF200]/20'
                }`}
              />
            ))}
            {[...Array(3)].map((_, i) => (
              <span
                key={`r-${i}`}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  carLive.speedKm > 255 + i * 8
                    ? 'bg-[#FF1801] shadow-[0_0_6px_#FF1801]'
                    : 'bg-[#FF1801]/20'
                }`}
              />
            ))}
            {[...Array(2)].map((_, i) => (
              <span
                key={`b-${i}`}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  carLive.speedKm > 275
                    ? 'bg-[#00D2BE] shadow-[0_0_8px_#00D2BE] animate-pulse'
                    : 'bg-[#00D2BE]/20'
                }`}
              />
            ))}
          </div>

          {/* Lateral G-Force Friction Gauge */}
          <div className="flex items-center gap-2.5 bg-[#12151B] px-2.5 py-1.5 rounded-xs border border-[#1f232d] mt-0.5">
            <div className="relative w-7 h-7 rounded-full border border-neutral-600 flex items-center justify-center shrink-0 bg-black/40">
              <div className="absolute w-full h-[0.5px] bg-neutral-700" />
              <div className="absolute h-full w-[0.5px] bg-neutral-700" />
              <span
                className="absolute w-2 h-2 rounded-full bg-[#FF1801] shadow-[0_0_6px_#FF1801]"
                style={{
                  transform: `translate(${Math.sin((carLive.lapProgress || 0) * 0.15) * 8}px, ${Math.cos((carLive.lapProgress || 0) * 0.15) * 6}px)`
                }}
              />
            </div>
            <div>
              <span className="text-[9px] text-neutral-500 block uppercase">LATERAL G-FORCE</span>
              <strong className="text-white text-xs font-mono">
                {(1.8 + Math.abs(Math.sin((carLive.lapProgress || 0) * 0.15)) * 3.2).toFixed(1)} G
              </strong>
            </div>
          </div>
        </div>

        {/* Stochastic Pit Box Target (Top-Right) */}
        <div className="absolute top-3 right-3 pointer-events-none bg-[#0A0C10]/95 backdrop-blur-md border border-[#212530] p-3.5 rounded-xs text-right shadow-2xl">
          <div className="text-[10px] tracking-widest uppercase font-mono text-neutral-400 font-semibold">
            OPTIMAL STOCHASTIC PIT WINDOW
          </div>
          <div className="font-mono text-2xl font-bold text-white mt-0.5">
            LAP {pitLap} <span className="text-[#E10600] text-sm">&rarr; {tireCompound}</span>
          </div>
          <div className="text-[11px] font-mono text-emerald-400 font-bold mt-0.5">
            EXPECTED SC BONUS: ~11.8s
          </div>
        </div>

        {/* Bottom Legend Bar */}
        <div className="absolute bottom-2.5 left-3 right-3 pointer-events-none flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono text-neutral-400 uppercase bg-[#0A0C10]/90 backdrop-blur-sm px-3 py-1.5 border border-[#212530] gap-2">
          {renderMode === 'wear' ? (
            <div className="flex items-center gap-3">
              <span className="text-white font-bold">THERMAL WEAR GRADIENT:</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-xs bg-[#10b981]" /> 0-40% FRESH GRIP</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-xs bg-[#f59e0b]" /> 40-75% LINEAR WEAR</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-xs bg-[#ef4444]" /> 75%+ CLIFF ZONE</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-white font-bold">VELOCITY GRADIENT:</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-xs bg-[#06b6d4]" /> &lt;130 KM/H (SLOW CHICANE)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-xs bg-[#f59e0b]" /> 130-240 KM/H (MEDIUM CORNER)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-xs bg-[#ef4444]" /> 240+ KM/H (DRS STRAIGHT)</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#E10600] animate-pulse" /> OPTIMAL BOX LAP</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white" /> TIMING SECTORS (S1/S2/S3)</span>
          </div>
        </div>
      </div>

      {/* Timing Sectors Diagnostic Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
        {activeCircuit.sectors.map((sec, sIdx) => (
          <div key={sIdx} className="bg-[#0A0C10] border border-[#1b1e26] p-3 rounded-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
              <div>
                <strong className="text-white block">{sec.name}</strong>
                <span className="text-[10px] text-neutral-500">APEX GEAR: {sec.gear} &bull; LATERAL LOAD: {sec.gForce}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-neutral-500 block uppercase">APEX SPEED</span>
              <strong className="text-emerald-400 text-sm">{sec.speed}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
