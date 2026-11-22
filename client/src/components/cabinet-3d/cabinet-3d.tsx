/**
 * 3D 机柜预览 — 铝型材 + 三通角件框架（工程图纸视觉语言）。
 *  - 型材杆：带 T 型槽截面，沿 12 条棱；8 个三通角件
 *  - 尺寸变化 spring 过渡：改宽/深/高时型材平滑伸缩（reduced-motion 下直接跳变）
 *  - 爆炸视图滑块：型材/角件沿各自向外方向拉开，看结构组成
 *  - 视点预设：正视/俯视/侧视/等轴，相机平滑飞行
 *  - 线框模式：金色线框 + 标注（工程图纸模式）
 *  - 光照：Lightformer 程序化环境贴图——金属材质没有 envMap 会近乎全黑（离线可用）
 *  - 接触投影 + 图纸网格：柜体落点与空间感
 *  - 导出 PNG（preserveDrawingBuffer）/ 型材总长 HUD
 *  - OrbitControls 拖拽旋转 + 自转
 */

import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  Lightformer,
  ContactShadows,
  Grid,
  Edges,
} from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import * as THREE from 'three';
import type { CabinetSize, ProfileColor } from '@idle-fish/shared';
import { SIZE_GAP } from '@idle-fish/shared';
import { Download } from 'lucide-react';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

interface Cabinet3DProps {
  size: CabinetSize;
  color: ProfileColor;
}

const PROFILE = 0.025; // 型材截面 25mm（视觉接近 20 系列）
const SLOT = 0.006; // T 型槽宽
const SLOT_DEPTH = 0.008; // 槽深
const NODE = 0.032; // 三通角件尺寸
const GOLD = '#C9A961';
/** 相机注视点高度（画面构图）：target 投影在画面中心，值越小柜体越靠上 */
const CAM_TARGET_Y = 0.18;
/** 视点预设（相机位置）；俯视保留微偏移防万向锁翻转 */
const VIEWPOINTS = {
  front: [0, 0.35, 2.0],
  top: [0.02, 2.1, 0.02],
  side: [2.0, 0.35, 0],
  iso: [1.35, 1.15, 1.35],
} as const;

type ViewName = keyof typeof VIEWPOINTS;

