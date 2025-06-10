
'use client';

import type { ActiveTool, SideToolbarProps as SideToolbarPropsType, Measurement, Token, DefaultBattleMap } from '@/types';
import React, { useState, useEffect, useCallback } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Map, Users, DraftingCompass, Eraser, Shapes, Type, Undo2, Redo2, Power, Paintbrush, MousePointerSquareDashed } from 'lucide-react';
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


interface SideToolbarProps extends SideToolbarPropsType {}


interface ToolButtonComponentProps {
  label: string;
  icon?: React.ElementType;
  tool?: ActiveTool | ActiveTool[];
  currentActiveTool?: ActiveTool;
  onClick?: () => void;
  children?: React.ReactNode;
  asChild?: boolean;
  isActive?: boolean;
  disabled?: boolean;
  className?: string;
}

const ToolButtonComponent = React.memo(React.forwardRef<HTMLButtonElement, ToolButtonComponentProps>(
  ({ label, icon: IconComponent, tool, currentActiveTool, onClick, children, asChild = false, isActive: isActiveProp, disabled, className: passedInClassName }, ref) => {
    let isButtonActive = isActiveProp;
    if (isButtonActive === undefined && tool && currentActiveTool) {
      isButtonActive = Array.isArray(tool) ? tool.includes(currentActiveTool) : currentActiveTool === tool;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            variant="outline" // Static variant
            size="icon"
            onClick={onClick}
            className={cn(
              'rounded-md shadow-lg h-10 w-10 p-2', // Consistent structural classes
              'bg-card text-card-foreground hover:bg-muted', // Default appearance
              isButtonActive && '!bg-primary !text-primary-foreground hover:!bg-primary/90', // Active state override
              passedInClassName
            )}
            aria-label={label}
            disabled={disabled}
            asChild={asChild}
          >
            {children || (IconComponent && <IconComponent className="h-5 w-5" />)}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" align="center">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
));
ToolButtonComponent.displayName = "ToolButtonComponent";


export default function SideToolbar({
  activeTool, setActiveTool,
  selectedColor, setSelectedColor,
  selectedTokenTemplate, setSelectedTokenTemplate,
  selectedShapeDrawColor, setSelectedShapeDrawColor,
  backgroundImageUrl, setBackgroundImageUrl,
  showGridLines, setShowGridLines,
  showAllLabels, setShowAllLabels,
  measurement, setMeasurement,
  backgroundZoomLevel, setBackgroundZoomLevel,
  onUndo, onRedo, canUndo, canRedo,
  onResetBoard,
  defaultBattlemaps,
  escapePressCount,
}: SideToolbarProps) {

  const [isMapSettingsPopoverOpen, setIsMapSettingsPopoverOpen] = useState(false);
  const [isMeasurementPopoverOpen, setIsMeasurementPopoverOpen] = useState(false);
  const [isTokenPlacerPopoverOpen, setIsTokenPlacerPopoverOpen] = useState(false);
  const [isColorPainterPopoverOpen, setIsColorPainterPopoverOpen] = useState(false);
  const [isShapeToolPopoverOpen, setIsShapeToolPopoverOpen] = useState(false);
  const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);

  const closeAllPopovers = useCallback(() => {
    setIsMapSettingsPopoverOpen(false);
    setIsMeasurementPopoverOpen(false);
    setIsTokenPlacerPopoverOpen(false);
    setIsColorPainterPopoverOpen(false);
    setIsShapeToolPopoverOpen(false);
  }, []);

  const toggleMapSettingsPopoverCallback = useCallback(() => {
    const nextState = !isMapSettingsPopoverOpen;
    closeAllPopovers();
    setIsMapSettingsPopoverOpen(nextState);
  }, [isMapSettingsPopoverOpen, closeAllPopovers]);

  const toggleMeasurementPopoverCallback = useCallback(() => {
    const nextState = !isMeasurementPopoverOpen;
    closeAllPopovers();
    setIsMeasurementPopoverOpen(nextState);
  }, [isMeasurementPopoverOpen, closeAllPopovers]);

  const toggleTokenPlacerPopoverCallback = useCallback(() => {
    const nextState = !isTokenPlacerPopoverOpen;
    closeAllPopovers();
    setIsTokenPlacerPopoverOpen(nextState);
  }, [isTokenPlacerPopoverOpen, closeAllPopovers]);

  const toggleColorPainterPopoverCallback = useCallback(() => {
    const nextState = !isColorPainterPopoverOpen;
    closeAllPopovers();
    setIsColorPainterPopoverOpen(nextState);
  }, [isColorPainterPopoverOpen, closeAllPopovers]);

  const toggleShapeToolPopoverCallback = useCallback(() => {
    const nextState = !isShapeToolPopoverOpen;
    closeAllPopovers();
    setIsShapeToolPopoverOpen(nextState);
  }, [isShapeToolPopoverOpen, closeAllPopovers]);


  const handleToolClick = useCallback((tool: ActiveTool) => {
    setActiveTool(tool);
    closeAllPopovers();
  }, [setActiveTool, closeAllPopovers]);

  const handleSelectToolClick = useCallback(() => { handleToolClick('select'); }, [handleToolClick]);
  const handleTypeToolClick = useCallback(() => { handleToolClick('type_tool'); }, [handleToolClick]);
  const handleEraserToolClick = useCallback(() => { handleToolClick('eraser_tool'); }, [handleToolClick]);


  useEffect(() => {
    if (escapePressCount > 0) {
      closeAllPopovers();
      setIsResetAlertOpen(false);
    }
  }, [ escapePressCount, closeAllPopovers, setIsResetAlertOpen ]);

  useEffect(() => {
    const toolSelectedFromPopover: ActiveTool[] = [
      'place_token', 'paint_cell', 'draw_line', 'draw_circle', 'draw_rectangle',
      'measure_distance', 'measure_radius'
    ];

    if (toolSelectedFromPopover.includes(activeTool)) {
      closeAllPopovers();
    }
  }, [activeTool, closeAllPopovers]);


  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn(
        "flex flex-col h-full w-16 p-2 items-center space-y-2 bg-sidebar text-sidebar-foreground shadow-lg border-r border-input z-20"
      )}>

        <ToolButtonComponent
          label="Select/Pan"
          icon={MousePointerSquareDashed}
          tool="select"
          currentActiveTool={activeTool}
          onClick={handleSelectToolClick}
          isActive={activeTool === 'select'}
        />

        <Popover open={isMapSettingsPopoverOpen} onOpenChange={toggleMapSettingsPopoverCallback}>
          <PopoverTrigger asChild>
            <Button
              variant="outline" // Static variant for popover triggers
              size="icon"
              className={cn(
                'rounded-md shadow-lg h-10 w-10 p-2',
                'bg-card text-card-foreground hover:bg-muted', // Static class for base appearance
                 isMapSettingsPopoverOpen && '!bg-primary !text-primary-foreground hover:!bg-primary/90' // Active state for popover open
              )}
              aria-label="Map Tool"
            >
              <Map className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[640px]" side="right" align="start">
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

        <Popover open={isMeasurementPopoverOpen} onOpenChange={toggleMeasurementPopoverCallback}>
          <PopoverTrigger asChild>
             <Button
              variant="outline"
              size="icon"
              className={cn(
                'rounded-md shadow-lg h-10 w-10 p-2',
                'bg-card text-card-foreground hover:bg-muted',
                isMeasurementPopoverOpen && '!bg-primary !text-primary-foreground hover:!bg-primary/90'
              )}
              aria-label="Measurement Tool"
            >
              <DraftingCompass className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" side="right" align="start">
            <MeasurementToolPanel
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              measurement={measurement}
              setMeasurement={setMeasurement}
            />
          </PopoverContent>
        </Popover>

        <Popover open={isTokenPlacerPopoverOpen} onOpenChange={toggleTokenPlacerPopoverCallback}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                'rounded-md shadow-lg h-10 w-10 p-2',
                'bg-card text-card-foreground hover:bg-muted',
                isTokenPlacerPopoverOpen && '!bg-primary !text-primary-foreground hover:!bg-primary/90'
              )}
              aria-label="Token Tool"
            >
              <Users className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" side="right" align="start">
            <TokenPlacerPanel
              setActiveTool={setActiveTool}
              setSelectedTokenTemplate={setSelectedTokenTemplate}
            />
          </PopoverContent>
        </Popover>

        <Popover open={isColorPainterPopoverOpen} onOpenChange={toggleColorPainterPopoverCallback}>
          <PopoverTrigger asChild>
             <Button
              variant="outline"
              size="icon"
              className={cn(
                'rounded-md shadow-lg h-10 w-10 p-2',
                'bg-card text-card-foreground hover:bg-muted',
                isColorPainterPopoverOpen && '!bg-primary !text-primary-foreground hover:!bg-primary/90'
              )}
              aria-label="Brush Tool"
            >
              <Paintbrush className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" side="right" align="start">
            <ColorToolPanel
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              selectedColor={selectedColor}
              setSelectedColor={setSelectedColor}
            />
          </PopoverContent>
        </Popover>

        <Popover open={isShapeToolPopoverOpen} onOpenChange={toggleShapeToolPopoverCallback}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                'rounded-md shadow-lg h-10 w-10 p-2',
                'bg-card text-card-foreground hover:bg-muted',
                isShapeToolPopoverOpen && '!bg-primary !text-primary-foreground hover:!bg-primary/90'
              )}
              aria-label="Shape Tool"
            >
              <Shapes className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" side="right" align="start">
            <ShapeToolPanel
              setActiveTool={setActiveTool}
              selectedShapeDrawColor={selectedShapeDrawColor}
              setSelectedShapeDrawColor={setSelectedShapeDrawColor}
            />
          </PopoverContent>
        </Popover>

        <ToolButtonComponent
          label="Type Tool"
          icon={Type}
          tool="type_tool"
          currentActiveTool={activeTool}
          onClick={handleTypeToolClick}
          isActive={activeTool === 'type_tool'}
        />

        <ToolButtonComponent
          label="Eraser Tool"
          icon={Eraser}
          tool="eraser_tool"
          currentActiveTool={activeTool}
          onClick={handleEraserToolClick}
          isActive={activeTool === 'eraser_tool'}
        />

        <Separator orientation="horizontal" className="w-10/12 my-1 bg-input" />

        <ToolButtonComponent
          label="Undo"
          icon={Undo2}
          onClick={onUndo}
          disabled={!canUndo}
        />
        <ToolButtonComponent
          label="Redo"
          icon={Redo2}
          onClick={onRedo}
          disabled={!canRedo}
        />
        <Separator orientation="horizontal" className="w-10/12 my-1 bg-input" />

        <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "rounded-md shadow-lg h-10 w-10 p-2",
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
              aria-label="Reset Board"
            >
              <Power className="h-5 w-5" />
            </Button>
          </AlertDialogTrigger>
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
                className={cn(buttonVariants({ variant: "destructive" }))}
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
