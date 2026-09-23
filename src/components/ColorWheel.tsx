import React, { useState, useEffect, useRef } from 'react';
import { ColorGroup, GeneratedGroup } from '../types';

interface ColorWheelProps {
  groups: ColorGroup[];
  generatedPalette: GeneratedGroup[];
  updateGroup: (id: string, fields: Partial<ColorGroup>) => void;
}

export const ColorWheel: React.FC<ColorWheelProps> = ({
  groups,
  generatedPalette,
  updateGroup,
}) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (draggingGroupId === null) return;

    const handleMove = (clientX: number, clientY: number) => {
      const wheelElement = wheelRef.current;
      if (!wheelElement) return;

      const rect = wheelElement.getBoundingClientRect();
      const xc = rect.left + rect.width / 2;
      const yc = rect.top + rect.height / 2;

      const dx = clientX - xc;
      const dy = clientY - yc;

      // Calculate angle from 12 o'clock clockwise
      let angleDeg = Math.atan2(dx, -dy) * (180 / Math.PI);
      if (angleDeg < 0) angleDeg += 360;
      const newHue = Math.round(angleDeg);

      // Find target group
      const group = groups.find((g) => g.id === draggingGroupId);
      if (!group) return;

      // Find current 500 shade's hue
      const groupShades = generatedPalette.find((g) => g.id === draggingGroupId)?.shades || [];
      const middleShade = groupShades[Math.floor(groupShades.length / 2)];
      const current500Hue = middleShade ? middleShade.hsl.h : group.startHSL.h;

      const delta = (newHue - current500Hue + 360) % 360;
      if (delta === 0) return;

      const shiftHue = (h: number) => {
        let val = (h + delta) % 360;
        if (val < 0) val += 360;
        return Math.round(val);
      };

      const updates: Partial<ColorGroup> = {
        startHSL: { ...group.startHSL, h: shiftHue(group.startHSL.h) },
        endHSL: { ...group.endHSL, h: shiftHue(group.endHSL.h) },
        midHSL: group.midHSL ? { ...group.midHSL, h: shiftHue(group.midHSL.h) } : undefined,
        ctrlStartHSL: group.ctrlStartHSL ? { ...group.ctrlStartHSL, h: shiftHue(group.ctrlStartHSL.h) } : undefined,
        ctrlEndHSL: group.ctrlEndHSL ? { ...group.ctrlEndHSL, h: shiftHue(group.ctrlEndHSL.h) } : undefined,
        ctrlMidStartHSL: group.ctrlMidStartHSL ? { ...group.ctrlMidStartHSL, h: shiftHue(group.ctrlMidStartHSL.h) } : undefined,
        ctrlMidEndHSL: group.ctrlMidEndHSL ? { ...group.ctrlMidEndHSL, h: shiftHue(group.ctrlMidEndHSL.h) } : undefined,
      };

      if (group.manualColors) {
        updates.manualColors = group.manualColors.map((color) => ({
          ...color,
          h: shiftHue(color.h),
        }));
      }

      updateGroup(draggingGroupId, updates);
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      // Prevent scrolling when dragging on the wheel
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleMouseUp = () => {
      setDraggingGroupId(null);
    };

    const handleTouchEnd = () => {
      setDraggingGroupId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [draggingGroupId, groups, generatedPalette, updateGroup]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-[180px] h-[180px] flex-shrink-0" ref={wheelRef}>
        {/* The actual conic gradient wheel background */}
        <div 
          className="absolute inset-0 rounded-full border border-neutral-200/50 shadow-inner"
          style={{
            background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          }}
        />
        
        {/* Inner hole mask to make it a premium donut wheel */}
        <div className="absolute inset-[30px] bg-white rounded-full border border-neutral-200/30 flex items-center justify-center shadow-xs">
          <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider text-center select-none leading-tight">
            500 Hue<br />Wheel
          </div>
        </div>

        {/* Absolutely positioned draggable handles */}
        {groups.map((group) => {
          const groupShades = generatedPalette.find((g) => g.id === group.id)?.shades || [];
          const middleShade = groupShades[Math.floor(groupShades.length / 2)];
          const current500Hue = middleShade ? middleShade.hsl.h : group.startHSL.h;
          const current500Hex = middleShade ? middleShade.hex : '#888888';

          // Radius on a track centered in the 180px donut path
          const r = 75;
          const rad = (current500Hue * Math.PI) / 180;
          const x = 90 + r * Math.sin(rad);
          const y = 90 - r * Math.cos(rad);

          const isDragging = draggingGroupId === group.id;

          return (
            <div
              key={group.id}
              onMouseDown={(e) => {
                e.preventDefault();
                setDraggingGroupId(group.id);
              }}
              onTouchStart={(e) => {
                setDraggingGroupId(group.id);
              }}
              className={`absolute w-6 h-6 rounded-full cursor-grab active:cursor-grabbing border-2 border-white shadow-md flex items-center justify-center transition-transform ${
                isDragging ? 'scale-125 cursor-grabbing z-30' : 'hover:scale-115 z-20'
              }`}
              style={{
                left: `${x}px`,
                top: `${y}px`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: current500Hex,
              }}
              title={`${group.name} (Hue: ${current500Hue}°)`}
            >
              <span className="text-[8px] font-bold text-white drop-shadow-[0_1px_2.5px_rgba(0,0,0,0.85)]">
                {group.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
