import React, { useRef, useEffect, useState } from 'react';
import { HSL, ColorGroup, GeneratedShade, GeneratedGroup } from '../types';
import { hslToRgb, rgbToHex } from '../utils';
import { Sliders, Compass, Box, Layers, ZoomIn, ZoomOut, Maximize, Minimize } from 'lucide-react';
import { ColorWheel } from './ColorWheel';

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

interface ColorSpaceVisualizerProps {
  group: ColorGroup;
  shades: GeneratedShade[];
  generatedPalette: GeneratedGroup[];
  onChangeStartHSL: (hsl: HSL) => void;
  onChangeEndHSL: (hsl: HSL) => void;
  onChangeGroupProp: (fields: Partial<ColorGroup>) => void;
}

export const ColorSpaceVisualizer: React.FC<ColorSpaceVisualizerProps> = ({
  group,
  shades,
  generatedPalette,
  onChangeStartHSL,
  onChangeEndHSL,
  onChangeGroupProp,
}) => {
  const hlCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvas3DRef = useRef<HTMLCanvasElement | null>(null);

  const hlContainerRef = useRef<HTMLDivElement | null>(null);
  const lsContainerRef = useRef<HTMLDivElement | null>(null);
  const hsContainerRef = useRef<HTMLDivElement | null>(null);

  const [dragging, setDragging] = useState<{
    plot: 'hl' | 'ls' | 'hs';
    node: string;
  } | null>(null);

  const [hoveredShade, setHoveredShade] = useState<{
    shade: GeneratedShade;
    plot: 'hl' | 'ls' | 'hs';
    x: number;
    y: number;
  } | null>(null);

  const [rotation, setRotation] = useState({ alpha: -0.6, beta: 0.3 });
  const [model3DType, setModel3DType] = useState<'hls' | 'rgb' | 'hsb' | 'lab'>('hls');
  const [activeSpaceTab, setActiveSpaceTab] = useState<'3d' | 'hl' | 'ls' | 'sh'>('3d');
  const [zoom, setZoom] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isDragging3D, setIsDragging3D] = useState(false);
  const dragStart3D = useRef({ x: 0, y: 0, alpha: 0, beta: 0 });

  const [satShift, setSatShift] = useState(0);
  const [prevSatShift, setPrevSatShift] = useState(0);

  const handleSatShiftChange = (val: number) => {
    setSatShift(val);
    const delta = val - prevSatShift;
    setPrevSatShift(val);
    if (delta === 0) return;

    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
    
    const updates: Partial<ColorGroup> = {
      startHSL: { ...group.startHSL, s: clamp(group.startHSL.s + delta) },
      endHSL: { ...group.endHSL, s: clamp(group.endHSL.s + delta) },
    };

    if (group.midHSL) {
      updates.midHSL = { ...group.midHSL, s: clamp(group.midHSL.s + delta) };
    }
    if (group.ctrlStartHSL) {
      updates.ctrlStartHSL = { ...group.ctrlStartHSL, s: clamp(group.ctrlStartHSL.s + delta) };
    }
    if (group.ctrlEndHSL) {
      updates.ctrlEndHSL = { ...group.ctrlEndHSL, s: clamp(group.ctrlEndHSL.s + delta) };
    }
    if (group.ctrlMidStartHSL) {
      updates.ctrlMidStartHSL = { ...group.ctrlMidStartHSL, s: clamp(group.ctrlMidStartHSL.s + delta) };
    }
    if (group.ctrlMidEndHSL) {
      updates.ctrlMidEndHSL = { ...group.ctrlMidEndHSL, s: clamp(group.ctrlMidEndHSL.s + delta) };
    }
    if (group.manualColors) {
      updates.manualColors = group.manualColors.map((c) => ({
        ...c,
        s: clamp(c.s + delta),
      }));
    }

    onChangeGroupProp(updates);
  };

  const handleSatShiftEnd = () => {
    setSatShift(0);
    setPrevSatShift(0);
  };

  const [lightShift, setLightShift] = useState(0);
  const [prevLightShift, setPrevLightShift] = useState(0);

  const handleLightShiftChange = (val: number) => {
    setLightShift(val);
    const delta = val - prevLightShift;
    setPrevLightShift(val);
    if (delta === 0) return;

    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

    const updates: Partial<ColorGroup> = {
      startHSL: { ...group.startHSL, l: clamp(group.startHSL.l + delta) },
      endHSL: { ...group.endHSL, l: clamp(group.endHSL.l + delta) },
    };

    if (group.midHSL) {
      updates.midHSL = { ...group.midHSL, l: clamp(group.midHSL.l + delta) };
    }
    if (group.ctrlStartHSL) {
      updates.ctrlStartHSL = { ...group.ctrlStartHSL, l: clamp(group.ctrlStartHSL.l + delta) };
    }
    if (group.ctrlEndHSL) {
      updates.ctrlEndHSL = { ...group.ctrlEndHSL, l: clamp(group.ctrlEndHSL.l + delta) };
    }
    if (group.ctrlMidStartHSL) {
      updates.ctrlMidStartHSL = { ...group.ctrlMidStartHSL, l: clamp(group.ctrlMidStartHSL.l + delta) };
    }
    if (group.ctrlMidEndHSL) {
      updates.ctrlMidEndHSL = { ...group.ctrlMidEndHSL, l: clamp(group.ctrlMidEndHSL.l + delta) };
    }
    if (group.manualColors) {
      updates.manualColors = group.manualColors.map((c) => ({
        ...c,
        l: clamp(c.l + delta),
      }));
    }

    onChangeGroupProp(updates);
  };

  const handleLightShiftEnd = () => {
    setLightShift(0);
    setPrevLightShift(0);
  };

  // Provide default handles (1/3 and 2/3 of HSL distance, unwrapping Hue)
  const getHandles = () => {
    let diffE = group.endHSL.h - group.startHSL.h;
    if (diffE > 180) diffE -= 360;
    else if (diffE < -180) diffE += 360;

    const startH = group.startHSL.h;
    const h1 = (startH + diffE * (1 / 3)) % 360;
    const s1 = group.startHSL.s + (group.endHSL.s - group.startHSL.s) * (1 / 3);
    const l1 = group.startHSL.l + (group.endHSL.l - group.startHSL.l) * (1 / 3);

    const h2 = (startH + diffE * (2 / 3)) % 360;
    const s2 = group.startHSL.s + (group.endHSL.s - group.startHSL.s) * (2 / 3);
    const l2 = group.startHSL.l + (group.endHSL.l - group.startHSL.l) * (2 / 3);

    const defaultCtrlStart = {
      h: Math.round(h1 < 0 ? h1 + 360 : h1),
      s: Math.round(Math.max(0, Math.min(100, s1))),
      l: Math.round(Math.max(0, Math.min(100, l1))),
    };

    const defaultCtrlEnd = {
      h: Math.round(h2 < 0 ? h2 + 360 : h2),
      s: Math.round(Math.max(0, Math.min(100, s2))),
      l: Math.round(Math.max(0, Math.min(100, l2))),
    };

    // Mode 3 Middle Point and Handles
    const midHSL = group.midHSL || {
      h: Math.round((group.startHSL.h + group.endHSL.h) / 2),
      s: Math.round((group.startHSL.s + group.endHSL.s) / 2),
      l: Math.round((group.startHSL.l + group.endHSL.l) / 2),
    };

    const defaultCtrlMidStart = {
      h: Math.round(group.startHSL.h + (midHSL.h - group.startHSL.h) * 0.66),
      s: Math.round(group.startHSL.s + (midHSL.s - group.startHSL.s) * 0.66),
      l: Math.round(group.startHSL.l + (midHSL.l - group.startHSL.l) * 0.66),
    };

    const defaultCtrlMidEnd = {
      h: Math.round(midHSL.h + (group.endHSL.h - midHSL.h) * 0.33),
      s: Math.round(midHSL.s + (group.endHSL.s - midHSL.s) * 0.33),
      l: Math.round(midHSL.l + (group.endHSL.l - midHSL.l) * 0.33),
    };

    return {
      ctrlStart: group.ctrlStartHSL || defaultCtrlStart,
      ctrlEnd: group.ctrlEndHSL || defaultCtrlEnd,
      midHSL,
      ctrlMidStart: group.ctrlMidStartHSL || defaultCtrlMidStart,
      ctrlMidEnd: group.ctrlMidEndHSL || defaultCtrlMidEnd,
    };
  };

  const { ctrlStart, ctrlEnd, midHSL, ctrlMidStart, ctrlMidEnd } = getHandles();

  // 1. Redraw HL Space Background (Hue vs Lightness, Saturation is averaged)
  useEffect(() => {
    const canvas = hlCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const avgSaturation = Math.round((group.startHSL.s + group.endHSL.s) / 2);
    const width = 180;
    const height = 100;
    canvas.width = width;
    canvas.height = height;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const l = 100 - (y / (height - 1)) * 100; // 100% top to 0% bottom
      for (let x = 0; x < width; x++) {
        const h = (x / (width - 1)) * 360; // 0 to 360
        const rgb = hslToRgb(h, avgSaturation, l);

        const index = (y * width + x) * 4;
        data[index] = rgb.r;
        data[index + 1] = rgb.g;
        data[index + 2] = rgb.b;
        data[index + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [group.startHSL.s, group.endHSL.s, activeSpaceTab]);

  // 2. Redraw LS Space Background (Lightness vs Saturation, Hue is averaged)
  useEffect(() => {
    const canvas = lsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Shortest path hue average
    const h1 = group.startHSL.h;
    const h2 = group.endHSL.h;
    let diff = h2 - h1;
    if (diff > 180) diff -= 360;
    else if (diff < -180) diff += 360;
    let avgHue = (h1 + diff / 2) % 360;
    if (avgHue < 0) avgHue += 360;

    const width = 100;
    const height = 100;
    canvas.width = width;
    canvas.height = height;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const s = 100 - (y / (height - 1)) * 100; // 100% top to 0% bottom
      for (let x = 0; x < width; x++) {
        const l = (x / (width - 1)) * 100; // 0% left to 100% right
        const rgb = hslToRgb(avgHue, s, l);

        const index = (y * width + x) * 4;
        data[index] = rgb.r;
        data[index + 1] = rgb.g;
        data[index + 2] = rgb.b;
        data[index + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [group.startHSL.h, group.endHSL.h, activeSpaceTab]);

  // 3. Redraw SH Space Background (Saturation vs Hue, Lightness is averaged)
  useEffect(() => {
    const canvas = hsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const avgLightness = Math.round((group.startHSL.l + group.endHSL.l) / 2);
    const width = 100;
    const height = 180;
    canvas.width = width;
    canvas.height = height;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const h = 360 - (y / (height - 1)) * 360; // 360 top to 0 bottom
      for (let x = 0; x < width; x++) {
        const s = (x / (width - 1)) * 100; // 0% left to 100% right
        const rgb = hslToRgb(h, s, avgLightness);

        const index = (y * width + x) * 4;
        data[index] = rgb.r;
        data[index + 1] = rgb.g;
        data[index + 2] = rgb.b;
        data[index + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [group.startHSL.l, group.endHSL.l, activeSpaceTab]);

  // Handle pointer down on any plot
  const handlePointerDown = (
    plot: 'hl' | 'ls' | 'hs',
    containerRef: React.RefObject<HTMLDivElement | null>,
    clientX: number,
    clientY: number,
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    container.setPointerCapture(e.pointerId);

    const rect = container.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    // Calculate node coordinates in pixels
    let startX = 0, startY = 0, endX = 0, endY = 0;
    let csX = 0, csY = 0, ceX = 0, ceY = 0;
    let mX = 0, mY = 0, cmsX = 0, cmsY = 0, cmeX = 0, cmeY = 0;

    if (plot === 'hl') {
      startX = (group.startHSL.h / 360) * rect.width;
      startY = (1 - group.startHSL.l / 100) * rect.height;
      endX = (group.endHSL.h / 360) * rect.width;
      endY = (1 - group.endHSL.l / 100) * rect.height;
      csX = (ctrlStart.h / 360) * rect.width;
      csY = (1 - ctrlStart.l / 100) * rect.height;
      ceX = (ctrlEnd.h / 360) * rect.width;
      ceY = (1 - ctrlEnd.l / 100) * rect.height;

      mX = (midHSL.h / 360) * rect.width;
      mY = (1 - midHSL.l / 100) * rect.height;
      cmsX = (ctrlMidStart.h / 360) * rect.width;
      cmsY = (1 - ctrlMidStart.l / 100) * rect.height;
      cmeX = (ctrlMidEnd.h / 360) * rect.width;
      cmeY = (1 - ctrlMidEnd.l / 100) * rect.height;
    } else if (plot === 'ls') {
      startX = (group.startHSL.l / 100) * rect.width;
      startY = (1 - group.startHSL.s / 100) * rect.height;
      endX = (group.endHSL.l / 100) * rect.width;
      endY = (1 - group.endHSL.s / 100) * rect.height;
      csX = (ctrlStart.l / 100) * rect.width;
      csY = (1 - ctrlStart.s / 100) * rect.height;
      ceX = (ctrlEnd.l / 100) * rect.width;
      ceY = (1 - ctrlEnd.s / 100) * rect.height;

      mX = (midHSL.l / 100) * rect.width;
      mY = (1 - midHSL.s / 100) * rect.height;
      cmsX = (ctrlMidStart.l / 100) * rect.width;
      cmsY = (1 - ctrlMidStart.s / 100) * rect.height;
      cmeX = (ctrlMidEnd.l / 100) * rect.width;
      cmeY = (1 - ctrlMidEnd.s / 100) * rect.height;
    } else {
      startX = (group.startHSL.s / 100) * rect.width;
      startY = (1 - group.startHSL.h / 360) * rect.height;
      endX = (group.endHSL.s / 100) * rect.width;
      endY = (1 - group.endHSL.h / 360) * rect.height;
      csX = (ctrlStart.s / 100) * rect.width;
      csY = (1 - ctrlStart.h / 360) * rect.height;
      ceX = (ctrlEnd.s / 100) * rect.width;
      ceY = (1 - ctrlEnd.h / 360) * rect.height;

      mX = (midHSL.s / 100) * rect.width;
      mY = (1 - midHSL.h / 360) * rect.height;
      cmsX = (ctrlMidStart.s / 100) * rect.width;
      cmsY = (1 - ctrlMidStart.h / 360) * rect.height;
      cmeX = (ctrlMidEnd.s / 100) * rect.width;
      cmeY = (1 - ctrlMidEnd.h / 360) * rect.height;
    }

    const mode = group.settingsMode || 'linear';

    if (mode === 'manual') {
      const manualTargets: { node: string; dist: number }[] = [];
      shades.forEach((shade, idx) => {
        let sx = 0, sy = 0;
        if (plot === 'hl') {
          sx = (shade.hsl.h / 360) * rect.width;
          sy = (1 - shade.hsl.l / 100) * rect.height;
        } else if (plot === 'ls') {
          sx = (shade.hsl.l / 100) * rect.width;
          sy = (1 - shade.hsl.s / 100) * rect.height;
        } else {
          sx = (shade.hsl.s / 100) * rect.width;
          sy = (1 - shade.hsl.h / 360) * rect.height;
        }
        manualTargets.push({ node: `manual-${idx}`, dist: Math.hypot(clickX - sx, clickY - sy) });
      });

      if (manualTargets.length > 0) {
        let closestManual = manualTargets[0];
        for (let i = 1; i < manualTargets.length; i++) {
          if (manualTargets[i].dist < closestManual.dist) {
            closestManual = manualTargets[i];
          }
        }
        if (closestManual.dist < 25) {
          setDragging({ plot, node: closestManual.node });
          handleDragUpdate(plot, closestManual.node, container, clientX, clientY, ctrlStart, ctrlEnd, midHSL, ctrlMidStart, ctrlMidEnd);
        }
      }
      return;
    }

    const targets: { node: string; dist: number }[] = [
      { node: 'start', dist: Math.hypot(clickX - startX, clickY - startY) },
      { node: 'end', dist: Math.hypot(clickX - endX, clickY - endY) }
    ];

    if (mode === 'handles_sliders' || mode === 'handles_center') {
      targets.push({ node: 'ctrlStart', dist: Math.hypot(clickX - csX, clickY - csY) });
      targets.push({ node: 'ctrlEnd', dist: Math.hypot(clickX - ceX, clickY - ceY) });
    }

    if (mode === 'handles_center') {
      targets.push({ node: 'mid', dist: Math.hypot(clickX - mX, clickY - mY) });
      targets.push({ node: 'ctrlMidStart', dist: Math.hypot(clickX - cmsX, clickY - cmsY) });
      targets.push({ node: 'ctrlMidEnd', dist: Math.hypot(clickX - cmeX, clickY - cmeY) });
    }

    // Find the closest point that is within 25px
    let closest = targets[0];
    for (let i = 1; i < targets.length; i++) {
      if (targets[i].dist < closest.dist) {
        closest = targets[i];
      }
    }

    if (closest.dist < 25) {
      setDragging({ plot, node: closest.node });
      handleDragUpdate(plot, closest.node, container, clientX, clientY, ctrlStart, ctrlEnd, midHSL, ctrlMidStart, ctrlMidEnd);
    }
  };

  const handleDragUpdate = (
    plot: 'hl' | 'ls' | 'hs',
    node: string,
    container: HTMLDivElement,
    clientX: number,
    clientY: number,
    currentC1: HSL,
    currentC2: HSL,
    currentMid: HSL,
    currentCMS: HSL,
    currentCME: HSL
  ) => {
    const rect = container.getBoundingClientRect();
    const xRatio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const yRatio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    const mapCoords = () => {
      if (plot === 'hl') {
        return { h: Math.round(xRatio * 360), s: undefined, l: Math.round(100 - yRatio * 100) };
      } else if (plot === 'ls') {
        return { h: undefined, s: Math.round(100 - yRatio * 100), l: Math.round(xRatio * 100) };
      } else {
        return { h: Math.round(360 - yRatio * 360), s: Math.round(xRatio * 100), l: undefined };
      }
    };

    const coords = mapCoords();

    if (node.startsWith('manual-')) {
      const idx = parseInt(node.split('-')[1], 10);
      const updatedColors = [...(group.manualColors || [])];
      
      // Safety guarantee: pre-populate manualColors if empty or size-mismatched
      if (updatedColors.length !== shades.length) {
        shades.forEach((s, sIdx) => {
          if (!updatedColors[sIdx]) {
            updatedColors[sIdx] = { ...s.hsl };
          }
        });
      }

      const currentHsl = { ...(updatedColors[idx] || { h: 0, s: 0, l: 0 }) };
      if (coords.h !== undefined) currentHsl.h = coords.h;
      if (coords.s !== undefined) currentHsl.s = coords.s;
      if (coords.l !== undefined) currentHsl.l = coords.l;
      
      updatedColors[idx] = currentHsl;
      onChangeGroupProp({ manualColors: updatedColors });
      return;
    }

    if (node === 'start') {
      const updated = { ...group.startHSL };
      if (coords.h !== undefined) updated.h = coords.h;
      if (coords.s !== undefined) updated.s = coords.s;
      if (coords.l !== undefined) updated.l = coords.l;
      onChangeStartHSL(updated);
    } else if (node === 'end') {
      const updated = { ...group.endHSL };
      if (coords.h !== undefined) updated.h = coords.h;
      if (coords.s !== undefined) updated.s = coords.s;
      if (coords.l !== undefined) updated.l = coords.l;
      onChangeEndHSL(updated);
    } else if (node === 'ctrlStart') {
      const updated = { ...currentC1 };
      if (coords.h !== undefined) updated.h = coords.h;
      if (coords.s !== undefined) updated.s = coords.s;
      if (coords.l !== undefined) updated.l = coords.l;
      onChangeGroupProp({ ctrlStartHSL: updated });
    } else if (node === 'ctrlEnd') {
      const updated = { ...currentC2 };
      if (coords.h !== undefined) updated.h = coords.h;
      if (coords.s !== undefined) updated.s = coords.s;
      if (coords.l !== undefined) updated.l = coords.l;
      onChangeGroupProp({ ctrlEndHSL: updated });
    } else if (node === 'mid') {
      const updated = { ...currentMid };
      if (coords.h !== undefined) updated.h = coords.h;
      if (coords.s !== undefined) updated.s = coords.s;
      if (coords.l !== undefined) updated.l = coords.l;
      onChangeGroupProp({ midHSL: updated });
    } else if (node === 'ctrlMidStart') {
      const updated = { ...currentCMS };
      if (coords.h !== undefined) updated.h = coords.h;
      if (coords.s !== undefined) updated.s = coords.s;
      if (coords.l !== undefined) updated.l = coords.l;
      onChangeGroupProp({ ctrlMidStartHSL: updated });
    } else if (node === 'ctrlMidEnd') {
      const updated = { ...currentCME };
      if (coords.h !== undefined) updated.h = coords.h;
      if (coords.s !== undefined) updated.s = coords.s;
      if (coords.l !== undefined) updated.l = coords.l;
      onChangeGroupProp({ ctrlMidEndHSL: updated });
    }
  };

  const handlePointerMove = (
    plot: 'hl' | 'ls' | 'hs',
    containerRef: React.RefObject<HTMLDivElement | null>,
    e: React.PointerEvent
  ) => {
    const container = containerRef.current;
    if (!container) return;

    if (dragging && dragging.plot === plot) {
      handleDragUpdate(plot, dragging.node, container, e.clientX, e.clientY, ctrlStart, ctrlEnd, midHSL, ctrlMidStart, ctrlMidEnd);
    } else {
      // Hover detection for tooltips
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      let minDistance = 16; // search radius in px
      let found: GeneratedShade | null = null;

      shades.forEach((shade) => {
        let sx = 0, sy = 0;
        if (plot === 'hl') {
          sx = (shade.hsl.h / 360) * rect.width;
          sy = (1 - shade.hsl.l / 100) * rect.height;
        } else if (plot === 'ls') {
          sx = (shade.hsl.l / 100) * rect.width;
          sy = (1 - shade.hsl.s / 100) * rect.height;
        } else {
          sx = (shade.hsl.s / 100) * rect.width;
          sy = (1 - shade.hsl.h / 360) * rect.height;
        }

        const dist = Math.hypot(cursorX - sx, cursorY - sy);
        if (dist < minDistance) {
          minDistance = dist;
          found = shade;
        }
      });

      if (found) {
        setHoveredShade({
          shade: found,
          plot,
          x: cursorX,
          y: cursorY,
        });
      } else {
        setHoveredShade(null);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragging) {
      const containerMap = { hl: hlContainerRef, ls: lsContainerRef, hs: hsContainerRef };
      const currentContainer = containerMap[dragging.plot].current;
      if (currentContainer) {
        currentContainer.releasePointerCapture(e.pointerId);
      }
      setDragging(null);
    }
  };

  const handlePointerDown3D = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    container.setPointerCapture(e.pointerId);
    setIsDragging3D(true);
    dragStart3D.current = {
      x: e.clientX,
      y: e.clientY,
      alpha: rotation.alpha,
      beta: rotation.beta,
    };
  };

  const handlePointerMove3D = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging3D) return;
    const dx = e.clientX - dragStart3D.current.x;
    const dy = e.clientY - dragStart3D.current.y;

    setRotation({
      alpha: dragStart3D.current.alpha + dx * 0.015,
      beta: Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, dragStart3D.current.beta - dy * 0.015)),
    });
  };

  const handlePointerUp3D = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging3D) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging3D(false);
    }
  };

  // 4. Redraw 3D Space (Cylinder HLS or Cube RGB)
  useEffect(() => {
    const canvas = canvas3DRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 360;
    const height = rect.height || 360;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    // Clear background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, width, height);

    const { alpha, beta } = rotation;
    const baseScale = (Math.min(width, height) / 240) * zoom;

    // Projection helpers inside useEffect
    const projectHLS = (h: number, s: number, l: number) => {
      const theta = (h * Math.PI) / 180;
      const r = (s / 100) * 45 * baseScale;
      const y3d = ((l - 50) / 100) * 120 * baseScale;

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
      const r = (s / 100) * 45 * baseScale;
      const y3d = ((b - 50) / 100) * 120 * baseScale;

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
      const y3d = ((L - 50) / 100) * 120 * baseScale;
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
      if (model3DType === 'rgb') {
        return projectRGB(rVal, gVal, bVal);
      }
      if (model3DType === 'hsb') {
        const hsb = rgbToHsb(rVal, gVal, bVal);
        return projectHSB(hsb.h, hsb.s, hsb.b);
      }
      if (model3DType === 'lab') {
        const lab = rgbToLab(rVal, gVal, bVal);
        return projectLAB(lab.L, lab.a, lab.b);
      }
      return projectHLS(h, s, l);
    };

    if (model3DType === 'hls') {
      // Draw central achromatic axis (gray center pole: Black to White)
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

      // Draw Cylinder wireframe rings at L=20, L=80
      const drawRing = (lVal: number, color: string, isDashed = true) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        if (isDashed) ctx.setLineDash([2, 4]);
        else ctx.setLineDash([]);

        for (let i = 0; i <= 36; i++) {
          const hVal = i * 10;
          const pt = projectHLS(hVal, 100, lVal);
          if (i === 0) {
            ctx.moveTo(pt.x, pt.y);
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
        ctx.stroke();
      };

      drawRing(20, '#d4d4d4', true);
      drawRing(80, '#d4d4d4', true);
      
      // Draw the middle ring (L=50) in color-coded segments to show the HSL color wheel!
      ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
      for (let hVal = 0; hVal < 360; hVal += 12) {
        const pt1 = projectHLS(hVal, 100, 50);
        const pt2 = projectHLS(hVal + 12, 100, 50);
        ctx.beginPath();
        const rgb = hslToRgb(hVal, 95, 50);
        ctx.strokeStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
      }

      // Draw vertical ribs of the cylinder at H = 0, 120, 240
      const drawRib = (hVal: number, color: string) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        const pBottom = projectHLS(hVal, 100, 20);
        const pTop = projectHLS(hVal, 100, 80);
        ctx.moveTo(pBottom.x, pBottom.y);
        ctx.lineTo(pTop.x, pTop.y);
        ctx.stroke();
      };
      drawRib(0, '#e5e5e5');
      drawRib(120, '#e5e5e5');
      drawRib(240, '#e5e5e5');
      ctx.setLineDash([]);
    } else if (model3DType === 'hsb') {
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
      ctx.lineWidth = 1.5;
      for (let hVal = 0; hVal < 360; hVal += 12) {
        const pt1 = projectHSB(hVal, 100, 100);
        const pt2 = projectHSB(hVal + 12, 100, 100);
        ctx.beginPath();
        const rgb = hslToRgb(hVal, 95, 50);
        ctx.strokeStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
      }

      // Draw vertical ribs
      const drawRib = (hVal: number, color: string) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        const pBottom = projectHSB(hVal, 100, 20);
        const pTop = projectHSB(hVal, 100, 80);
        ctx.moveTo(pBottom.x, pBottom.y);
        ctx.lineTo(pTop.x, pTop.y);
        ctx.stroke();
      };
      drawRib(0, '#e5e5e5');
      drawRib(120, '#e5e5e5');
      drawRib(240, '#e5e5e5');
      ctx.setLineDash([]);
    } else if (model3DType === 'lab') {
      // Draw LAB axes (L, a, b)
      ctx.beginPath();
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);

      // L-axis (vertical)
      const pL0 = projectLAB(0, 0, 0);
      const pL150 = projectLAB(100, 0, 0);
      ctx.moveTo(pL0.x, pL0.y);
      ctx.lineTo(pL150.x, pL150.y);

      // a-axis (red-green)
      const paMinus = projectLAB(50, -80, 0);
      const paPlus = projectLAB(50, 80, 0);
      ctx.moveTo(paMinus.x, paMinus.y);
      ctx.lineTo(paPlus.x, paPlus.y);

      // b-axis (yellow-blue)
      const pbMinus = projectLAB(50, 0, -80);
      const pbPlus = projectLAB(50, 0, 80);
      ctx.moveTo(pbMinus.x, pbMinus.y);
      ctx.lineTo(pbPlus.x, pbPlus.y);

      ctx.stroke();
      ctx.setLineDash([]);

      // Draw bounding box rings or limits
      ctx.strokeStyle = '#f0f0f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let LVal = 10; LVal <= 90; LVal += 40) {
        for (let angle = 0; angle <= 36; angle++) {
          const theta = (angle * 10 * Math.PI) / 180;
          const aVal = 60 * Math.cos(theta);
          const bVal = 60 * Math.sin(theta);
          const pt = projectLAB(LVal, aVal, bVal);
          if (angle === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();
    } else {
      // Draw RGB Cube Wireframe (12 edges)
      const corners = [
        { r: 0, g: 0, b: 0, label: 'K' },
        { r: 255, g: 0, b: 0, label: 'R' },
        { r: 255, g: 255, b: 0, label: 'Y' },
        { r: 0, g: 255, b: 0, label: 'G' },
        { r: 0, g: 0, b: 255, label: 'B' },
        { r: 255, g: 0, b: 255, label: 'M' },
        { r: 255, g: 255, b: 255, label: 'W' },
        { r: 0, g: 255, b: 255, label: 'C' },
      ];

      const edges = [
        [0, 1], [0, 3], [0, 4],
        [6, 2], [6, 5], [6, 7],
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
        ctx.fillText(c.label, pt.x + 4, pt.y + 3);
      });
    }

    // Draw the color-path trajectory in 3D!
    if (shades.length > 0) {
      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#262626'; // thick charcoal path line
      
      shades.forEach((s, idx) => {
        const rgb = hslToRgb(s.hsl.h, s.hsl.s, s.hsl.l);
        const pt = project(s.hsl.h, s.hsl.s, s.hsl.l, rgb.r, rgb.g, rgb.b);
        if (idx === 0) {
          ctx.moveTo(pt.x, pt.y);
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      });
      ctx.stroke();

      // Draw shade circles
      shades.forEach((s) => {
        const rgb = hslToRgb(s.hsl.h, s.hsl.s, s.hsl.l);
        const pt = project(s.hsl.h, s.hsl.s, s.hsl.l, rgb.r, rgb.g, rgb.b);
        
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#171717';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.fill();
      });

      // Label Start (S) and End (E) nodes
      if (shades.length >= 1) {
        const startRgb = hslToRgb(group.startHSL.h, group.startHSL.s, group.startHSL.l);
        const startPt = project(group.startHSL.h, group.startHSL.s, group.startHSL.l, startRgb.r, startRgb.g, startRgb.b);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('S', startPt.x + 6, startPt.y - 3);

        const endRgb = hslToRgb(group.endHSL.h, group.endHSL.s, group.endHSL.l);
        const endPt = project(group.endHSL.h, group.endHSL.s, group.endHSL.l, endRgb.r, endRgb.g, endRgb.b);
        ctx.fillText('E', endPt.x + 6, endPt.y - 3);
      }
    }

    // Draw a small 3D compass axis indicator in the corner
    const drawCompass = () => {
      const cx = 22;
      const cy = height - 22;
      const size = 10;

      ctx.fillStyle = '#737373';
      ctx.font = 'bold 7px sans-serif';

      if (model3DType === 'hls') {
        // X axis (Red) - Hue angle 0
        const xTheta = alpha;
        const xx = cx + size * Math.cos(xTheta);
        const xy = cy - size * Math.sin(xTheta) * Math.sin(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(xx, xy);
        ctx.stroke();
        ctx.fillText('H', xx + 2, xy);

        // Y axis (Green) - vertical (L)
        const yy = cy - size * Math.cos(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, yy);
        ctx.stroke();
        ctx.fillText('L', cx - 2, yy - 2);

        // Z axis (Blue) - Saturation radial
        const zTheta = alpha + Math.PI / 2;
        const zx = cx + size * Math.cos(zTheta);
        const zy = cy - size * Math.sin(zTheta) * Math.sin(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(zx, zy);
        ctx.stroke();
        ctx.fillText('S', zx + 2, zy);
      } else if (model3DType === 'hsb') {
        // HSB compass
        const xTheta = alpha;
        const xx = cx + size * Math.cos(xTheta);
        const xy = cy - size * Math.sin(xTheta) * Math.sin(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(xx, xy);
        ctx.stroke();
        ctx.fillText('H', xx + 2, xy);

        const yy = cy - size * Math.cos(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#f59e0b'; // Amber = Brightness
        ctx.lineWidth = 1.2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, yy);
        ctx.stroke();
        ctx.fillText('B', cx - 2, yy - 2);

        const zTheta = alpha + Math.PI / 2;
        const zx = cx + size * Math.cos(zTheta);
        const zy = cy - size * Math.sin(zTheta) * Math.sin(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(zx, zy);
        ctx.stroke();
        ctx.fillText('S', zx + 2, zy);
      } else if (model3DType === 'lab') {
        // LAB compass
        const xTheta = alpha;
        const xx = cx + size * Math.cos(xTheta);
        const xy = cy - size * Math.sin(xTheta) * Math.sin(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(xx, xy);
        ctx.stroke();
        ctx.fillText('a*', xx + 2, xy);

        const yy = cy - size * Math.cos(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#737373';
        ctx.lineWidth = 1.2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, yy);
        ctx.stroke();
        ctx.fillText('L*', cx - 2, yy - 2);

        const zTheta = alpha + Math.PI / 2;
        const zx = cx + size * Math.cos(zTheta);
        const zy = cy - size * Math.sin(zTheta) * Math.sin(beta);
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(zx, zy);
        ctx.stroke();
        ctx.fillText('b*', zx + 2, zy);
      } else {
        // RGB axes
        const rPt = projectRGB(255, 0, 0);
        const gPt = projectRGB(0, 255, 0);
        const bPt = projectRGB(0, 0, 255);
        const origin = projectRGB(0, 0, 0);

        const scaleVec = (p: {x: number, y: number}) => {
          const dx = p.x - origin.x;
          const dy = p.y - origin.y;
          const len = Math.hypot(dx, dy) || 1;
          return { x: cx + (dx / len) * size, y: cy + (dy / len) * size };
        };

        const rTarget = scaleVec(rPt);
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(rTarget.x, rTarget.y);
        ctx.stroke();
        ctx.fillText('R', rTarget.x + 2, rTarget.y);

        const gTarget = scaleVec(gPt);
        ctx.beginPath();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(gTarget.x, gTarget.y);
        ctx.stroke();
        ctx.fillText('G', gTarget.x + 2, gTarget.y);

        const bTarget = scaleVec(bPt);
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(bTarget.x, bTarget.y);
        ctx.stroke();
        ctx.fillText('B', bTarget.x + 2, bTarget.y);
      }
    };
    drawCompass();

  }, [group, shades, rotation, model3DType, activeSpaceTab, zoom, isFullscreen]);

  return (
    <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs" id="interactive-color-spaces-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-neutral-100" id="spaces-top-bar">
        {/* Unified View Selector Tabs */}
        <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-neutral-200 self-start overflow-x-auto max-w-full">
          <button
            onClick={() => {
              setActiveSpaceTab('3d');
              setModel3DType('hls');
            }}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md whitespace-nowrap transition-all cursor-pointer ${
              activeSpaceTab === '3d' && model3DType === 'hls' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            HLS
          </button>
          <button
            onClick={() => {
              setActiveSpaceTab('3d');
              setModel3DType('hsb');
            }}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md whitespace-nowrap transition-all cursor-pointer ${
              activeSpaceTab === '3d' && model3DType === 'hsb' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            HSB
          </button>
          <button
            onClick={() => {
              setActiveSpaceTab('3d');
              setModel3DType('rgb');
            }}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md whitespace-nowrap transition-all cursor-pointer ${
              activeSpaceTab === '3d' && model3DType === 'rgb' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            RGB
          </button>
          <button
            onClick={() => {
              setActiveSpaceTab('3d');
              setModel3DType('lab');
            }}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md whitespace-nowrap transition-all cursor-pointer ${
              activeSpaceTab === '3d' && model3DType === 'lab' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            LAB
          </button>
          <button
            onClick={() => setActiveSpaceTab('hl')}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md whitespace-nowrap transition-all cursor-pointer ${
              activeSpaceTab === 'hl' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            HL
          </button>
          <button
            onClick={() => setActiveSpaceTab('ls')}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md whitespace-nowrap transition-all cursor-pointer ${
              activeSpaceTab === 'ls' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            LS
          </button>
          <button
            onClick={() => setActiveSpaceTab('sh')}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md whitespace-nowrap transition-all cursor-pointer ${
              activeSpaceTab === 'sh' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            SH
          </button>
        </div>

        {/* Right: Interaction & Representation Switchers (only visible for 3D Space tab) */}
        {activeSpaceTab === '3d' && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center bg-white border border-neutral-200 rounded-lg p-0.5 shadow-2xs">
              <button
                onClick={() => setZoom(prev => Math.max(0.4, prev - 0.15))}
                className="p-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 rounded-md transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <span className="text-[9px] font-mono font-semibold px-1.5 text-neutral-600 select-none min-w-[32px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(prev => Math.min(2.5, prev + 0.15))}
                className="p-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 rounded-md transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
              <button
                onClick={() => setZoom(1.0)}
                className="px-1 text-[8px] text-neutral-400 hover:text-neutral-700 font-mono cursor-pointer"
                title="Reset Zoom"
              >
                Reset
              </button>
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={() => setIsFullscreen(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-white border border-neutral-200 rounded-md text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50 transition-all shadow-2xs cursor-pointer"
              title="Fullscreen"
            >
              <Maximize size={11} />
              <span>Fullscreen</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        {/* Left Column: Viewport container */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {/* 1. HL Space (Hue vs Lightness) */}
        <div className={`p-4 rounded-xl border border-neutral-200/60 bg-neutral-50/20 hover:bg-neutral-50/50 transition-colors ${activeSpaceTab === 'hl' ? '' : 'hidden'}`}>
            <div
              id="plot-hl-container"
              ref={hlContainerRef}
              onPointerDown={(e) => handlePointerDown('hl', hlContainerRef, e.clientX, e.clientY, e)}
              onPointerMove={(e) => handlePointerMove('hl', hlContainerRef, e)}
              onPointerUp={handlePointerUp}
              className="relative border border-neutral-200 rounded-lg overflow-hidden cursor-crosshair h-[360px] w-full select-none bg-white"
            >
              <canvas ref={hlCanvasRef} className="absolute inset-0 w-full h-full opacity-90 object-cover" />
              
              {/* SVG Overlay representing nodes and steps */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {/* Plot path lines connecting shade points */}
                {shades.slice(0, -1).map((s, idx) => {
                  const sNext = shades[idx + 1];
                  return (
                    <line
                      key={`hl-line-${idx}`}
                      x1={`${(s.hsl.h / 360) * 100}%`}
                      y1={`${(1 - s.hsl.l / 100) * 100}%`}
                      x2={`${(sNext.hsl.h / 360) * 100}%`}
                      y2={`${(1 - sNext.hsl.l / 100) * 100}%`}
                      stroke="rgba(255,255,255,0.7)"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                  );
                })}

                 {/* Individual shade dots */}
                {shades.map((s, idx) => {
                  const cxVal = `${(s.hsl.h / 360) * 100}%`;
                  const cyVal = `${(1 - s.hsl.l / 100) * 100}%`;
                  return (
                    <circle
                      key={`hl-dot-${idx}`}
                      cx={cxVal}
                      cy={cyVal}
                      r={group.settingsMode === 'manual' ? '7' : '4'}
                      fill={s.hex}
                      stroke="#ffffff"
                      strokeWidth={group.settingsMode === 'manual' ? '2' : '1.5'}
                      className="transition-transform hover:scale-150"
                    />
                  );
                })}

                {/* Mode 1 and 2 Handles */}
                {group.settingsMode !== 'handles_center' && group.settingsMode !== 'manual' && (
                  <>
                    {/* Start Handle (S) */}
                    {(group.settingsMode === 'handles_sliders') && (() => {
                      const startX = `${(group.startHSL.h / 360) * 100}%`;
                      const startY = `${(1 - group.startHSL.l / 100) * 100}%`;
                      const csX = `${(ctrlStart.h / 360) * 100}%`;
                      const csY = `${(1 - ctrlStart.l / 100) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={startX} y1={startY} x2={csX} y2={csY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={startX} y1={startY} x2={csX} y2={csY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={csX} cy={csY} r="6" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* End Handle (E) */}
                    {(group.settingsMode === 'handles_sliders') && (() => {
                      const endX = `${(group.endHSL.h / 360) * 100}%`;
                      const endY = `${(1 - group.endHSL.l / 100) * 100}%`;
                      const ceX = `${(ctrlEnd.h / 360) * 100}%`;
                      const ceY = `${(1 - ctrlEnd.l / 100) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={endX} y1={endY} x2={ceX} y2={ceY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={endX} y1={endY} x2={ceX} y2={ceY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={ceX} cy={ceY} r="6" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                        </g>
                      );
                    })()}
                  </>
                )}

                {/* Mode 3 Handles */}
                {group.settingsMode === 'handles_center' && (
                  <>
                    {/* Start Handle */}
                    {(() => {
                      const startX = `${(group.startHSL.h / 360) * 100}%`;
                      const startY = `${(1 - group.startHSL.l / 100) * 100}%`;
                      const csX = `${(ctrlStart.h / 360) * 100}%`;
                      const csY = `${(1 - ctrlStart.l / 100) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={startX} y1={startY} x2={csX} y2={csY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={startX} y1={startY} x2={csX} y2={csY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={csX} cy={csY} r="6" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* Mid Left Handle */}
                    {(() => {
                      const mX = `${(midHSL.h / 360) * 100}%`;
                      const mY = `${(1 - midHSL.l / 100) * 100}%`;
                      const cmsX = `${(ctrlMidStart.h / 360) * 100}%`;
                      const cmsY = `${(1 - ctrlMidStart.l / 100) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={mX} y1={mY} x2={cmsX} y2={cmsY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={mX} y1={mY} x2={cmsX} y2={cmsY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={cmsX} cy={cmsY} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* Mid Right Handle */}
                    {(() => {
                      const mX = `${(midHSL.h / 360) * 100}%`;
                      const mY = `${(1 - midHSL.l / 100) * 100}%`;
                      const cmeX = `${(ctrlMidEnd.h / 360) * 100}%`;
                      const cmeY = `${(1 - ctrlMidEnd.l / 100) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={mX} y1={mY} x2={cmeX} y2={cmeY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={mX} y1={mY} x2={cmeX} y2={cmeY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={cmeX} cy={cmeY} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* End Handle */}
                    {(() => {
                      const endX = `${(group.endHSL.h / 360) * 100}%`;
                      const endY = `${(1 - group.endHSL.l / 100) * 100}%`;
                      const ceX = `${(ctrlEnd.h / 360) * 100}%`;
                      const ceY = `${(1 - ctrlEnd.l / 100) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={endX} y1={endY} x2={ceX} y2={ceY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={endX} y1={endY} x2={ceX} y2={ceY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={ceX} cy={ceY} r="6" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* Mid Point (M) Node */}
                    {(() => {
                      const mX = `${(midHSL.h / 360) * 100}%`;
                      const mY = `${(1 - midHSL.l / 100) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <circle cx={mX} cy={mY} r="9" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                          <text x={mX} y={mY} dy="3.5" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">M</text>
                        </g>
                      );
                    })()}
                  </>
                )}

                {/* S Point Node */}
                {group.settingsMode !== 'manual' && (() => {
                  const startX = `${(group.startHSL.h / 360) * 100}%`;
                  const startY = `${(1 - group.startHSL.l / 100) * 100}%`;
                  return (
                    <g className="cursor-grab">
                      <circle cx={startX} cy={startY} r="9" fill="#000000" stroke="#ffffff" strokeWidth="2" />
                      <text x={startX} y={startY} dy="3" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">S</text>
                    </g>
                  );
                })()}

                {/* E Point Node */}
                {group.settingsMode !== 'manual' && (() => {
                  const endX = `${(group.endHSL.h / 360) * 100}%`;
                  const endY = `${(1 - group.endHSL.l / 100) * 100}%`;
                  return (
                    <g className="cursor-grab">
                      <circle cx={endX} cy={endY} r="9" fill="#000000" stroke="#ffffff" strokeWidth="2" />
                      <text x={endX} y={endY} dy="3" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">E</text>
                    </g>
                  );
                })()}
              </svg>

              {/* Hover Tooltip inside SVG view */}
              {hoveredShade && hoveredShade.plot === 'hl' && (
                <div
                  className="absolute bg-neutral-900/95 text-neutral-50 px-2 py-1 rounded text-[10px] font-mono pointer-events-none shadow-md border border-neutral-700 flex flex-col z-20"
                  style={{
                    left: `${hoveredShade.x + 10}px`,
                    top: `${hoveredShade.y - 15}px`,
                  }}
                >
                  <span className="font-bold">{hoveredShade.shade.step}</span>
                  <span>H:{hoveredShade.shade.hsl.h}° L:{hoveredShade.shade.hsl.l}%</span>
                  <span className="text-emerald-400">{hoveredShade.shade.hex}</span>
                </div>
              )}
            </div>
          </div>

        {/* 2. LS Space (Lightness vs Saturation) */}
        <div className={`p-4 rounded-xl border border-neutral-200/60 bg-neutral-50/20 hover:bg-neutral-50/50 transition-colors ${activeSpaceTab === 'ls' ? '' : 'hidden'}`}>
            <div
              id="plot-ls-container"
              ref={lsContainerRef}
              onPointerDown={(e) => handlePointerDown('ls', lsContainerRef, e.clientX, e.clientY, e)}
              onPointerMove={(e) => handlePointerMove('ls', lsContainerRef, e)}
              onPointerUp={handlePointerUp}
              className="relative border border-neutral-200 rounded-lg overflow-hidden cursor-crosshair h-[360px] w-full select-none bg-white"
            >
              <canvas ref={lsCanvasRef} className="absolute inset-0 w-full h-full opacity-90 object-cover" />
              
              {/* SVG Overlay representing nodes and steps */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {/* Plot path lines connecting shade points */}
                {shades.slice(0, -1).map((s, idx) => {
                  const sNext = shades[idx + 1];
                  return (
                    <line
                      key={`ls-line-${idx}`}
                      x1={`${(s.hsl.l / 100) * 100}%`}
                      y1={`${(1 - s.hsl.s / 100) * 100}%`}
                      x2={`${(sNext.hsl.l / 100) * 100}%`}
                      y2={`${(1 - sNext.hsl.s / 100) * 100}%`}
                      stroke="rgba(255,255,255,0.7)"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                  );
                })}

                 {/* Individual shade dots */}
                {shades.map((s, idx) => {
                  const cxVal = `${(s.hsl.l / 100) * 100}%`;
                  const cyVal = `${(1 - s.hsl.s / 100) * 100}%`;
                  return (
                    <circle
                      key={`ls-dot-${idx}`}
                      cx={cxVal}
                      cy={cyVal}
                      r={group.settingsMode === 'manual' ? '7' : '4'}
                      fill={s.hex}
                      stroke="#ffffff"
                      strokeWidth={group.settingsMode === 'manual' ? '2' : '1.5'}
                      className="transition-transform hover:scale-150"
                    />
                  );
                })}

                {/* Mode 1 and 2 Handles */}
                {group.settingsMode !== 'handles_center' && group.settingsMode !== 'manual' && (
                  <>
                    {/* Start Handle (S) */}
                    {(group.settingsMode === 'handles_sliders') && (() => {
                      const startX = `${(group.startHSL.l / 100) * 100}%`;
                      const startY = `${(1 - group.startHSL.s / 100) * 100}%`;
                      const csX = `${(ctrlStart.l / 100) * 100}%`;
                      const csY = `${(1 - ctrlStart.s / 100) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={startX} y1={startY} x2={csX} y2={csY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={startX} y1={startY} x2={csX} y2={csY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={csX} cy={csY} r="6" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* End Handle (E) */}
                    {(group.settingsMode === 'handles_sliders') && (() => {
                      const endX = `${(group.endHSL.l / 100) * 100}%`;
                      const endY = `${(1 - group.endHSL.s / 100) * 100}%`;
                      const ceX = `${(ctrlEnd.l / 100) * 100}%`;
                      const ceY = `${(1 - ctrlEnd.s / 100) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={endX} y1={endY} x2={ceX} y2={ceY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={endX} y1={endY} x2={ceX} y2={ceY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={ceX} cy={ceY} r="6" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                        </g>
                      );
                    })()}
                  </>
                )}

                {/* Mode 3 Handles */}
                {group.settingsMode === 'handles_center' && (
                  <>
                    {/* Start Handle */}
                    {(() => {
                      const startX = `${(group.startHSL.l / 100) * 100}%`;
                      const startY = `${(1 - group.startHSL.s / 100) * 100}%`;
                      const csX = `${(ctrlStart.l / 100) * 100}%`;
                      const csY = `${(1 - ctrlStart.s / 100) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={startX} y1={startY} x2={csX} y2={csY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={startX} y1={startY} x2={csX} y2={csY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={csX} cy={csY} r="6" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* Mid Left Handle */}
                    {(() => {
                      const mX = `${(midHSL.l / 100) * 100}%`;
                      const mY = `${(1 - midHSL.s / 100) * 100}%`;
                      const cmsX = `${(ctrlMidStart.l / 100) * 100}%`;
                      const cmsY = `${(1 - ctrlMidStart.s / 100) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={mX} y1={mY} x2={cmsX} y2={cmsY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={mX} y1={mY} x2={cmsX} y2={cmsY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={cmsX} cy={cmsY} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* Mid Right Handle */}
                    {(() => {
                      const mX = `${(midHSL.l / 100) * 100}%`;
                      const mY = `${(1 - midHSL.s / 100) * 100}%`;
                      const cmeX = `${(ctrlMidEnd.l / 100) * 100}%`;
                      const cmeY = `${(1 - ctrlMidEnd.s / 100) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={mX} y1={mY} x2={cmeX} y2={cmeY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={mX} y1={mY} x2={cmeX} y2={cmeY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={cmeX} cy={cmeY} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* End Handle */}
                    {(() => {
                      const endX = `${(group.endHSL.l / 100) * 100}%`;
                      const endY = `${(1 - group.endHSL.s / 100) * 100}%`;
                      const ceX = `${(ctrlEnd.l / 100) * 100}%`;
                      const ceY = `${(1 - ctrlEnd.s / 100) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={endX} y1={endY} x2={ceX} y2={ceY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={endX} y1={endY} x2={ceX} y2={ceY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={ceX} cy={ceY} r="6" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* Mid Point (M) Node */}
                    {(() => {
                      const mX = `${(midHSL.l / 100) * 100}%`;
                      const mY = `${(1 - midHSL.s / 100) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <circle cx={mX} cy={mY} r="9" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                          <text x={mX} y={mY} dy="3.5" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">M</text>
                        </g>
                      );
                    })()}
                  </>
                )}

                 {/* S Point Node */}
                {group.settingsMode !== 'manual' && (() => {
                  const startX = `${(group.startHSL.l / 100) * 100}%`;
                  const startY = `${(1 - group.startHSL.s / 100) * 100}%`;
                  return (
                    <g className="cursor-grab">
                      <circle cx={startX} cy={startY} r="9" fill="#000000" stroke="#ffffff" strokeWidth="2" />
                      <text x={startX} y={startY} dy="3" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">S</text>
                    </g>
                  );
                })()}

                {/* E Point Node */}
                {group.settingsMode !== 'manual' && (() => {
                  const endX = `${(group.endHSL.l / 100) * 100}%`;
                  const endY = `${(1 - group.endHSL.s / 100) * 100}%`;
                  return (
                    <g className="cursor-grab">
                      <circle cx={endX} cy={endY} r="9" fill="#000000" stroke="#ffffff" strokeWidth="2" />
                      <text x={endX} y={endY} dy="3" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">E</text>
                    </g>
                  );
                })()}
              </svg>

              {/* Hover Tooltip inside SVG view */}
              {hoveredShade && hoveredShade.plot === 'ls' && (
                <div
                  className="absolute bg-neutral-900/95 text-neutral-50 px-2 py-1 rounded text-[10px] font-mono pointer-events-none shadow-md border border-neutral-700 flex flex-col z-20"
                  style={{
                    left: `${hoveredShade.x + 10}px`,
                    top: `${hoveredShade.y - 15}px`,
                  }}
                >
                  <span className="font-bold">{hoveredShade.shade.step}</span>
                  <span>L:{hoveredShade.shade.hsl.l}% S:{hoveredShade.shade.hsl.s}%</span>
                  <span className="text-emerald-400">{hoveredShade.shade.hex}</span>
                </div>
              )}
            </div>
          </div>

        {/* 3. SH Space (Saturation vs Hue) */}
        <div className={`p-4 rounded-xl border border-neutral-200/60 bg-neutral-50/20 hover:bg-neutral-50/50 transition-colors ${activeSpaceTab === 'sh' ? '' : 'hidden'}`}>
            <div
              id="plot-hs-container"
              ref={hsContainerRef}
              onPointerDown={(e) => handlePointerDown('hs', hsContainerRef, e.clientX, e.clientY, e)}
              onPointerMove={(e) => handlePointerMove('hs', hsContainerRef, e)}
              onPointerUp={handlePointerUp}
              className="relative border border-neutral-200 rounded-lg overflow-hidden cursor-crosshair h-[360px] w-full select-none bg-white"
            >
              <canvas ref={hsCanvasRef} className="absolute inset-0 w-full h-full opacity-90 object-cover" />
              
              {/* SVG Overlay representing nodes and steps */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {/* Plot path lines connecting shade points */}
                {shades.slice(0, -1).map((s, idx) => {
                  const sNext = shades[idx + 1];
                  return (
                    <line
                      key={`hs-line-${idx}`}
                      x1={`${(s.hsl.s / 100) * 100}%`}
                      y1={`${(1 - s.hsl.h / 360) * 100}%`}
                      x2={`${(sNext.hsl.s / 100) * 100}%`}
                      y2={`${(1 - sNext.hsl.h / 360) * 100}%`}
                      stroke="rgba(255,255,255,0.7)"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                  );
                })}

                 {/* Individual shade dots */}
                {shades.map((s, idx) => {
                  const cxVal = `${(s.hsl.s / 100) * 100}%`;
                  const cyVal = `${(1 - s.hsl.h / 360) * 100}%`;
                  return (
                    <circle
                      key={`hs-dot-${idx}`}
                      cx={cxVal}
                      cy={cyVal}
                      r={group.settingsMode === 'manual' ? '7' : '4'}
                      fill={s.hex}
                      stroke="#ffffff"
                      strokeWidth={group.settingsMode === 'manual' ? '2' : '1.5'}
                      className="transition-transform hover:scale-150"
                    />
                  );
                })}

                {/* Mode 1 and 2 Handles */}
                {group.settingsMode !== 'handles_center' && group.settingsMode !== 'manual' && (
                  <>
                    {/* Start Handle (S) */}
                    {(group.settingsMode === 'handles_sliders') && (() => {
                      const startX = `${(group.startHSL.s / 100) * 100}%`;
                      const startY = `${(1 - group.startHSL.h / 360) * 100}%`;
                      const csX = `${(ctrlStart.s / 100) * 100}%`;
                      const csY = `${(1 - ctrlStart.h / 360) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={startX} y1={startY} x2={csX} y2={csY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={startX} y1={startY} x2={csX} y2={csY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={csX} cy={csY} r="6" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* End Handle (E) */}
                    {(group.settingsMode === 'handles_sliders') && (() => {
                      const endX = `${(group.endHSL.s / 100) * 100}%`;
                      const endY = `${(1 - group.endHSL.h / 360) * 100}%`;
                      const ceX = `${(ctrlEnd.s / 100) * 100}%`;
                      const ceY = `${(1 - ctrlEnd.h / 360) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={endX} y1={endY} x2={ceX} y2={ceY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={endX} y1={endY} x2={ceX} y2={ceY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={ceX} cy={ceY} r="6" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                        </g>
                      );
                    })()}
                  </>
                )}

                {/* Mode 3 Handles */}
                {group.settingsMode === 'handles_center' && (
                  <>
                    {/* Start Handle */}
                    {(() => {
                      const startX = `${(group.startHSL.s / 100) * 100}%`;
                      const startY = `${(1 - group.startHSL.h / 360) * 100}%`;
                      const csX = `${(ctrlStart.s / 100) * 100}%`;
                      const csY = `${(1 - ctrlStart.h / 360) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={startX} y1={startY} x2={csX} y2={csY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={startX} y1={startY} x2={csX} y2={csY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={csX} cy={csY} r="6" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* Mid Left Handle */}
                    {(() => {
                      const mX = `${(midHSL.s / 100) * 100}%`;
                      const mY = `${(1 - midHSL.h / 360) * 100}%`;
                      const cmsX = `${(ctrlMidStart.s / 100) * 100}%`;
                      const cmsY = `${(1 - ctrlMidStart.h / 360) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={mX} y1={mY} x2={cmsX} y2={cmsY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={mX} y1={mY} x2={cmsX} y2={cmsY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={cmsX} cy={cmsY} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* Mid Right Handle */}
                    {(() => {
                      const mX = `${(midHSL.s / 100) * 100}%`;
                      const mY = `${(1 - midHSL.h / 360) * 100}%`;
                      const cmeX = `${(ctrlMidEnd.s / 100) * 100}%`;
                      const cmeY = `${(1 - ctrlMidEnd.h / 360) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={mX} y1={mY} x2={cmeX} y2={cmeY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={mX} y1={mY} x2={cmeX} y2={cmeY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={cmeX} cy={cmeY} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* End Handle */}
                    {(() => {
                      const endX = `${(group.endHSL.s / 100) * 100}%`;
                      const endY = `${(1 - group.endHSL.h / 360) * 100}%`;
                      const ceX = `${(ctrlEnd.s / 100) * 100}%`;
                      const ceY = `${(1 - ctrlEnd.h / 360) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <line x1={endX} y1={endY} x2={ceX} y2={ceY} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" opacity="0.9" />
                          <line x1={endX} y1={endY} x2={ceX} y2={ceY} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <circle cx={ceX} cy={ceY} r="6" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}

                    {/* Mid Point (M) Node */}
                    {(() => {
                      const mX = `${(midHSL.s / 100) * 100}%`;
                      const mY = `${(1 - midHSL.h / 360) * 100}%`;
                      return (
                        <g className="cursor-grab">
                          <circle cx={mX} cy={mY} r="9" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                          <text x={mX} y={mY} dy="3.5" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">M</text>
                        </g>
                      );
                    })()}
                  </>
                )}

                 {/* S Point Node */}
                {group.settingsMode !== 'manual' && (() => {
                  const startX = `${(group.startHSL.s / 100) * 100}%`;
                  const startY = `${(1 - group.startHSL.h / 360) * 100}%`;
                  return (
                    <g className="cursor-grab">
                      <circle cx={startX} cy={startY} r="9" fill="#000000" stroke="#ffffff" strokeWidth="2" />
                      <text x={startX} y={startY} dy="3" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">S</text>
                    </g>
                  );
                })()}

                {/* E Point Node */}
                {group.settingsMode !== 'manual' && (() => {
                  const endX = `${(group.endHSL.s / 100) * 100}%`;
                  const endY = `${(1 - group.endHSL.h / 360) * 100}%`;
                  return (
                    <g className="cursor-grab">
                      <circle cx={endX} cy={endY} r="9" fill="#000000" stroke="#ffffff" strokeWidth="2" />
                      <text x={endX} y={endY} dy="3" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">E</text>
                    </g>
                  );
                })()}
              </svg>

              {/* Hover Tooltip inside SVG view */}
              {hoveredShade && hoveredShade.plot === 'hs' && (
                <div
                  className="absolute bg-neutral-900/95 text-neutral-50 px-2 py-1 rounded text-[10px] font-mono pointer-events-none shadow-md border border-neutral-700 flex flex-col z-20"
                  style={{
                    left: `${hoveredShade.x + 10}px`,
                    top: `${hoveredShade.y - 15}px`,
                  }}
                >
                  <span className="font-bold">{hoveredShade.shade.step}</span>
                  <span>S:{hoveredShade.shade.hsl.s}% H:{hoveredShade.shade.hsl.h}°</span>
                  <span className="text-emerald-400">{hoveredShade.shade.hex}</span>
                </div>
              )}
            </div>
          </div>

        {/* 4. Interactive 3D Space (Rotating Cylinder/Cube) */}
        <div className={`p-4 rounded-xl border border-neutral-200/60 bg-neutral-50/20 hover:bg-neutral-50/50 transition-colors ${activeSpaceTab === '3d' ? '' : 'hidden'}`}>
            {!isFullscreen && (
              <div
                id="plot-3d-container"
                onPointerDown={handlePointerDown3D}
                onPointerMove={handlePointerMove3D}
                onPointerUp={handlePointerUp3D}
                className="relative border border-neutral-200 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing h-[380px] w-full select-none bg-[#fafafa]"
              >
                <canvas ref={canvas3DRef} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-neutral-900/10 hover:bg-neutral-900/20 text-neutral-600 px-1.5 py-0.5 rounded text-[8px] font-semibold pointer-events-none transition-colors backdrop-blur-xs">
                  Drag to Rotate
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Shift Group (ColorWheel) */}
        {!isFullscreen && (
          <div className="w-full lg:w-[240px] flex-shrink-0 flex flex-col items-center justify-center p-5 bg-neutral-50 border border-neutral-200/60 rounded-xl self-start">
            <span className="text-xs font-bold text-neutral-500 mb-3 block text-center">
              Shift Group ({shades[Math.floor(shades.length / 2)]?.hsl.h || 0}°)
            </span>
            <ColorWheel 
              groups={[group]}
              generatedPalette={generatedPalette}
              updateGroup={(id, fields) => onChangeGroupProp(fields)}
            />
            
            <div className="w-full mt-4 pt-4 border-t border-neutral-200/50 flex flex-col gap-3">
              {/* Saturation Shift Slider */}
              <div className="flex flex-col gap-1 w-full">
                <div className="flex justify-between text-[10px] font-bold text-neutral-500 font-mono">
                  <span>Shift Saturation</span>
                  <span>{satShift > 0 ? `+${satShift}` : satShift}%</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={satShift}
                  onChange={(e) => handleSatShiftChange(Number(e.target.value))}
                  onPointerUp={handleSatShiftEnd}
                  onTouchEnd={handleSatShiftEnd}
                  className="w-full accent-neutral-900 cursor-pointer h-1 bg-neutral-200 rounded-lg appearance-none"
                />
              </div>

              {/* Lightness Shift Slider */}
              <div className="flex flex-col gap-1 w-full">
                <div className="flex justify-between text-[10px] font-bold text-neutral-500 font-mono">
                  <span>Shift Lightness</span>
                  <span>{lightShift > 0 ? `+${lightShift}` : lightShift}%</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={lightShift}
                  onChange={(e) => handleLightShiftChange(Number(e.target.value))}
                  onPointerUp={handleLightShiftEnd}
                  onTouchEnd={handleLightShiftEnd}
                  className="w-full accent-neutral-900 cursor-pointer h-1 bg-neutral-200 rounded-lg appearance-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

        {/* Fullscreen Overlay Modal */}
        {isFullscreen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 md:p-10 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[85vh] border border-neutral-200">
              {/* Header controls inside fullscreen */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
                <div className="flex items-center gap-2">
                  <Compass className="text-emerald-500 animate-spin-slow" size={16} />
                  <h3 className="text-sm font-bold text-neutral-800">
                    3D Color Space: {model3DType === 'hls' ? 'HLS Cylinder' : model3DType === 'hsb' ? 'HSB Cylinder' : model3DType === 'rgb' ? 'RGB Cube' : 'LAB Space'}
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
                      onClick={() => setModel3DType('hls')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        model3DType === 'hls' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      <span>HLS</span>
                    </button>
                    <button
                      onClick={() => setModel3DType('hsb')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        model3DType === 'hsb' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      <span>HSB</span>
                    </button>
                    <button
                      onClick={() => setModel3DType('rgb')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        model3DType === 'rgb' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      <span>RGB</span>
                    </button>
                    <button
                      onClick={() => setModel3DType('lab')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        model3DType === 'lab' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
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
                id="plot-3d-fullscreen-container"
                onPointerDown={handlePointerDown3D}
                onPointerMove={handlePointerMove3D}
                onPointerUp={handlePointerUp3D}
                className="flex-1 relative cursor-grab active:cursor-grabbing select-none bg-[#fafafa]"
              >
                <canvas ref={canvas3DRef} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute bottom-4 left-4 bg-neutral-900/40 backdrop-blur-xs text-neutral-50 px-2 py-1 rounded text-[10px] pointer-events-none">
                  Drag to rotate azimuth and elevation • Zoom levels {Math.round(zoom * 100)}%
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
