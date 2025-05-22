
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Palette } from 'lucide-react';

interface ColorToolPanelProps {
  activeTool: ActiveTool;
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  selectedColor: string;
  setSelectedColor: Dispatch<SetStateAction<string>>;
}

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
    <div className="space-y-4 p-4">
      <div className="flex items-center text-lg font-semibold mb-3 text-popover-foreground">
        <Palette className="mr-2 h-5 w-5" /> Color Painter
      </div>
      <div>
        <Label htmlFor="color-picker" className="text-popover-foreground">Cell Paint Color</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            id="color-picker"
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            className="w-16 h-10 p-1"
            onFocus={() => setActiveTool('paint_cell')}
          />
          <Button 
            variant={activeTool === 'paint_cell' ? "default" : "outline"}
            onClick={() => setActiveTool('paint_cell')}
            className="flex-1"
          >
            Paint Cell
          </Button>
        </div>
        <div className="grid grid-cols-8 gap-1 mt-2">
          {defaultColors.map(color => (
            <Button
              key={color}
              variant="outline"
              size="icon"
              style={{ backgroundColor: color }}
              className="h-7 w-7 border"
              onClick={() => { setSelectedColor(color); setActiveTool('paint_cell');}}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
