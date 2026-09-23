import { HSL, RGB, ColorGroup, GeneratedShade, GeneratedGroup } from './types';

export function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360;
  s /= 100;
  l /= 100;
  let r = l;
  let g = l;
  let b = l;

  if (s !== 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = hue2rgb(h + 1 / 3);
    g = hue2rgb(h);
    b = hue2rgb(h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
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
    l: Math.round(l * 100),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): RGB | null {
  const cleanHex = hex.trim().replace(/^#/, '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return { r, g, b };
  }
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function hexToHsl(hex: string): HSL | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

// Generates an array of shade steps based on the total steps count
export function getStepLabel(index: number, total: number): number {
  if (total <= 1) return 500;
  const raw = 100 + (index * 800) / (total - 1);
  return Math.round(raw / 10) * 10;
}

// Helper to compute a single cubic Bezier value
export function getBezierValue(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 +
         3 * mt * mt * t * p1 +
         3 * mt * t * t * p2 +
         t * t * t * p3;
}

// Helper to map a normalized distance d in [0, 1] to the Bezier parameter u in [0, 1] using arc-length parameterization
export function getArcLengthU(
  getPoint: (u: number) => { x: number; y: number; z: number },
  d: number,
  samples: number = 100
): number {
  if (d <= 0) return 0;
  if (d >= 1) return 1;

  // Build cumulative distance table
  const dists: number[] = [0];
  let totalDist = 0;
  let prevPt = getPoint(0);

  for (let i = 1; i <= samples; i++) {
    const u = i / samples;
    const pt = getPoint(u);
    const dx = pt.x - prevPt.x;
    const dy = pt.y - prevPt.y;
    const dz = pt.z - prevPt.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    totalDist += dist;
    dists.push(totalDist);
    prevPt = pt;
  }

  if (totalDist === 0) return d;

  const targetDist = d * totalDist;
  
  let low = 0;
  let high = samples;
  while (low < high - 1) {
    const mid = (low + high) >> 1;
    if (dists[mid] <= targetDist) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const d0 = dists[low];
  const d1 = dists[high];
  const u0 = low / samples;
  const u1 = high / samples;

  if (d1 === d0) return u0;
  const fraction = (targetDist - d0) / (d1 - d0);
  return u0 + fraction * (u1 - u0);
}

// Interpolation with distribution bias and optional Bezier handles
export function interpolate(
  startHSL: HSL,
  endHSL: HSL,
  t: number,
  distribution: number,
  mode: 'hsl' | 'rgb',
  ctrlStartHSL?: HSL,
  ctrlEndHSL?: HSL
): { hsl: HSL; rgb: RGB; hex: string } {
  const p = Math.pow(2, distribution / 50);
  const tBiased = Math.pow(t, p);

  if (mode === 'hsl') {
    // Shortest path hue interpolation
    const h1 = startHSL.h;
    const h2 = endHSL.h;
    let diff = h2 - h1;
    if (diff > 180) {
      diff -= 360;
    } else if (diff < -180) {
      diff += 360;
    }
    const unwrappedE_h = h1 + diff;

    // Control point 1 default (1/3) or actual HSL
    let unwrappedC1_h = h1 + diff * (1 / 3);
    let c1_s = startHSL.s + (endHSL.s - startHSL.s) * (1 / 3);
    let c1_l = startHSL.l + (endHSL.l - startHSL.l) * (1 / 3);
    if (ctrlStartHSL) {
      let diffC1 = ctrlStartHSL.h - h1;
      if (diffC1 > 180) diffC1 -= 360;
      else if (diffC1 < -180) diffC1 += 360;
      unwrappedC1_h = h1 + diffC1;
      c1_s = ctrlStartHSL.s;
      c1_l = ctrlStartHSL.l;
    }

    // Control point 2 default (2/3) or actual HSL
    let unwrappedC2_h = h1 + diff * (2 / 3);
    let c2_s = startHSL.s + (endHSL.s - startHSL.s) * (2 / 3);
    let c2_l = startHSL.l + (endHSL.l - startHSL.l) * (2 / 3);
    if (ctrlEndHSL) {
      let diffC2 = ctrlEndHSL.h - h1;
      if (diffC2 > 180) diffC2 -= 360;
      else if (diffC2 < -180) diffC2 += 360;
      unwrappedC2_h = h1 + diffC2;
      c2_s = ctrlEndHSL.s;
      c2_l = ctrlEndHSL.l;
    }

    // Define 3D path evaluator in HSL space
    const getPointHSL = (u: number) => {
      const h = getBezierValue(u, h1, unwrappedC1_h, unwrappedC2_h, unwrappedE_h);
      const s = getBezierValue(u, startHSL.s, c1_s, c2_s, endHSL.s);
      const l = getBezierValue(u, startHSL.l, c1_l, c2_l, endHSL.l);
      // Scale Hue to 0-100 range for distance calculation
      return { x: h / 3.6, y: s, z: l };
    };

    // Find the single arc-length parameterized u-value for all channels using the single distribution-biased target distance
    const u = getArcLengthU(getPointHSL, tBiased);

    // Evaluate channels at the same u value
    let h = getBezierValue(u, h1, unwrappedC1_h, unwrappedC2_h, unwrappedE_h) % 360;
    if (h < 0) h += 360;

    const s = getBezierValue(u, startHSL.s, c1_s, c2_s, endHSL.s);
    const l = getBezierValue(u, startHSL.l, c1_l, c2_l, endHSL.l);

    const roundedHsl = {
      h: Math.round(h),
      s: Math.round(Math.max(0, Math.min(100, s))),
      l: Math.round(Math.max(0, Math.min(100, l))),
    };

    const rgb = hslToRgb(roundedHsl.h, roundedHsl.s, roundedHsl.l);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

    return { hsl: roundedHsl, rgb, hex };
  } else {
    // RGB space interpolation
    const rgbStart = hslToRgb(startHSL.h, startHSL.s, startHSL.l);
    const rgbEnd = hslToRgb(endHSL.h, endHSL.s, endHSL.l);

    const rgbC1 = ctrlStartHSL
      ? hslToRgb(ctrlStartHSL.h, ctrlStartHSL.s, ctrlStartHSL.l)
      : {
          r: rgbStart.r + (rgbEnd.r - rgbStart.r) * (1 / 3),
          g: rgbStart.g + (rgbEnd.g - rgbStart.g) * (1 / 3),
          b: rgbStart.b + (rgbEnd.b - rgbStart.b) * (1 / 3),
        };

    const rgbC2 = ctrlEndHSL
      ? hslToRgb(ctrlEndHSL.h, ctrlEndHSL.s, ctrlEndHSL.l)
      : {
          r: rgbStart.r + (rgbEnd.r - rgbStart.r) * (2 / 3),
          g: rgbStart.g + (rgbEnd.g - rgbStart.g) * (2 / 3),
          b: rgbStart.b + (rgbEnd.b - rgbStart.b) * (2 / 3),
        };

    // Define 3D path evaluator in RGB space
    const getPointRGB = (u: number) => {
      const r = getBezierValue(u, rgbStart.r, rgbC1.r, rgbC2.r, rgbEnd.r);
      const g = getBezierValue(u, rgbStart.g, rgbC1.g, rgbC2.g, rgbEnd.g);
      const b = getBezierValue(u, rgbStart.b, rgbC1.b, rgbC2.b, rgbEnd.b);
      return { x: r, y: g, z: b };
    };

    // Find the single arc-length parameterized u-value for all channels using the single distribution-biased target distance
    const u = getArcLengthU(getPointRGB, tBiased);

    // Blend channels using same arc-length parameterized u value
    const r = getBezierValue(u, rgbStart.r, rgbC1.r, rgbC2.r, rgbEnd.r);
    const g = getBezierValue(u, rgbStart.g, rgbC1.g, rgbC2.g, rgbEnd.g);
    const b = getBezierValue(u, rgbStart.b, rgbC1.b, rgbC2.b, rgbEnd.b);

    const roundedRgb = {
      r: Math.round(Math.max(0, Math.min(255, r))),
      g: Math.round(Math.max(0, Math.min(255, g))),
      b: Math.round(Math.max(0, Math.min(255, b))),
    };

    const hsl = rgbToHsl(roundedRgb.r, roundedRgb.g, roundedRgb.b);
    const hex = rgbToHex(roundedRgb.r, roundedRgb.g, roundedRgb.b);

    return { hsl, rgb: roundedRgb, hex };
  }
}

// Generate the complete shade steps for a single color group
export function generateGroupShades(
  group: ColorGroup,
  numShades: number,
  globalMode: 'hsl' | 'rgb' = 'hsl'
): GeneratedShade[] {
  const shades: GeneratedShade[] = [];
  const mode = globalMode;

  const actualNumShades = group.numShades || numShades;
  const settingsMode = group.settingsMode || 'linear';

  if (settingsMode === 'manual') {
    const manualColors = group.manualColors || [];
    if (manualColors.length !== actualNumShades) {
      // Pre-populate with standard linear interpolation
      const baseShades = generateGroupShades({ ...group, settingsMode: 'linear' }, actualNumShades, globalMode);
      const populated: HSL[] = [];
      for (let i = 0; i < actualNumShades; i++) {
        if (manualColors[i]) {
          populated.push(manualColors[i]);
        } else {
          populated.push(baseShades[i].hsl);
        }
      }
      group.manualColors = populated;
    }

    for (let i = 0; i < actualNumShades; i++) {
      const step = getStepLabel(i, actualNumShades);
      const hsl = group.manualColors[i];
      const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      shades.push({
        step,
        hsl,
        rgb,
        hex,
      });
    }
    return shades;
  }

  if (settingsMode === 'handles_center') {
    // Mode 3: Two joined Bezier curves: Segment A (S -> M) and Segment B (M -> E)
    const n = Math.floor(actualNumShades / 2); // integer division (e.g., 9 shades -> 4 steps each side, 5th is mid)

    // Calculate dynamic mid point HSL
    const midHSL = group.midHSL || {
      h: Math.round((group.startHSL.h + group.endHSL.h) / 2),
      s: Math.round((group.startHSL.s + group.endHSL.s) / 2),
      l: Math.round((group.startHSL.l + group.endHSL.l) / 2),
    };

    // Control points Segment A
    const ctrlStart = group.ctrlStartHSL || {
      h: Math.round(group.startHSL.h + (midHSL.h - group.startHSL.h) * 0.33),
      s: Math.round(group.startHSL.s + (midHSL.s - group.startHSL.s) * 0.33),
      l: Math.round(group.startHSL.l + (midHSL.l - group.startHSL.l) * 0.33),
    };

    const ctrlMidStart = group.ctrlMidStartHSL || {
      h: Math.round(group.startHSL.h + (midHSL.h - group.startHSL.h) * 0.66),
      s: Math.round(group.startHSL.s + (midHSL.s - group.startHSL.s) * 0.66),
      l: Math.round(group.startHSL.l + (midHSL.l - group.startHSL.l) * 0.66),
    };

    // Control points Segment B
    const ctrlMidEnd = group.ctrlMidEndHSL || {
      h: Math.round(midHSL.h + (group.endHSL.h - midHSL.h) * 0.33),
      s: Math.round(midHSL.s + (group.endHSL.s - midHSL.s) * 0.33),
      l: Math.round(midHSL.l + (group.endHSL.l - midHSL.l) * 0.33),
    };

    const ctrlEnd = group.ctrlEndHSL || {
      h: Math.round(midHSL.h + (group.endHSL.h - midHSL.h) * 0.66),
      s: Math.round(midHSL.s + (group.endHSL.s - midHSL.s) * 0.66),
      l: Math.round(midHSL.l + (group.endHSL.l - midHSL.l) * 0.66),
    };

    for (let i = 0; i < actualNumShades; i++) {
      const step = getStepLabel(i, actualNumShades);

      if (i < n) {
        // Curve Segment A
        const t = i / n;
        const interp = interpolate(group.startHSL, midHSL, t, 0, mode, ctrlStart, ctrlMidStart);
        shades.push({
          step,
          hsl: interp.hsl,
          rgb: interp.rgb,
          hex: interp.hex,
        });
      } else if (i === n) {
        // Absolute midpoint (color 500)
        const rgb = hslToRgb(midHSL.h, midHSL.s, midHSL.l);
        shades.push({
          step,
          hsl: midHSL,
          rgb,
          hex: rgbToHex(rgb.r, rgb.g, rgb.b),
        });
      } else {
        // Curve Segment B
        const t = (i - n) / n;
        const interp = interpolate(midHSL, group.endHSL, t, 0, mode, ctrlMidEnd, ctrlEnd);
        shades.push({
          step,
          hsl: interp.hsl,
          rgb: interp.rgb,
          hex: interp.hex,
        });
      }
    }
  } else {
    // Mode 1 ("linear") and Mode 2 ("handles_sliders")
    const dist = group.distribution ?? 0;
    const centerB = group.centerBias ?? 0;

    for (let i = 0; i < actualNumShades; i++) {
      const t = actualNumShades <= 1 ? 0.5 : i / (actualNumShades - 1);
      const step = getStepLabel(i, actualNumShades);

      // 1. Distribution Bias
      const pDist = Math.pow(2, dist / 50);
      let tBiased = Math.pow(t, pDist);

      // 2. Center Bias (Symmetrical power mapping)
      if (centerB !== 0) {
        const pCenter = Math.pow(2, -centerB / 50);
        if (tBiased < 0.5) {
          tBiased = 0.5 * Math.pow(2 * tBiased, pCenter);
        } else {
          tBiased = 1 - 0.5 * Math.pow(2 * (1 - tBiased), pCenter);
        }
      }

      let interp;
      if (settingsMode === 'handles_sliders') {
        interp = interpolate(
          group.startHSL,
          group.endHSL,
          tBiased,
          0,
          mode,
          group.ctrlStartHSL,
          group.ctrlEndHSL
        );
      } else {
        // Mode 1: Pure linear
        interp = interpolate(
          group.startHSL,
          group.endHSL,
          tBiased,
          0,
          mode
        );
      }

      shades.push({
        step,
        hsl: interp.hsl,
        rgb: interp.rgb,
        hex: interp.hex,
      });
    }
  }

  return shades;
}

// Preset Groups containing 26 colors with initial parameters tailored to Tailwind CSS palettes
export const PRESET_GROUPS: ColorGroup[] = [
  {
    id: 'group-slate',
    name: 'Slate',
    startHSL: { h: 210, s: 15, l: 96 },
    endHSL: { h: 215, s: 25, l: 12 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-gray',
    name: 'Gray',
    startHSL: { h: 220, s: 10, l: 96 },
    endHSL: { h: 220, s: 15, l: 12 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-zinc',
    name: 'Zinc',
    startHSL: { h: 240, s: 5, l: 96 },
    endHSL: { h: 240, s: 6, l: 10 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-neutral',
    name: 'Neutral',
    startHSL: { h: 0, s: 0, l: 98 },
    endHSL: { h: 0, s: 0, l: 10 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-stone',
    name: 'Stone',
    startHSL: { h: 30, s: 5, l: 96 },
    endHSL: { h: 30, s: 8, l: 12 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-red',
    name: 'Red',
    startHSL: { h: 0, s: 95, l: 96 },
    endHSL: { h: 350, s: 90, l: 15 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-orange',
    name: 'Orange',
    startHSL: { h: 24, s: 95, l: 95 },
    endHSL: { h: 16, s: 95, l: 15 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-amber',
    name: 'Amber',
    startHSL: { h: 48, s: 95, l: 94 },
    endHSL: { h: 28, s: 95, l: 15 },
    distribution: 10,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-yellow',
    name: 'Yellow',
    startHSL: { h: 54, s: 95, l: 94 },
    endHSL: { h: 40, s: 95, l: 15 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-lime',
    name: 'Lime',
    startHSL: { h: 84, s: 90, l: 94 },
    endHSL: { h: 100, s: 90, l: 15 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-green',
    name: 'Green',
    startHSL: { h: 140, s: 85, l: 95 },
    endHSL: { h: 155, s: 95, l: 12 },
    distribution: -15,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-emerald',
    name: 'Emerald',
    startHSL: { h: 150, s: 85, l: 95 },
    endHSL: { h: 165, s: 95, l: 12 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-teal',
    name: 'Teal',
    startHSL: { h: 174, s: 80, l: 94 },
    endHSL: { h: 182, s: 95, l: 12 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-cyan',
    name: 'Cyan',
    startHSL: { h: 190, s: 90, l: 95 },
    endHSL: { h: 195, s: 95, l: 15 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-sky',
    name: 'Sky',
    startHSL: { h: 200, s: 90, l: 96 },
    endHSL: { h: 205, s: 95, l: 15 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-blue',
    name: 'Blue',
    startHSL: { h: 215, s: 95, l: 96 },
    endHSL: { h: 224, s: 85, l: 15 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-indigo',
    name: 'Indigo',
    startHSL: { h: 230, s: 95, l: 96 },
    endHSL: { h: 240, s: 85, l: 15 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-violet',
    name: 'Violet',
    startHSL: { h: 255, s: 95, l: 96 },
    endHSL: { h: 265, s: 85, l: 15 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-purple',
    name: 'Purple',
    startHSL: { h: 270, s: 90, l: 96 },
    endHSL: { h: 275, s: 85, l: 15 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-fuchsia',
    name: 'Fuchsia',
    startHSL: { h: 290, s: 90, l: 95 },
    endHSL: { h: 295, s: 90, l: 15 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-pink',
    name: 'Pink',
    startHSL: { h: 320, s: 90, l: 95 },
    endHSL: { h: 330, s: 90, l: 15 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-rose',
    name: 'Rose',
    startHSL: { h: 345, s: 95, l: 95 },
    endHSL: { h: 355, s: 95, l: 15 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-bronze',
    name: 'Bronze',
    startHSL: { h: 35, s: 40, l: 95 },
    endHSL: { h: 25, s: 60, l: 12 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-gold',
    name: 'Gold',
    startHSL: { h: 45, s: 70, l: 95 },
    endHSL: { h: 35, s: 90, l: 15 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-brown',
    name: 'Brown',
    startHSL: { h: 28, s: 40, l: 95 },
    endHSL: { h: 18, s: 70, l: 10 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  },
  {
    id: 'group-crimson',
    name: 'Crimson',
    startHSL: { h: 345, s: 90, l: 96 },
    endHSL: { h: 340, s: 95, l: 12 },
    distribution: 0,
    centerBias: 0,
    settingsMode: 'linear',
  }
];

// Helper to calculate relative luminance of an RGB color
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const rs = r / 255;
  const gs = g / 255;
  const bs = b / 255;

  const R = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
  const G = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
  const B = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// Helper to calculate contrast ratio between two relative luminances
export function getContrastRatio(lum1: number, lum2: number): number {
  const l1 = Math.max(lum1, lum2);
  const l2 = Math.min(lum1, lum2);
  return (l1 + 0.05) / (l2 + 0.05);
}
