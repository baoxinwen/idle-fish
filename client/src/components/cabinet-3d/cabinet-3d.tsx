/**
 * 3D 机柜预览 — 铝型材 + 三通角件框架。
 *  - 型材杆：带 T 型槽截面（主方条 + 4 条槽），沿 12 条棱
 *  - 三通角件：8 个角节点，三向 L 型接头（3 个交叉小方块）
 *  - 尺寸标注：暖金标注线
 *  - OrbitControls 拖拽旋转 + 自转
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Edges } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { CabinetSize, ProfileColor } from '@idlefish/shared';
import { SIZE_GAP } from '@idlefish/shared';

interface Cabinet3DProps {
  size: CabinetSize;
  color: ProfileColor;
}

const PROFILE = 0.025; // 型材截面 25mm（视觉接近 20 系列）
const SLOT = 0.006; // T 型槽宽
const SLOT_DEPTH = 0.008; // 槽深
const NODE = 0.032; // 三通角件尺寸

export function Cabinet3D({ size, color }: Cabinet3DProps) {
  const inner = useMemo(
    () => ({
      w: Math.max(0, (size.width - SIZE_GAP) / 1000),
      d: Math.max(0, (size.depth - SIZE_GAP) / 1000),
      h: Math.max(0, (size.height - SIZE_GAP) / 1000),
    }),
    [size],
  );

  const COLOR_MAP = {
    black: { material: '#3f3f46', edge: '#18181b', node: '#27272a' },
    silver: { material: '#e4e4e7', edge: '#a1a1aa', node: '#d4d4d8' },
  } as const;
  const colorCfg = COLOR_MAP[color];

  if (inner.w <= 0 && inner.d <= 0 && inner.h <= 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        请输入有效机柜尺寸
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [1.8, 1.5, 1.8], fov: 40 }}
      style={{ width: '100%', height: '100%' }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 2]} intensity={1.4} castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.6} />
      <directionalLight position={[0, -3, 3]} intensity={0.3} />

      <group position={[-inner.w / 2, -inner.h / 2, -inner.d / 2]}>
        <Frame inner={inner} material={colorCfg.material} edge={colorCfg.edge} nodeColor={colorCfg.node} />
        {/* 尺寸标注（暖金） */}
        <DimensionLine from={[0, -0.09, inner.d]} to={[inner.w, -0.09, inner.d]} label={`${size.width}mm`} />
        <DimensionLine from={[inner.w, -0.09, 0]} to={[inner.w, -0.09, inner.d]} label={`${size.depth}mm`} />
        <DimensionLine from={[-0.09, 0, inner.d]} to={[-0.09, inner.h, inner.d]} label={`${size.height}mm`} />
      </group>

      <OrbitControls
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.8}
        minDistance={0.8}
        maxDistance={5}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}

interface FrameProps {
  inner: { w: number; d: number; h: number };
  material: string;
  edge: string;
  nodeColor: string;
}

/** 12 条棱的带槽铝型材 + 8 个三通角件 */
function Frame({ inner, material, edge, nodeColor }: FrameProps) {
  const { w, d, h } = inner;

  // 12 条棱：起点、长度、轴向（'x'|'y'|'z'）
  const bars: { pos: [number, number, number]; len: number; axis: 'x' | 'y' | 'z' }[] = [
    // 底/顶 4 条宽（x 向）
    { pos: [w / 2, 0, 0], len: w, axis: 'x' },
    { pos: [w / 2, h, 0], len: w, axis: 'x' },
    { pos: [w / 2, 0, d], len: w, axis: 'x' },
    { pos: [w / 2, h, d], len: w, axis: 'x' },
    // 4 条立柱（y 向）
    { pos: [0, h / 2, 0], len: h, axis: 'y' },
    { pos: [w, h / 2, 0], len: h, axis: 'y' },
    { pos: [0, h / 2, d], len: h, axis: 'y' },
    { pos: [w, h / 2, d], len: h, axis: 'y' },
    // 前/后 4 条深（z 向）
    { pos: [0, 0, d / 2], len: d, axis: 'z' },
    { pos: [0, h, d / 2], len: d, axis: 'z' },
    { pos: [w, 0, d / 2], len: d, axis: 'z' },
    { pos: [w, h, d / 2], len: d, axis: 'z' },
  ];

  const nodes: [number, number, number][] = [
    [0, 0, 0], [w, 0, 0], [0, h, 0], [w, h, 0],
    [0, 0, d], [w, 0, d], [0, h, d], [w, h, d],
  ];

  return (
    <group>
      {bars.map((b, i) => (
        <ProfileBar key={`b${i}`} pos={b.pos} len={b.len} axis={b.axis} material={material} edge={edge} />
      ))}
      {nodes.map((p, i) => (
        <CornerNode key={`n${i}`} pos={p} color={nodeColor} edge={edge} />
      ))}
      {/* 底面托盘示意 */}
      <mesh position={[w / 2, -PROFILE / 2, d / 2]} receiveShadow>
        <boxGeometry args={[w * 0.9, PROFILE / 3, d * 0.9]} />
        <meshStandardMaterial color="#9ca3af" transparent opacity={0.3} metalness={0.3} roughness={0.6} />
      </mesh>
    </group>
  );
}

