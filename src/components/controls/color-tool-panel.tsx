
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool } from '@/types';
import { Button } from '@/components/ui/button';
// Input import removed
// Label import removed
// Palette icon import removed
import { cn } from '@/lib/utils';
// Tooltip imports removed as the custom color input it was for is removed

interface ColorToolPanelProps {
  activeTool: ActiveTool;
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  selectedColor: string;
  setSelectedColor: Dispatch<SetStateAction<string>>;
  onColorSelect?: () => void; // Callback to close popover
}

const defaultColors = [
  "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
  "#800000", "#008000", "#000080", "#808000", "#800080", "#008080",
  "#C0C0C0", "#808080", "#000000", "#FFFFFF"
];

export default function ColorToolPanel({
  activeTool, setActiveTool,
  selectedColor, setSelectedColor,
  onColorSelect,
}: ColorToolPanelProps) {
  
  return (
    <div className="space-y-2"> {/* Adjusted spacing since elements were removed */}
      {/* Removed header section */}
      
      <div className="mt-1"> {/* Margin might need adjustment or can be removed if space-y-2 is enough */}
        {/* "Default Colors" Label removed */}
        <div className="grid grid-cols-8 gap-1 mt-1"> {/* mt-1 might be redundant if space-y on parent is sufficient */}
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
                onColorSelect?.(); 
              }}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      </div>

      {/* Custom Color Selector section removed */}
    </div>
  );
}