export function Cabinet3D({ size, color }: Cabinet3DProps) {
  const inner = useMemo(
    () => ({
      w: Math.max(0, (size.width - SIZE_GAP) / 1000),
      d: Math.max(0, (size.depth - SIZE_GAP) / 1000),
      h: Math.max(0, (size.height - SIZE_GAP) / 1000),
    }),
    [size],
  );

  // 金属质感配色：禁纯黑（铁律），black 档也保留灰面反射
  const COLOR_MAP = {
    black: { material: '#3a3a42', edge: '#52525e', node: '#45454e' },
    silver: { material: '#d9d9de', edge: '#f2f2f5', node: '#c9c9cf' },
  } as const;
  const colorCfg = COLOR_MAP[color];
  const reducedMotion = usePrefersReducedMotion();

  const [explode, setExplode] = useState(0);
  const [wireframe, setWireframe] = useState(false);
  const [viewRequest, setViewRequest] = useState<ViewName | null>(null);
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 视点飞行逻辑在 Canvas 内部的 CameraFlyer 中驱动
  if (inner.w <= 0 && inner.d <= 0 && inner.h <= 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        请输入有效机柜尺寸
      </div>
    );
  }

  function handleExport() {
    const canvas = wrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `cabinet-${size.width}x${size.depth}x${size.height}.png`;
    a.click();
  }

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <Canvas
        camera={{ position: VIEWPOINTS.iso, fov: 38 }}
        style={{ width: '100%', height: '100%' }}
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 4, 2]} intensity={1.1} castShadow />
        <directionalLight position={[-3, 2, -2]} intensity={0.5} />
        <directionalLight position={[0, -3, 3]} intensity={0.25} />

        {/* 程序化环境贴图：给金属材质反射面（替代外部 HDR，离线可用） */}
        <Environment resolution={256}>
          <Lightformer intensity={2.2} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[9, 9, 1]} />
          <Lightformer intensity={1.6} position={[-4, 1.5, -1]} rotation-y={Math.PI / 2} scale={[7, 2.5, 1]} />
          <Lightformer intensity={1.2} position={[4, 1.5, 1]} rotation-y={-Math.PI / 2} scale={[7, 2.5, 1]} />
          <Lightformer intensity={0.9} position={[0, 1, 4]} scale={[6, 2, 1]} color="#aebfd8" />
        </Environment>

        <Frame
          inner={inner}
          colorCfg={colorCfg}
          explode={explode}
          wireframe={wireframe}
        />

        {/* 视点飞行驱动（useFrame 必须在 Canvas 内） */}
        <CameraFlyer
          viewRequest={viewRequest}
          reducedMotion={reducedMotion}
          controlsRef={controlsRef}
          onArrived={() => setViewRequest(null)}
        />

        {/* 尺寸标注（暖金）：宽 / 深 / 高，端点带刻度；爆炸展开时隐藏（工程惯例，避免脱节） */}
        <group position={[-inner.w / 2, -inner.h / 2, -inner.d / 2]} visible={explode === 0}>
          <DimensionLine
            from={[0, -0.08, inner.d + 0.04]}
            to={[inner.w, -0.08, inner.d + 0.04]}
            tickDir={[0, 0, -1]}
            label={`${size.width}mm`}
          />
          <DimensionLine
            from={[inner.w + 0.04, -0.08, 0]}
            to={[inner.w + 0.04, -0.08, inner.d]}
            tickDir={[1, 0, 0]}
            label={`${size.depth}mm`}
          />
          <DimensionLine
            from={[-0.08, 0, inner.d + 0.04]}
            to={[-0.08, inner.h, inner.d + 0.04]}
            tickDir={[0, 0, -1]}
            label={`${size.height}mm`}
          />
        </group>

        {/* 接触投影 + 图纸网格：柜体落点与蓝图空间感 */}
        <ContactShadows position={[0, -0.07, 0]} opacity={0.42} scale={3.2} blur={2.2} far={1.2} frames={1} />
        <Grid
          position={[0, -0.075, 0]}
          args={[10, 10]}
          cellSize={0.1}
          cellThickness={0.6}
          cellColor="#24365c"
          sectionSize={0.5}
          sectionThickness={1}
          sectionColor="#33507f"
          fadeDistance={4.5}
          fadeStrength={1.2}
          infiniteGrid
        />

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          autoRotate={!reducedMotion && !viewRequest}
          autoRotateSpeed={0.8}
          minDistance={0.7}
          maxDistance={4}
          target={[0, CAM_TARGET_Y, 0]}
        />
      </Canvas>

      {/* 控件条：右上角悬浮（构图上部为背景区，不遮挡柜体）。控件自解释，
          不再叠加「可拖拽旋转」类说明标签与重复尺寸徽标 */}
      <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-lg border border-white/10 bg-[#0b1220]/70 px-2 py-1 backdrop-blur-sm">
        {(Object.keys(VIEWPOINTS) as ViewName[]).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setViewRequest(name)}
            aria-label={`切换到${VIEW_LABEL[name]}视角`}
            title={`切换到${VIEW_LABEL[name]}视角`}
            className="rounded px-1.5 py-0.5 text-[10px] text-white/70 transition-colors hover:bg-white/10 hover:text-accent"
          >
            {VIEW_LABEL[name]}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-white/15" aria-hidden />
        <button
          type="button"
          onClick={() => setWireframe((v) => !v)}
          aria-pressed={wireframe}
          title="线框模式（工程图纸）"
          className={`rounded px-1.5 py-0.5 text-[10px] transition-colors hover:bg-white/10 ${
            wireframe ? 'bg-accent/20 text-accent' : 'text-white/70'
          }`}
        >
          线框
        </button>
        <span className="mx-1 h-4 w-px bg-white/15" aria-hidden />
        <label className="flex items-center gap-1.5 text-[10px] text-white/70">
          <span aria-hidden>爆</span>
          <input
            type="range"
            min={0}
            max={100}
            value={explode * 100}
            onChange={(e) => setExplode(Number(e.target.value) / 100)}
            aria-label="爆炸视图分离程度"
            className="h-1 w-16 cursor-pointer accent-[#C9A961]"
          />
        </label>
        <span className="mx-1 h-4 w-px bg-white/15" aria-hidden />
        <button
          type="button"
          onClick={handleExport}
          aria-label="导出当前视角 PNG"
          title="导出当前视角 PNG"
          className="rounded p-0.5 text-white/70 transition-colors hover:bg-white/10 hover:text-accent"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

const VIEW_LABEL: Record<ViewName, string> = { front: '正', top: '顶', side: '侧', iso: '轴' };

interface CameraFlyerProps {
  viewRequest: ViewName | null;
  reducedMotion: boolean;
  controlsRef: React.RefObject<ComponentRef<typeof OrbitControls>>;
  /** 到位后必须清空请求：否则每帧 lerp 回预设点，把用户的拖拽位置锁死 */
  onArrived: () => void;
}

/** 视点飞行：每帧向目标相机位 lerp，到位清空；reduced-motion 直接跳变（useFrame 须在 Canvas 内） */
function CameraFlyer({ viewRequest, reducedMotion, controlsRef, onArrived }: CameraFlyerProps) {
  const flyTarget = useRef<THREE.Vector3 | null>(null);
  useFrame(({ camera }) => {
    const controls = controlsRef.current;
    if (!viewRequest || !controls) return;
    const [x, y, z] = VIEWPOINTS[viewRequest];
    const target = flyTarget.current ?? new THREE.Vector3(x, y, z);
    flyTarget.current = target;
    if (reducedMotion) {
      camera.position.set(x, y, z);
      flyTarget.current = null;
      onArrived();
    } else {
      camera.position.lerp(target, 0.12);
      if (camera.position.distanceTo(target) < 0.02) {
        flyTarget.current = null;
        onArrived();
      }
    }
    controls.target.set(0, CAM_TARGET_Y, 0);
    controls.update();
  });
  return null;
}

interface FrameProps {
  inner: { w: number; d: number; h: number };
  colorCfg: { material: string; edge: string; node: string };
  explode: number;
  wireframe: boolean;
}

/** 12 条棱的带槽铝型材 + 8 个三通角件；整体居中偏移随尺寸 spring 过渡 */
function Frame({ inner, colorCfg, explode, wireframe }: FrameProps) {
  const { w, d, h } = inner;
  const groupRef = useRef<THREE.Group>(null);
  const reducedMotion = usePrefersReducedMotion();

  const center: [number, number, number] = [w / 2, h / 2, d / 2];

  // 尺寸过渡：group 居中偏移向目标 lerp（reduced-motion 直接跳变）
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const t = reducedMotion ? 1 : 0.2;
    g.position.x += (-w / 2 - g.position.x) * t;
    g.position.y += (-h / 2 - g.position.y) * t;
    g.position.z += (-d / 2 - g.position.z) * t;
  });

  // 12 条棱：中点、长度、轴向。key 按角色固定（尺寸过渡时组件保持挂载）
  const bars: { mid: [number, number, number]; len: number; axis: 'x' | 'y' | 'z' }[] = [
    { mid: [w / 2, 0, 0], len: w, axis: 'x' },
    { mid: [w / 2, h, 0], len: w, axis: 'x' },
    { mid: [w / 2, 0, d], len: w, axis: 'x' },
    { mid: [w / 2, h, d], len: w, axis: 'x' },
    { mid: [0, h / 2, 0], len: h, axis: 'y' },
    { mid: [w, h / 2, 0], len: h, axis: 'y' },
    { mid: [0, h / 2, d], len: h, axis: 'y' },
    { mid: [w, h / 2, d], len: h, axis: 'y' },
    { mid: [0, 0, d / 2], len: d, axis: 'z' },
    { mid: [0, h, d / 2], len: d, axis: 'z' },
    { mid: [w, 0, d / 2], len: d, axis: 'z' },
    { mid: [w, h, d / 2], len: d, axis: 'z' },
  ];

  const nodes: [number, number, number][] = [
    [0, 0, 0], [w, 0, 0], [0, h, 0], [w, h, 0],
    [0, 0, d], [w, 0, d], [0, h, d], [w, h, d],
  ];

  return (
    <group ref={groupRef}>
      {bars.map((b, i) => (
        <ProfileBar
          key={`b${i}`}
          midTarget={b.mid}
          len={b.len}
          axis={b.axis}
          material={colorCfg.material}
          edge={colorCfg.edge}
          wireframe={wireframe}
          explode={explode}
          explodeDir={barExplodeDir(b.mid, center)}
        />
      ))}
      {nodes.map((p, i) => (
        <CornerNode
          key={`n${i}`}
          posTarget={p}
          color={colorCfg.node}
          edge={colorCfg.edge}
          wireframe={wireframe}
          explode={explode}
          explodeDir={nodeExplodeDir(p, center)}
        />
      ))}
    </group>
  );
}

