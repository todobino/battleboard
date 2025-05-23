
'use client';

import type { Point, BattleGridProps, Token as TokenType } from '@/types';
import type { LucideProps } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const GRID_SIZE = 30;
const DEFAULT_CELL_SIZE = 30;
const BORDER_WIDTH_WHEN_VISIBLE = 1;
const FEET_PER_SQUARE = 5;

export default function BattleGrid({
  gridCells,
  setGridCells,
  tokens,
  setTokens,
  showGridLines,
  backgroundImageUrl,
  backgroundZoomLevel = 1,
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
    return `${0 - padding} ${0 - padding} ${initialContentWidth + padding * 2} ${initialContentHeight + padding * 2}`;
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [draggingToken, setDraggingToken] = useState<TokenType | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [hoveredCellWhilePaintingOrErasing, setHoveredCellWhilePaintingOrErasing] = useState<Point | null>(null);
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);


  const { toast } = useToast();
  const cellSize = DEFAULT_CELL_SIZE;

  useEffect(() => {
    const contentWidth = GRID_SIZE * DEFAULT_CELL_SIZE;
    const contentHeight = GRID_SIZE * DEFAULT_CELL_SIZE;
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

      const currentZoomLevel = contentWidth / currentVbParts[2];
      if (needsRecenter && Math.abs(currentZoomLevel - 1) < 1e-3) {
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

  const handleTokenMouseDown = (event: React.MouseEvent<SVGElement>, token: TokenType) => {
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
      setHoveredCellWhilePaintingOrErasing(null);
    } else if (draggingToken && dragOffset && activeTool === 'select') {
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
      setMeasurement(prev => ({ ...prev, endPoint, result: resultText }));
      setHoveredCellWhilePaintingOrErasing(null);
    } else if (isErasing && activeTool === 'eraser_tool') {
        const gridX = Math.floor(pos.x / cellSize);
        const gridY = Math.floor(pos.y / cellSize);
        if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
             setHoveredCellWhilePaintingOrErasing({ x: gridX, y: gridY });
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
    } else {
        setHoveredCellWhilePaintingOrErasing(null);
    }
  };

  const handleMouseUp = (event: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
    }
    if (draggingToken && activeTool === 'select') {
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
        setHoveredCellWhilePaintingOrErasing(null);
    }
    if (isPainting) {
        setIsPainting(false);
        setHoveredCellWhilePaintingOrErasing(null);
    }
  };

  const handleMouseLeave = () => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
    }
    if (isMeasuring) {
      setIsMeasuring(false);
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

  const imgScaledWidth = gridContentWidth * backgroundZoomLevel;
  const imgScaledHeight = gridContentHeight * backgroundZoomLevel;
  const imgScaledX = (gridContentWidth - imgScaledWidth) / 2;
  const imgScaledY = (gridContentHeight - imgScaledHeight) / 2;

  return (
    <div className="w-full h-full overflow-hidden bg-battle-grid-bg flex items-center justify-center relative">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className={cn(
          "w-full h-full",
          (isPanning || draggingToken) ? 'cursor-grabbing' :
          (activeTool === 'select' && !isPanning && !draggingToken) ? 'cursor-default' :
          (activeTool === 'paint_cell' || activeTool === 'place_token' || activeTool === 'measure_distance' || activeTool === 'measure_radius' || activeTool === 'eraser_tool') ? 'cursor-crosshair' :
          'cursor-default'
        )}
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
              const isHighlighted = hoveredCellWhilePaintingOrErasing &&
                                  ((isPainting && activeTool === 'paint_cell') || (isErasing && activeTool === 'eraser_tool')) &&
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
          
          const currentX = token.x;
          const currentY = token.y;

          const iconDisplaySize = cellSize * 0.8;
          const iconOffset = (cellSize - iconDisplaySize) / 2;

          let backgroundFill = 'black'; // Default background
          switch (token.type) {
            case 'player':
              backgroundFill = 'hsl(120, 40%, 25%)'; // Dark Green
              break;
            case 'enemy':
              backgroundFill = 'hsl(0, 60%, 30%)';   // Red
              break;
            case 'item':
              backgroundFill = 'hsl(270, 40%, 30%)'; // Dark Purple
              break;
            case 'terrain':
              backgroundFill = 'hsl(var(--muted))'; // Dark Gray (from theme)
              break;
            case 'generic': // Assuming 'generic' is a valid type; was item previously for color
              backgroundFill = 'hsl(30, 70%, 40%)'; // Orange
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
    </div>
  );
}

