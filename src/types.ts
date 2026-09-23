export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface ColorGroup {
  id: string;
  name: string;
  startHSL: HSL;
  endHSL: HSL;
  distribution: number; // Single distribution bias (-100 to 100)
  centerBias?: number;   // Center bias (-100 to 100)
  settingsMode?: 'linear' | 'handles_sliders' | 'handles_center' | 'manual'; // Settings Mode
  numShades?: number;   // Number of shades for this group (optional, overrides global count)
  ctrlStartHSL?: HSL; // Bezier handle 1 (Start handle)
  ctrlEndHSL?: HSL;   // Bezier handle 2 (End handle)
  midHSL?: HSL;       // Middle node (500 shade) for mode 3
  ctrlMidStartHSL?: HSL; // Center point's left handle
  ctrlMidEndHSL?: HSL;   // Center point's right handle
  manualColors?: HSL[]; // Manually customized colors for 'manual' mode
}

export interface Palette {
  name: string;
  numShades: number;
  interpolationMode: 'hsl' | 'rgb';
  groups: ColorGroup[];
}

export interface GeneratedShade {
  step: number; // e.g., 100, 200...
  hsl: HSL;
  rgb: RGB;
  hex: string;
}

export interface GeneratedGroup {
  id: string;
  name: string;
  shades: GeneratedShade[];
}
