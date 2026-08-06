/**
 * 3D 机柜预览。
 *  - 铝型材框架：12 条棱用细长 BoxGeometry
 *  - 8 个三通节点
 *  - 尺寸标注：底部宽、深，侧面高
 *  - OrbitControls 拖拽 360° 旋转 + 无交互自转
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

const PROFILE = 0.02; // 型材截面 20mm
const NODE_R = 0.025; // 三通节点半径

export function Cabinet3D({ size, color }: Cabinet3DProps) {
  // 内径（米），clamp ≥0 避免负尺寸翻转几何
  const inner = useMemo(
    () => ({
      w: Math.max(0, (size.width - SIZE_GAP) / 1000),
      d: Math.max(0, (size.depth - SIZE_GAP) / 1000),
      h: Math.max(0, (size.height - SIZE_GAP) / 1000),
    }),
    [size],
  );

  // 颜色映射：型材材质色 + 棱线高亮色
  const COLOR_MAP = {
    black: { material: '#3f3f46', edge: '#18181b' },
    silver: { material: '#d4d4d8', edge: '#a1a1aa' },
  } as const;
  const colorCfg = COLOR_MAP[color];

  // 尺寸过小（内径全 0）时显示占位，避免退化几何
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
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 2]} intensity={1.1} castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} />

      <group position={[-inner.w / 2, -inner.h / 2, -inner.d / 2]}>
        <Frame inner={inner} material={colorCfg.material} edge={colorCfg.edge} />
        {/* 尺寸标注 */}
        <DimensionLine
          from={[0, -0.08, inner.d]}
          to={[inner.w, -0.08, inner.d]}
          label={`${size.width}mm`}
        />
        <DimensionLine
          from={[inner.w, -0.08, 0]}
          to={[inner.w, -0.08, inner.d]}
          label={`${size.depth}mm`}
        />
        <DimensionLine
          from={[-0.08, 0, inner.d]}
          to={[-0.08, inner.h, inner.d]}
          label={`${size.height}mm`}
        />
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
}

/** 12 条棱的铝型材框架 + 8 个三通节点 */
function Frame({ inner, material, edge }: FrameProps) {
  const { w, d, h } = inner;
  const t = PROFILE / 2;

  // 12 条棱：起点、长度、轴向
  const edges: { pos: [number, number, number]; size: [number, number, number] }[] = [
    // 底部 4 条
    { pos: [w / 2, 0, 0], size: [w + PROFILE, PROFILE, PROFILE] },
    { pos: [w / 2, h, 0], size: [w + PROFILE, PROFILE, PROFILE] },
    { pos: [w / 2, 0, d], size: [w + PROFILE, PROFILE, PROFILE] },
    { pos: [w / 2, h, d], size: [w + PROFILE, PROFILE, PROFILE] },
    // 4 条立柱
    { pos: [0, h / 2, 0], size: [PROFILE, h + PROFILE, PROFILE] },
    { pos: [w, h / 2, 0], size: [PROFILE, h + PROFILE, PROFILE] },
    { pos: [0, h / 2, d], size: [PROFILE, h + PROFILE, PROFILE] },
    { pos: [w, h / 2, d], size: [PROFILE, h + PROFILE, PROFILE] },
    // 前后 4 条深
    { pos: [0, 0, d / 2], size: [PROFILE, PROFILE, d + PROFILE] },
    { pos: [0, h, d / 2], size: [PROFILE, PROFILE, d + PROFILE] },
    { pos: [w, 0, d / 2], size: [PROFILE, PROFILE, d + PROFILE] },
    { pos: [w, h, d / 2], size: [PROFILE, PROFILE, d + PROFILE] },
  ];

  const nodes: [number, number, number][] = [
    [0, 0, 0], [w, 0, 0], [0, h, 0], [w, h, 0],
    [0, 0, d], [w, 0, d], [0, h, d], [w, h, d],
  ];

  return (
    <group>
      {edges.map((e, i) => (
        <mesh key={`e${i}`} position={e.pos} castShadow>
          <boxGeometry args={e.size} />
          <meshStandardMaterial color={material} metalness={0.5} roughness={0.4} />
          <Edges scale={1} threshold={15} color={edge} />
        </mesh>
      ))}
      {nodes.map((p, i) => (
        <mesh key={`n${i}`} position={p}>
          <sphereGeometry args={[NODE_R, 16, 16]} />
          <meshStandardMaterial color={material} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {/* 底面托盘示意 */}
      <mesh position={[w / 2, -t, d / 2]} receiveShadow>
        <boxGeometry args={[w * 0.9, PROFILE / 2, d * 0.9]} />
        <meshStandardMaterial color="#9ca3af" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

interface DimensionLineProps {
  from: [number, number, number];
  to: [number, number, number];
  label: string;
}

/** 尺寸标注线 + 文字（用 sprite 文字贴片） */
function DimensionLine({ from, to, label }: DimensionLineProps) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
    ]);
    return g;
  }, [from, to]);

  // 卸载/重建时释放旧 geometry，避免显存泄漏
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
        <lineBasicMaterial color="#2563eb" />
      </lineSegments>
      <DimLabel position={mid} text={label} />
    </group>
  );
}

interface DimLabelProps {
  position: [number, number, number];
  text: string;
}

/** 用 Canvas 纹理做文字贴片，避免加载外部字体 */
function DimLabel({ position, text }: DimLabelProps) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text]);

  // 卸载/重建时释放旧 texture
  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  return (
    <sprite position={position} scale={[0.22, 0.055, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
