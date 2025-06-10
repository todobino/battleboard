
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, ShapeToolPanelProps as ShapeToolPanelPropsType } from '@/types'; // Updated import
import { Button } from '@/components/ui/button';
import { LineChart, Circle, Square } from 'lucide-react';
import { STANDARD_SHAPE_COLORS } from '@/config/shape-colors';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

// Using the imported ShapeToolPanelPropsType
interface ShapeToolPanelProps extends ShapeToolPanelPropsType {}

export default function ShapeToolPanel({
  setActiveTool,
  selectedShapeDrawColor,
  setSelectedShapeDrawColor,
  onToolSelect,
}: ShapeToolPanelProps) {

  const handleShapeTypeSelect = (tool: 'draw_line' | 'draw_circle' | 'draw_rectangle') => {
    setActiveTool(tool);
    onToolSelect?.(); // Close popover only when a shape TYPE is selected
  };

  const handleColorSelect = (color: string) => {
    setSelectedShapeDrawColor(color);
    // Do not close popover here, allow user to then select shape type
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium text-popover-foreground">Shape Color</Label>
        <div className="grid grid-cols-6 gap-1.5 mt-1.5">
          {Object.entries(STANDARD_SHAPE_COLORS).map(([name, color]) => (
            <Button
              key={name}
              variant="outline"
              size="icon"
              style={{ backgroundColor: color }}
              className={cn(
                "h-7 w-7 border-2",
                selectedShapeDrawColor === color ? 'border-ring ring-2 ring-ring ring-offset-1' : 'border-border hover:border-primary',
                 // Make contrast better for light colors like yellow
                (color === STANDARD_SHAPE_COLORS.Yellow || color === STANDARD_SHAPE_COLORS.Orange) && selectedShapeDrawColor === color ? 'ring-offset-background' : ''
              )}
              onClick={() => handleColorSelect(color)}
              aria-label={`Select color ${name}`}
              title={name}
            />
          ))}
        </div>
      </div>

      <Separator className="my-3" />

      <div>
        <Label className="text-sm font-medium text-popover-foreground">Shape Type</Label>
        <div className="grid grid-cols-3 gap-2 mt-1.5">
          <Button
            variant="outline"
            onClick={() => handleShapeTypeSelect('draw_line')}
            className="flex flex-col items-center h-auto py-2"
            title="Draw Line"
          >
            <LineChart className="mb-1 h-5 w-5" />
            <span className="text-xs">Line</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => handleShapeTypeSelect('draw_circle')}
            className="flex flex-col items-center h-auto py-2"
            title="Draw Circle"
          >
            <Circle className="mb-1 h-5 w-5" />
            <span className="text-xs">Circle</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => handleShapeTypeSelect('draw_rectangle')}
            className="flex flex-col items-center h-auto py-2"
            title="Draw Rectangle"
          >
            <Square className="mb-1 h-5 w-5" />
            <span className="text-xs">Rectangle</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