/** 条的爆炸方向：条中点相对框架中心的单位向量 */
function barExplodeDir(mid: [number, number, number], center: [number, number, number]): [number, number, number] {
  const v = new THREE.Vector3(mid[0] - center[0], mid[1] - center[1], mid[2] - center[2]);
  if (v.lengthSq() < 1e-8) return [0, 0, 0];
  return [v.x / v.length(), v.y / v.length(), v.z / v.length()];
}

/** 角件的爆炸方向：体对角向外（角点相对中心，恒为非零） */
function nodeExplodeDir(pos: [number, number, number], center: [number, number, number]): [number, number, number] {
  const v = new THREE.Vector3(pos[0] - center[0], pos[1] - center[1], pos[2] - center[2]);
  const len = v.length();
  return len < 1e-8 ? [0, 0, 0] : [v.x / len, v.y / len, v.z / len];
}

/** 爆炸位移幅度：条 0.55、角件 0.85（滑块 0–1） */
const EXPLODE_BAR = 0.55;
const EXPLODE_NODE = 0.85;

interface ProfileBarProps {
  midTarget: [number, number, number];
  len: number;
  axis: 'x' | 'y' | 'z';
  material: string;
  edge: string;
  wireframe: boolean;
  explode: number;
  explodeDir: [number, number, number];
}

