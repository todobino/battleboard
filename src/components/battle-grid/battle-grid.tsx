
'use client';

import type { GridCellData, Token, ActiveTool, Point, Measurement } from '@/types';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface BattleGridProps {
  gridCells: GridCellData[][];
  setGridCells: React.Dispatch<React.SetStateAction<GridCellData[][]>>;
  tokens: Token[];
  setTokens: React.Dispatch<React.SetStateAction<Token[]>>;
  showGridLines: boolean;
  zoomLevel: number;
  backgroundImageUrl: string | null;
  activeTool: ActiveTool;
  selectedColor: string;
  selectedTokenTemplate: Omit<Token, 'id' | 'x' | 'y'> | null;
  onCellClick: (x: number, y: number) => void;
  onTokenMove: (tokenId: string, newX: number, newY: number) => void;
  measurement: Measurement;
  setMeasurement: React.Dispatch<React.SetStateAction<Measurement>>;
}

const GRID_SIZE = 20; // 20x20 grid
const DEFAULT_CELL_SIZE = 30; // pixels
const GRID_LINE_STROKE_WIDTH = 1.5; // Stroke width for grid lines

export default function BattleGrid({
  gridCells,
  tokens,
  showGridLines,
  zoomLevel, // Note: zoomLevel prop might be less directly used now viewBox handles zoom
  backgroundImageUrl,
  activeTool,
  onCellClick, 
  onTokenMove,
  selectedColor,
  selectedTokenTemplate,
  setGridCells,
  setTokens,
  measurement,
  setMeasurement,
}: BattleGridProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState(() => {
    const initialContentWidth = GRID_SIZE * DEFAULT_CELL_SIZE;
    const initialContentHeight = GRID_SIZE * DEFAULT_CELL_SIZE;
    // Expand viewBox slightly to ensure lines on edges are fully visible
    const padding = GRID_LINE_STROKE_WIDTH / 2;
    return `${0 - padding} ${0 - padding} ${initialContentWidth + GRID_LINE_STROKE_WIDTH} ${initialContentHeight + GRID_LINE_STROKE_WIDTH}`;
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [draggingToken, setDraggingToken] = useState<Token | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const { toast } = useToast();

  const cellSize = DEFAULT_CELL_SIZE; 

  useEffect(() => {
    // Set initial viewBox considering stroke width to prevent clipping
    const initialContentWidth = GRID_SIZE * DEFAULT_CELL_SIZE;
    const initialContentHeight = GRID_SIZE * DEFAULT_CELL_SIZE;
    const padding = GRID_LINE_STROKE_WIDTH / 2; // Half stroke width for padding
    
    // Check if viewBox needs reset (e.g. if GRID_SIZE or DEFAULT_CELL_SIZE were dynamic, though they are const here)
    const currentVbParts = viewBox.split(' ').map(Number);
    const expectedVw = initialContentWidth + GRID_LINE_STROKE_WIDTH;
    const expectedVh = initialContentHeight + GRID_LINE_STROKE_WIDTH;

    if (currentVbParts[2] !== expectedVw || currentVbParts[3] !== expectedVh ) {
        setViewBox(`${0 - padding} ${0 - padding} ${expectedVw} ${expectedVh}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Recalculate if GRID_SIZE or DEFAULT_CELL_SIZE changed, though they are const.

  const getMousePosition = (event: React.MouseEvent<SVGSVGElement>): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const CTM = svg.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (event.clientX - CTM.e) / CTM.a,
      y: (event.clientY - CTM.f) / CTM.d,
    };
  };
  
  const handleGridMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePosition(event);
    const gridX = Math.floor(pos.x / cellSize);
    const gridY = Math.floor(pos.y / cellSize);

    if (gridX < 0 || gridX >= GRID_SIZE || gridY < 0 || gridY >= GRID_SIZE) {
       // Allow clicks outside for panning to start
      if (event.button === 1 || (event.button === 0 && event.ctrlKey)) {
         setIsPanning(true);
         setPanStart({ x: event.clientX, y: event.clientY });
      }
      return;
    }


    switch (activeTool) {
      case 'select':
        if (event.button === 1 || (event.button === 0 && event.ctrlKey)) { // Middle mouse or Ctrl+Left Click
          setIsPanning(true);
          setPanStart({ x: event.clientX, y: event.clientY });
        }
        break;
      case 'paint_cell':
        setGridCells(prev => {
          const newCells = prev.map(row => row.map(cell => ({ ...cell })));
          newCells[gridY][gridX].color = selectedColor;
          return newCells;
        });
        break;
      case 'place_token':
        if (selectedTokenTemplate) {
          const newToken: Token = {
            ...selectedTokenTemplate,
            id: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            x: gridX,
            y: gridY,
          };
          setTokens(prev => [...prev, newToken]);
        }
        break;
      case 'measure_distance':
      case 'measure_radius':
        if (!measurement.startPoint) {
          setMeasurement({ startPoint: { x: gridX, y: gridY }, type: activeTool === 'measure_distance' ? 'distance' : 'radius', endPoint: undefined, result: undefined });
        } else {
          const endPoint = {x: gridX, y: gridY};
          const dx = endPoint.x - measurement.startPoint.x;
          const dy = endPoint.y - measurement.startPoint.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const roundedDist = Math.round(dist * 10) / 10;
          const resultText = measurement.type === 'distance' ? `Distance: ${roundedDist} units` : `Radius: ${roundedDist} units`;
          setMeasurement(prev => ({ ...prev, endPoint, result: resultText }));
          toast({ title: "Measurement Complete", description: resultText });
        }
        break;
    }
  };

  const handleTokenMouseDown = (event: React.MouseEvent<SVGElement>, token: Token) => {
    if (activeTool !== 'select') return;
    event.stopPropagation();
    setDraggingToken(token);
    const pos = getMousePosition(event);
    setDragOffset({
      x: pos.x - token.x * cellSize,
      y: pos.y - token.y * cellSize
    });
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePosition(event);
    if (isPanning && panStart) {
      // Determine current zoom factor from viewBox width relative to content width
      const currentVbWidth = parseFloat(viewBox.split(' ')[2]);
      const contentWidth = GRID_SIZE * DEFAULT_CELL_SIZE + GRID_LINE_STROKE_WIDTH; // base content width including padding
      const currentZoomFactor = contentWidth / currentVbWidth; // Higher value means more zoomed out

      const dx = (panStart.x - event.clientX) * currentZoomFactor ; 
      const dy = (panStart.y - event.clientY) * currentZoomFactor ;

      const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);
      setViewBox(`${vx + dx} ${vy + dy} ${vw} ${vh}`);
      setPanStart({ x: event.clientX, y: event.clientY });
    } else if (draggingToken && dragOffset) {
      // Dragging logic (currently no live visual update, happens on mouseUp)
    } else if ((activeTool === 'measure_distance' || activeTool === 'measure_radius') && measurement.startPoint && !measurement.endPoint) {
      const gridX = Math.floor(pos.x / cellSize);
      const gridY = Math.floor(pos.y / cellSize);
      setMeasurement(prev => ({...prev, endPoint: {x: gridX, y: gridY}}));
    }
  };

  const handleMouseUp = (event: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
    }
    if (draggingToken) {
      const pos = getMousePosition(event);
      const gridX = Math.floor(pos.x / cellSize);
      const gridY = Math.floor(pos.y / cellSize);
      
      if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
        onTokenMove(draggingToken.id, gridX, gridY);
      }
      setDraggingToken(null);
      setDragOffset(null);
    }
  };
  
  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const scaleAmount = 1.1;
    const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);
    const mousePos = getMousePosition(event);

    let newVw, newVh;
    if (event.deltaY < 0) { // Zoom in
      newVw = vw / scaleAmount;
      newVh = vh / scaleAmount;
    } else { // Zoom out
      newVw = vw * scaleAmount;
      newVh = vh * scaleAmount;
    }
    
    const contentWidth = GRID_SIZE * DEFAULT_CELL_SIZE; // Base content width for zoom clamping
    const minDim = contentWidth / 5; // Max zoom in (5x) relative to content
    const maxDim = contentWidth * 5; // Max zoom out (1/5x) relative to content
    
    newVw = Math.max(minDim, Math.min(maxDim, newVw));
    newVh = Math.max(minDim, Math.min(maxDim, newVh));

    const newVx = mousePos.x - (mousePos.x - vx) * (newVw / vw);
    const newVy = mousePos.y - (mousePos.y - vy) * (newVh / vh);
    
    setViewBox(`${newVx} ${newVy} ${newVw} ${newVh}`);
  };

  const gridContentWidth = GRID_SIZE * cellSize;
  const gridContentHeight = GRID_SIZE * cellSize;

  return (
    <div className="w-full h-full overflow-hidden bg-muted flex items-center justify-center relative">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="w-full h-full"
        onMouseDown={handleGridMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        preserveAspectRatio="xMidYMid meet"
        data-ai-hint="battle grid tactical map"
      >
        {backgroundImageUrl && (
          <image href={backgroundImageUrl} x="0" y="0" width={gridContentWidth} height={gridContentHeight} />
        )}

        {gridCells.flatMap((row, y) =>
          row.map((cell, x) => (
            <rect
              key={cell.id}
              x={x * cellSize}
              y={y * cellSize}
              width={cellSize}
              height={cellSize}
              fill={cell.color || 'transparent'}
              className={cn(
                'transition-colors duration-100',
                (activeTool === 'paint_cell' || activeTool === 'place_token') && 'cursor-pointer hover:opacity-80'
              )}
            />
          ))
        )}

        {showGridLines && (
          <g stroke="var(--border)" strokeWidth={GRID_LINE_STROKE_WIDTH} shapeRendering="crispEdges">
            {Array.from({ length: GRID_SIZE + 1 }).map((_, i) => (
              <React.Fragment key={`line-${i}`}>
                <line x1={i * cellSize} y1="0" x2={i * cellSize} y2={gridContentHeight} />
                <line x1="0" y1={i * cellSize} x2={gridContentWidth} y2={i * cellSize} />
              </React.Fragment>
            ))}
          </g>
        )}
        
        {measurement.startPoint && measurement.endPoint && (
          <g stroke={selectedColor || "hsl(var(--accent))"} strokeWidth="2" fill="none">
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
                strokeDasharray="4"
              />
            )}
          </g>
        )}
        {measurement.startPoint && (
           <circle cx={measurement.startPoint.x * cellSize + cellSize / 2} cy={measurement.startPoint.y * cellSize + cellSize / 2} r="3" fill={selectedColor || "hsl(var(--accent))"} />
        )}
         {measurement.endPoint && (
           <circle cx={measurement.endPoint.x * cellSize + cellSize / 2} cy={measurement.endPoint.y * cellSize + cellSize / 2} r="3" fill={selectedColor || "hsl(var(--accent))"} />
        )}

        <defs>
          <marker id="arrowhead" markerWidth="5" markerHeight="3.5" refX="5" refY="1.75" orient="auto">
            <polygon points="0 0, 5 1.75, 0 3.5" fill={selectedColor || "hsl(var(--accent))"} />
          </marker>
        </defs>

        {tokens.map(token => {
          const IconComponent = token.icon;
          return (
            <g 
              key={token.id} 
              transform={`translate(${token.x * cellSize}, ${token.y * cellSize})`}
              onMouseDown={(e) => handleTokenMouseDown(e, token)}
              className={cn(activeTool === 'select' && 'cursor-grab', draggingToken?.id === token.id && 'cursor-grabbing')}
            >
              {IconComponent ? (
                <IconComponent 
                  className="w-full h-full p-1" 
                  style={{ color: token.color, width: cellSize * (token.size || 1), height: cellSize * (token.size || 1) }} 
                />
              ) : (
                <circle
                  cx={cellSize / 2 * (token.size || 1)}
                  cy={cellSize / 2 * (token.size || 1)}
                  r={cellSize / 2.5 * (token.size || 1)}
                  fill={token.color}
                  stroke="hsl(var(--foreground))"
                  strokeWidth="1"
                />
              )}
              {token.label && (
                <text 
                  x={cellSize / 2 * (token.size || 1)} 
                  y={cellSize / 2 * (token.size || 1)} 
                  textAnchor="middle" 
                  dy=".3em" 
                  fontSize={cellSize / 3} 
                  fill="hsl(var(--primary-foreground))"
                  className="pointer-events-none select-none"
                >
                  {token.label.substring(0,1).toUpperCase()}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

