
'use client';

import type { Point, BattleGridProps, Token as TokenType, DrawnShape } from '@/types';
import type { LucideProps } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const GRID_SIZE = 30;
const DEFAULT_CELL_SIZE = 30;
const BORDER_WIDTH_WHEN_VISIBLE = 1;
const FEET_PER_SQUARE = 5;
const ZOOM_AMOUNT = 1.1; // For button zoom

// Helper to snap to grid cell centers (for circles)
const snapToCellCenter = (pos: Point, cellSize: number): Point => ({
  x: Math.floor(pos.x / cellSize) * cellSize + cellSize / 2,
  y: Math.floor(pos.y / cellSize) * cellSize + cellSize / 2,
});

// Helper to snap to grid vertices (for lines, squares)
const snapToVertex = (pos: Point, cellSize: number): Point => ({
  x: Math.round(pos.x / cellSize) * cellSize,
  y: Math.round(pos.y / cellSize) * cellSize,
});

// Helper functions for distance to line segment
function sqr(x: number) { return x * x; }
function dist2(v: Point, w: Point) { return sqr(v.x - w.x) + sqr(v.y - w.y); }
function distToSegmentSquared(p: Point, v: Point, w: Point) {
  const l2 = dist2(v, w);
  if (l2 === 0) return dist2(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}
function distanceToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt(distToSegmentSquared({ x: px, y: py }, { x: x1, y: y1 }, { x: x2, y: y2 }));
}