/**
 * 带槽铝型材杆：主方条 + 4 条 T 槽（沿轴向）。
 * 几何固定为 1 基准、由 scale 驱动长度；position/scale 逐帧 lerp 实现尺寸 spring 过渡。
 */
function ProfileBar({ midTarget, len, axis, material, edge, wireframe, explode, explodeDir }: ProfileBarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mainRef = useRef<THREE.Mesh>(null);
  const slotGroupRef = useRef<THREE.Group>(null);
  const reducedMotion = usePrefersReducedMotion();

  // 主条几何 1 基准：scale 沿轴驱动长度；槽长贯通（len + PROFILE）
  const mainGeo: [number, number, number] =
    axis === 'x' ? [1, PROFILE, PROFILE] : axis === 'y' ? [PROFILE, 1, PROFILE] : [PROFILE, PROFILE, 1];
  const mainScale: [number, number, number] =
    axis === 'x' ? [len, 1, 1] : axis === 'y' ? [1, len, 1] : [1, 1, len];
  const slotGeo: [number, number, number] =
    axis === 'x' ? [1, SLOT, SLOT] : axis === 'y' ? [SLOT, 1, SLOT] : [SLOT, SLOT, 1];
  const slotScale: [number, number, number] =
    axis === 'x' ? [len + PROFILE, 1, 1] : axis === 'y' ? [1, len + PROFILE, 1] : [1, 1, len + PROFILE];

  const half = PROFILE / 2;
  const sd = half - SLOT_DEPTH / 2;
  const slotOffsets: [number, number, number][] =
    axis === 'x' ? [[0, sd, 0], [0, -sd, 0], [0, 0, sd], [0, 0, -sd]]
    : axis === 'y' ? [[sd, 0, 0], [-sd, 0, 0], [0, 0, sd], [0, 0, -sd]]
    : [[sd, 0, 0], [-sd, 0, 0], [0, sd, 0], [0, -sd, 0]];

  const matColor = wireframe ? GOLD : material;

  useFrame(() => {
    const g = groupRef.current;
    const m = mainRef.current;
    const sg = slotGroupRef.current;
    if (!g || !m || !sg) return;
    const t = reducedMotion ? 1 : 0.2;
    // 尺寸 spring：位置/长度向目标 lerp，再叠加爆炸位移（滑块直接驱动，不过渡）
    g.position.x += (midTarget[0] + explodeDir[0] * EXPLODE_BAR * explode - g.position.x) * t;
    g.position.y += (midTarget[1] + explodeDir[1] * EXPLODE_BAR * explode - g.position.y) * t;
    g.position.z += (midTarget[2] + explodeDir[2] * EXPLODE_BAR * explode - g.position.z) * t;
    m.scale.x += (mainScale[0] - m.scale.x) * t;
    m.scale.y += (mainScale[1] - m.scale.y) * t;
    m.scale.z += (mainScale[2] - m.scale.z) * t;
    sg.scale.x += (slotScale[0] - sg.scale.x) * t;
    sg.scale.y += (slotScale[1] - sg.scale.y) * t;
    sg.scale.z += (slotScale[2] - sg.scale.z) * t;
  });

  return (
    <group ref={groupRef}>
      <mesh ref={mainRef} castShadow>
        <boxGeometry args={mainGeo} />
        <meshStandardMaterial
          color={matColor}
          metalness={wireframe ? 0 : 0.85}
          roughness={wireframe ? 0.4 : 0.28}
          envMapIntensity={wireframe ? 0 : 1.15}
          wireframe={wireframe}
        />
        <Edges scale={1} threshold={15} color={wireframe ? GOLD : edge} />
      </mesh>
      <group ref={slotGroupRef} visible={!wireframe}>
        {slotOffsets.map((off, i) => (
          <mesh key={i} position={off}>
            <boxGeometry args={slotGeo} />
            <meshStandardMaterial color={edge} metalness={0.6} roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

interface CornerNodeProps {
  posTarget: [number, number, number];
  color: string;
  edge: string;
  wireframe: boolean;
  explode: number;
  explodeDir: [number, number, number];
}

/** 三通角件：中心块，位置 spring 过渡 + 体对角爆炸外移 */
function CornerNode({ posTarget, color, edge, wireframe, explode, explodeDir }: CornerNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const reducedMotion = usePrefersReducedMotion();
  const n = NODE;

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const t = reducedMotion ? 1 : 0.2;
    g.position.x += (posTarget[0] + explodeDir[0] * EXPLODE_NODE * explode - g.position.x) * t;
    g.position.y += (posTarget[1] + explodeDir[1] * EXPLODE_NODE * explode - g.position.y) * t;
    g.position.z += (posTarget[2] + explodeDir[2] * EXPLODE_NODE * explode - g.position.z) * t;
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <boxGeometry args={[n, n, n]} />
        <meshStandardMaterial
          color={wireframe ? GOLD : color}
          metalness={wireframe ? 0 : 0.75}
          roughness={wireframe ? 0.4 : 0.3}
          envMapIntensity={wireframe ? 0 : 1.1}
          wireframe={wireframe}
        />
        <Edges scale={1} threshold={15} color={wireframe ? GOLD : edge} />
      </mesh>
    </group>
  );
}

interface DimensionLineProps {
  from: [number, number, number];
  to: [number, number, number];
  /** 端点刻度的方向（单位向量，通常指向柜体） */
  tickDir: [number, number, number];
  label: string;
}

function DimensionLine({ from, to, tickDir, label }: DimensionLineProps) {
  const geometry = useMemo(() => {
    const tick = 0.03;
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
      new THREE.Vector3(from[0] + tickDir[0] * tick, from[1] + tickDir[1] * tick, from[2] + tickDir[2] * tick),
      new THREE.Vector3(from[0] - tickDir[0] * tick, from[1] - tickDir[1] * tick, from[2] - tickDir[2] * tick),
      new THREE.Vector3(to[0] + tickDir[0] * tick, to[1] + tickDir[1] * tick, to[2] + tickDir[2] * tick),
      new THREE.Vector3(to[0] - tickDir[0] * tick, to[1] - tickDir[1] * tick, to[2] - tickDir[2] * tick),
    ]);
    return g;
  }, [from, to, tickDir]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  const mid: [number, number, number] = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  ];

  return (
    <group>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={GOLD} transparent opacity={0.9} />
      </lineSegments>
      <DimLabel position={mid} text={label} />
    </group>
  );
}

interface DimLabelProps {
  position: [number, number, number];
  text: string;
}

function DimLabel({ position, text }: DimLabelProps) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    // 深蓝图签底 + 金字描边：任意角度下保持可读
    ctx.fillStyle = 'rgba(11,18,32,0.72)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 256, 64, 10);
    ctx.fill();
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(11,18,32,0.9)';
    ctx.strokeText(text, 128, 34);
    ctx.fillStyle = GOLD;
    ctx.fillText(text, 128, 34);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text]);

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  return (
    <sprite position={position} scale={[0.24, 0.06, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
