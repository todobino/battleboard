
'use client';

import type { ActiveTool, Token, Measurement } from '@/types';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { LandPlot, PencilRuler, Paintbrush, MousePointerSquareDashed, Map, Puzzle, DraftingCompass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ColorToolPanel from '@/components/controls/color-tool-panel';
import GridSettingsPanel from '@/components/controls/grid-settings-panel';
import MeasurementToolPanel from '@/components/controls/measurement-tool-panel';


interface FloatingToolbarProps {
  activeTool: ActiveTool;
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  title: string;
  Icon: React.ElementType;
  selectedColor: string;
  setSelectedColor: Dispatch<SetStateAction<string>>;
  selectedTokenTemplate: Omit<Token, 'id' | 'x' | 'y'> | null;
  setSelectedTokenTemplate: Dispatch<SetStateAction<Omit<Token, 'id' | 'x' | 'y'> | null>>;
  backgroundImageUrl: string | null;
  setBackgroundImageUrl: Dispatch<SetStateAction<string | null>>;
  showGridLines: boolean;
  setShowGridLines: Dispatch<SetStateAction<boolean>>;
  measurement: Measurement;
  setMeasurement: Dispatch<SetStateAction<Measurement>>;
}

interface ToolButtonProps {
  label: string;
  icon: React.ElementType;
  tool: ActiveTool;
  currentActiveTool: ActiveTool;
  onClick: () => void;
  children?: React.ReactNode; // For PopoverTrigger
  asChild?: boolean; // For PopoverTrigger
}

const ToolButton: React.FC<ToolButtonProps> = ({ label, icon: Icon, tool, currentActiveTool, onClick, children, asChild }) => (
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
        asChild={asChild}
      >
        {children || <Icon className="h-5 w-5 text-accent-foreground" />}
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom" align="center">
      <p>{label}</p>
    </TooltipContent>
  </Tooltip>
);

export default function FloatingToolbar({
  activeTool, setActiveTool,
  title, Icon,
  selectedColor, setSelectedColor,
  selectedTokenTemplate, setSelectedTokenTemplate,
  backgroundImageUrl, setBackgroundImageUrl,
  showGridLines, setShowGridLines,
  measurement, setMeasurement,
}: FloatingToolbarProps) {

  const mainTools: Omit<ToolButtonProps, 'currentActiveTool' | 'onClick' | 'children' | 'asChild'>[] = [
    { label: 'Select/Pan', icon: MousePointerSquareDashed, tool: 'select' },
    { label: 'Token Placer', icon: Puzzle, tool: 'token_placer_tool' },
    { label: 'Drafting Tools', icon: DraftingCompass, tool: 'drafting_compass_tool' }, // Example, might be a popover
  ];

  const handleToolClick = (tool: ActiveTool) => {
    if (setActiveTool) {
      setActiveTool(tool);
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="absolute top-4 left-4 flex items-center space-x-2 p-2 bg-background/80 backdrop-blur-sm rounded-lg shadow-xl border border-border z-50">
        {Icon && title && (
          <>
            <div className="flex items-center gap-2 px-2 mr-2">
              <Icon className="h-6 w-6 text-primary" />
              <span className="font-semibold text-foreground">{title}</span>
            </div>
            <Separator orientation="vertical" className="h-8 bg-border" />
          </>
        )}

        {mainTools.map((toolProps) => (
          <ToolButton
            key={toolProps.tool}
            {...toolProps}
            currentActiveTool={activeTool}
            onClick={() => handleToolClick(toolProps.tool)}
          />
        ))}

        {/* Measurement Tools Popover */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={(activeTool === 'measure_distance' || activeTool === 'measure_radius') ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => handleToolClick('measure_distance')} // Default to distance or keep active measurement tool
                  className={cn(
                    'rounded-md shadow-lg h-12 w-12 p-2.5',
                     (activeTool === 'measure_distance' || activeTool === 'measure_radius') ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-muted'
                  )}
                  aria-label="Measurement Tools"
                >
                  <PencilRuler className="h-5 w-5 text-accent-foreground" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center">
              <p>Measurement Tools</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-80" side="top" align="start">
            <MeasurementToolPanel
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              measurement={measurement}
              setMeasurement={setMeasurement}
            />
          </PopoverContent>
        </Popover>

        {/* Grid Settings Popover */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={activeTool === 'map_tool' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => handleToolClick('map_tool')}
                  className={cn(
                    'rounded-md shadow-lg h-12 w-12 p-2.5',
                    activeTool === 'map_tool' ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-muted'
                  )}
                  aria-label="Map & Grid Settings"
                >
                  <Map className="h-5 w-5 text-accent-foreground" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center">
              <p>Map & Grid Settings</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-80" side="top" align="end">
            <GridSettingsPanel
              showGridLines={showGridLines}
              setShowGridLines={setShowGridLines}
              backgroundImageUrl={backgroundImageUrl}
              setBackgroundImageUrl={setBackgroundImageUrl}
              setActiveTool={setActiveTool}
            />
          </PopoverContent>
        </Popover>

        {/* Color & Token Tool Popover */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={activeTool === 'paint_cell' || activeTool === 'place_token' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => handleToolClick('paint_cell')}
                  className={cn(
                    'rounded-md shadow-lg h-12 w-12 p-2.5',
                     (activeTool === 'paint_cell' || activeTool === 'place_token') ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-muted'
                  )}
                  aria-label="Color & Token Tools"
                >
                  <Paintbrush className="h-5 w-5 text-accent-foreground" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center">
              <p>Color & Token Tools</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-80" side="top" align="end">
            <ColorToolPanel
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              selectedColor={selectedColor}
              setSelectedColor={setSelectedColor}
              setSelectedTokenTemplate={setSelectedTokenTemplate}
            />
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  );
}
