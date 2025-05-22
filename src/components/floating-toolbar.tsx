
'use client';

import type { ActiveTool, Token, Measurement } from '@/types';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { LandPlot, Paintbrush, MousePointerSquareDashed, Map, Puzzle, DraftingCompass, Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ColorToolPanel from '@/components/controls/color-tool-panel';
import GridSettingsPanel from '@/components/controls/grid-settings-panel';
import MeasurementToolPanel from '@/components/controls/measurement-tool-panel';
import TokenPlacerPanel from '@/components/controls/token-placer-panel';


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
  backgroundZoomLevel: number; // Added prop
  setBackgroundZoomLevel: Dispatch<SetStateAction<number>>; // Added prop
}

interface ToolButtonProps {
  label: string;
  icon: React.ElementType;
  tool?: ActiveTool; 
  currentActiveTool?: ActiveTool; 
  onClick?: () => void; 
  children?: React.ReactNode; 
  asChild?: boolean; 
  variantOverride?: "default" | "outline"; 
}

const ToolButton: React.FC<ToolButtonProps> = ({ label, icon: Icon, tool, currentActiveTool, onClick, children, asChild, variantOverride }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant={variantOverride || (tool && currentActiveTool === tool ? 'default' : 'outline')}
        size="icon"
        onClick={onClick}
        className={cn(
          'rounded-md shadow-lg h-12 w-12 p-2.5',
          (variantOverride === 'default' || (tool && currentActiveTool === tool)) ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-muted'
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
  backgroundZoomLevel, setBackgroundZoomLevel, // Destructure new props
}: FloatingToolbarProps) {

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

        <ToolButton
          label="Select/Pan"
          icon={MousePointerSquareDashed}
          tool="select"
          currentActiveTool={activeTool}
          onClick={() => handleToolClick('select')}
        />

        <Popover>
          <ToolButton
            label="Token Placer"
            icon={Puzzle}
            onClick={() => handleToolClick('token_placer_tool')}
            variantOverride={activeTool === 'token_placer_tool' || activeTool === 'place_token' ? 'default' : 'outline'}
            asChild
          >
            <PopoverTrigger asChild>
              <Button
                variant={activeTool === 'token_placer_tool' || activeTool === 'place_token' ? 'default' : 'outline'}
                size="icon"
                className={cn(
                  'rounded-md shadow-lg h-12 w-12 p-2.5',
                  (activeTool === 'token_placer_tool' || activeTool === 'place_token') ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-muted'
                )}
                aria-label="Token Placer"
              >
                <Puzzle className="h-5 w-5 text-accent-foreground" />
              </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side="top" align="start">
            <TokenPlacerPanel
              setActiveTool={setActiveTool}
              setSelectedTokenTemplate={setSelectedTokenTemplate}
            />
          </PopoverContent>
        </Popover>

        <Popover>
           <ToolButton
            label="Measurement Tools"
            icon={DraftingCompass}
            onClick={() => handleToolClick(activeTool === 'measure_radius' ? 'measure_radius' : 'measure_distance')}
            variantOverride={(activeTool === 'measure_distance' || activeTool === 'measure_radius') ? 'default' : 'outline'}
            asChild
          >
            <PopoverTrigger asChild>
               <Button
                  variant={(activeTool === 'measure_distance' || activeTool === 'measure_radius') ? 'default' : 'outline'}
                  size="icon"
                  className={cn(
                    'rounded-md shadow-lg h-12 w-12 p-2.5',
                     (activeTool === 'measure_distance' || activeTool === 'measure_radius') ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-muted'
                  )}
                  aria-label="Measurement Tools"
                >
                  <DraftingCompass className="h-5 w-5 text-accent-foreground" />
                </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side="top" align="start">
            <MeasurementToolPanel
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              measurement={measurement}
              setMeasurement={setMeasurement}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <ToolButton
            label="Map & Grid Settings"
            icon={Map}
            onClick={() => handleToolClick('map_tool')}
            variantOverride={activeTool === 'map_tool' ? 'default' : 'outline'}
            asChild
          >
            <PopoverTrigger asChild>
                <Button
                  variant={activeTool === 'map_tool' ? 'default' : 'outline'}
                  size="icon"
                  className={cn(
                    'rounded-md shadow-lg h-12 w-12 p-2.5',
                    activeTool === 'map_tool' ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-muted'
                  )}
                  aria-label="Map & Grid Settings"
                >
                  <Map className="h-5 w-5 text-accent-foreground" />
                </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side="top" align="end">
            <GridSettingsPanel
              showGridLines={showGridLines}
              setShowGridLines={setShowGridLines}
              backgroundImageUrl={backgroundImageUrl}
              setBackgroundImageUrl={setBackgroundImageUrl}
              setActiveTool={setActiveTool}
              backgroundZoomLevel={backgroundZoomLevel} 
              setBackgroundZoomLevel={setBackgroundZoomLevel}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <ToolButton
            label="Color Painter"
            icon={Paintbrush}
            onClick={() => handleToolClick('paint_cell')}
            variantOverride={activeTool === 'paint_cell' ? 'default' : 'outline'}
            asChild
          >
            <PopoverTrigger asChild>
              <Button
                variant={activeTool === 'paint_cell' ? 'default' : 'outline'}
                size="icon"
                className={cn(
                  'rounded-md shadow-lg h-12 w-12 p-2.5',
                    activeTool === 'paint_cell' ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-muted'
                )}
                aria-label="Color Painter"
              >
                <Paintbrush className="h-5 w-5 text-accent-foreground" />
              </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side="top" align="end">
            <ColorToolPanel
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              selectedColor={selectedColor}
              setSelectedColor={setSelectedColor}
            />
          </PopoverContent>
        </Popover>

        <ToolButton
          label="Eraser"
          icon={Eraser}
          tool="eraser_tool"
          currentActiveTool={activeTool}
          onClick={() => handleToolClick('eraser_tool')}
        />
      </div>
    </TooltipProvider>
  );
}
