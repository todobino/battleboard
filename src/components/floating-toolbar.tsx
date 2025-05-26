
'use client';

import type { ActiveTool, Token, Measurement, DrawnShape, DefaultBattleMap, FloatingToolbarProps as FloatingToolbarPropsType } from '@/types'; // Added DefaultBattleMap and imported existing props type
import type { Dispatch, SetStateAction } from 'react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LandPlot, Paintbrush, MousePointerSquareDashed, Map, Users, DraftingCompass, Eraser, Shapes, Circle, Square as SquareIcon, LineChart, Ruler, Type, Undo2, Redo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ColorToolPanel from '@/components/controls/color-tool-panel';
import GridSettingsPanel from '@/components/controls/grid-settings-panel';
import MeasurementToolPanel from '@/components/controls/measurement-tool-panel';
import TokenPlacerPanel from '@/components/controls/token-placer-panel';
import ShapeToolPanel from '@/components/controls/shape-tool-panel';

// Re-define props here if not using the imported type directly, or ensure the imported one is correctly structured
// For clarity, using the imported type:
interface FloatingToolbarProps extends FloatingToolbarPropsType {}


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
  disabled?: boolean;
}

const ToolButton: React.FC<ToolButtonProps> = ({ label, icon: IconComponent, tool, currentActiveTool, onClick, children, asChild, variantOverride, isActive, disabled }) => {
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
            'rounded-md shadow-lg h-10 w-10 p-2', // Changed from h-12 w-12 p-2.5
            (variantOverride === 'default' || isButtonActive) ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-muted'
          )}
          aria-label={label}
          asChild={asChild}
          disabled={disabled}
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
  selectedColor, setSelectedColor,
  selectedTokenTemplate, setSelectedTokenTemplate,
  backgroundImageUrl, setBackgroundImageUrl,
  showGridLines, setShowGridLines,
  measurement, setMeasurement,
  backgroundZoomLevel, setBackgroundZoomLevel,
  onUndo, onRedo, canUndo, canRedo,
  defaultBattlemaps,
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
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 p-2 bg-background/80 backdrop-blur-sm rounded-lg shadow-lg border border-border z-50">
        {/* Title and Icon removed from here */}
        <ToolButton
          label="Select/Pan"
          icon={MousePointerSquareDashed}
          tool="select"
          currentActiveTool={activeTool}
          onClick={() => handleToolClick('select')}
        />

        <Popover open={isMapSettingsPopoverOpen} onOpenChange={setIsMapSettingsPopoverOpen}>
          <ToolButton
            label="Map Tool"
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
                  className='rounded-md shadow-lg h-10 w-10 p-2' // Changed from h-12 w-12 p-2.5
                  aria-label="Map Tool"
                >
                  <Map className="h-5 w-5 text-accent-foreground" />
                </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-[640px]" side="bottom" align="center">
            <GridSettingsPanel
              showGridLines={showGridLines}
              setShowGridLines={setShowGridLines}
              backgroundImageUrl={backgroundImageUrl}
              setBackgroundImageUrl={setBackgroundImageUrl}
              setActiveTool={setActiveTool}
              backgroundZoomLevel={backgroundZoomLevel}
              setBackgroundZoomLevel={setBackgroundZoomLevel}
              defaultBattlemaps={defaultBattlemaps}
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
                  className='rounded-md shadow-lg h-10 w-10 p-2' // Changed from h-12 w-12 p-2.5
                  aria-label="Measurement Tools"
                >
                  <DraftingCompass className="h-5 w-5 text-accent-foreground" />
                </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side="bottom" align="center">
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
            label="Tokens Tool"
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
                className='rounded-md shadow-lg h-10 w-10 p-2' // Changed from h-12 w-12 p-2.5
                aria-label="Tokens Tool"
              >
                <Users className="h-5 w-5 text-accent-foreground" />
              </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side="bottom" align="center">
            <TokenPlacerPanel
              setActiveTool={setActiveTool}
              setSelectedTokenTemplate={setSelectedTokenTemplate}
              onTokenTemplateSelect={handleTokenTemplateSelected}
            />
          </PopoverContent>
        </Popover>

        <Popover open={isColorPainterPopoverOpen} onOpenChange={setIsColorPainterPopoverOpen}>
          <ToolButton
            label="Paint Tool"
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
                className='rounded-md shadow-lg h-10 w-10 p-2' // Changed from h-12 w-12 p-2.5
                aria-label="Paint Tool"
              >
                <Paintbrush className="h-5 w-5 text-accent-foreground" />
              </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side="bottom" align="center">
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
            label="Shapes Tool"
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
                className='rounded-md shadow-lg h-10 w-10 p-2' // Changed from h-12 w-12 p-2.5
                aria-label="Shapes Tool"
              >
                <Shapes className="h-5 w-5 text-accent-foreground" />
              </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side="bottom" align="center">
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
          label="Eraser Tool"
          icon={Eraser}
          tool="eraser_tool"
          currentActiveTool={activeTool}
          onClick={() => handleToolClick('eraser_tool')}
        />

        <Separator orientation="vertical" className="h-8 bg-border mx-1" />

        <ToolButton
          label="Undo"
          icon={Undo2}
          onClick={onUndo}
          disabled={!canUndo}
        />
        <ToolButton
          label="Redo"
          icon={Redo2}
          onClick={onRedo}
          disabled={!canRedo}
        />
        
      </div>
    </TooltipProvider>
  );
}

