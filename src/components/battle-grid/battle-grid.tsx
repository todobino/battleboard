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

export default function BattleGrid({
  gridCells,
  tokens,
  showGridLines,
  zoomLevel,
  backgroundImageUrl,
  activeTool,
  onCellClick, // This will be handled internally or passed up if needed
  onTokenMove,
  selectedColor,
  selectedTokenTemplate,
  setGridCells,
  setTokens,
  measurement,
  setMeasurement,
}: BattleGridProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState(`0 0 ${GRID_SIZE * DEFAULT_CELL_SIZE} ${GRID_SIZE * DEFAULT_CELL_SIZE}`);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [draggingToken, setDraggingToken] = useState<Token | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const { toast } = useToast();

  const cellSize = DEFAULT_CELL_SIZE; // Base cell size, zoom affects viewBox
  const effectiveCellSize = cellSize * zoomLevel; // This isn't quite right with viewBox zoom. Scale directly.

  useEffect(() => {
    // For pan/zoom, manipulating viewBox is common.
    // Initial viewBox setup based on grid size and default cell size
    const initialWidth = GRID_SIZE * DEFAULT_CELL_SIZE;
    const initialHeight = GRID_SIZE * DEFAULT_CELL_SIZE;
    setViewBox(`0 0 ${initialWidth} ${initialHeight}`);
  }, []);

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

    if (gridX < 0 || gridX >= GRID_SIZE || gridY < 0 || gridY >= GRID_SIZE) return;

    switch (activeTool) {
      case 'select':
        // Pan start logic
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
          // Reset for next measurement after a delay or on tool change
          // setTimeout(() => setMeasurement({type: null}), 2000); 
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
      const dx = (panStart.x - event.clientX) / zoomLevel; // Adjust sensitivity by zoom
      const dy = (panStart.y - event.clientY) / zoomLevel;
      const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);
      setViewBox(`${vx + dx} ${vy + dy} ${vw} ${vh}`);
      setPanStart({ x: event.clientX, y: event.clientY });
    } else if (draggingToken && dragOffset) {
      const newSvgX = pos.x - dragOffset.x;
      const newSvgY = pos.y - dragOffset.y;
      // Update visual position while dragging, but don't snap to grid yet
      const tempTokens = tokens.map(t => 
        t.id === draggingToken.id ? { ...t, tempX: newSvgX, tempY: newSvgY } : t
      );
      // This requires adding tempX/tempY to Token type or handle differently
      // For simplicity, I'll skip live visual update during drag for now and update on mouseUp
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
    
    // Clamp zoom
    const minDim = GRID_SIZE * DEFAULT_CELL_SIZE / 5; // Max zoom in (5x)
    const maxDim = GRID_SIZE * DEFAULT_CELL_SIZE * 5; // Max zoom out (1/5x)
    newVw = Math.max(minDim, Math.min(maxDim, newVw));
    newVh = Math.max(minDim, Math.min(maxDim, newVh));


    const newVx = mousePos.x - (mousePos.x - vx) * (newVw / vw);
    const newVy = mousePos.y - (mousePos.y - vy) * (newVh / vh);
    
    setViewBox(`${newVx} ${newVy} ${newVw} ${newVh}`);
  };


  const gridWidth = GRID_SIZE * cellSize;
  const gridHeight = GRID_SIZE * cellSize;

  return (
    <div className="w-full h-full overflow-hidden bg-muted flex items-center justify-center relative">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="w-full h-full border border-border"
        onMouseDown={handleGridMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // End drag/pan if mouse leaves SVG
        onWheel={handleWheel}
        preserveAspectRatio="xMidYMid meet"
        data-ai-hint="battle grid tactical map"
      >
        {backgroundImageUrl && (
          <image href={backgroundImageUrl} x="0" y="0" width={gridWidth} height={gridHeight} />
        )}

        {/* Grid Cells Backgrounds */}
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

        {/* Grid Lines */}
        {showGridLines && (
          <g stroke="var(--border)" strokeWidth="0.5"> {/* Use CSS var for border */}
            {Array.from({ length: GRID_SIZE + 1 }).map((_, i) => (
              <React.Fragment key={`line-${i}`}>
                <line x1={i * cellSize} y1="0" x2={i * cellSize} y2={gridHeight} />
                <line x1="0" y1={i * cellSize} x2={gridWidth} y2={i * cellSize} />
              </React.Fragment>
            ))}
          </g>
        )}
        
        {/* Measurement rendering */}
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


        {/* Tokens */}
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
