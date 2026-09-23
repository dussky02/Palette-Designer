import React, { useRef, useEffect, useState } from 'react';
import { ColorGroup, GeneratedGroup } from '../types';
import { hslToRgb } from '../utils';
import { ColorWheel } from './ColorWheel';
import { Compass, Box, Layers, ZoomIn, ZoomOut, Maximize, Minimize } from 'lucide-react';

function rgbToHsb(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;

  let h = 0;
  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    b: Math.round(v * 100),
  };
}

function rgbToXyz(r: number, g: number, b: number) {
  let r_s = r / 255;
  let g_s = g / 255;
  let b_s = b / 255;

  r_s = r_s > 0.04045 ? Math.pow((r_s + 0.055) / 1.055, 2.4) : r_s / 12.92;
  g_s = g_s > 0.04045 ? Math.pow((g_s + 0.055) / 1.055, 2.4) : g_s / 12.92;
  b_s = b_s > 0.04045 ? Math.pow((b_s + 0.055) / 1.055, 2.4) : b_s / 12.92;

  r_s *= 100;
  g_s *= 100;
  b_s *= 100;

  // Observer = 2°, Illuminant = D65
  const x = r_s * 0.4124 + g_s * 0.3576 + b_s * 0.1805;
  const y = r_s * 0.2126 + g_s * 0.7152 + b_s * 0.0722;
  const z = r_s * 0.0193 + g_s * 0.1192 + b_s * 0.9505;

  return { x, y, z };
}

function xyzToLab(x: number, y: number, z: number) {
  const ref_X = 95.047;
  const ref_Y = 100.000;
  const ref_Z = 108.883;

  let x_s = x / ref_X;
  let y_s = y / ref_Y;
  let z_s = z / ref_Z;

  x_s = x_s > 0.008856 ? Math.pow(x_s, 1 / 3) : (7.787 * x_s) + (16 / 116);
  y_s = y_s > 0.008856 ? Math.pow(y_s, 1 / 3) : (7.787 * y_s) + (16 / 116);
  z_s = z_s > 0.008856 ? Math.pow(z_s, 1 / 3) : (7.787 * z_s) + (16 / 116);

  const L = (116 * y_s) - 16;
  const a = 500 * (x_s - y_s);
  const b = 200 * (y_s - z_s);

  return { L, a, b };
}

function rgbToLab(r: number, g: number, b: number) {
  const xyz = rgbToXyz(r, g, b);
  return xyzToLab(xyz.x, xyz.y, xyz.z);
}

interface GlobalColorSpaceVisualizer3DProps {
  palette: GeneratedGroup[];
  groups: ColorGroup[];
  updateGroup: (id: string, fields: Partial<ColorGroup>) => void;
}

