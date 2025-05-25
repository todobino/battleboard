
'use client';

import type { ActiveTool, Token, Measurement, DrawnShape } from '@/types';
import type { Dispatch, SetStateAction } from 'react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LandPlot, Paintbrush, MousePointerSquareDashed, Map, Users, DraftingCompass, Eraser, Shapes, Circle, Square as SquareIcon, LineChart, Ruler, Type } from 'lucide-react'; // Added Type icon
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ColorToolPanel from '@/components/controls/color-tool-panel';
import GridSettingsPanel from '@/components/controls/grid-settings-panel';
import MeasurementToolPanel from '@/components/controls/measurement-tool-panel';
import TokenPlacerPanel from '@/components/controls/token-placer-panel';
import ShapeToolPanel from '@/components/controls/shape-tool-panel';


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
  backgroundZoomLevel: number;
  setBackgroundZoomLevel: Dispatch<SetStateAction<number>>;
}

interface ToolButtonProps {
  label: string;
  icon: React.ElementType;
  tool?: ActiveTool | ActiveTool[];
  currentActiveTool?: ActiveTool;
  onClick?: () => void;
  children?: React.ReactNode;
  asChild?: boolean;
  variantOverride?: "default" | "outline";
  isActive?: boolean;
}

const ToolButton: React.FC<ToolButtonProps> = ({ label, icon: IconComponent, tool, currentActiveTool, onClick, children, asChild, variantOverride, isActive }) => {
  let isButtonActive = isActive;
  if (isButtonActive === undefined && tool && currentActiveTool) {
    isButtonActive = Array.isArray(tool) ? tool.includes(currentActiveTool) : currentActiveTool === tool;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variantOverride || (isButtonActive ? 'default' : 'outline')}
          size="icon"
          onClick={onClick}
          className={cn(
            'rounded-md shadow-lg h-12 w-12 p-2.5',
            (variantOverride === 'default' || isButtonActive) ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-muted'
          )}
          aria-label={label}
          asChild={asChild}
        >
          {children || <IconComponent className="h-5 w-5 text-accent-foreground" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default function FloatingToolbar({
  activeTool, setActiveTool,
  title, Icon,
  selectedColor, setSelectedColor,
  selectedTokenTemplate, setSelectedTokenTemplate,
  backgroundImageUrl, setBackgroundImageUrl,
  showGridLines, setShowGridLines,
  measurement, setMeasurement,
  backgroundZoomLevel, setBackgroundZoomLevel,
}: FloatingToolbarProps) {

  const [isMapSettingsPopoverOpen, setIsMapSettingsPopoverOpen] = useState(false);
  const [isMeasurementPopoverOpen, setIsMeasurementPopoverOpen] = useState(false);
  const [isTokenPlacerPopoverOpen, setIsTokenPlacerPopoverOpen] = useState(false);
  const [isColorPainterPopoverOpen, setIsColorPainterPopoverOpen] = useState(false);
  const [isShapeToolPopoverOpen, setIsShapeToolPopoverOpen] = useState(false);


  const handleToolClick = (tool: ActiveTool) => {
    if (setActiveTool) {
      setActiveTool(tool);
    }
    // Close other popovers if they are not the one being interacted with
    if (tool !== 'map_tool' && !['measure_distance', 'measure_radius'].includes(tool) && tool !== 'token_placer_tool' && tool !== 'paint_cell' && !['shapes_tool', 'draw_line', 'draw_circle', 'draw_square'].includes(tool) && tool !== 'type_tool') {
        setIsMapSettingsPopoverOpen(false);
        setIsMeasurementPopoverOpen(false);
        setIsTokenPlacerPopoverOpen(false);
        setIsColorPainterPopoverOpen(false);
        setIsShapeToolPopoverOpen(false);
    }
  };

  const handleTokenTemplateSelected = () => {
    setIsTokenPlacerPopoverOpen(false);
  };

  const handleColorSelected = () => {
    setIsColorPainterPopoverOpen(false);
  };

  const handleShapeToolSelected = () => {
    setIsShapeToolPopoverOpen(false);
  };

  const handleMeasurementToolSelected = () => {
    setIsMeasurementPopoverOpen(false);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="absolute top-4 left-4 flex items-center space-x-2 p-2 bg-background/80 backdrop-blur-sm rounded-lg shadow-lg border border-border z-50">
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

        <Popover open={isMapSettingsPopoverOpen} onOpenChange={setIsMapSettingsPopoverOpen}>
          <ToolButton
            label="Map & Grid Settings"
            icon={Map}
            onClick={() => {
                handleToolClick('map_tool');
                setIsMapSettingsPopoverOpen(prev => !prev);
            }}
            isActive={isMapSettingsPopoverOpen || activeTool === 'map_tool'}
            asChild
          >
            <PopoverTrigger asChild>
                <Button
                  variant={(isMapSettingsPopoverOpen || activeTool === 'map_tool') ? 'default' : 'outline'}
                  size="icon"
                  className='rounded-md shadow-lg h-12 w-12 p-2.5'
                  aria-label="Map & Grid Settings"
                >
                  <Map className="h-5 w-5 text-accent-foreground" />
                </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-[640px]" side="bottom" align="start">
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

        <Popover open={isMeasurementPopoverOpen} onOpenChange={setIsMeasurementPopoverOpen}>
           <ToolButton
            label="Measurement Tools"
            icon={DraftingCompass}
            onClick={() => {
                setIsMeasurementPopoverOpen(prev => !prev);
            }}
            isActive={isMeasurementPopoverOpen || activeTool === 'measure_distance' || activeTool === 'measure_radius'}
            asChild
          >
            <PopoverTrigger asChild>
               <Button
                  variant={(isMeasurementPopoverOpen || activeTool === 'measure_distance' || activeTool === 'measure_radius') ? 'default' : 'outline'}
                  size="icon"
                  className='rounded-md shadow-lg h-12 w-12 p-2.5'
                  aria-label="Measurement Tools"
                >
                  <DraftingCompass className="h-5 w-5 text-accent-foreground" />
                </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side="bottom" align="start">
            <MeasurementToolPanel
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              measurement={measurement}
              setMeasurement={setMeasurement}
              onToolSelect={handleMeasurementToolSelected}
            />
          </PopoverContent>
        </Popover>

        <Popover open={isTokenPlacerPopoverOpen} onOpenChange={setIsTokenPlacerPopoverOpen}>
          <ToolButton
            label="Tokens & Terrain"
            icon={Users}
             onClick={() => {
                handleToolClick('token_placer_tool');
                setIsTokenPlacerPopoverOpen(prev => !prev);
            }}
            isActive={isTokenPlacerPopoverOpen || activeTool === 'token_placer_tool' || activeTool === 'place_token'}
            asChild
          >
            <PopoverTrigger asChild>
              <Button
                variant={(isTokenPlacerPopoverOpen || activeTool === 'token_placer_tool' || activeTool === 'place_token') ? 'default' : 'outline'}
                size="icon"
                className='rounded-md shadow-lg h-12 w-12 p-2.5'
                aria-label="Tokens & Terrain"
              >
                <Users className="h-5 w-5 text-accent-foreground" />
              </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side="bottom" align="start">
            <TokenPlacerPanel
              setActiveTool={setActiveTool}
              setSelectedTokenTemplate={setSelectedTokenTemplate}
              onTokenTemplateSelect={handleTokenTemplateSelected}
            />
          </PopoverContent>
        </Popover>

        <Popover open={isColorPainterPopoverOpen} onOpenChange={setIsColorPainterPopoverOpen}>
          <ToolButton
            label="Color Painter"
            icon={Paintbrush}
            onClick={() => {
                handleToolClick('paint_cell');
                setIsColorPainterPopoverOpen(prev => !prev);
            }}
            isActive={isColorPainterPopoverOpen || activeTool === 'paint_cell'}
            asChild
          >
            <PopoverTrigger asChild>
              <Button
                variant={(isColorPainterPopoverOpen || activeTool === 'paint_cell') ? 'default' : 'outline'}
                size="icon"
                className='rounded-md shadow-lg h-12 w-12 p-2.5'
                aria-label="Color Painter"
              >
                <Paintbrush className="h-5 w-5 text-accent-foreground" />
              </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side="bottom" align="start">
            <ColorToolPanel
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              selectedColor={selectedColor}
              setSelectedColor={setSelectedColor}
              onColorSelect={handleColorSelected}
            />
          </PopoverContent>
        </Popover>

        <Popover open={isShapeToolPopoverOpen} onOpenChange={setIsShapeToolPopoverOpen}>
          <ToolButton
            label="Shape Tools"
            icon={Shapes}
            onClick={() => {
              handleToolClick('shapes_tool');
              setIsShapeToolPopoverOpen(prev => !prev);
            }}
            isActive={isShapeToolPopoverOpen || activeTool === 'shapes_tool' || activeTool === 'draw_line' || activeTool === 'draw_circle' || activeTool === 'draw_square'}
            asChild
          >
            <PopoverTrigger asChild>
              <Button
                variant={isShapeToolPopoverOpen || activeTool === 'shapes_tool' || activeTool === 'draw_line' || activeTool === 'draw_circle' || activeTool === 'draw_square' ? 'default' : 'outline'}
                size="icon"
                className='rounded-md shadow-lg h-12 w-12 p-2.5'
                aria-label="Shape Tools"
              >
                <Shapes className="h-5 w-5 text-accent-foreground" />
              </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side="bottom" align="start">
            <ShapeToolPanel
              setActiveTool={setActiveTool}
              onToolSelect={handleShapeToolSelected}
            />
          </PopoverContent>
        </Popover>

        <ToolButton
          label="Type Tool"
          icon={Type}
          tool="type_tool"
          currentActiveTool={activeTool}
          onClick={() => handleToolClick('type_tool')}
        />

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
