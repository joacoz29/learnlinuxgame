import * as THREE from 'three';
import type { Facing } from '../data/world/types';

export const COLORS = {
  cyan: 0x35e0ff,
  red: 0xff3355,
  green: 0x3dff9a,
  amber: 0xffb13d,
  magenta: 0xff3df2,
  void: 0x04060d,
};

export const WALL_HEIGHT = 3.4;

export function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function floorTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#101a30';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#16213c';
    ctx.fillRect(8, 8, 240, 240);
    ctx.strokeStyle = 'rgba(53,224,255,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 252, 252);
    ctx.strokeStyle = 'rgba(53,224,255,0.12)';
    ctx.lineWidth = 1;
    for (let i = 64; i < 256; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 8);
      ctx.lineTo(i, 248);
      ctx.moveTo(8, i);
      ctx.lineTo(248, i);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(53,224,255,0.5)';
    for (const [x, y] of [[8, 8], [248, 8], [8, 248], [248, 248]] as const) ctx.fillRect(x - 3, y - 3, 6, 6);
  });
}

export function wallTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#1b2746';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#16203a';
    ctx.fillRect(6, 6, 244, 244);
    ctx.strokeStyle = 'rgba(120,160,255,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, 244, 244);
    ctx.beginPath();
    ctx.moveTo(6, 128);
    ctx.lineTo(250, 128);
    ctx.moveTo(128, 6);
    ctx.lineTo(128, 128);
    ctx.stroke();
    ctx.fillStyle = 'rgba(160,190,255,0.35)';
    for (const [x, y] of [[16, 16], [240, 16], [16, 240], [240, 240], [16, 120], [240, 120]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function rackTexture(seed: number): THREE.CanvasTexture {
  const texture = canvasTexture(128, 512, (ctx) => {
    ctx.fillStyle = '#0a0f1c';
    ctx.fillRect(0, 0, 128, 512);
    let s = seed;
    const rand = (): number => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const palette = ['#35e0ff', '#3dff9a', '#ffb13d', '#35e0ff'];
    for (let y = 8; y < 504; y += 32) {
      ctx.fillStyle = '#141c30';
      ctx.fillRect(6, y, 116, 24);
      ctx.fillStyle = '#1f2a46';
      ctx.fillRect(10, y + 4, 60, 16);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = rand() > 0.3 ? (palette[Math.floor(rand() * palette.length)] as string) : '#16203a';
        ctx.fillRect(78 + i * 7, y + 9, 4, 6);
      }
    }
  });
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function dashTexture(): THREE.CanvasTexture {
  const texture = canvasTexture(64, 16, (ctx) => {
    ctx.clearRect(0, 0, 64, 16);
    const gradient = ctx.createLinearGradient(0, 0, 64, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.65, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 4, 64, 8);
  });
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

export interface TextPanel {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  draw(lines: string[], color: string, options?: { background?: string }): void;
}

/** A plane showing canvas text; redraw it whenever the content or state changes. */
export function createTextPanel(width: number, height: number, pxW: number, pxH: number, additive = false): TextPanel {
  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);

  const draw = (lines: string[], color: string, options: { background?: string } = {}): void => {
    ctx.clearRect(0, 0, pxW, pxH);
    if (options.background) {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, pxW, pxH);
    }
    const lineHeight = pxH / Math.max(lines.length + 1, 3);
    let size = Math.floor(lineHeight * 0.8);
    const font = (px: number): string => `bold ${px}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.font = font(size);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
    if (widest > pxW * 0.9) size = Math.floor((size * pxW * 0.9) / widest);
    ctx.font = font(size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.5;
    ctx.fillStyle = color;
    const top = pxH / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => ctx.fillText(line, pxW / 2, top + i * lineHeight));
    ctx.shadowBlur = 0;
    texture.needsUpdate = true;
  };
  return { mesh, material, draw };
}

/** Rotation.y for an object authored facing +z so that its front points toward `facing`. */
export function objectYaw(facing: Facing): number {
  return { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 }[facing];
}

/** Camera yaw that looks toward `facing` (the camera looks down -z at yaw 0). */
export function cameraYaw(facing: Facing): number {
  return { n: 0, w: Math.PI / 2, s: Math.PI, e: -Math.PI / 2 }[facing];
}

export function facingVector(facing: Facing): { x: number; z: number } {
  return { s: { x: 0, z: 1 }, n: { x: 0, z: -1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } }[facing];
}
