
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Palette icon import removed
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
    <div className="space-y-4 p-4">
      {/* Removed header section */}
      
      <div className="mt-1"> {/* Adjusted margin since header is removed */}
        <Label className="text-popover-foreground text-sm">Default Colors</Label>
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
                onColorSelect?.(); 
              }}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-4">
        <Label htmlFor="color-picker-input-custom" className="text-popover-foreground text-sm">Custom Color</Label>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Input
                id="color-picker-input-custom"
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-full h-10 p-1 border mt-1" // Changed w-10 to w-full
                onFocus={() => setActiveTool('paint_cell')}
                aria-label="Custom color picker"
              />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Choose a custom color</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