export default function BattleGrid({
  gridCells,
  setGridCells,
  tokens,
  setTokens,
  drawnShapes,
  setDrawnShapes,
  currentDrawingShape,
  setCurrentDrawingShape,
  showGridLines,
  backgroundImageUrl,
  backgroundZoomLevel = 1,
  activeTool,
  setActiveTool,
  onTokenMove,
  selectedColor,
  selectedTokenTemplate,
  measurement,
  setMeasurement,
}: BattleGridProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState(() => {
    const initialContentWidth = GRID_SIZE * DEFAULT_CELL_SIZE;
    const initialContentHeight = GRID_SIZE * DEFAULT_CELL_SIZE;
    // Assume showGridLines is true for the very first render's default.
    // The useEffect will correct this if showGridLines is false.
    const currentBorderWidth = BORDER_WIDTH_WHEN_VISIBLE; 
    const padding = currentBorderWidth / 2;
    return `${0 - padding} ${0 - padding} ${initialContentWidth + currentBorderWidth} ${initialContentHeight + currentBorderWidth}`;
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [draggingToken, setDraggingToken] = useState<TokenType | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [draggingTokenPosition, setDraggingTokenPosition] = useState<Point | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [hoveredCellWhilePaintingOrErasing, setHoveredCellWhilePaintingOrErasing] = useState<Point | null>(null);
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingStartPoint, setDrawingStartPoint] = useState<Point | null>(null);


  const { toast } = useToast();
  const cellSize = DEFAULT_CELL_SIZE;

   useEffect(() => {
    const contentWidth = GRID_SIZE * cellSize;
    const contentHeight = GRID_SIZE * cellSize;
    const currentBorderWidth = showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0;
    const svgPadding = currentBorderWidth / 2;

    const expectedMinX = 0 - svgPadding;
    const expectedMinY = 0 - svgPadding;
    const expectedVw = contentWidth + currentBorderWidth;
    const expectedVh = contentHeight + currentBorderWidth;
    
    setViewBox(currentVbString => {
      const currentVbParts = currentVbString.split(' ').map(Number);
      const needsRecenter = Math.abs(currentVbParts[0] - expectedMinX) > 1e-3 ||
                            Math.abs(currentVbParts[1] - expectedMinY) > 1e-3 ||
                            Math.abs(currentVbParts[2] - expectedVw) > 1e-3 ||
                            Math.abs(currentVbParts[3] - expectedVh) > 1e-3;

      // currentZoomLevel represents how much the viewBox width (currentVbParts[2])
      // differs from the base content width. A zoom level of 1 means currentVbParts[2] is contentWidth.
      const currentZoomRatio = contentWidth !== 0 ? currentVbParts[2] / contentWidth : 1;
      
      // Only recenter if at base zoom (viewBox width matches content width) and position is off
      if (needsRecenter && Math.abs(currentZoomRatio - (expectedVw / contentWidth)) < 1e-3 ) {
           return `${expectedMinX} ${expectedMinY} ${expectedVw} ${expectedVh}`;
      }
      return currentVbString;
    });
  }, [showGridLines, cellSize]);


  const getMousePosition = (event: React.MouseEvent<SVGSVGElement> | React.WheelEvent<SVGSVGElement> | MouseEvent): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const CTM = svg.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (event.clientX - CTM.e) / CTM.a,
      y: (event.clientY - CTM.f) / CTM.d,
    };
  };

  const eraseContentAtCell = (gridX: number, gridY: number) => {
    setGridCells(prev => {
      const newCells = prev.map(row => row.map(cell => ({ ...cell })));
      if (newCells[gridY] && newCells[gridY][gridX]) {
        newCells[gridY][gridX].color = undefined;
      }
      return newCells;
    });
    setTokens(prev => prev.filter(token => !(token.x === gridX && token.y === gridY)));

    const cellCenterX = gridX * cellSize + cellSize / 2;
    const cellCenterY = gridY * cellSize + cellSize / 2;

    setDrawnShapes(prevShapes =>
      prevShapes.filter(shape => {
        if (shape.type === 'line') {
          const distToLine = distanceToLineSegment(
            cellCenterX, cellCenterY,
            shape.startPoint.x, shape.startPoint.y,
            shape.endPoint.x, shape.endPoint.y
          );
          return distToLine > (shape.strokeWidth / 2 + 2); 
        } else if (shape.type === 'circle') {
          const distToCircleCenter = Math.sqrt(
            Math.pow(cellCenterX - shape.startPoint.x, 2) +
            Math.pow(cellCenterY - shape.startPoint.y, 2)
          );
          const radius = Math.sqrt(
            Math.pow(shape.endPoint.x - shape.startPoint.x, 2) +
            Math.pow(shape.endPoint.y - shape.startPoint.y, 2)
          );
          return distToCircleCenter > radius;
        } else if (shape.type === 'square') {
          const rectX = Math.min(shape.startPoint.x, shape.endPoint.x);
          const rectY = Math.min(shape.startPoint.y, shape.endPoint.y);
          const rectWidth = Math.abs(shape.endPoint.x - shape.startPoint.x);
          const rectHeight = Math.abs(shape.endPoint.y - shape.startPoint.y);
          return !(
            cellCenterX >= rectX &&
            cellCenterX <= rectX + rectWidth &&
            cellCenterY >= rectY &&
            cellCenterY <= rectY + rectHeight
          );
        }
        return true;
      })
    );
  };


  const handleGridMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePosition(event);
    const gridX = Math.floor(pos.x / cellSize);
    const gridY = Math.floor(pos.y / cellSize);

    if (activeTool === 'select' && (event.button === 0 || event.button === 1)) {
        if (gridX < 0 || gridX >= GRID_SIZE || gridY < 0 || gridY >= GRID_SIZE) {
            if (event.button === 1 || (event.button === 0 && (event.ctrlKey || event.metaKey) )) {
                 setIsPanning(true);
                 setPanStart({ x: event.clientX, y: event.clientY });
            }
            return;
        }
        // Allow panning with primary button (no ctrl/meta) or middle mouse / ctrl+primary on the grid itself
        setIsPanning(true);
        setPanStart({ x: event.clientX, y: event.clientY });
        return;
    }

    if (gridX < 0 || gridX >= GRID_SIZE || gridY < 0 || gridY >= GRID_SIZE) {
      if (event.button === 1 || (event.button === 0 && (event.ctrlKey || event.metaKey) )) {
         setIsPanning(true);
         setPanStart({ x: event.clientX, y: event.clientY });
      }
      return;
    }

    switch (activeTool) {
      case 'paint_cell':
        setIsPainting(true);
        setHoveredCellWhilePaintingOrErasing({ x: gridX, y: gridY });
        setGridCells(prev => {
          const newCells = prev.map(row => row.map(cell => ({ ...cell })));
          if (newCells[gridY] && newCells[gridY][gridX]) {
            newCells[gridY][gridX].color = selectedColor;
          }
          return newCells;
        });
        break;
      case 'place_token':
        if (selectedTokenTemplate) {
          const newTokenData: Omit<TokenType, 'id'> = {
            ...selectedTokenTemplate,
             x: gridX,
             y: gridY,
          };
          const newToken = {
            ...newTokenData,
            id: `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          };
          setTokens(prev => [...prev, newToken]);
        }
        break;
      case 'measure_distance':
      case 'measure_radius':
        setIsMeasuring(true);
        setMeasurement({
          startPoint: { x: gridX, y: gridY },
          type: activeTool === 'measure_distance' ? 'distance' : 'radius',
          endPoint: { x: gridX, y: gridY },
          result: undefined
        });
        break;
      case 'eraser_tool':
        setIsErasing(true);
        setHoveredCellWhilePaintingOrErasing({ x: gridX, y: gridY });
        eraseContentAtCell(gridX, gridY);
        break;
      case 'draw_line':
      case 'draw_circle':
      case 'draw_square':
        {
          setIsDrawing(true);
          const snapFn = activeTool === 'draw_circle' ? snapToCellCenter : snapToVertex;
          const startP = snapFn(pos, cellSize);
          setDrawingStartPoint(startP);
          setCurrentDrawingShape({
            id: `shape-${Date.now()}`,
            type: activeTool === 'draw_line' ? 'line' : activeTool === 'draw_circle' ? 'circle' : 'square',
            startPoint: startP,
            endPoint: startP, 
            color: activeTool === 'draw_line' ? 'hsl(var(--accent))' : 'hsl(var(--border))',
            fillColor: activeTool !== 'draw_line' ? 'hsla(30, 40%, 25%, 0.5)' : undefined, 
            strokeWidth: activeTool === 'draw_line' ? 2 : 1,
          });
        }
        break;
    }
  };

  const handleTokenMouseDown = (event: React.MouseEvent<SVGElement>, token: TokenType) => {
    if (activeTool !== 'select') return;
    event.stopPropagation();
    setDraggingToken(token);
    const pos = getMousePosition(event);
    setDragOffset({
      x: pos.x - token.x * cellSize,
      y: pos.y - token.y * cellSize
    });
    setDraggingTokenPosition(null); 
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePosition(event);
    if (isPanning && panStart && svgRef.current) {
      const currentVbParts = viewBox.split(' ').map(Number);
      const svgContainerWidth = svgRef.current.clientWidth;
      const svgContainerHeight = svgRef.current.clientHeight;
      if (svgContainerWidth === 0 || svgContainerHeight === 0) return;
      
      const currentVbX = currentVbParts[0];
      const currentVbY = currentVbParts[1];
      const currentVbWidth = currentVbParts[2];
      const currentVbHeight = currentVbParts[3];

      const zoomFactorX = currentVbWidth / svgContainerWidth;
      const zoomFactorY = currentVbHeight / svgContainerHeight;
      
      const dxPan = (panStart.x - event.clientX) * zoomFactorX;
      const dyPan = (panStart.y - event.clientY) * zoomFactorY;

      let newVx = currentVbX + dxPan;
      let newVy = currentVbY + dyPan;

      const contentTotalWidth = GRID_SIZE * cellSize;
      const contentTotalHeight = GRID_SIZE * cellSize;
      const currentBorderWidth = showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0;
      const svgPadding = currentBorderWidth / 2;

      const minContentVx = 0 - svgPadding;
      const maxPossibleVx = (contentTotalWidth + currentBorderWidth) - currentVbWidth - svgPadding;
      
      // If viewBox width is greater than or equal to the content width (fully zoomed out for width)
      // then lock horizontal panning by setting newVx to minContentVx.
      // A small tolerance (e.g., 1 pixel in content coordinates) for floating point comparisons.
      if (currentVbWidth >= (contentTotalWidth + currentBorderWidth - 1)) {
        newVx = minContentVx;
      } else {
        newVx = Math.max(minContentVx, newVx); // Don't pan left of content start
        newVx = Math.min(newVx, maxPossibleVx); // Don't pan right of content end (maxPossibleVx is minContentVx + contentTotalWidthWithBorder - currentVbWidth)
                                                // simplified: maxPossibleVx = (contentTotalWidth + svgPadding) - currentVbWidth;
      }
      
      const minContentVy = 0 - svgPadding;
      const maxPossibleVy = (contentTotalHeight + currentBorderWidth) - currentVbHeight - svgPadding;
      // Allow vertical panning but clamp within content boundaries
      newVy = Math.max(minContentVy, newVy);
      newVy = Math.min(newVy, maxPossibleVy);


      setViewBox(`${newVx} ${newVy} ${currentVbWidth} ${currentVbHeight}`);
      setPanStart({ x: event.clientX, y: event.clientY });
      setHoveredCellWhilePaintingOrErasing(null);

    } else if (draggingToken && dragOffset && activeTool === 'select') {
      const currentMouseSvgPos = getMousePosition(event);
      const newTargetTokenOriginX = currentMouseSvgPos.x - dragOffset.x;
      const newTargetTokenOriginY = currentMouseSvgPos.y - dragOffset.y;

      const gridX = Math.floor(newTargetTokenOriginX / cellSize);
      const gridY = Math.floor(newTargetTokenOriginY / cellSize);
      
      const clampedGridX = Math.max(0, Math.min(gridX, GRID_SIZE - 1));
      const clampedGridY = Math.max(0, Math.min(gridY, GRID_SIZE - 1));

      if (!draggingTokenPosition || draggingTokenPosition.x !== clampedGridX || draggingTokenPosition.y !== clampedGridY) {
        setDraggingTokenPosition({ x: clampedGridX, y: clampedGridY });
      }
      setHoveredCellWhilePaintingOrErasing(null); 
    } else if (isMeasuring && measurement.startPoint && (activeTool === 'measure_distance' || activeTool === 'measure_radius')) {
      const gridX = Math.floor(pos.x / cellSize);
      const gridY = Math.floor(pos.y / cellSize);
      const endPoint = { x: Math.max(0, Math.min(gridX, GRID_SIZE -1)), y: Math.max(0, Math.min(gridY, GRID_SIZE -1)) };
      const dxSquares = endPoint.x - measurement.startPoint.x;
      const dySquares = endPoint.y - measurement.startPoint.y;
      const distInSquares = Math.sqrt(dxSquares*dxSquares + dySquares*dySquares);
      const distInFeet = distInSquares * FEET_PER_SQUARE;
      const roundedDistInFeet = Math.round(distInFeet * 10) / 10;
      const resultText = measurement.type === 'distance'
        ? `Distance: ${roundedDistInFeet} ft`
        : `Radius: ${roundedDistInFeet} ft`;
      setMeasurement(prev => ({ ...prev!, endPoint, result: resultText }));
      setHoveredCellWhilePaintingOrErasing(null);
    } else if (isErasing && activeTool === 'eraser_tool') {
        const gridX = Math.floor(pos.x / cellSize);
        const gridY = Math.floor(pos.y / cellSize);
        if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
             setHoveredCellWhilePaintingOrErasing({ x: gridX, y: gridY });
             eraseContentAtCell(gridX, gridY);
        } else {
           setHoveredCellWhilePaintingOrErasing(null);
        }
    } else if (isPainting && activeTool === 'paint_cell') {
        const gridX = Math.floor(pos.x / cellSize);
        const gridY = Math.floor(pos.y / cellSize);
        if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
            setHoveredCellWhilePaintingOrErasing({ x: gridX, y: gridY });
            setGridCells(prev => {
                const newCells = [...prev.map(r => [...r.map(c => ({...c}))])];
                if (newCells[gridY] && newCells[gridY][gridX] && newCells[gridY][gridX].color !== selectedColor) {
                    newCells[gridY][gridX].color = selectedColor;
                    return newCells;
                }
                return prev;
            });
        } else {
           setHoveredCellWhilePaintingOrErasing(null);
        }
    } else if (isDrawing && currentDrawingShape && drawingStartPoint) {
        const snapFn = currentDrawingShape.type === 'circle' ? snapToCellCenter : snapToVertex;
        const currentEndPoint = snapFn(pos, cellSize);
        setCurrentDrawingShape(prev => prev ? {...prev, endPoint: currentEndPoint} : null);
        setHoveredCellWhilePaintingOrErasing(null);
    }
     else {
        setHoveredCellWhilePaintingOrErasing(null);
    }
  };

  const handleMouseUp = (event: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
    }
    if (draggingToken && activeTool === 'select') {
      if (draggingTokenPosition) {
        const finalX = Math.max(0, Math.min(draggingTokenPosition.x, GRID_SIZE - 1));
        const finalY = Math.max(0, Math.min(draggingTokenPosition.y, GRID_SIZE - 1));
        onTokenMove(draggingToken.id, finalX, finalY);
      }
      setDraggingToken(null);
      setDragOffset(null);
      setDraggingTokenPosition(null);
    }
    if (isMeasuring) {
      setIsMeasuring(false);
      if (measurement.result) {
        toast({ title: "Measurement Complete", description: measurement.result });
      }
    }
    if (isErasing) {
        setIsErasing(false);
        setHoveredCellWhilePaintingOrErasing(null);
    }
    if (isPainting) {
        setIsPainting(false);
        setHoveredCellWhilePaintingOrErasing(null);
    }
    if (isDrawing && currentDrawingShape) {
      setDrawnShapes(prev => [...prev, currentDrawingShape]);
      setCurrentDrawingShape(null);
      setIsDrawing(false);
      setDrawingStartPoint(null);
    }
  };

  const handleMouseLeave = () => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
    }
    if (isMeasuring) {
      // Optionally finalize measurement if mouse leaves while measuring
    }
    if (isErasing) {
        setIsErasing(false);
        setHoveredCellWhilePaintingOrErasing(null);
    }
    if (isPainting) {
        setIsPainting(false);
        setHoveredCellWhilePaintingOrErasing(null);
    }
  };

  const applyZoom = (zoomIn: boolean, customScaleAmount?: number) => {
    if (!svgRef.current) return;
    const scaleAmount = customScaleAmount || ZOOM_AMOUNT;
    const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);

    const svgRect = svgRef.current.getBoundingClientRect();
    const clientCenterX = svgRect.left + svgRect.width / 2;
    const clientCenterY = svgRect.top + svgRect.height / 2;

    const centerPos = getMousePosition({ clientX: clientCenterX, clientY: clientCenterY } as MouseEvent);

    let newVw, newVh;
    if (zoomIn) {
      newVw = vw / scaleAmount;
      newVh = vh / scaleAmount;
    } else {
      newVw = vw * scaleAmount;
      newVh = vh * scaleAmount;
    }

    const baseContentWidth = GRID_SIZE * cellSize;
    const currentBorderWidth = showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0;
    
    const minAllowedVw = baseContentWidth / 10; // Max zoom IN (viewBox is 1/10th of content width)
    const maxAllowedVw = baseContentWidth + currentBorderWidth; // Max zoom OUT (viewBox width equals content width)


    newVw = Math.max(minAllowedVw, Math.min(maxAllowedVw, newVw));
    // Maintain aspect ratio based on the (potentially clamped) newVw
    if (vw !== 0) { // prevent division by zero if vw was somehow 0
        newVh = (newVw / vw) * vh;
    } else { // Should not happen with proper initialization
        newVh = newVw; // Assume square content if vw is 0
    }


    const newVx = centerPos.x - (centerPos.x - vx) * (newVw / vw);
    const newVy = centerPos.y - (centerPos.y - vy) * (newVh / vh);

    setViewBox(`${newVx} ${newVy} ${newVw} ${newVh}`);
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    applyZoom(event.deltaY < 0, ZOOM_AMOUNT);
  };

  const handleZoomButtonClick = (zoomIn: boolean) => {
    applyZoom(zoomIn, ZOOM_AMOUNT);
  };


  const gridContentWidth = GRID_SIZE * cellSize;
  const gridContentHeight = GRID_SIZE * cellSize;

  const imgScaledWidth = gridContentWidth * backgroundZoomLevel;
  const imgScaledHeight = gridContentHeight * backgroundZoomLevel;
  const imgScaledX = (gridContentWidth - imgScaledWidth) / 2;
  const imgScaledY = (gridContentHeight - imgScaledHeight) / 2;

 const getCursorStyle = () => {
    if (isPanning || (draggingToken && activeTool === 'select')) return 'cursor-grabbing';
    if (activeTool === 'select' && !draggingToken) return 'cursor-default'; 
    if (activeTool === 'select' && draggingToken) return 'cursor-grabbing'; 
    if ([
      'paint_cell', 
      'place_token', 
      'measure_distance', 
      'measure_radius', 
      'eraser_tool', 
      'draw_line', 
      'draw_circle', 
      'draw_square'
    ].includes(activeTool)) return 'cursor-crosshair';
    return 'cursor-default';
  };

  return (
    <div className="w-full h-full overflow-hidden bg-battle-grid-bg flex items-center justify-center relative">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className={cn("w-full h-full", getCursorStyle())}
        onMouseDown={handleGridMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        preserveAspectRatio="xMidYMid meet"
        data-ai-hint="battle grid tactical map"
      >
        {backgroundImageUrl && (
          <image
            href={backgroundImageUrl}
            x={imgScaledX}
            y={imgScaledY}
            width={imgScaledWidth}
            height={imgScaledHeight}
          />
        )}

        <g shapeRendering="crispEdges">
          {gridCells.flatMap((row, y) =>
            row.map((cell, x) => {
              const isHighlightActive = (isPainting && activeTool === 'paint_cell') || (isErasing && activeTool === 'eraser_tool');
              const isHighlighted = isHighlightActive &&
                                  hoveredCellWhilePaintingOrErasing &&
                                  hoveredCellWhilePaintingOrErasing.x === x &&
                                  hoveredCellWhilePaintingOrErasing.y === y;
              return (
              <rect
                key={cell.id}
                x={x * cellSize}
                y={y * cellSize}
                width={cellSize}
                height={cellSize}
                fill={cell.color || 'transparent'}
                stroke={
                  isHighlighted
                    ? 'hsl(var(--ring))'
                    : showGridLines ? 'black' : 'transparent'
                }
                strokeWidth={
                  isHighlighted
                    ? BORDER_WIDTH_WHEN_VISIBLE + 1 
                    : showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0
                }
              />
              );
            })
          )}
        </g>

        {/* Render persistent drawn shapes */}
        <g>
          {drawnShapes.map(shape => {
            if (shape.type === 'line') {
              return (
                <line
                  key={shape.id}
                  x1={shape.startPoint.x}
                  y1={shape.startPoint.y}
                  x2={shape.endPoint.x}
                  y2={shape.endPoint.y}
                  stroke={shape.color}
                  strokeWidth={shape.strokeWidth}
                />
              );
            } else if (shape.type === 'circle') {
              const radius = Math.sqrt(
                Math.pow(shape.endPoint.x - shape.startPoint.x, 2) +
                Math.pow(shape.endPoint.y - shape.startPoint.y, 2)
              );
              return (
                <circle
                  key={shape.id}
                  cx={shape.startPoint.x}
                  cy={shape.startPoint.y}
                  r={radius}
                  stroke={shape.color}
                  strokeWidth={shape.strokeWidth}
                  fill={shape.fillColor || 'transparent'}
                />
              );
            } else if (shape.type === 'square') {
              const width = Math.abs(shape.endPoint.x - shape.startPoint.x);
              const height = Math.abs(shape.endPoint.y - shape.startPoint.y);
              const rectX = Math.min(shape.startPoint.x, shape.endPoint.x);
              const rectY = Math.min(shape.startPoint.y, shape.endPoint.y);
              return (
                <rect
                  key={shape.id}
                  x={rectX}
                  y={rectY}
                  width={width}
                  height={height}
                  stroke={shape.color}
                  strokeWidth={shape.strokeWidth}
                  fill={shape.fillColor || 'transparent'}
                />
              );
            }
            return null;
          })}
        </g>

        {/* Render current drawing shape (preview) */}
        {currentDrawingShape && isDrawing && (
          <g>
            {currentDrawingShape.type === 'line' && (
              <line
                x1={currentDrawingShape.startPoint.x}
                y1={currentDrawingShape.startPoint.y}
                x2={currentDrawingShape.endPoint.x}
                y2={currentDrawingShape.endPoint.y}
                stroke={currentDrawingShape.color}
                strokeWidth={currentDrawingShape.strokeWidth}
                strokeDasharray="3 3"
              />
            )}
            {currentDrawingShape.type === 'circle' && (
              <circle
                cx={currentDrawingShape.startPoint.x}
                cy={currentDrawingShape.startPoint.y}
                r={Math.sqrt(
                  Math.pow(currentDrawingShape.endPoint.x - currentDrawingShape.startPoint.x, 2) +
                  Math.pow(currentDrawingShape.endPoint.y - currentDrawingShape.startPoint.y, 2)
                )}
                stroke={currentDrawingShape.color}
                strokeWidth={currentDrawingShape.strokeWidth}
                fill={currentDrawingShape.fillColor || 'transparent'}
                strokeDasharray="3 3"
              />
            )}
            {currentDrawingShape.type === 'square' && (
              <rect
                x={Math.min(currentDrawingShape.startPoint.x, currentDrawingShape.endPoint.x)}
                y={Math.min(currentDrawingShape.startPoint.y, currentDrawingShape.endPoint.y)}
                width={Math.abs(currentDrawingShape.endPoint.x - currentDrawingShape.startPoint.x)}
                height={Math.abs(currentDrawingShape.endPoint.y - currentDrawingShape.startPoint.y)}
                stroke={currentDrawingShape.color}
                strokeWidth={currentDrawingShape.strokeWidth}
                fill={currentDrawingShape.fillColor || 'transparent'}
                strokeDasharray="3 3"
              />
            )}
          </g>
        )}


        <defs>
          <marker id="arrowhead" markerWidth="12" markerHeight="8.4" refX="11.5" refY="4.2" orient="auto">
            <polygon points="0 0, 12 4.2, 0 8.4" fill="hsl(var(--accent))" />
          </marker>
        </defs>

        {measurement.startPoint && measurement.endPoint && (
          <g stroke="hsl(var(--accent))" strokeWidth="3" fill="none">
            {measurement.type === 'distance' ? (
              <line
                x1={measurement.startPoint.x * cellSize + cellSize/2}
                y1={measurement.startPoint.y * cellSize + cellSize/2}
                x2={measurement.endPoint.x * cellSize + cellSize/2}
                y2={measurement.endPoint.y * cellSize + cellSize/2}
                markerEnd="url(#arrowhead)"
              />
            ) : (
              <circle
                cx={measurement.startPoint.x * cellSize + cellSize/2}
                cy={measurement.startPoint.y * cellSize + cellSize/2}
                r={Math.sqrt(Math.pow(measurement.endPoint.x - measurement.startPoint.x, 2) + Math.pow(measurement.endPoint.y - measurement.startPoint.y, 2)) * cellSize}
                strokeDasharray="5 3"
                fill="hsla(30, 80%, 85%, 0.3)" 
              />
            )}
          </g>
        )}

        {isMeasuring && measurement.endPoint && measurement.result && (
          <text
            x={measurement.endPoint.x * cellSize + cellSize / 2 + 20}
            y={measurement.endPoint.y * cellSize + cellSize / 2 + 20}
            fill="hsl(var(--accent))"
            fontSize="20"
            paintOrder="stroke"
            stroke="hsl(var(--background))"
            strokeWidth="4px"
            strokeLinecap="butt"
            strokeLinejoin="miter"
            className="pointer-events-none select-none font-bold"
          >
            {measurement.result.replace("Distance: ", "").replace("Radius: ", "")}
          </text>
        )}

         {measurement.startPoint && (
           <circle cx={measurement.startPoint.x * cellSize + cellSize / 2} cy={measurement.startPoint.y * cellSize + cellSize / 2} r="4" fill="hsl(var(--accent))" />
         )}
         {measurement.endPoint && measurement.result && (
           <circle cx={measurement.endPoint.x * cellSize + cellSize / 2} cy={measurement.endPoint.y * cellSize + cellSize / 2} r="4" fill="hsl(var(--accent))" />
         )}

        {tokens.map(token => {
          const IconComponent = token.icon as React.FC<LucideProps & {x?: number; y?:number; width?: string | number; height?: string | number; color?: string}>;

          let currentX = token.x;
          let currentY = token.y;

          if (draggingToken && token.id === draggingToken.id && draggingTokenPosition) {
            currentX = draggingTokenPosition.x;
            currentY = draggingTokenPosition.y;
          }


          const iconDisplaySize = cellSize * 0.8;
          const iconOffset = (cellSize - iconDisplaySize) / 2;

          let backgroundFill = 'black';
            switch (token.type) {
                case 'player':
                backgroundFill = 'hsl(120, 40%, 25%)'; 
                break;
                case 'enemy':
                backgroundFill = 'hsl(0, 60%, 30%)';   
                break;
                case 'item':
                backgroundFill = 'hsl(270, 40%, 30%)'; 
                break;
                case 'terrain':
                backgroundFill = 'hsl(var(--muted))'; 
                break;
                case 'generic':
                backgroundFill = 'hsl(var(--accent))'; 
                break;
                default:
                backgroundFill = 'black';
            }

          return (
            <g
              key={token.id}
              transform={`translate(${currentX * cellSize}, ${currentY * cellSize})`}
              onMouseDown={(e) => handleTokenMouseDown(e, token)}
              onMouseEnter={() => setHoveredTokenId(token.id)}
              onMouseLeave={() => setHoveredTokenId(null)}
              className={cn(
                activeTool === 'select' && 'cursor-grab',
                draggingToken?.id === token.id && 'cursor-grabbing'
              )}
            >
              <circle
                cx={cellSize / 2}
                cy={cellSize / 2}
                r={cellSize / 2}
                fill={backgroundFill}
                stroke={hoveredTokenId === token.id && activeTool === 'select' ? 'hsl(var(--accent))' : 'hsl(var(--primary-foreground))'}
                strokeWidth="1"
              />
              {IconComponent && (
                <IconComponent
                  x={iconOffset}
                  y={iconOffset}
                  width={iconDisplaySize}
                  height={iconDisplaySize}
                  color={'hsl(var(--primary-foreground))'}
                  strokeWidth={1.5}
                />
              )}
            </g>
          );
        })}
      </svg>
      <TooltipProvider delayDuration={0}>
        <div className="absolute bottom-4 right-4 flex flex-col space-y-2 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleZoomButtonClick(true)}
                className="rounded-md shadow-lg h-10 w-10 p-2 bg-card text-card-foreground hover:bg-muted"
                aria-label="Zoom In"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" align="center">
              <p>Zoom In</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleZoomButtonClick(false)}
                className="rounded-md shadow-lg h-10 w-10 p-2 bg-card text-card-foreground hover:bg-muted"
                aria-label="Zoom Out"
              >
                <Minus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" align="center">
              <p>Zoom Out</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}

