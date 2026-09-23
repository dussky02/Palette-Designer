import React, { useState, useMemo, useEffect } from 'react';
import { ColorGroup, GeneratedGroup, HSL, RGB } from './types';
import {
  PRESET_GROUPS,
  generateGroupShades,
  hslToRgb,
  rgbToHex,
  rgbToHsl,
  hexToHsl,
} from './utils';
import { ColorSpaceVisualizer } from './components/ColorSpaceVisualizer';
import { GlobalColorSpaceVisualizer3D } from './components/GlobalColorSpaceVisualizer3D';
import { ColorWheel } from './components/ColorWheel';
import {
  Sliders,
  Download,
  Upload,
  Plus,
  Trash2,
  Copy,
  Check,
  Settings,
  Moon,
  Sun,
  FileCode,
  FileJson,
  X,
  Layers,
  ChevronRight
} from 'lucide-react';

function HexInput({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [localVal, setLocalVal] = useState(value);
  useEffect(() => {
    setLocalVal(value);
  }, [value]);
  return (
    <input
      type="text"
      value={localVal}
      onChange={(e) => {
        const val = e.target.value;
        setLocalVal(val);
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          onChange(val);
        }
      }}
      placeholder="#FFFFFF"
      className="w-18 text-center text-xs font-mono bg-neutral-50 border border-neutral-200 rounded py-0.5 px-1 uppercase focus:outline-none focus:border-neutral-900 focus:bg-white"
    />
  );
}

