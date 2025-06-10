
'use client';

import type { ActiveTool, SideToolbarProps as SideToolbarPropsType, Measurement, Token, DefaultBattleMap } from '@/types';
import React, { useState, useEffect, useCallback } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { LandPlot, Paintbrush, MousePointerSquareDashed, Map, Users, DraftingCompass, Eraser, Shapes, Type, Undo2, Redo2, Power } from 'lucide-react';
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
  // variantOverride prop is removed as variant is now static internally
  isActive?: boolean;
  disabled?: boolean;
  className?: string; // Allow passing additional classes
}

const ToolButtonComponent = React.forwardRef<HTMLButtonElement, ToolButtonComponentProps>(
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
            size="icon" // Standard size for these buttons
            onClick={onClick}
            className={cn(
              // Base classes for 'outline' are handled by buttonVariants via the static variant prop.
              // Additional consistent styling for all ToolButtons:
              'rounded-md shadow-lg h-10 w-10 p-2',
              // Default appearance (matches outline styles but ensures consistency):
              'bg-card text-card-foreground hover:bg-muted',
              // Conditional active state styling (overrides default if active):
              isButtonActive && '!bg-primary !text-primary-foreground hover:!bg-primary/90',
              passedInClassName // Allow external classes to be passed
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
);
ToolButtonComponent.displayName = "ToolButtonComponent";
const ToolButton = React.memo(ToolButtonComponent);


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
      setIsResetAlertOpen(false); // Also close alert dialog on escape
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
        "flex flex-col h-full w-16 p-2 items-center space-y-2 bg-sidebar text-sidebar-foreground shadow-lg border-r border-sidebar-border z-20"
      )}>

        <ToolButton
          label="Select/Pan"
          icon={MousePointerSquareDashed}
          tool="select"
          currentActiveTool={activeTool}
          onClick={handleSelectToolClick}
        />

        <Popover open={isMapSettingsPopoverOpen} onOpenChange={toggleMapSettingsPopoverCallback}>
          <PopoverTrigger asChild>
            <Button
              variant="outline" // Static variant
              className={cn(
                'rounded-md shadow-lg h-10 w-10 p-2',
                isMapSettingsPopoverOpen ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-card text-card-foreground hover:bg-muted'
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
              variant="outline" // Static variant
              className={cn(
                'rounded-md shadow-lg h-10 w-10 p-2',
                isMeasurementPopoverOpen ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-card text-card-foreground hover:bg-muted'
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
              variant="outline" // Static variant
              className={cn(
                'rounded-md shadow-lg h-10 w-10 p-2',
                isTokenPlacerPopoverOpen ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-card text-card-foreground hover:bg-muted'
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
              variant="outline" // Static variant
              className={cn(
                'rounded-md shadow-lg h-10 w-10 p-2',
                isColorPainterPopoverOpen ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-card text-card-foreground hover:bg-muted'
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
              variant="outline" // Static variant
              className={cn(
                'rounded-md shadow-lg h-10 w-10 p-2',
                isShapeToolPopoverOpen ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-card text-card-foreground hover:bg-muted'
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

        <ToolButton
          label="Type Tool"
          icon={Type}
          tool="type_tool"
          currentActiveTool={activeTool}
          onClick={handleTypeToolClick}
        />

        <ToolButton
          label="Eraser Tool"
          icon={Eraser}
          tool="eraser_tool"
          currentActiveTool={activeTool}
          onClick={handleEraserToolClick}
        />

        <Separator orientation="horizontal" className="w-10/12 my-1 bg-sidebar-border" />

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
        <Separator orientation="horizontal" className="w-10/12 my-1 bg-sidebar-border" />

        <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline" // Keep consistent with other triggers, destructive comes from content
              className={cn(
                "rounded-md shadow-lg h-10 w-10 p-2",
                "bg-destructive text-destructive-foreground hover:bg-destructive/90" // Destructive styling
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

