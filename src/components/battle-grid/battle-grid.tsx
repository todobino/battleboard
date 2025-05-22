
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
  backgroundImageUrl: string | null;
  activeTool: ActiveTool;
  selectedColor: string;
  selectedTokenTemplate: Omit<Token, 'id' | 'x' | 'y'> | null;
  onTokenMove: (tokenId: string, newX: number, newY: number) => void;
  measurement: Measurement;
  setMeasurement: React.Dispatch<React.SetStateAction<Measurement>>;
}

const GRID_SIZE = 30; // 30x30 grid
const DEFAULT_CELL_SIZE = 30; // pixels
const BORDER_WIDTH_WHEN_VISIBLE = 1;
const FEET_PER_SQUARE = 5;

export default function BattleGrid({
  gridCells,
  setGridCells,
  tokens,
  setTokens,
  showGridLines,
  backgroundImageUrl,
  activeTool,
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
    const padding = BORDER_WIDTH_WHEN_VISIBLE / 2; 
    return `${0 - padding} ${0 - padding} ${initialContentWidth + (padding * 2)} ${initialContentHeight + (padding * 2)}`;
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [draggingToken, setDraggingToken] = useState<Token | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [hoveredCellWhilePainting, setHoveredCellWhilePainting] = useState<Point | null>(null);


  const { toast } = useToast();

  const cellSize = DEFAULT_CELL_SIZE;

  useEffect(() => {
    const contentWidth = GRID_SIZE * DEFAULT_CELL_SIZE;
    const contentHeight = GRID_SIZE * DEFAULT_CELL_SIZE;
    
    const currentBorderWidth = showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0;
    const svgPadding = currentBorderWidth / 2; 

    const expectedMinX = 0 - svgPadding;
    const expectedMinY = 0 - svgPadding;
    const expectedVw = contentWidth + (svgPadding * 2);
    const expectedVh = contentHeight + (svgPadding * 2);

    setViewBox(currentVbString => {
        const currentVbParts = currentVbString.split(' ').map(Number);
        const needsRecenter = Math.abs(currentVbParts[0] - expectedMinX) > 1e-3 ||
                               Math.abs(currentVbParts[1] - expectedMinY) > 1e-3 ||
                               Math.abs(currentVbParts[2] - expectedVw) > 1e-3 ||
                               Math.abs(currentVbParts[3] - expectedVh) > 1e-3;
        
        const currentZoomLevel = (contentWidth + (currentBorderWidth)) / currentVbParts[2];
        if (needsRecenter && Math.abs(currentZoomLevel - 1) < 1e-3) { 
             return `${expectedMinX} ${expectedMinY} ${expectedVw} ${expectedVh}`;
        }
        return currentVbString; 
    });
  }, [showGridLines]);

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

  const handleGridMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePosition(event);
    const gridX = Math.floor(pos.x / cellSize);
    const gridY = Math.floor(pos.y / cellSize);

    if (gridX < 0 || gridX >= GRID_SIZE || gridY < 0 || gridY >= GRID_SIZE) {
      if (event.button === 1 || (event.button === 0 && (event.ctrlKey || event.metaKey) )) { 
         setIsPanning(true);
         setPanStart({ x: event.clientX, y: event.clientY });
      }
      return;
    }

    switch (activeTool) {
      case 'select':
        if (event.button === 1 || (event.button === 0 && (event.ctrlKey || event.metaKey))) {
          setIsPanning(true);
          setPanStart({ x: event.clientX, y: event.clientY });
        }
        break;
      case 'paint_cell':
        setIsPainting(true);
        setHoveredCellWhilePainting({ x: gridX, y: gridY }); // Set initial hover for immediate feedback
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
          const newToken: Token = {
            ...selectedTokenTemplate,
            id: `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            x: gridX,
            y: gridY,
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
        setGridCells(prev => {
            const newCells = prev.map(row => row.map(cell => ({ ...cell })));
            if (newCells[gridY] && newCells[gridY][gridX]) {
                newCells[gridY][gridX].color = undefined;
            }
            return newCells;
        });
        setTokens(prev => prev.filter(token => !(token.x === gridX && token.y === gridY)));
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
    if (isPanning && panStart && svgRef.current) {
      const currentVbParts = viewBox.split(' ').map(Number);
      const svgWidth = svgRef.current.clientWidth;
      const svgHeight = svgRef.current.clientHeight;

      if (svgWidth === 0 || svgHeight === 0) return; 

      const currentVbWidth = currentVbParts[2];
      const currentVbHeight = currentVbParts[3];

      const zoomFactorX = currentVbWidth / svgWidth;
      const zoomFactorY = currentVbHeight / svgHeight;

      const dx = (panStart.x - event.clientX) * zoomFactorX;
      const dy = (panStart.y - event.clientY) * zoomFactorY;

      const [vx, vy, vw, vh] = currentVbParts;
      setViewBox(`${vx + dx} ${vy + dy} ${vw} ${vh}`);
      setPanStart({ x: event.clientX, y: event.clientY });
      setHoveredCellWhilePainting(null); // Clear paint hover if panning

    } else if (draggingToken && dragOffset) {
      // Dragging logic handled on mouseUp
      setHoveredCellWhilePainting(null); // Clear paint hover if dragging token
    } else if (isMeasuring && measurement.startPoint) {
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

      setMeasurement(prev => ({ ...prev, endPoint, result: resultText }));
      setHoveredCellWhilePainting(null); // Clear paint hover if measuring
    } else if (isErasing && activeTool === 'eraser_tool') {
        const gridX = Math.floor(pos.x / cellSize);
        const gridY = Math.floor(pos.y / cellSize);

        if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
             setGridCells(prev => {
                const newCells = [...prev.map(r => [...r.map(c => ({...c}))])];
                if (newCells[gridY][gridX].color !== undefined) {
                    newCells[gridY][gridX].color = undefined;
                    return newCells;
                }
                return prev;
            });
            setTokens(prev => {
                const tokenExistsOnCell = prev.some(token => token.x === gridX && token.y === gridY);
                if (tokenExistsOnCell) {
                    return prev.filter(token => !(token.x === gridX && token.y === gridY));
                }
                return prev;
            });
        }
        setHoveredCellWhilePainting(null); // Clear paint hover if erasing
    } else if (isPainting && activeTool === 'paint_cell') {
        const gridX = Math.floor(pos.x / cellSize);
        const gridY = Math.floor(pos.y / cellSize);

        if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
            setHoveredCellWhilePainting({ x: gridX, y: gridY });
            setGridCells(prev => {
                const newCells = [...prev.map(r => [...r.map(c => ({...c}))])];
                 if (newCells[gridY] && newCells[gridY][gridX] && newCells[gridY][gridX].color !== selectedColor) {
                    newCells[gridY][gridX].color = selectedColor;
                    return newCells;
                }
                return prev;
            });
        } else {
           setHoveredCellWhilePainting(null); // Cursor outside grid
        }
    } else {
        // If no specific drag operation is active, clear the painting hover highlight
        setHoveredCellWhilePainting(null);
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
    if (isMeasuring) {
      setIsMeasuring(false);
      if (measurement.result) {
        toast({ title: "Measurement Complete", description: measurement.result });
      }
    }
    if (isErasing) {
        setIsErasing(false);
    }
    if (isPainting) {
        setIsPainting(false);
        setHoveredCellWhilePainting(null); // Clear hover highlight on paint end
    }
  };
  
  const handleMouseLeave = () => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
    }
    // Do not finalize token drop if mouse leaves SVG, let mouseup handle it if it occurs inside.
    // If mouseup occurs outside, token position is not updated.
    if (isMeasuring) {
      setIsMeasuring(false);
      // Measurement is not finalized if mouse leaves SVG, only if mouseup occurs inside.
    }
    if (isErasing) {
      setIsErasing(false);
    }
    if (isPainting) {
      setIsPainting(false);
      setHoveredCellWhilePainting(null); // Clear hover highlight if mouse leaves SVG while painting
    }
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    if(!svgRef.current) return;

    const scaleAmount = 1.1; 
    const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);
    const mousePos = getMousePosition(event);

    let newVw, newVh;
    if (event.deltaY < 0) { 
      newVw = vw / scaleAmount;
      newVh = vh / scaleAmount;
    } else { 
      newVw = vw * scaleAmount;
      newVh = vh * scaleAmount;
    }

    const baseContentWidth = GRID_SIZE * DEFAULT_CELL_SIZE;
    const minAllowedVw = baseContentWidth / 10; 
    const maxAllowedVw = baseContentWidth * 5;  

    newVw = Math.max(minAllowedVw, Math.min(maxAllowedVw, newVw));
    newVh = (newVw / vw) * vh; 

    const newVx = mousePos.x - (mousePos.x - vx) * (newVw / vw);
    const newVy = mousePos.y - (mousePos.y - vy) * (newVh / vh);

    setViewBox(`${newVx} ${newVy} ${newVw} ${newVh}`);
  };

  const gridContentWidth = GRID_SIZE * cellSize;
  const gridContentHeight = GRID_SIZE * cellSize;

  return (
    <div className="w-full h-full overflow-hidden bg-battle-grid-bg flex items-center justify-center relative">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="w-full h-full"
        onMouseDown={handleGridMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave} 
        onWheel={handleWheel}
        preserveAspectRatio="xMidYMid meet"
        data-ai-hint="battle grid tactical map"
      >
        {backgroundImageUrl && (
          <image href={backgroundImageUrl} x="0" y="0" width={gridContentWidth} height={gridContentHeight} />
        )}

        <g shapeRendering="crispEdges">
          {gridCells.flatMap((row, y) =>
            row.map((cell, x) => {
              const isHoveredDuringPaint = hoveredCellWhilePainting &&
                                         hoveredCellWhilePainting.x === x &&
                                         hoveredCellWhilePainting.y === y;
              return (
              <rect
                key={cell.id}
                x={x * cellSize}
                y={y * cellSize}
                width={cellSize}
                height={cellSize}
                fill={cell.color || 'transparent'}
                stroke={
                  isHoveredDuringPaint && isPainting
                    ? 'hsl(var(--ring))' // Highlight color (e.g., a bright yellow or theme accent)
                    : showGridLines ? 'black' : 'transparent'
                }
                strokeWidth={
                  isHoveredDuringPaint && isPainting
                    ? BORDER_WIDTH_WHEN_VISIBLE + 1 // Thicker border for highlight
                    : showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0
                }
                className={cn(
                  (activeTool === 'paint_cell' || activeTool === 'place_token' || activeTool === 'measure_distance' || activeTool === 'measure_radius' || activeTool === 'eraser_tool') && 'cursor-crosshair',
                  (activeTool !== 'paint_cell' && activeTool !== 'place_token' && activeTool !== 'measure_distance' && activeTool !== 'measure_radius' && activeTool !== 'eraser_tool') && 'cursor-default'
                )}
              />
              );
            })
          )}
        </g>
        
        <defs>
          <marker id="arrowhead" markerWidth="12" markerHeight="8.4" refX="10.8" refY="4.2" orient="auto">
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

    