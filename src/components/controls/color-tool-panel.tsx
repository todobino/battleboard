
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, ColorToolPanelProps as ColorToolPanelPropsType } from '@/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ColorToolPanelProps extends ColorToolPanelPropsType {}

const defaultColors = [
  "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
  "#800000", "#008000", "#000080", "#808000", "#800080", "#008080",
  "#C0C0C0", "#808080", "#000000", "#FFFFFF"
];

export default function ColorToolPanel({
  activeTool, setActiveTool,
  selectedColor, setSelectedColor,
}: ColorToolPanelProps) {
  
  return (
    <div className="space-y-2">
      <div className="mt-1">
        <div className="grid grid-cols-8 gap-1 mt-1">
          {defaultColors.map(color => (
            <Button
              key={color}
              variant="outline"
              size="icon"
              style={{ backgroundColor: color }}
              className={cn(
                "h-7 w-7 border",
                "hover:border-accent hover:border-2"
              )}
              onClick={() => { 
                setSelectedColor(color); 
                setActiveTool('paint_cell');
                // Popover closing is now handled by SideToolbar's useEffect
              }}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
