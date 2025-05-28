
'use client';

import type { ActiveTool, Token, Measurement, DrawnShape, DefaultBattleMap, FloatingToolbarProps as FloatingToolbarPropsType } from '@/types';
import type { Dispatch, SetStateAction } from 'react';
import React, { useState, useEffect } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { LandPlot, Paintbrush, MousePointerSquareDashed, Map, Users, DraftingCompass, Eraser, Shapes, Type, Undo2, Redo2, Power, ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ColorToolPanel from '@/components/controls/color-tool-panel';
import GridSettingsPanel from '@/components/controls/grid-settings-panel';
import MeasurementToolPanel from '@/components/controls/measurement-tool-panel';
import TokenPlacerPanel from '@/components/controls/token-placer-panel';
import ShapeToolPanel from '@/components/controls/shape-tool-panel';


interface FloatingToolbarProps extends FloatingToolbarPropsType {}


interface ToolButtonProps {
  label: string;
  icon?: React.ElementType; // Made icon optional as children can be used
  tool?: ActiveTool | ActiveTool[];
  currentActiveTool?: ActiveTool;
  onClick?: () => void;
  children?: React.ReactNode;
  asChild?: boolean;
  variantOverride?: "default" | "outline";
  isActive?: boolean;
  disabled?: boolean;
  className?: string;
}

const ToolButton: React.FC<ToolButtonProps> = ({ label, icon: IconComponent, tool, currentActiveTool, onClick, children, asChild, variantOverride, isActive, disabled, className }) => {
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
            'rounded-md shadow-lg h-10 w-10 p-2',
            (variantOverride === 'default' || isButtonActive) ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-muted',
            className
          )}
          aria-label={label}
          asChild={asChild}
          disabled={disabled}
        >
          {children || (IconComponent && <IconComponent className="h-5 w-5 text-accent-foreground" />)}
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
  showAllLabels, setShowAllLabels,
  measurement, setMeasurement,
  backgroundZoomLevel, setBackgroundZoomLevel,
  onUndo, onRedo, canUndo, canRedo,
  onResetBoard,
  defaultBattlemaps,
  escapePressCount,
  toolbarPosition,
  setToolbarPosition,
}: FloatingToolbarProps) {

  const [isMapSettingsPopoverOpen, setIsMapSettingsPopoverOpen] = useState(false);
  const [isMeasurementPopoverOpen, setIsMeasurementPopoverOpen] = useState(false);
  const [isTokenPlacerPopoverOpen, setIsTokenPlacerPopoverOpen] = useState(false);
  const [isColorPainterPopoverOpen, setIsColorPainterPopoverOpen] = useState(false);
  const [isShapeToolPopoverOpen, setIsShapeToolPopoverOpen] = useState(false);
  const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);


  useEffect(() => {
    if (escapePressCount && escapePressCount > 0) {
      setIsMapSettingsPopoverOpen(false);
      setIsMeasurementPopoverOpen(false);
      setIsTokenPlacerPopoverOpen(false);
      setIsColorPainterPopoverOpen(false);
      setIsShapeToolPopoverOpen(false);
      setIsResetAlertOpen(false); 
    }
  }, [escapePressCount]);


  const handleToolClick = (tool: ActiveTool) => {
    if (setActiveTool) {
      setActiveTool(tool);
    }
    if (tool !== 'map_tool' && !['measure_distance', 'measure_radius'].includes(tool) && tool !== 'token_placer_tool' && tool !== 'paint_cell' && !['shapes_tool', 'draw_line', 'draw_circle', 'draw_rectangle'].includes(tool) && tool !== 'type_tool') {
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

  const toggleToolbarPosition = () => {
    setToolbarPosition(current => (current === 'top' ? 'bottom' : 'top'));
  };

  const isToolbarAtTop = toolbarPosition === 'top';
  const popoverSide = isToolbarAtTop ? "bottom" : "top";

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn(
        "absolute left-1/2 transform -translate-x-1/2 flex items-center space-x-2 p-2 bg-background/80 backdrop-blur-sm rounded-lg shadow-lg border border-border z-50",
        isToolbarAtTop ? "top-4" : "bottom-4"
      )}>
        <ToolButton
          label={isToolbarAtTop ? "Move Toolbar to Bottom" : "Move Toolbar to Top"}
          onClick={toggleToolbarPosition}
          className={cn(
            "mr-1",
            // Default state: blue icon, blue border, transparent bg
            "border-[hsl(var(--app-blue-bg))] text-[hsl(var(--app-blue-bg))] bg-background",
            // Hover state: blue background, white icon
            "hover:bg-[hsl(var(--app-blue-bg))] hover:text-[hsl(var(--app-blue-foreground))]"
          )}
        >
          {isToolbarAtTop
            ? <ArrowDownToLine className="h-5 w-5" />
            : <ArrowUpToLine className="h-5 w-5" />
          }
        </ToolButton>
        <Separator orientation="vertical" className="h-8 bg-border mx-1" />

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
                setIsMapSettingsPopoverOpen(prev => !prev);
            }}
            isActive={isMapSettingsPopoverOpen}
            asChild
          >
            <PopoverTrigger asChild>
                <Button
                  variant={(isMapSettingsPopoverOpen) ? 'default' : 'outline'}
                  size="icon"
                  className='rounded-md shadow-lg h-10 w-10 p-2'
                  aria-label="Map Tool"
                >
                  <Map className="h-5 w-5 text-accent-foreground" />
                </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-[640px]" side={popoverSide} align="center">
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
            label="Measurement Tool"
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
                  className='rounded-md shadow-lg h-10 w-10 p-2'
                  aria-label="Measurement Tool"
                >
                  <DraftingCompass className="h-5 w-5 text-accent-foreground" />
                </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side={popoverSide} align="center">
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
            label="Token Tool"
            icon={Users}
             onClick={() => {
                setIsTokenPlacerPopoverOpen(prev => !prev);
            }}
            isActive={isTokenPlacerPopoverOpen || activeTool === 'place_token'}
            asChild
          >
            <PopoverTrigger asChild>
              <Button
                variant={(isTokenPlacerPopoverOpen || activeTool === 'place_token') ? 'default' : 'outline'}
                size="icon"
                className='rounded-md shadow-lg h-10 w-10 p-2'
                aria-label="Token Tool"
              >
                <Users className="h-5 w-5 text-accent-foreground" />
              </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side={popoverSide} align="center">
            <TokenPlacerPanel
              setActiveTool={setActiveTool}
              setSelectedTokenTemplate={setSelectedTokenTemplate}
              onTokenTemplateSelect={handleTokenTemplateSelected}
            />
          </PopoverContent>
        </Popover>

        <Popover open={isColorPainterPopoverOpen} onOpenChange={setIsColorPainterPopoverOpen}>
          <ToolButton
            label="Brush Tool"
            icon={Paintbrush}
            onClick={() => {
                setIsColorPainterPopoverOpen(prev => !prev);
            }}
            isActive={isColorPainterPopoverOpen || activeTool === 'paint_cell'}
            asChild
          >
            <PopoverTrigger asChild>
              <Button
                variant={(isColorPainterPopoverOpen || activeTool === 'paint_cell') ? 'default' : 'outline'}
                size="icon"
                className='rounded-md shadow-lg h-10 w-10 p-2'
                aria-label="Brush Tool"
              >
                <Paintbrush className="h-5 w-5 text-accent-foreground" />
              </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side={popoverSide} align="center">
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
            label="Shape Tool"
            icon={Shapes}
            onClick={() => {
              setIsShapeToolPopoverOpen(prev => !prev);
            }}
            isActive={isShapeToolPopoverOpen || activeTool === 'draw_line' || activeTool === 'draw_circle' || activeTool === 'draw_rectangle'}
            asChild
          >
            <PopoverTrigger asChild>
              <Button
                variant={isShapeToolPopoverOpen || activeTool === 'draw_line' || activeTool === 'draw_circle' || activeTool === 'draw_rectangle' ? 'default' : 'outline'}
                size="icon"
                className='rounded-md shadow-lg h-10 w-10 p-2'
                aria-label="Shape Tool"
              >
                <Shapes className="h-5 w-5 text-accent-foreground" />
              </Button>
            </PopoverTrigger>
          </ToolButton>
          <PopoverContent className="w-80" side={popoverSide} align="center">
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

        <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "rounded-md shadow-lg h-10 w-10 p-2",
                    "bg-card border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  )}
                  aria-label="Reset Board"
                >
                  <Power className="h-5 w-5" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side={popoverSide} align="center">
              <p>Reset Board</p>
            </TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Entire Board?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to clear everything? This includes all tokens, shapes, text, the background map, and initiative order. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onResetBoard();
                  setIsResetAlertOpen(false);
                }}
                className={buttonVariants({ variant: "destructive" })}
              >
                Reset Board
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </TooltipProvider>
  );
}