export const GlobalColorSpaceVisualizer3D: React.FC<GlobalColorSpaceVisualizer3DProps> = ({ palette, groups, updateGroup }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [modelType, setModelType] = useState<'hls' | 'rgb' | 'hsb' | 'lab'>('hls');
  const [rotation, setRotation] = useState({ alpha: -0.6, beta: 0.3 });
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const dragStart = useRef({ x: 0, y: 0, alpha: 0, beta: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      alpha: rotation.alpha,
      beta: rotation.beta,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    setRotation({
      alpha: dragStart.current.alpha + dx * 0.01,
      beta: Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, dragStart.current.beta - dy * 0.015)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 400;
    const height = rect.height || 360;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, width, height);

    const { alpha, beta } = rotation;
    const baseScale = (Math.min(width, height) / 240) * zoom;

    // Projection helpers
    const projectHLS = (h: number, s: number, l: number) => {
      const theta = (h * Math.PI) / 180;
      const r = (s / 100) * 45 * baseScale; // scaled radius
      const y3d = ((l - 50) / 100) * 120 * baseScale; // scaled height

      const x1_3d = r * Math.cos(theta);
      const z1_3d = r * Math.sin(theta);

      const x1 = x1_3d * Math.cos(alpha) - z1_3d * Math.sin(alpha);
      const z1 = x1_3d * Math.sin(alpha) + z1_3d * Math.cos(alpha);

      const x2 = x1;
      const y2 = y3d * Math.cos(beta) - z1 * Math.sin(beta);
      const z2 = y3d * Math.sin(beta) + z1 * Math.cos(beta);

      return { x: width / 2 + x2, y: height / 2 - y2, z: z2 };
    };

    const projectHSB = (h: number, s: number, b: number) => {
      const theta = (h * Math.PI) / 180;
      const r = (s / 100) * 45 * baseScale; // scaled radius
      const y3d = ((b - 50) / 100) * 120 * baseScale; // scaled height

      const x1_3d = r * Math.cos(theta);
      const z1_3d = r * Math.sin(theta);

      const x1 = x1_3d * Math.cos(alpha) - z1_3d * Math.sin(alpha);
      const z1 = x1_3d * Math.sin(alpha) + z1_3d * Math.cos(alpha);

      const x2 = x1;
      const y2 = y3d * Math.cos(beta) - z1 * Math.sin(beta);
      const z2 = y3d * Math.sin(beta) + z1 * Math.cos(beta);

      return { x: width / 2 + x2, y: height / 2 - y2, z: z2 };
    };

    const projectRGB = (r: number, g: number, b: number) => {
      const x3d = ((r / 255) - 0.5) * 110 * baseScale;
      const y3d = ((g / 255) - 0.5) * 110 * baseScale;
      const z3d = ((b / 255) - 0.5) * 110 * baseScale;

      const x1 = x3d * Math.cos(alpha) - z3d * Math.sin(alpha);
      const z1 = x3d * Math.sin(alpha) + z3d * Math.cos(alpha);

      const x2 = x1;
      const y2 = y3d * Math.cos(beta) - z1 * Math.sin(beta);
      const z2 = y3d * Math.sin(beta) + z1 * Math.cos(beta);

      return { x: width / 2 + x2, y: height / 2 - y2, z: z2 };
    };

    const projectLAB = (L: number, a: number, b: number) => {
      // L goes 0..100, scale it to similar vertical range as HLS/HSB (around -60 to 60)
      const y3d = ((L - 50) / 100) * 120 * baseScale;
      // a, b typically range from -80 to 80. Map to fit 3D bounding limits
      const x3d = (a / 120) * 55 * baseScale;
      const z3d = (b / 120) * 55 * baseScale;

      const x1 = x3d * Math.cos(alpha) - z3d * Math.sin(alpha);
      const z1 = x3d * Math.sin(alpha) + z3d * Math.cos(alpha);

      const x2 = x1;
      const y2 = y3d * Math.cos(beta) - z1 * Math.sin(beta);
      const z2 = y3d * Math.sin(beta) + z1 * Math.cos(beta);

      return { x: width / 2 + x2, y: height / 2 - y2, z: z2 };
    };

    const project = (h: number, s: number, l: number, rVal: number, gVal: number, bVal: number) => {
      if (modelType === 'rgb') {
        return projectRGB(rVal, gVal, bVal);
      }
      if (modelType === 'hsb') {
        const hsb = rgbToHsb(rVal, gVal, bVal);
        return projectHSB(hsb.h, hsb.s, hsb.b);
      }
      if (modelType === 'lab') {
        const lab = rgbToLab(rVal, gVal, bVal);
        return projectLAB(lab.L, lab.a, lab.b);
      }
      return projectHLS(h, s, l);
    };

    if (modelType === 'hls') {
      // Draw HLS Cylinder Wireframe
      ctx.beginPath();
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 3]);
      const bottomPole = projectHLS(0, 0, 5);
      const topPole = projectHLS(0, 0, 95);
      ctx.moveTo(bottomPole.x, bottomPole.y);
      ctx.lineTo(topPole.x, topPole.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const drawRing = (lVal: number, color: string, isDashed = true) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        if (isDashed) ctx.setLineDash([2, 4]);
        else ctx.setLineDash([]);

        for (let i = 0; i <= 36; i++) {
          const hVal = i * 10;
          const pt = projectHLS(hVal, 100, lVal);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      };

      drawRing(20, '#e5e5e5', true);
      drawRing(80, '#e5e5e5', true);

      // Draw middle HSL color spectrum ring
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      for (let hVal = 0; hVal < 360; hVal += 10) {
        const pt1 = projectHLS(hVal, 100, 50);
        const pt2 = projectHLS(hVal + 10, 100, 50);
        ctx.beginPath();
        const rgb = hslToRgb(hVal, 95, 50);
        ctx.strokeStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
      }

      // Draw HLS Axis Labels
      ctx.fillStyle = '#a3a3a3';
      ctx.font = '9px monospace';
      const labelZ = projectHLS(0, 100, 50);
      ctx.fillText('Max Saturation', labelZ.x + 5, labelZ.y);
      const labelTop = projectHLS(0, 0, 95);
      ctx.fillText('White', labelTop.x + 5, labelTop.y);
      const labelBottom = projectHLS(0, 0, 5);
      ctx.fillText('Black', labelBottom.x + 5, labelBottom.y);
    } else if (modelType === 'hsb') {
      // Draw HSB Cylinder Wireframe
      ctx.beginPath();
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 3]);
      const bottomPole = projectHSB(0, 0, 5);
      const topPole = projectHSB(0, 0, 95);
      ctx.moveTo(bottomPole.x, bottomPole.y);
      ctx.lineTo(topPole.x, topPole.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const drawRing = (bVal: number, color: string, isDashed = true) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        if (isDashed) ctx.setLineDash([2, 4]);
        else ctx.setLineDash([]);

        for (let i = 0; i <= 36; i++) {
          const hVal = i * 10;
          const pt = projectHSB(hVal, 100, bVal);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      };

      drawRing(20, '#e5e5e5', true);
      drawRing(80, '#e5e5e5', true);

      // Draw middle HSB color spectrum ring at Brightness = 100
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      for (let hVal = 0; hVal < 360; hVal += 10) {
        const pt1 = projectHSB(hVal, 100, 100);
        const pt2 = projectHSB(hVal + 10, 100, 100);
        ctx.beginPath();
        const rgb = hslToRgb(hVal, 100, 50);
        ctx.strokeStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
      }

      // Draw HSB Axis Labels
      ctx.fillStyle = '#a3a3a3';
      ctx.font = '9px monospace';
      const labelZ_hsb = projectHSB(0, 100, 100);
      ctx.fillText('Max Saturation (B=100)', labelZ_hsb.x + 5, labelZ_hsb.y);
      const labelTop_hsb = projectHSB(0, 0, 95);
      ctx.fillText('White', labelTop_hsb.x + 5, labelTop_hsb.y);
      const labelBottom_hsb = projectHSB(0, 0, 5);
      ctx.fillText('Black', labelBottom_hsb.x + 5, labelBottom_hsb.y);
    } else if (modelType === 'lab') {
      // Draw LAB Wireframe
      // Lightness vertical central axis (0 to 100)
      ctx.beginPath();
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 3]);
      const bottomPole = projectLAB(0, 0, 0);
      const topPole = projectLAB(100, 0, 0);
      ctx.moveTo(bottomPole.x, bottomPole.y);
      ctx.lineTo(topPole.x, topPole.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw a-axis (green to red) at L=50
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444'; // Red for positive a*
      ctx.lineWidth = 1;
      const pt_a_min = projectLAB(50, -80, 0);
      const pt_a_max = projectLAB(50, 80, 0);
      ctx.moveTo(pt_a_min.x, pt_a_min.y);
      ctx.lineTo(pt_a_max.x, pt_a_max.y);
      ctx.stroke();

      // Draw b-axis (blue to yellow) at L=50
      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6'; // Blue for negative b*
      ctx.lineWidth = 1;
      const pt_b_min = projectLAB(50, 0, -80);
      const pt_b_max = projectLAB(50, 0, 80);
      ctx.moveTo(pt_b_min.x, pt_b_min.y);
      ctx.lineTo(pt_b_max.x, pt_b_max.y);
      ctx.stroke();

      // Draw boundary circle at L=50 for visualization context
      ctx.beginPath();
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      for (let i = 0; i <= 36; i++) {
        const theta = (i * 10 * Math.PI) / 180;
        const radius = 60; // default radius
        const aVal = radius * Math.cos(theta);
        const bVal = radius * Math.sin(theta);
        const pt = projectLAB(50, aVal, bVal);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw LAB Labels
      ctx.fillStyle = '#a3a3a3';
      ctx.font = '9px monospace';
      const labelL_top = projectLAB(95, 0, 0);
      ctx.fillText('L*=100 (White)', labelL_top.x + 5, labelL_top.y);
      const labelL_bot = projectLAB(5, 0, 0);
      ctx.fillText('L*=0 (Black)', labelL_bot.x + 5, labelL_bot.y);

      const labelA_max = projectLAB(50, 80, 0);
      ctx.fillText('+a* (Red)', labelA_max.x + 5, labelA_max.y);
      const labelA_min = projectLAB(50, -80, 0);
      ctx.fillText('-a* (Green)', labelA_min.x + 5, labelA_min.y);

      const labelB_max = projectLAB(50, 0, 80);
      ctx.fillText('+b* (Yellow)', labelB_max.x + 5, labelB_max.y);
      const labelB_min = projectLAB(50, 0, -80);
      ctx.fillText('-b* (Blue)', labelB_min.x + 5, labelB_min.y);
    } else {
      // Draw RGB Cube Wireframe (12 edges)
      const corners = [
        { r: 0, g: 0, b: 0, label: 'K (Black)' },
        { r: 255, g: 0, b: 0, label: 'Red' },
        { r: 255, g: 255, b: 0, label: 'Yellow' },
        { r: 0, g: 255, b: 0, label: 'Green' },
        { r: 0, g: 0, b: 255, label: 'Blue' },
        { r: 255, g: 0, b: 255, label: 'Magenta' },
        { r: 255, g: 255, b: 255, label: 'W (White)' },
        { r: 0, g: 255, b: 255, label: 'Cyan' },
      ];

      const edges = [
        [0, 1], [0, 3], [0, 4], // from Black
        [6, 2], [6, 5], [6, 7], // from White
        [1, 2], [1, 5],
        [3, 2], [3, 7],
        [4, 5], [4, 7]
      ];

      ctx.beginPath();
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      edges.forEach(([i, j]) => {
        const p1 = projectRGB(corners[i].r, corners[i].g, corners[i].b);
        const p2 = projectRGB(corners[j].r, corners[j].g, corners[j].b);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Label corners
      ctx.fillStyle = '#a3a3a3';
      ctx.font = '9px monospace';
      corners.forEach((c) => {
        const pt = projectRGB(c.r, c.g, c.b);
        ctx.fillText(c.label, pt.x + 5, pt.y + 3);
      });
    }

    // Draw all color group trajectories in the 3D space!
    palette.forEach((group) => {
      if (group.shades.length === 0) return;

      // Draw continuous trajectory line
      ctx.beginPath();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#a3a3a3'; // general trajectory wire
      
      group.shades.forEach((shade, idx) => {
        const pt = project(shade.hsl.h, shade.hsl.s, shade.hsl.l, shade.rgb.r, shade.rgb.g, shade.rgb.b);
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      // Draw shade points
      group.shades.forEach((shade) => {
        const pt = project(shade.hsl.h, shade.hsl.s, shade.hsl.l, shade.rgb.r, shade.rgb.g, shade.rgb.b);

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#525252';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = shade.hex;
        ctx.fill();
      });
    });

    // Draw small coordinate compass indicator
    const drawCompass = () => {
      const cx = 30;
      const cy = height - 30;
      const size = 15;

      ctx.fillStyle = '#737373';
      ctx.font = 'bold 8px sans-serif';

      if (modelType === 'hls') {
        // HLS compass
        const xTheta = alpha;
        const xx = cx + size * Math.cos(xTheta);
        const xy = cy - size * Math.sin(xTheta) * Math.sin(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444'; // Red = Hue
        ctx.moveTo(cx, cy);
        ctx.lineTo(xx, xy);
        ctx.stroke();
        ctx.fillText('H', xx + 3, xy);

        const yy = cy - size * Math.cos(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#10b981'; // Green = Lightness
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, yy);
        ctx.stroke();
        ctx.fillText('L', cx - 2, yy - 3);

        const zTheta = alpha + Math.PI / 2;
        const zx = cx + size * Math.cos(zTheta);
        const zy = cy - size * Math.sin(zTheta) * Math.sin(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6'; // Blue = Saturation
        ctx.moveTo(cx, cy);
        ctx.lineTo(zx, zy);
        ctx.stroke();
        ctx.fillText('S', zx + 3, zy);
      } else if (modelType === 'hsb') {
        // HSB compass
        const xTheta = alpha;
        const xx = cx + size * Math.cos(xTheta);
        const xy = cy - size * Math.sin(xTheta) * Math.sin(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444'; // Red = Hue
        ctx.moveTo(cx, cy);
        ctx.lineTo(xx, xy);
        ctx.stroke();
        ctx.fillText('H', xx + 3, xy);

        const yy = cy - size * Math.cos(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#f59e0b'; // Amber = Brightness
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, yy);
        ctx.stroke();
        ctx.fillText('B', cx - 2, yy - 3);

        const zTheta = alpha + Math.PI / 2;
        const zx = cx + size * Math.cos(zTheta);
        const zy = cy - size * Math.sin(zTheta) * Math.sin(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6'; // Blue = Saturation
        ctx.moveTo(cx, cy);
        ctx.lineTo(zx, zy);
        ctx.stroke();
        ctx.fillText('S', zx + 3, zy);
      } else if (modelType === 'lab') {
        // LAB compass
        // a* (green-red) is mapped to x3d (horizontal)
        const xTheta = alpha;
        const xx = cx + size * Math.cos(xTheta);
        const xy = cy - size * Math.sin(xTheta) * Math.sin(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444'; // Red = a*
        ctx.moveTo(cx, cy);
        ctx.lineTo(xx, xy);
        ctx.stroke();
        ctx.fillText('a*', xx + 3, xy);

        // L* (Lightness) is mapped to y3d (vertical)
        const yy = cy - size * Math.cos(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#737373'; // Gray = L*
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, yy);
        ctx.stroke();
        ctx.fillText('L*', cx - 2, yy - 3);

        // b* (blue-yellow) is mapped to z3d (depth)
        const zTheta = alpha + Math.PI / 2;
        const zx = cx + size * Math.cos(zTheta);
        const zy = cy - size * Math.sin(zTheta) * Math.sin(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6'; // Blue = b*
        ctx.moveTo(cx, cy);
        ctx.lineTo(zx, zy);
        ctx.stroke();
        ctx.fillText('b*', zx + 3, zy);
      } else {
        // RGB compass
        const rPt = projectRGB(255, 0, 0);
        const gPt = projectRGB(0, 255, 0);
        const bPt = projectRGB(0, 0, 255);
        const origin = projectRGB(0, 0, 0);

        // Calculate vector from origin to project offset
        const scaleVec = (p: {x: number, y: number}) => {
          const dx = p.x - origin.x;
          const dy = p.y - origin.y;
          const len = Math.hypot(dx, dy) || 1;
          return { x: cx + (dx / len) * size, y: cy + (dy / len) * size };
        };

        const rTarget = scaleVec(rPt);
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444'; // R = Red
        ctx.moveTo(cx, cy);
        ctx.lineTo(rTarget.x, rTarget.y);
        ctx.stroke();
        ctx.fillText('R', rTarget.x + 3, rTarget.y);

        const gTarget = scaleVec(gPt);
        ctx.beginPath();
        ctx.strokeStyle = '#10b981'; // G = Green
        ctx.moveTo(cx, cy);
        ctx.lineTo(gTarget.x, gTarget.y);
        ctx.stroke();
        ctx.fillText('G', gTarget.x + 3, gTarget.y);

        const bTarget = scaleVec(bPt);
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6'; // B = Blue
        ctx.moveTo(cx, cy);
        ctx.lineTo(bTarget.x, bTarget.y);
        ctx.stroke();
        ctx.fillText('B', bTarget.x + 3, bTarget.y);
      }
    };
    drawCompass();

  }, [palette, modelType, rotation, zoom, isFullscreen]);

  return (
    <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
            <Compass size={14} className="text-neutral-400" />
            Visualizer
          </h3>
        </div>

        {/* Interaction, Zoom, Fullscreen & Model switchers */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {/* Zoom Controls */}
          <div className="flex items-center bg-white border border-neutral-200 rounded-lg p-0.5 shadow-2xs">
            <button
              onClick={() => setZoom(prev => Math.max(0.4, prev - 0.15))}
              className="p-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 rounded-md transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-[9px] font-mono font-semibold px-1.5 text-neutral-600 select-none min-w-[32px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(2.5, prev + 0.15))}
              className="p-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 rounded-md transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <button
              onClick={() => setZoom(1.0)}
              className="px-1 text-[8px] text-neutral-400 hover:text-neutral-700 font-mono"
              title="Reset Zoom"
            >
              Reset
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-white border border-neutral-200 rounded-md text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50 transition-all shadow-2xs"
            title="Fullscreen"
          >
            <Maximize size={11} />
            <span>Fullscreen</span>
          </button>

          {/* HLS vs HSB vs RGB vs LAB Switch */}
          <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-neutral-200">
            <button
              onClick={() => setModelType('hls')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                modelType === 'hls' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Layers size={11} />
              <span>HLS Cylinder</span>
            </button>
            <button
              onClick={() => setModelType('hsb')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                modelType === 'hsb' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Layers size={11} className="text-amber-500" />
              <span>HSB Cylinder</span>
            </button>
            <button
              onClick={() => setModelType('rgb')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                modelType === 'rgb' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Box size={11} />
              <span>RGB Cube</span>
            </button>
            <button
              onClick={() => setModelType('lab')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                modelType === 'lab' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Compass size={11} className="text-indigo-500" />
              <span>LAB</span>
            </button>
          </div>
        </div>
      </div>

      {!isFullscreen && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left: 3D Coordinate Space */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-[380px] relative">
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative border border-neutral-200 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing h-full w-full select-none bg-[#fafafa] flex items-center justify-center shadow-2xs"
            >
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute top-2.5 right-2.5 bg-white/85 backdrop-blur-xs border border-neutral-200/50 rounded-md px-2 py-1 text-[9px] font-mono text-neutral-400 pointer-events-none">
                Drag to rotate
              </div>
            </div>
          </div>

          {/* Right: 2D Interactive Hue ColorWheel */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col items-center justify-center p-4 border border-neutral-200 rounded-xl bg-neutral-50/30 shadow-2xs min-h-[380px]">
            <span className="text-[10px] font-bold text-neutral-500 mb-2.5 text-center uppercase tracking-wider block">
              Drag nodes to shift whole group Hue
            </span>
            <div className="w-full max-w-[280px] aspect-square flex items-center justify-center">
              <ColorWheel 
                groups={groups}
                generatedPalette={palette}
                updateGroup={updateGroup}
              />
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Overlay Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 md:p-10 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[85vh] border border-neutral-200">
            {/* Header controls inside fullscreen */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <div className="flex items-center gap-2">
                <Compass className="text-emerald-500 animate-spin-slow" size={16} />
                <h3 className="text-sm font-bold text-neutral-800">
                  Global 3D Color Palette Space: {modelType === 'hls' ? 'HLS Cylinder' : modelType === 'hsb' ? 'HSB Cylinder' : modelType === 'rgb' ? 'RGB Cube' : 'LAB Space'}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                {/* Zoom controls */}
                <div className="flex items-center bg-white border border-neutral-200 rounded-lg p-0.5 shadow-2xs">
                  <button
                    onClick={() => setZoom(prev => Math.max(0.4, prev - 0.15))}
                    className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 rounded-md transition-colors"
                    title="Zoom Out"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span className="text-[10px] font-mono font-semibold px-2 text-neutral-600 min-w-[36px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom(prev => Math.min(2.5, prev + 0.15))}
                    className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 rounded-md transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn size={14} />
                  </button>
                  <button
                    onClick={() => setZoom(1.0)}
                    className="px-1.5 text-[9px] text-neutral-400 hover:text-neutral-700 font-mono"
                    title="Reset Zoom"
                  >
                    Reset
                  </button>
                </div>

                 {/* Model toggle */}
                <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-neutral-200">
                  <button
                    onClick={() => setModelType('hls')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      modelType === 'hls' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    <Layers size={11} />
                    <span>HLS Cylinder</span>
                  </button>
                  <button
                    onClick={() => setModelType('hsb')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      modelType === 'hsb' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    <Layers size={11} className="text-amber-500" />
                    <span>HSB Cylinder</span>
                  </button>
                  <button
                    onClick={() => setModelType('rgb')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      modelType === 'rgb' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    <Box size={11} />
                    <span>RGB Cube</span>
                  </button>
                  <button
                    onClick={() => setModelType('lab')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      modelType === 'lab' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    <Compass size={11} className="text-indigo-500" />
                    <span>LAB</span>
                  </button>
                </div>

                {/* Close fullscreen */}
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg shadow-sm transition-colors"
                >
                  <Minimize size={12} />
                  <span>Close</span>
                </button>
              </div>
            </div>

            {/* Main 3D canvas viewport in fullscreen */}
            <div
              id="plot-3d-global-fullscreen-container"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="flex-1 relative cursor-grab active:cursor-grabbing select-none bg-[#fafafa]"
            >
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute bottom-4 left-4 bg-neutral-900/40 backdrop-blur-xs text-neutral-50 px-2 py-1 rounded text-[10px] pointer-events-none">
                Drag to rotate • Zoom levels {Math.round(zoom * 100)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