export default function App() {
  // Global configuration states
  const [paletteName, setPaletteName] = useState<string>('My Custom Palette');
  const [numShades, setNumShades] = useState<number>(9);
  const [groups, setGroups] = useState<ColorGroup[]>(PRESET_GROUPS);
  
  // Navigation State: 'palette' or group ID
  const [activeTab, setActiveTab] = useState<string>('palette');

  // UI state
  const [canvasBackgroundMode, setCanvasBackgroundMode] = useState<'light' | 'dark'>('light');
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isRegenerateOpen, setIsRegenerateOpen] = useState<boolean>(false);
  const [tempGroupCount, setTempGroupCount] = useState<number>(PRESET_GROUPS.length);
  const [tempShadesCount, setTempShadesCount] = useState<number>(9);
  const [importJson, setImportJson] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'json' | 'css' | 'tailwind'>('json');
  const [expandedShadeIdx, setExpandedShadeIdx] = useState<number | null>(null);

  // Active group based on tab
  const activeGroup = useMemo(() => {
    if (activeTab === 'palette') return null;
    return groups.find((g) => g.id === activeTab) || null;
  }, [groups, activeTab]);

  // Generate shades for all groups
  const generatedPalette: GeneratedGroup[] = useMemo(() => {
    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      shades: generateGroupShades(group, group.numShades || numShades),
    }));
  }, [groups, numShades]);

  // Active group's shades
  const activeGroupShades = useMemo(() => {
    if (!activeGroup) return [];
    const generated = generatedPalette.find((g) => g.id === activeGroup.id);
    return generated ? generated.shades : [];
  }, [activeGroup, generatedPalette]);

  // Handle count of groups change (synchronizes with slider/input)
  const handleGroupCountChange = (count: number) => {
    const val = Math.max(2, Math.min(26, count));
    const currentCount = groups.length;
    if (val === currentCount) return;

    if (val < currentCount) {
      const updated = groups.slice(0, val);
      setGroups(updated);
      if (activeTab !== 'palette' && !updated.some((g) => g.id === activeTab)) {
        setActiveTab('palette');
      }
    } else {
      const updated = [...groups];
      for (let i = currentCount; i < val; i++) {
        if (PRESET_GROUPS[i]) {
          updated.push(PRESET_GROUPS[i]);
        } else {
          const h = (i * 13.8) % 360;
          updated.push({
            id: `group-${Date.now()}-${i}`,
            name: `Group ${i + 1}`,
            startHSL: { h, s: 90, l: 95 },
            endHSL: { h: (h + 15) % 360, s: 95, l: 15 },
            distribution: 0,
            centerBias: 0,
            settingsMode: 'linear',
          });
        }
      }
      setGroups(updated);
    }
  };

  // Add individual group
  const addGroup = () => {
    if (groups.length >= 26) return;
    const i = groups.length;
    let newGroup: ColorGroup;
    if (PRESET_GROUPS[i]) {
      newGroup = { ...PRESET_GROUPS[i], id: `group-${Date.now()}` };
    } else {
      const h = (i * 13.8) % 360;
      newGroup = {
        id: `group-${Date.now()}`,
        name: `Group ${i + 1}`,
        startHSL: { h, s: 90, l: 95 },
        endHSL: { h: (h + 15) % 360, s: 95, l: 15 },
        distribution: 0,
        centerBias: 0,
        settingsMode: 'linear',
      };
    }
    setGroups([...groups, newGroup]);
    setActiveTab(newGroup.id);
  };

  // Remove individual group
  const removeGroup = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent tab selection trigger
    if (groups.length <= 2) return;
    const updated = groups.filter((g) => g.id !== id);
    setGroups(updated);
    if (activeTab === id) {
      setActiveTab('palette');
    }
  };

  // Update group properties
  const updateGroup = (id: string, fields: Partial<ColorGroup>) => {
    setGroups(
      groups.map((g) => {
        if (g.id === id) {
          return { ...g, ...fields };
        }
        return g;
      })
    );
  };

  // Update individual coordinates directly in HSL
  const updateStartHSL = (id: string, hsl: HSL) => {
    updateGroup(id, { startHSL: hsl });
  };

  const updateEndHSL = (id: string, hsl: HSL) => {
    updateGroup(id, { endHSL: hsl });
  };

  const updateMidHSL = (id: string, hsl: HSL) => {
    updateGroup(id, { midHSL: hsl });
  };

  const updateManualColorHSL = (groupId: string, index: number, updatedHSL: Partial<HSL>) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    
    let currentManual = group.manualColors ? [...group.manualColors] : [];
    if (currentManual.length === 0) {
      const shades = generateGroupShades(group, group.numShades || numShades);
      currentManual = shades.map(s => ({ ...s.hsl }));
    }
    
    const oldHSL = currentManual[index] || { h: 0, s: 0, l: 0 };
    currentManual[index] = {
      h: Math.max(0, Math.min(360, updatedHSL.h !== undefined ? updatedHSL.h : oldHSL.h)),
      s: Math.max(0, Math.min(100, updatedHSL.s !== undefined ? updatedHSL.s : oldHSL.s)),
      l: Math.max(0, Math.min(100, updatedHSL.l !== undefined ? updatedHSL.l : oldHSL.l)),
    };
    
    updateGroup(groupId, { manualColors: currentManual, settingsMode: 'manual' });
  };

  const updateManualColorRGB = (groupId: string, index: number, updatedRGB: Partial<RGB>) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    
    let currentManual = group.manualColors ? [...group.manualColors] : [];
    if (currentManual.length === 0) {
      const shades = generateGroupShades(group, group.numShades || numShades);
      currentManual = shades.map(s => ({ ...s.hsl }));
    }
    
    const oldHSL = currentManual[index] || { h: 0, s: 0, l: 0 };
    const oldRGB = hslToRgb(oldHSL.h, oldHSL.s, oldHSL.l);
    
    const r = Math.max(0, Math.min(255, updatedRGB.r !== undefined ? updatedRGB.r : oldRGB.r));
    const g = Math.max(0, Math.min(255, updatedRGB.g !== undefined ? updatedRGB.g : oldRGB.g));
    const b = Math.max(0, Math.min(255, updatedRGB.b !== undefined ? updatedRGB.b : oldRGB.b));
    
    const newHSL = rgbToHsl(r, g, b);
    currentManual[index] = newHSL;
    
    updateGroup(groupId, { manualColors: currentManual, settingsMode: 'manual' });
  };

  const removeManualColorAtIndex = (groupId: string, index: number) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const currentCount = group.numShades || numShades;
    if (currentCount <= 3) return;

    let currentManual = group.manualColors ? [...group.manualColors] : [];
    if (currentManual.length === 0) {
      const shades = generateGroupShades(group, currentCount);
      currentManual = shades.map(s => ({ ...s.hsl }));
    }

    const nextManual = currentManual.filter((_, i) => i !== index);
    updateGroup(groupId, {
      numShades: currentCount - 1,
      manualColors: nextManual,
      settingsMode: 'manual'
    });
  };

  // Copy individual color hex to clipboard
  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  // Create full export data focusing purely on final HEX colors
  const exportData = useMemo(() => {
    return {
      paletteName,
      groups: generatedPalette.map((g) => ({
        name: g.name,
        colors: g.shades.map((s) => s.hex),
      })),
    };
  }, [paletteName, generatedPalette]);

  // Copy full exported content
  const [isExportCopied, setIsExportCopied] = useState<boolean>(false);
  const handleCopyExportText = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsExportCopied(true);
    setTimeout(() => setIsExportCopied(false), 2000);
  };

  // Generate CSS code for export
  const generatedCssText = useMemo(() => {
    let css = `/* CSS Variables for ${paletteName} */\n:root {\n`;
    generatedPalette.forEach((g) => {
      const nameKey = g.name.toLowerCase().replace(/\s+/g, '-');
      css += `  /* ${g.name} Group */\n`;
      g.shades.forEach((s) => {
        css += `  --color-${nameKey}-${s.step}: ${s.hex};\n`;
      });
      css += `\n`;
    });
    css += `}`;
    return css;
  }, [paletteName, generatedPalette]);

  // Generate Tailwind config code for export
  const generatedTailwindText = useMemo(() => {
    let tw = `// Tailwind CSS Color Extension for ${paletteName}\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n`;
    generatedPalette.forEach((g) => {
      const nameKey = g.name.toLowerCase().replace(/\s+/g, '-');
      tw += `        '${nameKey}': {\n`;
      g.shades.forEach((s) => {
        tw += `          '${s.step}': '${s.hex}',\n`;
      });
      tw += `        },\n`;
    });
    tw += `      }\n    }\n  }\n}`;
    return tw;
  }, [paletteName, generatedPalette]);

  // Download export data as JSON file
  const downloadJsonFile = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${paletteName.toLowerCase().replace(/\s+/g, '-')}-palette.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Handle Palette Import
  const handleImport = () => {
    try {
      const parsed = JSON.parse(importJson);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('JSON is not an object');
      }

      const importedGroups: ColorGroup[] = [];
      const configs = parsed.groups || parsed.config;

      if (!Array.isArray(configs)) {
        throw new Error('JSON structure must contain a "groups" array representing the color groups.');
      }

      configs.forEach((c: any, index: number) => {
        if (!c.name) {
          throw new Error(`Group at index ${index} is missing a "name" property.`);
        }

        let manualColors: HSL[] = [];

        // Parse hex colors list if present
        if (Array.isArray(c.colors)) {
          c.colors.forEach((hex: string) => {
            const hsl = hexToHsl(hex);
            if (hsl) {
              manualColors.push(hsl);
            } else {
              manualColors.push({ h: 0, s: 0, l: 50 });
            }
          });
        } else if (Array.isArray(c.manualColors)) {
          // Fallback if older structure is present
          manualColors = c.manualColors.map((m: any) => ({
            h: Number(m.h ?? 0),
            s: Number(m.s ?? 50),
            l: Number(m.l ?? 50),
          }));
        } else if (c.startHSL && c.endHSL) {
          // Fallback if only rules are provided but no individual colors
          manualColors = [];
        }

        const firstColor = manualColors[0] || { h: 0, s: 50, l: 95 };
        const lastColor = manualColors[manualColors.length - 1] || { h: 0, s: 50, l: 15 };

        importedGroups.push({
          id: `imported-group-${Date.now()}-${index}`,
          name: c.name,
          startHSL: c.startHSL ? {
            h: Number(c.startHSL.h ?? firstColor.h),
            s: Number(c.startHSL.s ?? firstColor.s),
            l: Number(c.startHSL.l ?? firstColor.l),
          } : firstColor,
          endHSL: c.endHSL ? {
            h: Number(c.endHSL.h ?? lastColor.h),
            s: Number(c.endHSL.s ?? lastColor.s),
            l: Number(c.endHSL.l ?? lastColor.l),
          } : lastColor,
          distribution: Number(c.distribution ?? 0),
          centerBias: c.centerBias !== undefined ? Number(c.centerBias) : undefined,
          settingsMode: 'manual', // Force manual color mode to display exact hex values
          manualColors: manualColors,
          midHSL: c.midHSL ? {
            h: Number(c.midHSL.h ?? 0),
            s: Number(c.midHSL.s ?? 50),
            l: Number(c.midHSL.l ?? 50),
          } : undefined,
        });
      });

      if (importedGroups.length === 0) {
        throw new Error('No valid color groups were found in the imported JSON.');
      }

      if (parsed.paletteName) {
        setPaletteName(parsed.paletteName);
      } else if (parsed.name) {
        setPaletteName(parsed.name);
      }

      // Infer shades count from imported lists
      if (importedGroups.length > 0 && importedGroups[0].manualColors.length > 0) {
        const detectedNumShades = importedGroups[0].manualColors.length;
        setNumShades(Math.max(3, Math.min(26, detectedNumShades)));
      }

      setGroups(importedGroups);
      setActiveTab('palette');
      setIsImportOpen(false);
      setImportJson('');
      setImportError(null);
    } catch (err: any) {
      setImportError(err.message || 'Malformed JSON. Please verify the fields.');
    }
  };

  // Preset Template loader
  const handleTemplateImport = (presetType: 'vk' | 'simple' | 'radix' | 'ibm' | 'tailwind') => {
    let templateData = '';
    if (presetType === 'vk') {
      templateData = JSON.stringify({
        paletteName: "VK Sub System Color Palette",
        groups: [
          { name: "VK Blue", colors: ["#d6ecff", "#97cfff", "#54b2ff", "#0095ff", "#0077ff", "#005eff", "#004dff", "#0037ed", "#0009b4"] },
          { name: "VK Purple", colors: ["#eedbfa", "#d4a5f3", "#ba6fec", "#a038e5", "#8024c0", "#6f16aa", "#5c128e", "#4a0f71", "#370b55"] },
          { name: "VK Lilac", colors: ["#f4e8fc", "#edd8fa", "#e2c0f8", "#d8a9f5", "#cd92f2", "#c279ef", "#ab47e9", "#8317c6", "#621195"] },
          { name: "VK Violet", colors: ["#fde3ff", "#fcd0ff", "#fab3ff", "#f897ff", "#f679ff", "#f45fff", "#f12aff", "#b000bd", "#7e0087"] },
          { name: "VK Fuchsia", colors: ["#ffd3fe", "#ffb6fd", "#ff8afb", "#ff5ffa", "#ff34f8", "#ff07f7", "#db00d3", "#990094", "#6d006a"] },
          { name: "VK Pink", colors: ["#ffdaf0", "#ffc1e6", "#ff9cd7", "#ff77c9", "#ff52b9", "#ff22a6", "#f00090", "#a80065", "#780048"] },
          { name: "VK Magenta", colors: ["#ffd4e5", "#ffb8d3", "#ff8db9", "#ff639f", "#ff3985", "#ff0c69", "#de0055", "#b20044", "#850033"] },
          { name: "VK Red", colors: ["#fad1d1", "#ffb7be", "#ff8b97", "#ff4c63", "#ff2045", "#f50029", "#e00025", "#b8001f", "#7a0014"] },
          { name: "VK Coral", colors: ["#ffe4dc", "#ffd1c5", "#ffb6a2", "#ff9b7f", "#ff7e5b", "#ff582a", "#f83600", "#b6321d", "#79210b"] },
          { name: "VK Light Salmon", colors: ["#ffede6", "#ffe0d5", "#ffcebc", "#ffbba3", "#ffaa8a", "#ff8356", "#ff5d22", "#b63c23", "#823118"] },
          { name: "VK Orange", colors: ["#ffe8c8", "#ffd9a4", "#ffc26d", "#ffac37", "#ff9500", "#ff7500", "#ff5500", "#b62f00", "#7c2100"] },
          { name: "VK Golden", colors: ["#fff7cf", "#fff2af", "#ffea7f", "#ffe24f", "#ffd91d", "#f5cc00", "#ccaa00", "#7f6a00", "#524400"] },
          { name: "VK Titanium", colors: ["#ffffd8", "#ffffad", "#ffff4d", "#f0f000", "#dddd00", "#cccc00", "#acac00", "#6e7700", "#4e4e00"] },
          { name: "VK Chartreuse", colors: ["#faffda", "#f5ffb5", "#f0ff90", "#e9ff58", "#dcfc00", "#c9e800", "#aac400", "#6c7d00", "#4d5900"] },
          { name: "VK Bitter Lemon", colors: ["#f2ffc3", "#e5ff87", "#d4ff37", "#c3fa00", "#b6e600", "#a7d500", "#8db400", "#5a7300", "#405200"] },
          { name: "VK Pistachio", colors: ["#e1f6de", "#ccf0c8", "#aee8a8", "#90df87", "#72d667", "#50cd42", "#3db22f", "#2a7d21", "#1e5918"] },
          { name: "VK Neon Green", colors: ["#dafed8", "#b6fdb2", "#91fd8b", "#11f905", "#11e605", "#0fd504", "#0db004", "#087302", "#065202"] },
          { name: "VK Green", colors: ["#b9f8de", "#96f5cd", "#61efb4", "#1be893", "#17d685", "#14cb7e", "#11ab6b", "#0c7d4e", "#095d3a"] },
          { name: "VK Aquamarine", colors: ["#dbfff9", "#c8fff6", "#a4fff0", "#6dffe7", "#0bfdd4", "#00edc5", "#00c8a7", "#00806a", "#005b4c"] },
          { name: "VK Light Blue", colors: ["#dbfcff", "#b6f9ff", "#92f6ff", "#5bf1ff", "#00eaff", "#00d9ed", "#00b8c8", "#007580", "#00535b"] },
          { name: "VK Blizzard Blue", colors: ["#e8f7f8", "#d8f2f3", "#c1eaeb", "#aae3e4", "#93dbdc", "#6ccecf", "#44c0c2", "#277577", "#1a4e4f"] },
          { name: "VK W. Grey", colors: ["#f2f0ee", "#e9e5e2", "#dbd6d1", "#cec6c0", "#beb6ae", "#a99d92", "#928274", "#675b51", "#49413a"] }
        ]
      }, null, 2);
    } else if (presetType === 'simple') {
      templateData = JSON.stringify({
        paletteName: "Simple Design System Color Primitives",
        groups: [
          {
            name: "Green",
            colors: ["#ebffee", "#cff7d3", "#aff4c6", "#85e0a3", "#14ae5c", "#009951", "#008043", "#02542d", "#024023", "#062d1b"]
          },
          {
            name: "Gray",
            colors: ["#f5f5f5", "#e6e6e6", "#d9d9d9", "#b3b3b3", "#757575", "#444444", "#383838", "#2c2c2c", "#1e1e1e", "#111111"]
          },
          {
            name: "Pink",
            colors: ["#fcf1fd", "#fae1fa", "#f5c0ef", "#f19edc", "#ea3fb8", "#d732a8", "#ba2a92", "#8a226f", "#57184a", "#3f1536"]
          },
          {
            name: "Red",
            colors: ["#fee9e7", "#fdd3d0", "#fcb3ad", "#f4776a", "#ec221f", "#c00f0c", "#900b09", "#690807", "#4d0b0a", "#300603"]
          },
          {
            name: "Slate",
            colors: ["#f3f3f3", "#e3e3e3", "#cdcdcd", "#b2b2b2", "#949494", "#767676", "#5a5a5a", "#434343", "#303030", "#242424"]
          },
          {
            name: "Yellow",
            colors: ["#fffbeb", "#fff1c2", "#ffe8a3", "#e8b931", "#e5a000", "#bf6a02", "#975102", "#682d03", "#522504", "#401b01"]
          },
          {
            name: "Blue",
            colors: ["#f1f6fd", "#e1ebfa", "#c0d4f5", "#9ebef1", "#3f81ea", "#3271d7", "#2a61ba", "#224a8a", "#183057", "#15253f"]
          }
        ]
      }, null, 2);
    } else if (presetType === 'radix') {
      templateData = JSON.stringify({
        paletteName: "Radix UI System",
        groups: [
          { name: "Gray", colors: ["#fcffff", "#f9f9f9", "#f0f0f0", "#e8e8e8", "#e0e0e0", "#d9d9d9", "#cecece", "#bbbbbb", "#8d8d8d", "#838383", "#646464", "#202020"] },
          { name: "Tomato", colors: ["#fffefd", "#fff4f0", "#ffe3da", "#ffd1c4", "#ffbeb0", "#ffaa99", "#fc917a", "#e54d2e", "#ec5f42", "#e54d2e", "#c93b1d", "#5c1809"] },
          { name: "Red", colors: ["#fffcfc", "#ffefe0", "#ffdcd6", "#ffc3b8", "#ffaa9e", "#ff8b82", "#f2645f", "#e5484d", "#ec5e62", "#e5484d", "#c9252d", "#640914"] },
          { name: "Ruby", colors: ["#fffcfd", "#ffeff3", "#ffdbe4", "#ffc1cf", "#ffaabf", "#ff8bad", "#f3648a", "#e54673", "#ec5a81", "#e54673", "#c91e4b", "#620924"] },
          { name: "Crimson", colors: ["#fffcfd", "#ffeff6", "#ffdce8", "#ffc0d9", "#ffaacf", "#ff8bc0", "#f462a6", "#e93d82", "#ee518e", "#e93d82", "#cd125d", "#64042f"] },
          { name: "Pink", colors: ["#fffdfd", "#ffeffa", "#ffdceb", "#ffbfe0", "#ffa9d6", "#ff8bc5", "#f562ae", "#ea3e97", "#ef51a1", "#ea3e97", "#cc1d7a", "#620536"] },
          { name: "Plum", colors: ["#fffdfd", "#fdf4ff", "#fbe7ff", "#f7cfff", "#f1bdfa", "#ea9ff5", "#dd7eeb", "#ab4aba", "#b955c8", "#ab4aba", "#8e2d9a", "#4d1252"] },
          { name: "Purple", colors: ["#fefdfe", "#faf5ff", "#f5ebff", "#ebd6ff", "#dfbcfd", "#d09ef7", "#be79df", "#8f44be", "#9d50cb", "#8f44be", "#732c9e", "#3f115a"] },
          { name: "Violet", colors: ["#fdfdfe", "#faf5ff", "#f4ebff", "#e6d6ff", "#d5bcfe", "#c09efc", "#a879f5", "#6e44be", "#7d50cb", "#6e44be", "#572c9e", "#2f115a"] },
          { name: "Iris", colors: ["#fdfdfe", "#faf6ff", "#f2eaff", "#e3d6ff", "#cfbcfe", "#b49efc", "#9679f5", "#5b44be", "#6d50cb", "#5b44be", "#492c9e", "#24115a"] },
          { name: "Indigo", colors: ["#fbfdff", "#f5faff", "#edf6ff", "#e1f0ff", "#cee7fe", "#b7d9f8", "#96c7f2", "#5eb0ef", "#0091ff", "#0081f1", "#006adc", "#00254d"] },
          { name: "Blue", colors: ["#fbfdff", "#f5faff", "#edf6ff", "#e1f0ff", "#cee7fe", "#b7d9f8", "#96c7f2", "#5eb0ef", "#0091ff", "#0081f1", "#006adc", "#00254d"] },
          { name: "Cyan", colors: ["#fafefe", "#f2fcfd", "#e6f8fa", "#d3f1f5", "#bee5eb", "#a1d4dd", "#7cc0cc", "#00a2c7", "#3db9d3", "#00a2c7", "#0080a3", "#003140"] },
          { name: "Teal", colors: ["#fafefe", "#f1fcfb", "#e4f9f7", "#cef1ee", "#b8e4e0", "#9cd4ce", "#76c1b8", "#12a594", "#30bca6", "#12a594", "#048477", "#00302b"] },
          { name: "Jade", colors: ["#fbfefd", "#f2fcf7", "#e4f8ee", "#cdf1dc", "#b7e4c7", "#9cd4b0", "#75c091", "#29a35a", "#3eb972", "#29a35a", "#1b8343", "#002f13"] },
          { name: "Green", colors: ["#fbfefc", "#f2fcf5", "#e5f8eb", "#d1f0db", "#b9e4c5", "#9cd4aa", "#72c088", "#46a758", "#5bb974", "#46a758", "#3b8e4c", "#143118"] },
          { name: "Grass", colors: ["#fcfefc", "#f4fcf6", "#e7f8ec", "#d4f0db", "#bde4c5", "#a2d4ad", "#7cc08d", "#46a758", "#5bb974", "#46a758", "#3b8e4c", "#123118"] },
          { name: "Lime", colors: ["#fdfefb", "#f8faf2", "#eff5e3", "#e0ebd0", "#cfdfb8", "#bcd09b", "#a2bf7c", "#82a651", "#93b561", "#82a651", "#68893c", "#293414"] },
          { name: "Mint", colors: ["#fafefe", "#f2fcf9", "#e5f8f3", "#cdf1e7", "#b6e4d7", "#9ad4c3", "#74c1ab", "#1ab394", "#34c3a7", "#1ab394", "#0d8f74", "#003024"] },
          { name: "Sky", colors: ["#fbfdff", "#f2fafc", "#e5f4f8", "#cbe9f0", "#b3dde6", "#94ccd7", "#72bccb", "#10b1d3", "#3fc1dd", "#10b1d3", "#088fae", "#002f3d"] },
          { name: "Amber", colors: ["#fefdfb", "#fef9ec", "#fdf2d0", "#fbe5a2", "#f8d875", "#f4c63f", "#ecb100", "#ffc53d", "#ffc53d", "#e1a700", "#ad7f00", "#4e3600"] },
          { name: "Orange", colors: ["#fefdfb", "#fff6ee", "#ffe9d5", "#ffbe40", "#ffd3a6", "#ffba75", "#fa9b50", "#f76b15", "#ff843d", "#f76b15", "#d65103", "#5a2000"] },
          { name: "Yellow", colors: ["#fefefe", "#fdfce3", "#faf7be", "#f5f19c", "#efe974", "#e4dc50", "#d4c82b", "#ffd600", "#ffe629", "#ffd600", "#e0b300", "#4d3b00"] },
          { name: "Bronze", colors: ["#fdfdfc", "#f8f7f6", "#f1ebe9", "#e6dfdc", "#ded5d1", "#d5cac4", "#c8b8b0", "#a18072", "#9c8276", "#8d7367", "#70594f", "#241f1c"] },
          { name: "Gold", colors: ["#fdfdfc", "#f9f8f6", "#f2eeea", "#e7e1d9", "#ded5c9", "#d5c8b7", "#c8b7a1", "#a18053", "#9b8364", "#8c7453", "#705d42", "#24201a"] },
          { name: "Brown", colors: ["#fefdfb", "#f9f6f3", "#f1ebe5", "#e6dbd1", "#ded1c4", "#d5c2b2", "#c8ad9a", "#ad7a5c", "#ad7f58", "#986443", "#7c4e30", "#271a10"] }
        ]
      }, null, 2);
    } else if (presetType === 'ibm') {
      templateData = JSON.stringify({
        paletteName: "IBM Carbon Design",
        groups: [
          { name: "IBM Blue", colors: ["#edf5ff", "#d0e2ff", "#a6c8ff", "#78a9ff", "#4589ff", "#0f62fe", "#0043ce", "#002d9c", "#001d6c", "#001141"] },
          { name: "IBM Teal", colors: ["#d9fbfb", "#9ef0f0", "#3ddbd9", "#08bdba", "#009d9a", "#007d79", "#005d5d", "#004144", "#022b30", "#081a1c"] },
          { name: "IBM Magenta", colors: ["#fff0f7", "#ffd6e8", "#ffafd2", "#ff7eb6", "#ee5396", "#d02670", "#9f1853", "#740937", "#510224", "#2a0011"] },
          { name: "IBM Red", colors: ["#fff1f1", "#ffd0d0", "#ffb3b3", "#ff8383", "#fa4d56", "#da1e28", "#a2191f", "#750e13", "#520408", "#2d0002"] },
          { name: "IBM Purple", colors: ["#f6f2ff", "#e8daff", "#d4bbff", "#be95ff", "#a56eff", "#8a3ffc", "#6929c4", "#491d8b", "#31135e", "#1c0f30"] },
          { name: "IBM Cyan", colors: ["#e5f6ff", "#bae6ff", "#82cfff", "#33b1ff", "#1192e8", "#0072c3", "#00539a", "#003a6d", "#012749", "#00122c"] },
          { name: "IBM Green", colors: ["#defbe6", "#a7f5b1", "#6fdc7f", "#30b44a", "#24a148", "#198038", "#0e6027", "#044317", "#022d0f", "#011707"] },
          { name: "IBM Orange", colors: ["#fff2e8", "#ffd4b2", "#ffb37a", "#ff8f3d", "#fa6400", "#e15400", "#b23e00", "#8a2a00", "#5e1a00", "#330c00"] },
          { name: "IBM Yellow", colors: ["#fcf6bd", "#fce985", "#fcdf3c", "#fcd116", "#fcc203", "#e19a00", "#b77c00", "#8e5d00", "#633f00", "#382300"] },
          { name: "IBM Gray", colors: ["#f4f4f4", "#e0e0e0", "#c6c6c6", "#a8a8a8", "#8d8d8d", "#6f6f6f", "#525252", "#393939", "#262626", "#161616"] },
          { name: "IBM Cool Gray", colors: ["#f2f4f8", "#dde1e6", "#c1c7cd", "#a2a9b0", "#878d96", "#697077", "#4d5358", "#343a40", "#21272a", "#121619"] },
          { name: "IBM Warm Gray", colors: ["#f7f3f2", "#e5e0df", "#cac5c4", "#ada8a6", "#8f8b8a", "#726e6d", "#565251", "#3c3837", "#272424", "#171414"] }
        ]
      }, null, 2);
    } else if (presetType === 'tailwind') {
      templateData = JSON.stringify({
        paletteName: "Tailwind CSS Palette",
        groups: [
          { name: "Tailwind Slate", colors: ["#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a", "#0c1422"] },
          { name: "Tailwind Gray", colors: ["#f9fafb", "#f3f4f6", "#e5e7eb", "#d1d5db", "#9ca3af", "#6b7280", "#4b5563", "#374151", "#1f2937", "#111827", "#030712"] },
          { name: "Tailwind Zinc", colors: ["#fafafa", "#f4f4f5", "#e4e4e7", "#d4d4d8", "#a1a1aa", "#71717a", "#52525b", "#3f3f46", "#27272a", "#18181b", "#09090b"] },
          { name: "Tailwind Neutral", colors: ["#fafafa", "#f5f5f5", "#e5e5e5", "#d4d4d4", "#a1a1a1", "#737373", "#525252", "#404040", "#262626", "#171717", "#0a0a0a"] },
          { name: "Tailwind Stone", colors: ["#fafaf9", "#f5f5f4", "#e7e5e4", "#d6d3d1", "#a8a29e", "#78716c", "#57534e", "#44403c", "#292524", "#1c1917", "#0c0a09"] },
          { name: "Tailwind Red", colors: ["#fef2f2", "#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ef4444", "#dc2626", "#b91c1c", "#991b1b", "#7f1d1d", "#450a0a"] },
          { name: "Tailwind Orange", colors: ["#fff7ed", "#ffedd5", "#fed7aa", "#fdbb74", "#f97316", "#ea580c", "#c2410c", "#9a3412", "#7c2d12", "#431407", "#2d0b00"] },
          { name: "Tailwind Amber", colors: ["#fffbeb", "#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f", "#451a03"] },
          { name: "Tailwind Yellow", colors: ["#fefce8", "#fef9c3", "#fef08a", "#fde047", "#facc15", "#eab308", "#ca8a04", "#a16207", "#854d0e", "#713f12", "#422006"] },
          { name: "Tailwind Lime", colors: ["#f7fee7", "#ecfccb", "#d9f99d", "#bef264", "#a3e635", "#84cc16", "#65a30d", "#4d7c0f", "#3f6212", "#1a2e05", "#101803"] },
          { name: "Tailwind Green", colors: ["#f0fdf4", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#22c55e", "#16a34a", "#15803d", "#166534", "#14532d", "#06220e"] },
          { name: "Tailwind Emerald", colors: ["#ecfdf5", "#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#059669", "#047857", "#065f46", "#064e3b", "#022c22"] },
          { name: "Tailwind Teal", colors: ["#f0fdfa", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#0f766e", "#115e59", "#134e4a", "#042f2e"] },
          { name: "Tailwind Cyan", colors: ["#ecfeff", "#cffafe", "#a5f3fc", "#67e8f9", "#22d3ee", "#06b6d4", "#0891b2", "#0e7490", "#155e75", "#164e63", "#083344"] },
          { name: "Tailwind Sky", colors: ["#f0f9ff", "#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7", "#0369a1", "#075985", "#0c4a6e", "#082f49"] },
          { name: "Tailwind Blue", colors: ["#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a", "#172554"] },
          { name: "Tailwind Indigo", colors: ["#eef2ff", "#e0e7ff", "#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#4338ca", "#3730a3", "#312e81", "#1e1b4b"] },
          { name: "Tailwind Violet", colors: ["#f5f3ff", "#ede9fe", "#ddd6ff", "#c4b4ff", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#2e1065"] },
          { name: "Tailwind Purple", colors: ["#faf5ff", "#f3e8ff", "#e9d5ff", "#d8b4fe", "#c084fc", "#a855f7", "#9333ea", "#7e22ce", "#6b21a8", "#581c87", "#3b0764"] },
          { name: "Tailwind Fuchsia", colors: ["#fdf4ff", "#fae8ff", "#f5d0fe", "#f0abfc", "#e879f9", "#d946ef", "#c026d3", "#a21caf", "#86198f", "#701a75", "#4a044e"] },
          { name: "Tailwind Pink", colors: ["#fdf2f8", "#fce7f3", "#fbcfe8", "#f472b6", "#ec4899", "#db2777", "#be185d", "#9d174d", "#831843", "#500724", "#2d0013"] },
          { name: "Tailwind Rose", colors: ["#fff1f2", "#ffe4e6", "#fecdd3", "#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#be123c", "#9f1239", "#881337", "#4c0519"] }
        ]
      }, null, 2);
    }
    setImportJson(templateData);
    setImportError(null);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans flex flex-col selection:bg-neutral-200">
      {/* Toast Notification */}
      {copiedColor && (
        <div id="copied-toast" className="fixed bottom-6 right-6 z-50 bg-neutral-950 text-neutral-50 border border-neutral-800 py-3 px-5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-mono animate-bounce">
          <Check size={14} className="text-emerald-400" />
          <span>Hex copied to clipboard: <strong className="text-emerald-400">{copiedColor}</strong></span>
        </div>
      )}

      {/* Header section */}
      <header className="bg-white border-b border-neutral-200 py-4 px-6 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-neutral-900 text-neutral-50 rounded-xl">
              <Layers size={22} />
            </div>
            <div>
              <input
                id="palette-name-input"
                type="text"
                value={paletteName}
                onChange={(e) => setPaletteName(e.target.value)}
                className="text-lg font-bold text-neutral-900 bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-neutral-900 focus:outline-none transition-all px-1"
                placeholder="Palette Name"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              id="btn-regenerate-palette-trigger"
              onClick={() => {
                setTempGroupCount(groups.length);
                setTempShadesCount(numShades);
                setIsRegenerateOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-all cursor-pointer"
            >
              <Sliders size={14} />
              <span>Regenerate</span>
            </button>
            <button
              id="btn-import-modal"
              onClick={() => {
                setImportError(null);
                setIsImportOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-all cursor-pointer"
            >
              <Upload size={14} />
              <span>Import</span>
            </button>
            <button
              id="btn-export-modal"
              onClick={() => setIsExportOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-50 transition-all shadow-xs cursor-pointer"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Full-Width Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        
        {/* Main Content Area */}
        <main className="flex flex-col gap-6" id="workspace-content">
          
          {/* ================= CASE 1: GLOBAL PALETTE SCREEN ================= */}
          {activeTab === 'palette' && (
            <>
              {/* GLOBAL 3D PALETTE VISUALIZER */}
              <GlobalColorSpaceVisualizer3D 
                palette={generatedPalette} 
                groups={groups}
                updateGroup={updateGroup}
              />

              {/* OUTPUT SHADE GRID PREVIEW */}
              <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs flex-1 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-neutral-100">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      id="btn-add-group-grid"
                      onClick={addGroup}
                      disabled={groups.length >= 26}
                      title={groups.length >= 26 ? "Maximum limit of 26 color groups reached" : "Add a new color group"}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-neutral-900 hover:bg-neutral-850 text-white transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-auto disabled:cursor-not-allowed shadow-xs"
                    >
                      <Plus size={13} />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Generated Rows Container */}
                <div
                  className={`flex-1 p-4 rounded-xl border transition-all flex flex-col gap-6 ${
                    canvasBackgroundMode === 'dark'
                      ? 'bg-neutral-950 border-neutral-800 text-neutral-100'
                      : 'bg-neutral-50/50 border-neutral-200 text-neutral-900'
                  }`}
                  id="shades-preview-canvas"
                >
                  {generatedPalette.map((group) => (
                    <div key={group.id} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between px-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveTab(group.id)}
                          className="flex items-center gap-1.5 text-xs font-bold font-mono tracking-wide text-neutral-700 hover:text-neutral-950 hover:underline text-left cursor-pointer transition-all bg-transparent border-0 p-0"
                          title={`Click to configure and edit ${group.name}`}
                        >
                          <span className="flex items-center gap-1">
                            {group.name}
                            <ChevronRight size={13} className="text-neutral-400 inline" />
                          </span>
                        </button>
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {group.shades.length} shades
                          </span>
                          <button
                            id={`btn-delete-group-${group.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeGroup(group.id, e);
                            }}
                            disabled={groups.length <= 2}
                            className="p-1 text-neutral-400 hover:text-red-500 disabled:opacity-30 rounded transition-all cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
                            title={groups.length <= 2 ? "Minimum of 2 color groups required" : "Delete this color group"}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Flex wrapper for shades */}
                      <div className="flex w-full gap-0 rounded-xl overflow-hidden border border-neutral-200/40">
                        {group.shades.map((shade) => {
                          const isTextColorLight = shade.hsl.l < 55;
                          const textColorClass = isTextColorLight ? 'text-white' : 'text-neutral-950';
                          const subColorClass = isTextColorLight ? 'text-white/75' : 'text-neutral-900/60';

                          return (
                            <button
                              key={`${group.id}-${shade.step}`}
                              id={`color-block-${group.name}-${shade.step}`}
                              onClick={() => copyToClipboard(shade.hex)}
                              className="flex-1 h-32 relative group flex flex-col justify-between p-2.5 transition-all hover:scale-y-110 hover:z-10 active:opacity-90 border-0 outline-hidden cursor-pointer"
                              style={{
                                backgroundColor: shade.hex,
                              }}
                              title={`Click to copy: ${shade.hex}`}
                            >
                              <div className={`text-[9px] font-bold font-mono self-start opacity-80 ${textColorClass}`}>
                                {shade.step}
                              </div>

                              <div className="w-full flex flex-col items-start gap-0.5 text-[7px] font-mono leading-none tracking-tight">
                                <span className={`font-semibold ${textColorClass}`}>{shade.hex}</span>
                                <span className={subColorClass}>H:{shade.hsl.h} L:{shade.hsl.l} S:{shade.hsl.s}</span>
                                <span className={subColorClass}>R:{shade.rgb.r} G:{shade.rgb.g} B:{shade.rgb.b}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ================= CASE 2: SINGLE GROUP SETTINGS SCREEN ================= */}
          {activeTab !== 'palette' && activeGroup && (
            <>
              {/* BACK TO PALETTE NAVIGATION BUTTON ROW */}
              <div className="flex flex-col gap-2 pb-2">
                <div>
                  <button
                    id="btn-back-to-palette"
                    onClick={() => setActiveTab('palette')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-all shadow-xs cursor-pointer"
                  >
                    <span className="mr-0.5">←</span>
                    <span>Back</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={activeGroup.name}
                    onChange={(e) => updateGroup(activeGroup.id, { name: e.target.value })}
                    className="text-xl font-bold text-neutral-800 bg-transparent border-b border-transparent hover:border-neutral-200 focus:border-neutral-900 focus:bg-white focus:px-2 focus:py-1 rounded transition-all focus:outline-none min-w-[240px]"
                    placeholder="Enter Group Name..."
                    title="Edit Group Name"
                  />
                </div>
              </div>

              {/* CURRENT GROUP QUICK PREVIEW BAR */}
              <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs" id="group-shades-preview">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Shades
                  </h3>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {activeGroupShades.length} shades
                  </span>
                </div>

                <div className="flex w-full gap-0 rounded-xl overflow-hidden border border-neutral-200/40">
                  {activeGroupShades.map((shade) => {
                    const isTextColorLight = shade.hsl.l < 55;
                    const textColorClass = isTextColorLight ? 'text-white' : 'text-neutral-950';
                    const subColorClass = isTextColorLight ? 'text-white/75' : 'text-neutral-900/60';

                    return (
                      <button
                        key={`preview-${shade.step}`}
                        onClick={() => copyToClipboard(shade.hex)}
                        className="flex-1 h-32 relative group flex flex-col justify-between p-2.5 transition-all hover:scale-y-110 hover:z-10 active:opacity-90 border-0 outline-hidden cursor-pointer"
                        style={{ backgroundColor: shade.hex }}
                        title={`Copy HEX: ${shade.hex}`}
                      >
                        <span className={`text-[9px] font-mono font-bold ${textColorClass}`}>
                          {shade.step}
                        </span>
                        
                        <div className="w-full flex flex-col items-start gap-0.5 text-[7px] font-mono leading-none tracking-tight">
                          <span className={`font-semibold ${textColorClass}`}>{shade.hex}</span>
                          <span className={subColorClass}>H:{shade.hsl.h} L:{shade.hsl.l} S:{shade.hsl.s}</span>
                          <span className={subColorClass}>R:{shade.rgb.r} G:{shade.rgb.g} B:{shade.rgb.b}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* GROUP SETTINGS CARD */}
              <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <Sliders size={16} className="text-neutral-500" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Settings
                    </h2>
                  </div>
                </div>

                {/* MODE SELECTION SWITCHER */}
                <div className="flex flex-col gap-2 bg-neutral-50/50 p-4 rounded-xl border border-neutral-200/50">
                  <span className="text-xs font-bold text-neutral-700 block">
                    Edit Mode
                  </span>
                  <div className="flex flex-col sm:flex-row gap-2 bg-neutral-100 p-1 rounded-xl border border-neutral-200/40">
                    <button
                       type="button"
                       id="mode-linear"
                       onClick={() => {
                         const updates: Partial<ColorGroup> = { settingsMode: 'linear' };
                         if (activeGroup.settingsMode === 'manual' && activeGroup.manualColors && activeGroup.manualColors.length >= 2) {
                           updates.startHSL = { ...activeGroup.manualColors[0] };
                           updates.endHSL = { ...activeGroup.manualColors[activeGroup.manualColors.length - 1] };
                         }
                         updateGroup(activeGroup.id, updates);
                       }}
                       className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
                         (activeGroup.settingsMode || 'linear') === 'linear'
                           ? 'bg-white text-neutral-900 shadow-xs'
                           : 'text-neutral-500 hover:text-neutral-800'
                       }`}
                    >
                      Linear
                    </button>
                    <button
                       type="button"
                       id="mode-handles-sliders"
                       onClick={() => {
                         const updates: Partial<ColorGroup> = { settingsMode: 'handles_sliders' };
                         if (activeGroup.settingsMode === 'manual' && activeGroup.manualColors && activeGroup.manualColors.length >= 2) {
                           updates.startHSL = { ...activeGroup.manualColors[0] };
                           updates.endHSL = { ...activeGroup.manualColors[activeGroup.manualColors.length - 1] };
                         }
                         updateGroup(activeGroup.id, updates);
                       }}
                       className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
                         activeGroup.settingsMode === 'handles_sliders'
                           ? 'bg-white text-neutral-900 shadow-xs'
                           : 'text-neutral-500 hover:text-neutral-800'
                       }`}
                    >
                      Bezier
                    </button>
                    <button
                       type="button"
                       id="mode-handles-center"
                       onClick={() => {
                         const currentCount = activeGroup.numShades || numShades;
                         let oddCount = currentCount;
                         if (oddCount % 2 === 0) {
                           oddCount = Math.max(3, oddCount + 1);
                         }
                         const updates: Partial<ColorGroup> = { settingsMode: 'handles_center', numShades: oddCount };
                         if (activeGroup.settingsMode === 'manual' && activeGroup.manualColors && activeGroup.manualColors.length >= 2) {
                           updates.startHSL = { ...activeGroup.manualColors[0] };
                           updates.endHSL = { ...activeGroup.manualColors[activeGroup.manualColors.length - 1] };
                           const midIdx = Math.floor(activeGroup.manualColors.length / 2);
                           updates.midHSL = { ...activeGroup.manualColors[midIdx] };
                         }
                         updateGroup(activeGroup.id, updates);
                       }}
                       className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
                         activeGroup.settingsMode === 'handles_center'
                           ? 'bg-white text-neutral-900 shadow-xs'
                           : 'text-neutral-500 hover:text-neutral-800'
                       }`}
                    >
                      Midpoint Bezier
                    </button>
                    <button
                       type="button"
                       id="mode-manual"
                       onClick={() => {
                         const initialManual = activeGroupShades && activeGroupShades.length > 0 
                           ? activeGroupShades.map(s => ({ ...s.hsl })) 
                           : [];
                         updateGroup(activeGroup.id, { settingsMode: 'manual', manualColors: initialManual });
                       }}
                       className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
                         activeGroup.settingsMode === 'manual'
                           ? 'bg-white text-neutral-900 shadow-xs'
                           : 'text-neutral-500 hover:text-neutral-800'
                       }`}
                    >
                      Manual
                    </button>
                  </div>
                </div>

                {/* Under Edit Mode Controls Row */}
                <div className="w-full">
                  {/* Coordinates depending on edit mode */}
                  {activeGroup.settingsMode !== 'manual' ? (
                    <div className={`grid grid-cols-1 ${activeGroup.settingsMode === 'handles_center' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
                      {/* Start Point Coordinate Pickers */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-neutral-700">
                          Start Color (HSL)
                        </label>
                        <div className="flex gap-1.5">
                          <div className="flex-1 flex flex-col items-center">
                            <input
                              id="start-h"
                              type="number"
                              min="0"
                              max="360"
                              value={activeGroup.startHSL.h}
                              onChange={(e) => updateStartHSL(activeGroup.id, { ...activeGroup.startHSL, h: Number(e.target.value) })}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-1.5 text-center font-mono text-xs focus:outline-none focus:border-neutral-900 focus:bg-white"
                              title="Hue (0-360)"
                            />
                            <span className="text-[9px] text-neutral-400 mt-0.5">H</span>
                          </div>
                          <div className="flex-1 flex flex-col items-center">
                            <input
                              id="start-s"
                              type="number"
                              min="0"
                              max="100"
                              value={activeGroup.startHSL.s}
                              onChange={(e) => updateStartHSL(activeGroup.id, { ...activeGroup.startHSL, s: Number(e.target.value) })}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-1.5 text-center font-mono text-xs focus:outline-none focus:border-neutral-900 focus:bg-white"
                              title="Saturation (0-100)"
                            />
                            <span className="text-[9px] text-neutral-400 mt-0.5">S%</span>
                          </div>
                          <div className="flex-1 flex flex-col items-center">
                            <input
                              id="start-l"
                              type="number"
                              min="0"
                              max="100"
                              value={activeGroup.startHSL.l}
                              onChange={(e) => updateStartHSL(activeGroup.id, { ...activeGroup.startHSL, l: Number(e.target.value) })}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-1.5 text-center font-mono text-xs focus:outline-none focus:border-neutral-900 focus:bg-white"
                              title="Lightness (0-100)"
                            />
                            <span className="text-[9px] text-neutral-400 mt-0.5">L%</span>
                          </div>
                        </div>
                      </div>

                      {/* Midpoint Color Coordinate Pickers */}
                      {activeGroup.settingsMode === 'handles_center' && (() => {
                        const mid = activeGroup.midHSL || {
                          h: Math.round((activeGroup.startHSL.h + activeGroup.endHSL.h) / 2),
                          s: Math.round((activeGroup.startHSL.s + activeGroup.endHSL.s) / 2),
                          l: Math.round((activeGroup.startHSL.l + activeGroup.endHSL.l) / 2),
                        };
                        return (
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-neutral-700">
                              Midpoint Color (HSL)
                            </label>
                            <div className="flex gap-1.5">
                              <div className="flex-1 flex flex-col items-center">
                                <input
                                  id="mid-h"
                                  type="number"
                                  min="0"
                                  max="360"
                                  value={mid.h}
                                  onChange={(e) => updateMidHSL(activeGroup.id, { ...mid, h: Number(e.target.value) })}
                                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-1.5 text-center font-mono text-xs focus:outline-none focus:border-neutral-900 focus:bg-white"
                                  title="Hue (0-360)"
                                />
                                <span className="text-[9px] text-neutral-400 mt-0.5">H</span>
                              </div>
                              <div className="flex-1 flex flex-col items-center">
                                <input
                                  id="mid-s"
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={mid.s}
                                  onChange={(e) => updateMidHSL(activeGroup.id, { ...mid, s: Number(e.target.value) })}
                                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-1.5 text-center font-mono text-xs focus:outline-none focus:border-neutral-900 focus:bg-white"
                                  title="Saturation (0-100)"
                                />
                                <span className="text-[9px] text-neutral-400 mt-0.5">S%</span>
                              </div>
                              <div className="flex-1 flex flex-col items-center">
                                <input
                                  id="mid-l"
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={mid.l}
                                  onChange={(e) => updateMidHSL(activeGroup.id, { ...mid, l: Number(e.target.value) })}
                                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-1.5 text-center font-mono text-xs focus:outline-none focus:border-neutral-900 focus:bg-white"
                                  title="Lightness (0-100)"
                                />
                                <span className="text-[9px] text-neutral-400 mt-0.5">L%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* End Point Coordinate Pickers */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-neutral-700">
                          End Color (HSL)
                        </label>
                        <div className="flex gap-1.5">
                          <div className="flex-1 flex flex-col items-center">
                            <input
                              id="end-h"
                              type="number"
                              min="0"
                              max="360"
                              value={activeGroup.endHSL.h}
                              onChange={(e) => updateEndHSL(activeGroup.id, { ...activeGroup.endHSL, h: Number(e.target.value) })}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-1.5 text-center font-mono text-xs focus:outline-none focus:border-neutral-900 focus:bg-white"
                              title="Hue (0-360)"
                            />
                            <span className="text-[9px] text-neutral-400 mt-0.5">H</span>
                          </div>
                          <div className="flex-1 flex flex-col items-center">
                            <input
                              id="end-s"
                              type="number"
                              min="0"
                              max="100"
                              value={activeGroup.endHSL.s}
                              onChange={(e) => updateEndHSL(activeGroup.id, { ...activeGroup.endHSL, s: Number(e.target.value) })}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-1.5 text-center font-mono text-xs focus:outline-none focus:border-neutral-900 focus:bg-white"
                              title="Saturation (0-100)"
                            />
                            <span className="text-[9px] text-neutral-400 mt-0.5">S%</span>
                          </div>
                          <div className="flex-1 flex flex-col items-center">
                            <input
                              id="end-l"
                              type="number"
                              min="0"
                              max="100"
                              value={activeGroup.endHSL.l}
                              onChange={(e) => updateEndHSL(activeGroup.id, { ...activeGroup.endHSL, l: Number(e.target.value) })}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-1.5 text-center font-mono text-xs focus:outline-none focus:border-neutral-900 focus:bg-white"
                              title="Lightness (0-100)"
                            />
                            <span className="text-[9px] text-neutral-400 mt-0.5">L%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* SLIDERS (only shown for Mode 1 and Mode 2) */}
                {(activeGroup.settingsMode || 'linear') !== 'handles_center' && activeGroup.settingsMode !== 'manual' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                    {/* Distribution Bias Slider */}
                    <div className="flex flex-col gap-2 bg-neutral-50/50 p-4 rounded-xl border border-neutral-200/50">
                      <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                        <span className="flex items-center gap-1.5">
                          <Sliders size={13} className="text-neutral-500" />
                          Distribution Bias (Step Spacing)
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            id="distribution-input"
                            type="number"
                            min="-100"
                            max="100"
                            value={activeGroup.distribution}
                            onChange={(e) => {
                              const val = Math.max(-100, Math.min(100, Number(e.target.value) || 0));
                              updateGroup(activeGroup.id, { distribution: val });
                            }}
                            className="w-12 text-center text-xs font-mono font-bold bg-white border border-neutral-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-neutral-900"
                          />
                          <span className="text-[10px] text-neutral-400 font-mono">%</span>
                        </div>
                      </div>
                      <input
                        id="slider-distribution"
                        type="range"
                        min="-100"
                        max="100"
                        value={activeGroup.distribution}
                        onChange={(e) => updateGroup(activeGroup.id, { distribution: Number(e.target.value) })}
                        className="w-full accent-neutral-800 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] font-medium text-neutral-400 mt-1">
                        <span>Tighten at Start</span>
                        <span>Linear</span>
                        <span>Tighten at End</span>
                      </div>
                    </div>

                    {/* Center Bias Slider */}
                    <div className="flex flex-col gap-2 bg-neutral-50/50 p-4 rounded-xl border border-neutral-200/50">
                      <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                        <span className="flex items-center gap-1.5">
                          <Sliders size={13} className="text-neutral-500" />
                          Center Bias (Center / Off-Center Spacing)
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            id="center-bias-input"
                            type="number"
                            min="-100"
                            max="100"
                            value={activeGroup.centerBias ?? 0}
                            onChange={(e) => {
                              const val = Math.max(-100, Math.min(100, Number(e.target.value) || 0));
                              updateGroup(activeGroup.id, { centerBias: val });
                            }}
                            className="w-12 text-center text-xs font-mono font-bold bg-white border border-neutral-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-neutral-900"
                          />
                          <span className="text-[10px] text-neutral-400 font-mono">%</span>
                        </div>
                      </div>
                      <input
                        id="slider-center-bias"
                        type="range"
                        min="-100"
                        max="100"
                        value={activeGroup.centerBias ?? 0}
                        onChange={(e) => updateGroup(activeGroup.id, { centerBias: Number(e.target.value) })}
                        className="w-full accent-neutral-800 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] font-medium text-neutral-400 mt-1">
                        <span>Off-Center</span>
                        <span>Balanced</span>
                        <span>On-Center</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* MANUAL COLOR LIST (only shown for Mode 'manual') */}
                {activeGroup.settingsMode === 'manual' && (
                  <div className="flex flex-col gap-3 mt-1 bg-neutral-50/50 p-4 rounded-xl border border-neutral-200/50">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-200/40">
                      <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                        <Sliders size={13} className="text-neutral-500" />
                        Manual Shade Editor
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const currentCount = activeGroup.numShades || numShades;
                          if (currentCount < 19) {
                            const nextCount = currentCount + 1;
                            const currentManual = activeGroup.manualColors && activeGroup.manualColors.length > 0
                              ? [...activeGroup.manualColors]
                              : activeGroupShades.map(s => ({ ...s.hsl }));
                            const lastColor = currentManual[currentManual.length - 1] || { h: 0, s: 0, l: 50 };
                            updateGroup(activeGroup.id, {
                              numShades: nextCount,
                              manualColors: [...currentManual, { ...lastColor }]
                            });
                          }
                        }}
                        disabled={(activeGroup.numShades || numShades) >= 19}
                        title={(activeGroup.numShades || numShades) >= 19 ? "Maximum limit of 19 shades reached" : "Add one shade"}
                        className="py-1 px-3 rounded-lg text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 disabled:pointer-events-auto disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {activeGroupShades.map((shade, idx) => {
                        const currentHSL = activeGroup.manualColors?.[idx] || shade.hsl;
                        const currentRGB = hslToRgb(currentHSL.h, currentHSL.s, currentHSL.l);
                        const isExpanded = expandedShadeIdx === idx;
                        return (
                          <div
                            key={`manual-row-${idx}`}
                            className="flex flex-col p-2.5 bg-white border border-neutral-200/80 rounded-xl hover:border-neutral-300 transition-colors shadow-2xs"
                          >
                            {/* Compact Row Header */}
                            <div className="flex items-center justify-between gap-3">
                              {/* Left: Native Color Swatch / Picker */}
                              <div className="relative w-8 h-8 rounded-lg border border-neutral-200/60 shadow-xs overflow-hidden shrink-0 cursor-pointer group">
                                <input
                                  type="color"
                                  value={shade.hex}
                                  onChange={(e) => {
                                    const newHex = e.target.value;
                                    const hsl = hexToHsl(newHex);
                                    updateManualColorHSL(activeGroup.id, idx, hsl);
                                  }}
                                  className="absolute inset-0 w-full h-full p-0 border-0 opacity-0 cursor-pointer z-10"
                                />
                                <div className="w-full h-full transition-transform group-hover:scale-110" style={{ backgroundColor: shade.hex }} />
                              </div>

                              {/* Middle-Left: Step & Hex Value */}
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-[9px] font-bold text-neutral-400 font-mono uppercase tracking-wider">Step {shade.step}</span>
                                <div className="mt-0.5">
                                  <HexInput
                                    value={shade.hex}
                                    onChange={(val) => {
                                      const hsl = hexToHsl(val);
                                      updateManualColorHSL(activeGroup.id, idx, hsl);
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Middle-Right: Quick HSL Stats */}
                              <div className="hidden xs:flex flex-col items-end shrink-0 text-[9px] font-mono font-bold text-neutral-400">
                                <span>H:{Math.round(currentHSL.h)}°</span>
                                <span>S:{Math.round(currentHSL.s)}% L:{Math.round(currentHSL.l)}%</span>
                              </div>

                              {/* Right: Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                {/* Expand/Collapse Sliders */}
                                <button
                                  type="button"
                                  onClick={() => setExpandedShadeIdx(isExpanded ? null : idx)}
                                  className={`p-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-500 hover:text-neutral-800 transition-all cursor-pointer ${
                                    isExpanded ? 'bg-neutral-50 text-neutral-900 border-neutral-300' : ''
                                  }`}
                                  title="Adjust sliders"
                                >
                                  <Sliders size={13} />
                                </button>

                                {/* Trash / Delete */}
                                <button
                                  type="button"
                                  onClick={() => removeManualColorAtIndex(activeGroup.id, idx)}
                                  disabled={(activeGroup.numShades || numShades) <= 3}
                                  title={(activeGroup.numShades || numShades) <= 3 ? "Minimum limit of 3 shades reached" : "Remove this shade"}
                                  className="p-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-500 hover:text-red-600 hover:border-red-200 disabled:opacity-40 disabled:pointer-events-auto disabled:cursor-not-allowed disabled:hover:text-neutral-500 disabled:hover:border-neutral-200 transition-all cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Detailed Expandable Sliders Panel */}
                            {isExpanded && (
                              <div className="flex flex-col gap-2.5 mt-2.5 pt-2.5 border-t border-neutral-100 bg-neutral-50/20 p-2 rounded-lg">
                                {/* Hue Slider */}
                                <div className="flex flex-col gap-1">
                                  <div className="flex justify-between text-[10px] font-mono text-neutral-500 font-bold">
                                    <span>Hue</span>
                                    <span>{Math.round(currentHSL.h)}°</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="360"
                                    value={Math.round(currentHSL.h)}
                                    onChange={(e) => updateManualColorHSL(activeGroup.id, idx, { h: Number(e.target.value) })}
                                    className="w-full accent-neutral-900 cursor-pointer h-1 bg-neutral-100 rounded-lg appearance-none"
                                  />
                                </div>

                                {/* Saturation Slider */}
                                <div className="flex flex-col gap-1">
                                  <div className="flex justify-between text-[10px] font-mono text-neutral-500 font-bold">
                                    <span>Saturation</span>
                                    <span>{Math.round(currentHSL.s)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={Math.round(currentHSL.s)}
                                    onChange={(e) => updateManualColorHSL(activeGroup.id, idx, { s: Number(e.target.value) })}
                                    className="w-full accent-neutral-900 cursor-pointer h-1 bg-neutral-100 rounded-lg appearance-none"
                                  />
                                </div>

                                {/* Lightness Slider */}
                                <div className="flex flex-col gap-1">
                                  <div className="flex justify-between text-[10px] font-mono text-neutral-500 font-bold">
                                    <span>Lightness</span>
                                    <span>{Math.round(currentHSL.l)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={Math.round(currentHSL.l)}
                                    onChange={(e) => updateManualColorHSL(activeGroup.id, idx, { l: Number(e.target.value) })}
                                    className="w-full accent-neutral-900 cursor-pointer h-1 bg-neutral-100 rounded-lg appearance-none"
                                  />
                                </div>

                                {/* RGB Inputs */}
                                <div className="grid grid-cols-3 gap-2 mt-1">
                                  <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200/60 rounded-lg px-2 py-0.5 shadow-2xs">
                                    <span className="text-[9px] font-bold text-red-500 font-mono">R</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="255"
                                      value={currentRGB.r}
                                      onChange={(e) => updateManualColorRGB(activeGroup.id, idx, { r: Number(e.target.value) })}
                                      className="w-full text-center text-xs font-mono bg-transparent border-0 focus:outline-none p-0 focus:ring-0"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200/60 rounded-lg px-2 py-0.5 shadow-2xs">
                                    <span className="text-[9px] font-bold text-green-600 font-mono">G</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="255"
                                      value={currentRGB.g}
                                      onChange={(e) => updateManualColorRGB(activeGroup.id, idx, { g: Number(e.target.value) })}
                                      className="w-full text-center text-xs font-mono bg-transparent border-0 focus:outline-none p-0 focus:ring-0"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200/60 rounded-lg px-2 py-0.5 shadow-2xs">
                                    <span className="text-[9px] font-bold text-blue-500 font-mono">B</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="255"
                                      value={currentRGB.b}
                                      onChange={(e) => updateManualColorRGB(activeGroup.id, idx, { b: Number(e.target.value) })}
                                      className="w-full text-center text-xs font-mono bg-transparent border-0 focus:outline-none p-0 focus:ring-0"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* GROUP SHADE COUNT CONTROLS */}
                {activeGroup.settingsMode !== 'manual' && (
                  <div className="bg-neutral-50/50 p-4 rounded-xl border border-neutral-200/50 mt-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-700">
                        Shades Count
                      </span>
                      <span className="text-xs font-mono bg-neutral-100 px-2 py-0.5 rounded text-neutral-700 font-bold">
                        {activeGroup.numShades || numShades}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <input
                        type="range"
                        min="3"
                        max="19"
                        step={activeGroup.settingsMode === 'handles_center' ? "2" : "1"}
                        value={activeGroup.numShades || numShades}
                        onChange={(e) => {
                          let val = Number(e.target.value);
                          if (activeGroup.settingsMode === 'handles_center' && val % 2 === 0) {
                            val = Math.max(3, val - 1);
                          }
                          updateGroup(activeGroup.id, { numShades: val });
                        }}
                        className="w-full accent-neutral-900 h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                      />
                      {activeGroup.settingsMode === 'handles_center' && (
                        <span className="text-[10px] text-neutral-400">
                          Midpoint Bezier requires an odd count of shades.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* THREE INTERACTIVE COLOR SPACES COMPONENT */}
              <ColorSpaceVisualizer
                group={activeGroup}
                shades={activeGroupShades}
                generatedPalette={generatedPalette}
                onChangeStartHSL={(hsl) => updateStartHSL(activeGroup.id, hsl)}
                onChangeEndHSL={(hsl) => updateEndHSL(activeGroup.id, hsl)}
                onChangeGroupProp={(fields) => updateGroup(activeGroup.id, fields)}
              />
            </>
          )}

        </main>
      </div>

      {/* FOOTER */}
      <footer className="bg-white border-t border-neutral-200 py-4 px-6 text-center text-xs text-neutral-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Palette Designer Engine © 2026. Made for designers and front-end developers.</span>
          <div className="flex gap-4">
            <span className="hover:text-neutral-600 transition-all cursor-help" title="To shift distribution: drag the individual HL, LS, or HS sliders. To edit colors: drag start (S) and end (E) coordinates on any color space plot.">
              How to use?
            </span>
          </div>
        </div>
      </footer>

      {/* EXPORT MODAL */}
      {isExportOpen && (
        <div id="export-modal-backdrop" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="export-modal" className="bg-white border border-neutral-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <FileCode size={20} className="text-neutral-700" />
                <h3 className="text-base font-bold text-neutral-900">
                  Export Color Palette: {paletteName}
                </h3>
              </div>
              <button
                id="btn-close-export"
                onClick={() => setIsExportOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-neutral-200 mb-4 self-start">
              <button
                id="format-json"
                onClick={() => setExportFormat('json')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  exportFormat === 'json'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <FileJson size={13} />
                JSON Config
              </button>
              <button
                id="format-css"
                onClick={() => setExportFormat('css')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  exportFormat === 'css'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <FileCode size={13} />
                CSS Variables
              </button>
              <button
                id="format-tailwind"
                onClick={() => setExportFormat('tailwind')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  exportFormat === 'tailwind'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <Sliders size={13} />
                Tailwind Extend
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mb-5">
              <pre className="bg-neutral-950 text-neutral-200 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-[350px] border border-neutral-800">
                <code>
                  {exportFormat === 'json'
                    ? JSON.stringify(exportData, null, 2)
                    : exportFormat === 'css'
                    ? generatedCssText
                    : generatedTailwindText}
                </code>
              </pre>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-neutral-100">
              <div className="text-xs text-neutral-400">
                {exportFormat === 'json'
                  ? 'Includes both the multi-dimensional math configs and resolved hex colors.'
                  : 'Ready to copy-paste directly into your configuration files.'}
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-copy-export"
                  onClick={() =>
                    handleCopyExportText(
                      exportFormat === 'json'
                        ? JSON.stringify(exportData, null, 2)
                        : exportFormat === 'css'
                        ? generatedCssText
                        : generatedTailwindText
                    )
                  }
                  className="flex items-center gap-1 px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-all cursor-pointer"
                >
                  {isExportCopied ? (
                    <>
                      <Check size={14} className="text-emerald-500" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>

                {exportFormat === 'json' && (
                  <button
                    id="btn-download-json"
                    onClick={downloadJsonFile}
                    className="flex items-center gap-1 px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white transition-all shadow-xs cursor-pointer"
                  >
                    <Download size={14} />
                    <span>Download File</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {isImportOpen && (
        <div id="import-modal-backdrop" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="import-modal" className="bg-white border border-neutral-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Upload size={20} className="text-neutral-700" />
                <h3 className="text-base font-bold text-neutral-900">
                  Import Color Palette Config
                </h3>
              </div>
              <button
                id="btn-close-import"
                onClick={() => setIsImportOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-4 mb-5">
              <p className="text-xs text-neutral-500">
                Paste an exported JSON config. We support multi-dimensional interpolation properties (<code>distHL</code>, <code>distLS</code>, <code>distHS</code>).
                You can also choose a preset template:
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  id="btn-preset-vk"
                  onClick={() => handleTemplateImport('vk')}
                  className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-blue-200 text-blue-600 bg-blue-50/50 hover:bg-blue-50 transition-all cursor-pointer"
                >
                  🌐 VK Sub System
                </button>
                <button
                  id="btn-preset-simple"
                  onClick={() => handleTemplateImport('simple')}
                  className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-emerald-200 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 transition-all cursor-pointer"
                >
                  🟢 Simple Primitives
                </button>
                <button
                  id="btn-preset-radix"
                  onClick={() => handleTemplateImport('radix')}
                  className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 transition-all cursor-pointer"
                >
                  🔮 Radix Colors
                </button>
                <button
                  id="btn-preset-ibm"
                  onClick={() => handleTemplateImport('ibm')}
                  className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-blue-200 text-blue-600 bg-blue-50/50 hover:bg-blue-50 transition-all cursor-pointer"
                >
                  🏢 IBM Carbon
                </button>
                <button
                  id="btn-preset-tailwind"
                  onClick={() => handleTemplateImport('tailwind')}
                  className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-sky-200 text-sky-600 bg-sky-50/50 hover:bg-sky-50 transition-all cursor-pointer"
                >
                  🌊 Tailwind CSS
                </button>
              </div>

              <textarea
                id="import-text-area"
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                className="w-full h-48 bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-neutral-900"
                placeholder='{ "paletteName": "Custom", "numShades": 9, "config": [...] }'
              />

              {importError && (
                <div id="import-error-banner" className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-200 flex flex-col gap-1">
                  <span className="font-bold">Import failed:</span>
                  <span>{importError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
              <button
                id="btn-cancel-import"
                onClick={() => setIsImportOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-submit-import"
                onClick={handleImport}
                disabled={!importJson.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white disabled:opacity-40 disabled:hover:bg-neutral-900 transition-all shadow-xs cursor-pointer"
              >
                Apply Config
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGENERATE PALETTE MODAL */}
      {isRegenerateOpen && (
        <div id="regenerate-modal-backdrop" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="regenerate-modal" className="bg-white border border-neutral-200 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-neutral-700" />
                <h3 className="text-base font-bold text-neutral-900">
                  Regenerate Palette Settings
                </h3>
              </div>
              <button
                id="btn-close-regenerate"
                onClick={() => setIsRegenerateOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5 mb-6">
              <p className="text-xs text-neutral-500 leading-relaxed">
                Choose the count of total color groups and shades. Please note that changing these values will regenerate the entire palette matrix.
              </p>

              {/* Total Color Groups Control */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="temp-group-count-slider" className="text-xs font-semibold text-neutral-700">
                    Total Color Groups (2-26)
                  </label>
                  <span className="text-xs font-mono bg-neutral-100 px-2 py-0.5 rounded text-neutral-700">
                    {tempGroupCount}
                  </span>
                </div>
                <input
                  id="temp-group-count-slider"
                  type="range"
                  min="2"
                  max="26"
                  value={tempGroupCount}
                  onChange={(e) => setTempGroupCount(Number(e.target.value))}
                  className="w-full accent-neutral-900 h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Shades per Group Control */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="temp-shade-count-slider" className="text-xs font-semibold text-neutral-700">
                    Shades per Group (3-19, Odd counts)
                  </label>
                  <span className="text-xs font-mono bg-neutral-100 px-2 py-0.5 rounded text-neutral-700">
                    {tempShadesCount}
                  </span>
                </div>
                <input
                  id="temp-shade-count-slider"
                  type="range"
                  min="3"
                  max="19"
                  step="2"
                  value={tempShadesCount}
                  onChange={(e) => setTempShadesCount(Number(e.target.value))}
                  className="w-full accent-neutral-900 h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
              <button
                id="btn-cancel-regenerate"
                onClick={() => setIsRegenerateOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-regenerate"
                onClick={() => {
                  setNumShades(tempShadesCount);
                  const val = Math.max(2, Math.min(26, tempGroupCount));
                  
                  const COLOR_POOL = [
                    { name: 'Ruby', h: 350, s: 92 },
                    { name: 'Rose', h: 330, s: 88 },
                    { name: 'Fuchsia', h: 310, s: 82 },
                    { name: 'Purple', h: 290, s: 78 },
                    { name: 'Violet', h: 270, s: 84 },
                    { name: 'Indigo', h: 245, s: 88 },
                    { name: 'Blue', h: 224, s: 92 },
                    { name: 'Sky', h: 203, s: 88 },
                    { name: 'Cyan', h: 184, s: 82 },
                    { name: 'Teal', h: 162, s: 78 },
                    { name: 'Emerald', h: 142, s: 84 },
                    { name: 'Green', h: 120, s: 82 },
                    { name: 'Lime', h: 92, s: 88 },
                    { name: 'Yellow', h: 60, s: 94 },
                    { name: 'Amber', h: 42, s: 96 },
                    { name: 'Orange', h: 24, s: 92 },
                    { name: 'Red', h: 6, s: 94 },
                    { name: 'Slate', h: 215, s: 18 },
                    { name: 'Zinc', h: 240, s: 8 },
                    { name: 'Stone', h: 30, s: 12 },
                  ];

                  // Shuffle COLOR_POOL so we get different colors and names each time
                  const shuffled = [...COLOR_POOL];
                  for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    const temp = shuffled[i];
                    shuffled[i] = shuffled[j];
                    shuffled[j] = temp;
                  }

                  const newGroups: ColorGroup[] = [];
                  for (let i = 0; i < val; i++) {
                    const poolItem = shuffled[i % shuffled.length];
                    
                    // Add a tiny variation to the starting hue to keep it fresh
                    const startH = (poolItem.h + Math.floor((Math.random() - 0.5) * 10) + 360) % 360;
                    const startS = Math.max(5, Math.min(100, poolItem.s + Math.floor((Math.random() - 0.5) * 10)));
                    const startL = 92 + Math.floor(Math.random() * 5); // 92 to 97%

                    // End hue shifts slightly from start hue for a professional spectrum shift
                    const hShift = 10 + Math.floor(Math.random() * 20); // 10 to 30 degrees
                    const endH = (startH + (Math.random() > 0.5 ? hShift : -hShift) + 360) % 360;
                    const endS = Math.max(10, Math.min(100, poolItem.s + 5 + Math.floor((Math.random() - 0.5) * 10)));
                    const endL = 10 + Math.floor(Math.random() * 6); // 10 to 16%

                    // Randomize settingsMode for organic variety: linear, bezier, midpoint bezier
                    const modes: ('linear' | 'handles_sliders' | 'handles_center')[] = ['linear', 'handles_sliders', 'handles_center'];
                    const selectedMode = modes[Math.floor(Math.random() * modes.length)];

                    // Keep total count odd if midpoint bezier is selected to retain symmetry
                    let groupShadeCount = tempShadesCount;
                    if (selectedMode === 'handles_center' && groupShadeCount % 2 === 0) {
                      groupShadeCount = Math.max(3, groupShadeCount + 1);
                    }

                    const newGroup: ColorGroup = {
                      id: `group-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
                      name: poolItem.name,
                      startHSL: { h: startH, s: startS, l: startL },
                      endHSL: { h: endH, s: endS, l: endL },
                      distribution: 0,
                      centerBias: 0,
                      settingsMode: selectedMode,
                      numShades: groupShadeCount,
                    };

                    // Add unique control points based on mode for beautiful Bezier curvature
                    if (selectedMode === 'handles_sliders') {
                      newGroup.ctrlStartHSL = {
                        h: (startH + 12) % 360,
                        s: Math.min(100, startS + 8),
                        l: Math.round(startL * 0.8),
                      };
                      newGroup.ctrlEndHSL = {
                        h: (endH - 12 + 360) % 360,
                        s: Math.max(10, endS - 8),
                        l: Math.round(endL * 1.8),
                      };
                    } else if (selectedMode === 'handles_center') {
                      newGroup.midHSL = {
                        h: Math.round((startH + endH) / 2),
                        s: Math.round((startS + endS) / 2),
                        l: 45 + Math.floor(Math.random() * 10), // 45 to 55%
                      };
                    }

                    newGroups.push(newGroup);
                  }

                  setGroups(newGroups);
                  
                  // Ensure active tab points back to the main overview palette or one of the new groups
                  if (activeTab !== 'palette' && !newGroups.some(g => g.id === activeTab)) {
                    setActiveTab('palette');
                  }
                  
                  setIsRegenerateOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-850 text-white transition-all cursor-pointer shadow-xs"
              >
                Confirm & Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
