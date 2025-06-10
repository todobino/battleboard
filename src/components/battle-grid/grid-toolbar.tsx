
'use client';

import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Minus, Grid2x2Check, Grid2x2X, Maximize, ListCheck, ListX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GridToolbarProps {
  showGridLines: boolean;
  setShowGridLines: (show: boolean) => void;
  showAllLabels: boolean;
  setShowAllLabels: (show: boolean) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

const GridToolbarComponent: React.FC<GridToolbarProps> = ({
  showGridLines,
  setShowGridLines,
  showAllLabels,
  setShowAllLabels,
  onZoomIn,
  onZoomOut,
  onResetView,
}) => {

  const handleToggleGridLines = useCallback(() => {
    setShowGridLines(!showGridLines);
  }, [showGridLines, setShowGridLines]);

  const handleToggleAllLabels = useCallback(() => {
    setShowAllLabels(!showAllLabels);
  }, [showAllLabels, setShowAllLabels]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="absolute top-4 right-4 flex flex-row space-x-2 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleToggleGridLines}
              className={cn(
                "rounded-md shadow-lg h-10 w-10 p-2",
                showGridLines
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-card text-card-foreground hover:bg-muted"
              )}
              aria-label={showGridLines ? "Hide Grid Lines" : "Show Grid Lines"}
            >
              {showGridLines ? <Grid2x2Check className="h-5 w-5" /> : <Grid2x2X className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="center">
            <p>{showGridLines ? "Hide Grid Lines" : "Show Grid Lines"}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleToggleAllLabels}
              className={cn(
                "rounded-md shadow-lg h-10 w-10 p-2",
                showAllLabels
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-card text-card-foreground hover:bg-muted"
              )}
              aria-label={showAllLabels ? "Hide All Labels" : "Show All Labels"}
            >
              {showAllLabels ? <ListCheck className="h-5 w-5" /> : <ListX className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="center">
            <p>{showAllLabels ? "Hide All Labels" : "Show All Labels"}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={onZoomIn} className="rounded-md shadow-lg h-10 w-10 p-2 bg-card text-card-foreground hover:bg-muted" aria-label="Zoom In" >
              <Plus className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="center"><p>Zoom In</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={onResetView} className="rounded-md shadow-lg h-10 w-10 p-2 bg-card text-card-foreground hover:bg-muted" aria-label="Reset View">
              <Maximize className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="center"><p>Reset View</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={onZoomOut} className="rounded-md shadow-lg h-10 w-10 p-2 bg-card text-card-foreground hover:bg-muted" aria-label="Zoom Out" >
              <Minus className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="center"><p>Zoom Out</p></TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

const GridToolbar = React.memo(GridToolbarComponent);
export default GridToolbar;