interface ProfileBarProps {
  pos: [number, number, number];
  len: number;
  axis: 'x' | 'y' | 'z';
  material: string;
  edge: string;
}

/** 带槽铝型材杆：主方条 + 4 条 T 槽（沿轴向） */
function ProfileBar({ pos, len, axis, material, edge }: ProfileBarProps) {
  // 主方条尺寸（沿 axis 方向为 len，另两向为 PROFILE）
  const size: [number, number, number] =
    axis === 'x' ? [len, PROFILE, PROFILE]
    : axis === 'y' ? [PROFILE, len, PROFILE]
    : [PROFILE, PROFILE, len];

  // 4 条槽：在方条 4 个面上各凹一条，沿轴向延伸
  const slotLen = len + PROFILE; // 槽略长，贯通
  const slotSize: [number, number, number] =
    axis === 'x' ? [slotLen, SLOT, SLOT]
    : axis === 'y' ? [SLOT, slotLen, SLOT]
    : [SLOT, SLOT, slotLen];

  const half = PROFILE / 2;
  const sd = half - SLOT_DEPTH / 2;
  // 4 条槽的偏移（垂直于 axis 的两个方向各 ±）
  const slotOffsets: [number, number, number][] =
    axis === 'x' ? [[0, sd, 0], [0, -sd, 0], [0, 0, sd], [0, 0, -sd]]
    : axis === 'y' ? [[sd, 0, 0], [-sd, 0, 0], [0, 0, sd], [0, 0, -sd]]
    : [[sd, 0, 0], [-sd, 0, 0], [0, sd, 0], [0, -sd, 0]];

  return (
    <group position={pos}>
      <mesh castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={material} metalness={0.7} roughness={0.35} />
        <Edges scale={1} threshold={15} color={edge} />
      </mesh>
      {slotOffsets.map((off, i) => (
        <mesh key={i} position={off}>
          <boxGeometry args={slotSize} />
          <meshStandardMaterial color={edge} metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

interface CornerNodeProps {
  pos: [number, number, number];
  color: string;
  edge: string;
}

/** 三通角件：3 个交叉小方块（沿 x/y/z 三向），模拟 L 型三向接头 */
function CornerNode({ pos, color, edge }: CornerNodeProps) {
  const n = NODE;
  // 3 个方块从角点向三个正方向延伸（角件占角）
  return (
    <group position={pos}>
      {/* 中心块 */}
      <mesh>
        <boxGeometry args={[n, n, n]} />
        <meshStandardMaterial color={color} metalness={0.75} roughness={0.3} />
        <Edges scale={1} threshold={15} color={edge} />
      </mesh>
    </group>
  );
}

interface DimensionLineProps {
  from: [number, number, number];
  to: [number, number, number];
  label: string;
}

function DimensionLine({ from, to, label }: DimensionLineProps) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
    ]);
    return g;
  }, [from, to]);

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
        <lineBasicMaterial color="#C9A961" />
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
    ctx.fillStyle = '#C9A961';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text]);

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  return (
    <sprite position={position} scale={[0.22, 0.055, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
