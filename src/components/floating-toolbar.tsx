
'use client';

import type { ActiveTool, Token, Measurement, DrawnShape, DefaultBattleMap, FloatingToolbarProps as FloatingToolbarPropsType } from '@/types';
import type { Dispatch, SetStateAction } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
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
            variant={variantOverride || (isButtonActive ? 'default' : 'outline')}
            size="icon"
            onClick={onClick}
            className={cn(
              'rounded-md shadow-lg h-10 w-10 p-2',
              (variantOverride === 'default' || isButtonActive) ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-muted',
              className
            )}
            aria-label={label}
            disabled={disabled}
          >
            {children || (IconComponent && <IconComponent className="h-5 w-5" />)}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="center">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
);
ToolButtonComponent.displayName = "ToolButtonComponent";
const ToolButton = React.memo(ToolButtonComponent);


export default function FloatingToolbar({
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
  toolbarPosition,
  setToolbarPosition,
}: FloatingToolbarProps) {

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

  useEffect(() => {
    if (escapePressCount && escapePressCount > 0) {
      setIsMapSettingsPopoverOpen(false);
      setIsMeasurementPopoverOpen(false);
      setIsTokenPlacerPopoverOpen(false);
      setIsColorPainterPopoverOpen(false);
      setIsShapeToolPopoverOpen(false);
      setIsResetAlertOpen(false);
    }
  }, [ escapePressCount, setIsResetAlertOpen ]);


  const handleToolClick = useCallback((tool: ActiveTool) => {
    setActiveTool(tool);
    setIsMapSettingsPopoverOpen(false);
    setIsMeasurementPopoverOpen(false);
    setIsTokenPlacerPopoverOpen(false);
    setIsColorPainterPopoverOpen(false);
    setIsShapeToolPopoverOpen(false);
  }, [setActiveTool]);

  const handleSelectToolClick = useCallback(() => handleToolClick('select'), [handleToolClick]);
  const handleTypeToolClick = useCallback(() => handleToolClick('type_tool'), [handleToolClick]);
  const handleEraserToolClick = useCallback(() => handleToolClick('eraser_tool'), [handleToolClick]);

  const handleTokenTemplateSelected = useCallback(() => {
    setIsTokenPlacerPopoverOpen(false);
  }, []);

  const handleColorSelected = useCallback(() => {
    setIsColorPainterPopoverOpen(false);
  }, []);

  const handleShapeToolSelected = useCallback(() => {
    setIsShapeToolPopoverOpen(false);
  }, []);

  const handleMeasurementToolSelected = useCallback(() => {
    setIsMeasurementPopoverOpen(false);
  }, []);

  const toggleToolbarPosition = useCallback(() => {
    setToolbarPosition(current => (current === 'top' ? 'bottom' : 'top'));
  }, [setToolbarPosition]);

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
            "bg-[hsl(var(--app-blue-bg))] border-[hsl(var(--app-blue-bg))] text-[hsl(var(--app-blue-foreground))]",
            "hover:bg-[hsl(var(--app-blue-hover-bg))]"
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
          onClick={handleSelectToolClick}
        />

        <Popover open={isMapSettingsPopoverOpen} onOpenChange={setIsMapSettingsPopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={isMapSettingsPopoverOpen ? 'default' : 'outline'}
                  size="icon"
                  onClick={toggleMapSettingsPopover}
                  className='rounded-md shadow-lg h-10 w-10 p-2'
                  aria-label="Map Tool"
                >
                  <Map className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side={popoverSide} align="center"><p>Map Tool</p></TooltipContent>
          </Tooltip>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={isMeasurementPopoverOpen ? 'default' : 'outline'}
                  size="icon"
                  onClick={toggleMeasurementPopover}
                  className='rounded-md shadow-lg h-10 w-10 p-2'
                  aria-label="Measurement Tool"
                >
                  <DraftingCompass className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side={popoverSide} align="center"><p>Measurement Tool</p></TooltipContent>
          </Tooltip>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={isTokenPlacerPopoverOpen ? 'default' : 'outline'}
                  size="icon"
                  onClick={toggleTokenPlacerPopover}
                  className='rounded-md shadow-lg h-10 w-10 p-2'
                  aria-label="Token Tool"
                >
                  <Users className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side={popoverSide} align="center"><p>Token Tool</p></TooltipContent>
          </Tooltip>
          <PopoverContent className="w-80" side={popoverSide} align="center">
            <TokenPlacerPanel
              setActiveTool={setActiveTool}
              setSelectedTokenTemplate={setSelectedTokenTemplate}
              onTokenTemplateSelect={handleTokenTemplateSelected}
            />
          </PopoverContent>
        </Popover>

        <Popover open={isColorPainterPopoverOpen} onOpenChange={setIsColorPainterPopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={isColorPainterPopoverOpen ? 'default' : 'outline'}
                  size="icon"
                  onClick={toggleColorPainterPopover}
                  className='rounded-md shadow-lg h-10 w-10 p-2'
                  aria-label="Brush Tool"
                >
                  <Paintbrush className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side={popoverSide} align="center"><p>Brush Tool</p></TooltipContent>
          </Tooltip>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant={isShapeToolPopoverOpen ? 'default' : 'outline'}
                  size="icon"
                  onClick={toggleShapeToolPopover}
                  className='rounded-md shadow-lg h-10 w-10 p-2'
                  aria-label="Shape Tool"
                >
                  <Shapes className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side={popoverSide} align="center"><p>Shape Tool</p></TooltipContent>
          </Tooltip>
          <PopoverContent className="w-80" side={popoverSide} align="center">
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
        <Separator orientation="vertical" className="h-8 bg-border mx-1" />

        <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="default"
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
