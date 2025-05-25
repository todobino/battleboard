
'use client';

import type { Point, BattleGridProps, Token as TokenType, DrawnShape, TextObjectType } from '@/types';
import type { LucideProps } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const GRID_SIZE = 30;
const DEFAULT_CELL_SIZE = 30;
const BORDER_WIDTH_WHEN_VISIBLE = 1;
const FEET_PER_SQUARE = 5;
const ZOOM_AMOUNT = 1.1; 
const TEXT_PADDING = { x: 8, y: 4 }; // Padding for text bubbles

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
  textObjects,
  setTextObjects,
  showGridLines,
  backgroundImageUrl,
  backgroundZoomLevel = 1,
  activeTool,
  setActiveTool,
  onTokenMove,
  onTokenInstanceNameChange,
  selectedColor,
  selectedTokenTemplate,
  measurement,
  setMeasurement,
  activeTokenId,
  currentTextFontSize,
}: BattleGridProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState(() => {
    const initialContentWidth = GRID_SIZE * DEFAULT_CELL_SIZE;
    const initialContentHeight = GRID_SIZE * DEFAULT_CELL_SIZE;
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

  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const foreignObjectInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [isCreatingText, setIsCreatingText] = useState<{ id: string; x: number; y: number; currentText: string; fontSize: number; inputWidth: number; } | null>(null);
  const [draggingTextObjectId, setDraggingTextObjectId] = useState<string | null>(null);
  const [textObjectDragOffset, setTextObjectDragOffset] = useState<Point | null>(null);


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
      const currentZoomRatio = contentWidth !== 0 ? currentVbParts[2] / contentWidth : 1;
      
      if (needsRecenter && Math.abs(currentZoomRatio - (expectedVw / contentWidth)) < 1e-3 ) {
           return `${expectedMinX} ${expectedMinY} ${expectedVw} ${expectedVh}`;
      }
      return currentVbString;
    });
  }, [showGridLines, cellSize]);

  useEffect(() => {
    if (editingTokenId && foreignObjectInputRef.current) {
      foreignObjectInputRef.current.focus();
      foreignObjectInputRef.current.select();
    }
  }, [editingTokenId]);

  useEffect(() => {
    if (isCreatingText && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [isCreatingText]);

  const measureText = useCallback((text: string, fontSize: number) => {
    const tempSpan = document.createElement('span');
    document.body.appendChild(tempSpan);
    tempSpan.style.font = `${fontSize}px sans-serif`; 
    tempSpan.style.whiteSpace = 'nowrap';
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.textContent = text;
    const width = tempSpan.offsetWidth;
    const height = tempSpan.offsetHeight;
    document.body.removeChild(tempSpan);
    return { width, height };
  }, []);

  const finalizeTextCreation = useCallback(() => {
    if (isCreatingText && isCreatingText.currentText.trim() !== '') {
      const { width: textContentWidth, height: textContentHeight } = measureText(isCreatingText.currentText, isCreatingText.fontSize);
      const bubbleWidth = textContentWidth + TEXT_PADDING.x * 2;
      const bubbleHeight = textContentHeight + TEXT_PADDING.y * 2;

      const newTextObject: TextObjectType = {
        id: isCreatingText.id,
        x: isCreatingText.x,
        y: isCreatingText.y - bubbleHeight / 2, 
        content: isCreatingText.currentText,
        fontSize: isCreatingText.fontSize,
        width: bubbleWidth,
        height: bubbleHeight,
      };
      setTextObjects(prev => [...prev, newTextObject]);
    }
    setIsCreatingText(null);
  }, [isCreatingText, setTextObjects, measureText]);

  useEffect(() => {
    // When the active tool changes, reset states from other tools that might conflict.
    if (activeTool !== 'select') {
      if (editingTokenId) { 
        setEditingTokenId(null);
        setEditingText('');
      }
    }
    if (activeTool !== 'type_tool') {
      if (isCreatingText) { 
        finalizeTextCreation();
      }
    }
  }, [activeTool, editingTokenId, isCreatingText, finalizeTextCreation]);


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
    setTokens(prev => prev.filter(token => {
      const tokenCenterX = token.x + (token.size || 1) / 2;
      const tokenCenterY = token.y + (token.size || 1) / 2;
      return !(Math.floor(tokenCenterX) === gridX && Math.floor(tokenCenterY) === gridY);
    }));

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
    setTextObjects(prev => prev.filter(obj => {
        return !(cellCenterX >= obj.x && cellCenterX <= obj.x + obj.width &&
                 cellCenterY >= obj.y && cellCenterY <= obj.y + obj.height);
    }));
  };

  const handleGridMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    if (editingTokenId) return; 

    const pos = getMousePosition(event);
    const gridX = Math.floor(pos.x / cellSize);
    const gridY = Math.floor(pos.y / cellSize);

    if (activeTool === 'select' && (event.button === 0 || event.button === 1)) {
        for (const textObj of textObjects) {
            if (pos.x >= textObj.x && pos.x <= textObj.x + textObj.width &&
                pos.y >= textObj.y && pos.y <= textObj.y + textObj.height) {
                setDraggingTextObjectId(textObj.id);
                setTextObjectDragOffset({ x: pos.x - textObj.x, y: pos.y - textObj.y });
                return; 
            }
        }
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

    if (activeTool === 'type_tool') {
        if (isCreatingText) { 
            finalizeTextCreation();
        }
        setIsCreatingText({
            id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            x: pos.x,
            y: pos.y,
            currentText: '',
            fontSize: currentTextFontSize,
            inputWidth: 150, 
        });
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
          const baseLabel = selectedTokenTemplate.label || selectedTokenTemplate.type;
          const count = tokens.filter(t => t.type === selectedTokenTemplate.type && t.label === baseLabel).length + 1;
          const instanceName = `${baseLabel} ${count}`;

          const newTokenData: Omit<TokenType, 'id'> = {
            ...selectedTokenTemplate,
             x: gridX,
             y: gridY,
             instanceName: instanceName,
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
    if (editingTokenId === token.id || activeTool !== 'select') return; 
    event.stopPropagation(); 
    setDraggingToken(token);
    const pos = getMousePosition(event);
    setDragOffset({
      x: pos.x - token.x * cellSize,
      y: pos.y - token.y * cellSize
    });
    setDraggingTokenPosition(null); 
  };

  const handleTokenLabelClick = (event: React.MouseEvent, token: TokenType) => {
    event.stopPropagation(); 
    if (activeTool === 'select' && !draggingToken) { 
      setEditingTokenId(token.id);
      setEditingText(token.instanceName || '');
    }
  };
  
  const handleSaveTokenName = () => {
    if (editingTokenId) {
      setTokens(prevTokens =>
        prevTokens.map(t =>
          t.id === editingTokenId ? { ...t, instanceName: editingText } : t
        )
      );
      onTokenInstanceNameChange(editingTokenId, editingText);
      setEditingTokenId(null);
      setEditingText('');
    }
  };

  const handleEditInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSaveTokenName();
    } else if (event.key === 'Escape') {
      setEditingTokenId(null);
      setEditingText('');
    }
  };

  const handleTextInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finalizeTextCreation();
    } else if (event.key === 'Escape') {
      setIsCreatingText(null);
    }
  };

  const handleTextInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isCreatingText) {
      const newText = event.target.value;
      const tempSpan = document.createElement('span');
      tempSpan.style.font = `${isCreatingText.fontSize}px sans-serif`;
      tempSpan.style.visibility = 'hidden';
      tempSpan.style.position = 'absolute';
      tempSpan.textContent = newText || " "; 
      document.body.appendChild(tempSpan);
      const textMetricsWidth = tempSpan.offsetWidth;
      document.body.removeChild(tempSpan);
      
      setIsCreatingText(prev => prev ? { ...prev, currentText: newText, inputWidth: textMetricsWidth + TEXT_PADDING.x * 2 + 5 } : null);
    }
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
      
      if (currentVbWidth >= (contentTotalWidth + currentBorderWidth - 1)) {
        newVx = minContentVx;
      } else {
        newVx = Math.max(minContentVx, newVx); 
        newVx = Math.min(newVx, maxPossibleVx); 
      }
      
      const minContentVy = 0 - svgPadding;
      const maxPossibleVy = (contentTotalHeight + currentBorderWidth) - currentVbHeight - svgPadding;
      newVy = Math.max(minContentVy, newVy);
      newVy = Math.min(newVy, maxPossibleVy);

      setViewBox(`${newVx} ${newVy} ${currentVbWidth} ${currentVbHeight}`);
      setPanStart({ x: event.clientX, y: event.clientY });
      setHoveredCellWhilePaintingOrErasing(null);

    } else if (draggingToken && dragOffset && activeTool === 'select' && !editingTokenId) {
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
    } else if (draggingTextObjectId && textObjectDragOffset && activeTool === 'select') {
        const newX = pos.x - textObjectDragOffset.x;
        const newY = pos.y - textObjectDragOffset.y;
        setTextObjects(prev => prev.map(obj => 
            obj.id === draggingTextObjectId ? { ...obj, x: newX, y: newY } : obj
        ));
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
    } else if (activeTool === 'place_token') {
      const gridX = Math.floor(pos.x / cellSize);
      const gridY = Math.floor(pos.y / cellSize);
      if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
        setHoveredCellWhilePaintingOrErasing({ x: gridX, y: gridY });
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
    if (draggingToken && activeTool === 'select' && !editingTokenId) { 
      if (draggingTokenPosition) {
        const finalX = Math.max(0, Math.min(draggingTokenPosition.x, GRID_SIZE - 1));
        const finalY = Math.max(0, Math.min(draggingTokenPosition.y, GRID_SIZE - 1));
        onTokenMove(draggingToken.id, finalX, finalY);
      }
      setDraggingToken(null);
      setDragOffset(null);
      setDraggingTokenPosition(null);
    }
    if (draggingTextObjectId) {
        setDraggingTextObjectId(null);
        setTextObjectDragOffset(null);
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
    if (isMeasuring) { /* Optionally finalize */ }
    if (isErasing) {
        setIsErasing(false);
        setHoveredCellWhilePaintingOrErasing(null);
    }
    if (isPainting) {
        setIsPainting(false);
        setHoveredCellWhilePaintingOrErasing(null);
    }
    if (activeTool === 'place_token') {
      setHoveredCellWhilePaintingOrErasing(null);
    }
    if (draggingTextObjectId) { 
        setDraggingTextObjectId(null);
        setTextObjectDragOffset(null);
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
    
    const minAllowedVw = baseContentWidth / 10; 
    const maxAllowedVw = baseContentWidth + currentBorderWidth; 

    newVw = Math.max(minAllowedVw, Math.min(maxAllowedVw, newVw));
    if (vw !== 0) { newVh = (newVw / vw) * vh; } 
    else { newVh = newVw; }

    const newVx = centerPos.x - (centerPos.x - vx) * (newVw / vw);
    const newVy = centerPos.y - (centerPos.y - vy) * (newVh / vh);

    setViewBox(`${newVx} ${newVy} ${newVw} ${newVh}`);
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    if (editingTokenId || isCreatingText) return; 
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
    if (editingTokenId || isCreatingText) return 'cursor-text';
    if (isPanning || (draggingToken && activeTool === 'select') || draggingTextObjectId) return 'cursor-grabbing';
    if (activeTool === 'select' && !draggingToken && !draggingTextObjectId) return 'cursor-default'; 
    if (activeTool === 'type_tool') return 'cursor-text';
    if ([
      'paint_cell', 'place_token', 'measure_distance', 'measure_radius', 
      'eraser_tool', 'draw_line', 'draw_circle', 'draw_square'
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
        preserveAspectRatio="xMidYMid slice"
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
              const isHighlightActive = (isPainting && activeTool === 'paint_cell') || 
                                      (isErasing && activeTool === 'eraser_tool') ||
                                      (activeTool === 'place_token');
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

        <g>
          {drawnShapes.map(shape => {
            if (shape.type === 'line') {
              return ( <line key={shape.id} x1={shape.startPoint.x} y1={shape.startPoint.y} x2={shape.endPoint.x} y2={shape.endPoint.y} stroke={shape.color} strokeWidth={shape.strokeWidth} /> );
            } else if (shape.type === 'circle') {
              const radius = Math.sqrt( Math.pow(shape.endPoint.x - shape.startPoint.x, 2) + Math.pow(shape.endPoint.y - shape.startPoint.y, 2) );
              return ( <circle key={shape.id} cx={shape.startPoint.x} cy={shape.startPoint.y} r={radius} stroke={shape.color} strokeWidth={shape.strokeWidth} fill={shape.fillColor || 'transparent'} /> );
            } else if (shape.type === 'square') {
              const width = Math.abs(shape.endPoint.x - shape.startPoint.x);
              const height = Math.abs(shape.endPoint.y - shape.startPoint.y);
              const rectX = Math.min(shape.startPoint.x, shape.endPoint.x);
              const rectY = Math.min(shape.startPoint.y, shape.endPoint.y);
              return ( <rect key={shape.id} x={rectX} y={rectY} width={width} height={height} stroke={shape.color} strokeWidth={shape.strokeWidth} fill={shape.fillColor || 'transparent'} /> );
            }
            return null;
          })}
        </g>

        {currentDrawingShape && isDrawing && (
          <g>
            {currentDrawingShape.type === 'line' && ( <line x1={currentDrawingShape.startPoint.x} y1={currentDrawingShape.startPoint.y} x2={currentDrawingShape.endPoint.x} y2={currentDrawingShape.endPoint.y} stroke={currentDrawingShape.color} strokeWidth={currentDrawingShape.strokeWidth} strokeDasharray="3 3" /> )}
            {currentDrawingShape.type === 'circle' && ( <circle cx={currentDrawingShape.startPoint.x} cy={currentDrawingShape.startPoint.y} r={Math.sqrt( Math.pow(currentDrawingShape.endPoint.x - currentDrawingShape.startPoint.x, 2) + Math.pow(currentDrawingShape.endPoint.y - currentDrawingShape.startPoint.y, 2) )} stroke={currentDrawingShape.color} strokeWidth={currentDrawingShape.strokeWidth} fill={currentDrawingShape.fillColor || 'transparent'} strokeDasharray="3 3" /> )}
            {currentDrawingShape.type === 'square' && ( <rect x={Math.min(currentDrawingShape.startPoint.x, currentDrawingShape.endPoint.x)} y={Math.min(currentDrawingShape.startPoint.y, currentDrawingShape.endPoint.y)} width={Math.abs(currentDrawingShape.endPoint.x - currentDrawingShape.startPoint.x)} height={Math.abs(currentDrawingShape.endPoint.y - currentDrawingShape.startPoint.y)} stroke={currentDrawingShape.color} strokeWidth={currentDrawingShape.strokeWidth} fill={currentDrawingShape.fillColor || 'transparent'} strokeDasharray="3 3" /> )}
          </g>
        )}

        {tokens.map(token => {
          const IconComponent = token.icon as React.FC<LucideProps & {x?: number; y?:number; width?: string | number; height?: string | number; color?: string}>;

          let currentX = token.x;
          let currentY = token.y;

          if (draggingToken && token.id === draggingToken.id && draggingTokenPosition && !editingTokenId) {
            currentX = draggingTokenPosition.x;
            currentY = draggingTokenPosition.y;
          }

          const iconDisplaySize = cellSize * 0.8;
          const iconOffset = (cellSize - iconDisplaySize) / 2;

          let backgroundFill = 'black';
            switch (token.type) {
                case 'player': backgroundFill = 'hsl(120, 40%, 25%)'; break;
                case 'enemy': backgroundFill = 'hsl(0, 60%, 30%)'; break;
                case 'ally': backgroundFill = 'hsl(210, 70%, 45%)'; break; 
                case 'item': backgroundFill = 'hsl(270, 40%, 30%)'; break;
                case 'terrain': backgroundFill = 'hsl(var(--muted))'; break;
                case 'generic': backgroundFill = 'hsl(var(--accent))'; break;
                default: backgroundFill = 'black';
            }

          const isCurrentlyEditing = editingTokenId === token.id;
          const isTokenActiveTurn = token.id === activeTokenId;

          return (
            <g
              key={token.id}
              transform={`translate(${currentX * cellSize}, ${currentY * cellSize})`}
              onMouseDown={(e) => handleTokenMouseDown(e, token)}
              onMouseEnter={() => setHoveredTokenId(token.id)}
              onMouseLeave={() => setHoveredTokenId(null)}
              className={cn(
                activeTool === 'select' && !isCurrentlyEditing && 'cursor-grab',
                draggingToken?.id === token.id && !isCurrentlyEditing && 'cursor-grabbing',
                isCurrentlyEditing && 'cursor-text',
                'drop-shadow-md' 
              )}
            >
              <circle
                cx={cellSize / 2}
                cy={cellSize / 2}
                r={cellSize / 2}
                fill={backgroundFill}
                stroke={
                  isTokenActiveTurn
                    ? 'hsl(var(--ring))'
                    : hoveredTokenId === token.id && activeTool === 'select' && !isCurrentlyEditing
                      ? 'hsl(var(--accent))'
                      : 'hsl(var(--primary-foreground))'
                }
                strokeWidth={isTokenActiveTurn ? 3 : 1}
                onClick={(e) => { if (!isCurrentlyEditing && activeTool === 'select') handleTokenLabelClick(e, token);}}
              />
              {IconComponent && (
                <IconComponent
                  x={iconOffset}
                  y={iconOffset}
                  width={iconDisplaySize}
                  height={iconDisplaySize}
                  color={'hsl(var(--primary-foreground))'}
                  strokeWidth={1.5}
                  onClick={(e) => { if (!isCurrentlyEditing && activeTool === 'select') handleTokenLabelClick(e, token);}}
                  className={!isCurrentlyEditing && activeTool === 'select' ? "pointer-events-auto" : "pointer-events-none"}
                />
              )}
              {token.instanceName && !isCurrentlyEditing && (
                <text
                  x={cellSize / 2}
                  y={cellSize + 10} 
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="sans-serif"
                  fill="hsl(var(--foreground))"
                  stroke="hsl(var(--background))"
                  strokeWidth="0.4px"
                  paintOrder="stroke"
                  className={cn(
                    activeTool === 'select' ? "cursor-text" : "cursor-default",
                    "select-none"
                  )}
                  onClick={(e) => handleTokenLabelClick(e, token)}
                >
                  {token.instanceName}
                </text>
              )}
              {isCurrentlyEditing && (
                <foreignObject 
                  x={-cellSize / 2} 
                  y={cellSize + 2} 
                  width={cellSize * 2} 
                  height={20} 
                >
                  <input
                    ref={foreignObjectInputRef}
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={handleSaveTokenName}
                    onKeyDown={handleEditInputKeyDown}
                    style={{
                      background: 'hsl(var(--background))',
                      color: 'hsl(var(--foreground))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '3px',
                      fontSize: '10px',
                      padding: '2px 4px',
                      width: '100%',
                      textAlign: 'center',
                      outline: 'none',
                    }}
                    onWheelCapture={(e) => e.stopPropagation()} 
                  />
                </foreignObject>
              )}
            </g>
          );
        })}
        
        {textObjects.map(obj => (
          <foreignObject
            key={obj.id}
            x={obj.x}
            y={obj.y}
            width={obj.width}
            height={obj.height}
            className={cn(activeTool === 'select' ? 'cursor-grab' : 'cursor-default', draggingTextObjectId === obj.id ? 'cursor-grabbing' : '')}
            onMouseDown={(e) => {
              if (activeTool === 'select') {
                e.stopPropagation(); 
                setDraggingTextObjectId(obj.id);
                const pos = getMousePosition(e);
                setTextObjectDragOffset({ x: pos.x - obj.x, y: pos.y - obj.y });
              }
            }}
          >
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: 'white',
                padding: `${TEXT_PADDING.y}px ${TEXT_PADDING.x}px`,
                borderRadius: '8px',
                fontSize: `${obj.fontSize}px`,
                fontFamily: 'sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap', 
                overflow: 'hidden',
                boxSizing: 'border-box',
              }}
            >
              {obj.content}
            </div>
          </foreignObject>
        ))}

        {isCreatingText && (
          <foreignObject 
            x={isCreatingText.x} 
            y={isCreatingText.y - (isCreatingText.fontSize + TEXT_PADDING.y * 2) / 2} 
            width={isCreatingText.inputWidth} 
            height={isCreatingText.fontSize + TEXT_PADDING.y * 2 + 2} 
          >
            <input
              ref={textInputRef}
              type="text"
              value={isCreatingText.currentText}
              onChange={handleTextInputChange}
              onKeyDown={handleTextInputKeyDown}
              onBlur={finalizeTextCreation}
              style={{
                width: '100%',
                height: '100%',
                padding: `${TEXT_PADDING.y}px ${TEXT_PADDING.x}px`,
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                border: '1px solid hsl(var(--accent))',
                borderRadius: '8px',
                fontSize: `${isCreatingText.fontSize}px`,
                fontFamily: 'sans-serif',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onWheelCapture={(e) => e.stopPropagation()}
            />
          </foreignObject>
        )}

        <defs>
          <marker id="arrowhead" markerWidth="12" markerHeight="8.4" refX="11.5" refY="4.2" orient="auto">
            <polygon points="0 0, 12 4.2, 0 8.4" fill="hsl(var(--accent))" />
          </marker>
        </defs>
        {measurement.startPoint && measurement.endPoint && (
          <g stroke="hsl(var(--accent))" strokeWidth="3" fill="none">
            {measurement.type === 'distance' ? ( <line x1={measurement.startPoint.x * cellSize + cellSize/2} y1={measurement.startPoint.y * cellSize + cellSize/2} x2={measurement.endPoint.x * cellSize + cellSize/2} y2={measurement.endPoint.y * cellSize + cellSize/2} markerEnd="url(#arrowhead)" />
            ) : ( <circle cx={measurement.startPoint.x * cellSize + cellSize/2} cy={measurement.startPoint.y * cellSize + cellSize/2} r={Math.sqrt(Math.pow(measurement.endPoint.x - measurement.startPoint.x, 2) + Math.pow(measurement.endPoint.y - measurement.startPoint.y, 2)) * cellSize} strokeDasharray="5 3" fill="hsla(30, 80%, 85%, 0.3)" /> )}
          </g>
        )}
        {isMeasuring && measurement.endPoint && measurement.result && (
          <text x={measurement.endPoint.x * cellSize + cellSize / 2 + 20} y={measurement.endPoint.y * cellSize + cellSize / 2 + 20} fill="hsl(var(--accent))" fontSize="20" paintOrder="stroke" stroke="hsl(var(--background))" strokeWidth="4px" strokeLinecap="butt" strokeLinejoin="miter" className="pointer-events-none select-none font-bold" >
            {measurement.result.replace("Distance: ", "").replace("Radius: ", "")}
          </text>
        )}
         {measurement.startPoint && ( <circle cx={measurement.startPoint.x * cellSize + cellSize / 2} cy={measurement.startPoint.y * cellSize + cellSize / 2} r="4" fill="hsl(var(--accent))" /> )}
         {measurement.endPoint && measurement.result && ( <circle cx={measurement.endPoint.x * cellSize + cellSize / 2} cy={measurement.endPoint.y * cellSize + cellSize / 2} r="4" fill="hsl(var(--accent))" /> )}

      </svg>
      <TooltipProvider delayDuration={0}>
        <div className="absolute bottom-4 right-4 flex flex-col space-y-2 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => handleZoomButtonClick(true)} className="rounded-md shadow-lg h-10 w-10 p-2 bg-card text-card-foreground hover:bg-muted" aria-label="Zoom In" >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" align="center"><p>Zoom In</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => handleZoomButtonClick(false)} className="rounded-md shadow-lg h-10 w-10 p-2 bg-card text-card-foreground hover:bg-muted" aria-label="Zoom Out" >
                <Minus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" align="center"><p>Zoom Out</p></TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}

