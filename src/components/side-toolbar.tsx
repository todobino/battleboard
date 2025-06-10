
'use client';

import type { ActiveTool, Token, Measurement, DrawnShape, DefaultBattleMap, SideToolbarProps as SideToolbarPropsType } from '@/types';
import type { Dispatch, SetStateAction } from 'react';
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
  variantOverride?: "default" | "outline";
  isActive?: boolean;
  disabled?: boolean;
  className?: string;
}

const ToolButtonComponent = React.forwardRef<HTMLButtonElement, ToolButtonComponentProps>(
  ({ label, icon: IconComponent, tool, currentActiveTool, onClick, children, asChild = false, variantOverride, isActive: isActiveProp, disabled, className }, ref) => {
    let isButtonActive = isActiveProp;
    if (isButtonActive === undefined && tool && currentActiveTool) {
      isButtonActive = Array.isArray(tool) ? tool.includes(currentActiveTool) : currentActiveTool === tool;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            variant={variantOverride || (isButtonActive ? 'default' : 'outline')} // Variant prop still determines base structure
            size="icon"
            onClick={onClick}
            className={cn(
              'rounded-md shadow-lg h-10 w-10 p-2',
              // Specific background and text colors override variant styles
              isButtonActive 
                ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                : 'bg-card text-card-foreground hover:bg-muted',
              className
            )}
            aria-label={label}
            disabled={disabled}
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

  const toggleMapSettingsPopover = useCallback(() => setIsMapSettingsPopoverOpen(prev => !prev), []);
  const toggleMeasurementPopover = useCallback(() => setIsMeasurementPopoverOpen(prev => !prev), []);
  const toggleTokenPlacerPopover = useCallback(() => setIsTokenPlacerPopoverOpen(prev => !prev), []);
  const toggleColorPainterPopover = useCallback(() => setIsColorPainterPopoverOpen(prev => !prev), []);
  const toggleShapeToolPopover = useCallback(() => setIsShapeToolPopoverOpen(prev => !prev), []);

  const handleToolClick = useCallback((tool: ActiveTool) => {
    setActiveTool(tool);
    setIsMapSettingsPopoverOpen(false);
    setIsMeasurementPopoverOpen(false);
    setIsTokenPlacerPopoverOpen(false);
    setIsColorPainterPopoverOpen(false);
    setIsShapeToolPopoverOpen(false);
  }, [setActiveTool, setIsMapSettingsPopoverOpen, setIsMeasurementPopoverOpen, setIsTokenPlacerPopoverOpen, setIsColorPainterPopoverOpen, setIsShapeToolPopoverOpen]);

  const handleSelectToolClick = useCallback(() => handleToolClick('select'), [handleToolClick]);
  const handleTypeToolClick = useCallback(() => handleToolClick('type_tool'), [handleToolClick]);
  const handleEraserToolClick = useCallback(() => handleToolClick('eraser_tool'), [handleToolClick]);


  useEffect(() => {
    if (escapePressCount && escapePressCount > 0) {
      setIsMapSettingsPopoverOpen(false);
      setIsMeasurementPopoverOpen(false);
      setIsTokenPlacerPopoverOpen(false);
      setIsColorPainterPopoverOpen(false);
      setIsShapeToolPopoverOpen(false);
      setIsResetAlertOpen(false); // Add reset for alert dialog as well
    }
  }, [ escapePressCount, setIsMapSettingsPopoverOpen, setIsMeasurementPopoverOpen, setIsTokenPlacerPopoverOpen, setIsColorPainterPopoverOpen, setIsShapeToolPopoverOpen, setIsResetAlertOpen ]);


  const handleTokenTemplateSelected = useCallback(() => {
    setIsTokenPlacerPopoverOpen(false);
  }, [setIsTokenPlacerPopoverOpen]);

  const handleColorSelected = useCallback(() => {
    setIsColorPainterPopoverOpen(false);
  }, [setIsColorPainterPopoverOpen]);

  const handleShapeToolSelected = useCallback(() => {
    setIsShapeToolPopoverOpen(false);
  }, [setIsShapeToolPopoverOpen]);

  const handleMeasurementToolSelected = useCallback(() => {
    setIsMeasurementPopoverOpen(false);
  }, [setIsMeasurementPopoverOpen]);

  const popoverSide = "right";
  const popoverAlign = "start";

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

        <Popover open={isMapSettingsPopoverOpen} onOpenChange={toggleMapSettingsPopover}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={isMapSettingsPopoverOpen ? 'default' : 'outline'}
                  size="icon"
                  className={cn('rounded-md shadow-lg h-10 w-10 p-2', 
                    isMapSettingsPopoverOpen 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                    : 'bg-card text-card-foreground hover:bg-muted'
                  )}
                  aria-label="Map Tool"
                >
                  <Map className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side={popoverSide} align="center"><p>Map Tool</p></TooltipContent>
          </Tooltip>
          <PopoverContent className="w-[640px]" side={popoverSide} align={popoverAlign}>
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

        <Popover open={isMeasurementPopoverOpen} onOpenChange={toggleMeasurementPopover}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={isMeasurementPopoverOpen ? 'default' : 'outline'}
                  size="icon"
                  className={cn('rounded-md shadow-lg h-10 w-10 p-2', 
                    isMeasurementPopoverOpen 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                    : 'bg-card text-card-foreground hover:bg-muted'
                  )}
                  aria-label="Measurement Tool"
                >
                  <DraftingCompass className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side={popoverSide} align="center"><p>Measurement Tool</p></TooltipContent>
          </Tooltip>
          <PopoverContent className="w-80" side={popoverSide} align={popoverAlign}>
            <MeasurementToolPanel
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              measurement={measurement}
              setMeasurement={setMeasurement}
              onToolSelect={handleMeasurementToolSelected}
            />
          </PopoverContent>
        </Popover>

        <Popover open={isTokenPlacerPopoverOpen} onOpenChange={toggleTokenPlacerPopover}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={isTokenPlacerPopoverOpen ? 'default' : 'outline'}
                  size="icon"
                  className={cn('rounded-md shadow-lg h-10 w-10 p-2', 
                    isTokenPlacerPopoverOpen 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                    : 'bg-card text-card-foreground hover:bg-muted'
                  )}
                  aria-label="Token Tool"
                >
                  <Users className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side={popoverSide} align="center"><p>Token Tool</p></TooltipContent>
          </Tooltip>
          <PopoverContent className="w-80" side={popoverSide} align={popoverAlign}>
            <TokenPlacerPanel
              setActiveTool={setActiveTool}
              setSelectedTokenTemplate={setSelectedTokenTemplate}
              onTokenTemplateSelect={handleTokenTemplateSelected}
            />
          </PopoverContent>
        </Popover>

        <Popover open={isColorPainterPopoverOpen} onOpenChange={toggleColorPainterPopover}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={isColorPainterPopoverOpen ? 'default' : 'outline'}
                  size="icon"
                  className={cn('rounded-md shadow-lg h-10 w-10 p-2', 
                    isColorPainterPopoverOpen 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                    : 'bg-card text-card-foreground hover:bg-muted'
                  )}
                  aria-label="Brush Tool"
                >
                  <Paintbrush className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side={popoverSide} align="center"><p>Brush Tool</p></TooltipContent>
          </Tooltip>
          <PopoverContent className="w-80" side={popoverSide} align={popoverAlign}>
            <ColorToolPanel
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              selectedColor={selectedColor}
              setSelectedColor={setSelectedColor}
              onColorSelect={handleColorSelected}
            />
          </PopoverContent>
        </Popover>

        <Popover open={isShapeToolPopoverOpen} onOpenChange={toggleShapeToolPopover}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={isShapeToolPopoverOpen ? 'default' : 'outline'}
                  size="icon"
                  className={cn('rounded-md shadow-lg h-10 w-10 p-2', 
                    isShapeToolPopoverOpen 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                    : 'bg-card text-card-foreground hover:bg-muted'
                  )}
                  aria-label="Shape Tool"
                >
                  <Shapes className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side={popoverSide} align="center"><p>Shape Tool</p></TooltipContent>
          </Tooltip>
          <PopoverContent className="w-80" side={popoverSide} align={popoverAlign}>
            <ShapeToolPanel
              setActiveTool={setActiveTool}
              selectedShapeDrawColor={selectedShapeDrawColor}
              setSelectedShapeDrawColor={setSelectedShapeDrawColor}
              onToolSelect={handleShapeToolSelected}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="default" // This should stay as destructive variant visually
                  size="icon"
                  className={cn(
                    "rounded-md shadow-lg h-10 w-10 p-2",
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90" // Explicit destructive styling
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
