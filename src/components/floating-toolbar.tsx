
'use client';

import type { ActiveTool } from '@/types';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Ruler, Maximize, Swords, Paintbrush, MousePointerSquareDashed, LandPlot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

interface FloatingToolbarProps {
  activeTool: ActiveTool;
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  title: string;
  Icon: React.ElementType;
}

interface ToolButtonProps {
  label: string;
  icon: React.ElementType;
  tool: ActiveTool;
  currentActiveTool: ActiveTool;
  onClick: () => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({ label, icon: Icon, tool, currentActiveTool, onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant={currentActiveTool === tool ? 'default' : 'outline'}
        size="icon"
        onClick={onClick}
        className={cn(
          'rounded-md shadow-lg h-12 w-12 p-2.5',
          currentActiveTool === tool ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-muted'
        )}
        aria-label={label}
      >
        <Icon className="h-5 w-5" />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top" align="center">
      <p>{label}</p>
    </TooltipContent>
  </Tooltip>
);

export default function FloatingToolbar({ activeTool, setActiveTool, title, Icon }: FloatingToolbarProps) {
  const tools: Omit<ToolButtonProps, 'currentActiveTool' | 'onClick'>[] = [
    { label: 'Select/Pan', icon: MousePointerSquareDashed, tool: 'select' },
    { label: 'Paint Cell', icon: Paintbrush, tool: 'paint_cell' },
    { label: 'Place Token', icon: Swords, tool: 'place_token' },
    { label: 'Measure Distance', icon: Ruler, tool: 'measure_distance' },
    { label: 'Measure Radius', icon: Maximize, tool: 'measure_radius' },
  ];

  const handleToolClick = (tool: ActiveTool) => {
    if (setActiveTool) {
      setActiveTool(tool);
    }
  };

  return (
    <TooltipProvider>
      <div className="absolute bottom-4 right-4 flex items-center space-x-2 p-2 bg-background/80 backdrop-blur-sm rounded-lg shadow-xl border border-border z-50">
        <div className="flex items-center gap-2 px-2 mr-2">
          <Icon className="h-6 w-6 text-primary" />
          <span className="font-semibold text-foreground">{title}</span>
        </div>
        <Separator orientation="vertical" className="h-8 bg-border" />
        {tools.map((toolProps) => (
          <ToolButton
            key={toolProps.tool}
            {...toolProps}
            currentActiveTool={activeTool}
            onClick={() => handleToolClick(toolProps.tool)}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
