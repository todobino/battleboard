
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool } from '@/types';
import { Button } from '@/components/ui/button';
import { LineChart, Circle, Square } from 'lucide-react'; // Shapes icon removed

interface ShapeToolPanelProps {
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  onToolSelect?: () => void; // Callback to close popover
}

export default function ShapeToolPanel({
  setActiveTool,
  onToolSelect,
}: ShapeToolPanelProps) {
  const handleShapeSelect = (tool: 'draw_line' | 'draw_circle' | 'draw_square') => {
    setActiveTool(tool);
    onToolSelect?.();
  };

  return (
    <div className="space-y-2"> {/* Padding removed, mb-3 removed from header which is now gone */}
      {/* Header div containing "Shape Tools" text and icon removed */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          onClick={() => handleShapeSelect('draw_line')}
          className="flex flex-col items-center h-auto py-2"
          title="Draw Line"
        >
          <LineChart className="mb-1 h-5 w-5" />
          <span className="text-xs">Line</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => handleShapeSelect('draw_circle')}
          className="flex flex-col items-center h-auto py-2"
          title="Draw Circle"
        >
          <Circle className="mb-1 h-5 w-5" />
          <span className="text-xs">Circle</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => handleShapeSelect('draw_square')}
          className="flex flex-col items-center h-auto py-2"
          title="Draw Square"
        >
          <Square className="mb-1 h-5 w-5" />
          <span className="text-xs">Square</span>
        </Button>
      </div>
      {/* "Click and drag on the grid to draw a shape." paragraph removed */}
    </div>
  );
}
