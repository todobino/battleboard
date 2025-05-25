
'use client';

import type { Point, BattleGridProps, Token as TokenType, DrawnShape, TextObjectType } from '@/types';
import type { LucideProps } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Plus, Minus, Grid2x2Check, Grid2x2X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const GRID_SIZE = 30; // Number of cells, not pixel size.
const DEFAULT_CELL_SIZE = 30; // Pixel size of each cell.
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
  setShowGridLines,
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
    const currentBorderWidth = BORDER_WIDTH_WHEN_VISIBLE; // Assume grid lines initially visible for padding calc
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


  const cellSize = DEFAULT_CELL_SIZE;

   useEffect(() => {
    // This effect primarily centers the viewbox if it's showing the entire grid content.
    // It might need adjustments if complex panning/zooming has occurred.
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
      // Check if current viewbox matches the 'fully zoomed out to content' dimensions
      const isFullyZoomedToContent = Math.abs(currentVbParts[0] - expectedMinX) < 1e-3 &&
                                   Math.abs(currentVbParts[1] - expectedMinY) < 1e-3 &&
                                   Math.abs(currentVbParts[2] - expectedVw) < 1e-3 &&
                                   Math.abs(currentVbParts[3] - expectedVh) < 1e-3;

      if (isFullyZoomedToContent) {
           return currentVbString; // Already centered and fitting content
      }
      // More complex logic might be needed if trying to re-center after arbitrary pan/zoom
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
    // When activeTool changes, reset conflicting states
    if (activeTool !== 'select') {
      if (editingTokenId) {
        // If we switch tool while editing a token name, cancel the edit
        setEditingTokenId(null);
        setEditingText('');
      }
    }
    if (activeTool !== 'type_tool') {
      if (isCreatingText) {
        // If we switch tool while creating text, finalize it
        finalizeTextCreation();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);


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
        // If not clicking a text object, initiate pan
        setIsPanning(true);
        setPanStart({ x: event.clientX, y: event.clientY });
        return;
    }

    if (activeTool === 'type_tool') {
        event.stopPropagation(); // Prevent click from bubbling to other handlers

        if (isCreatingText) { // If already creating text, finalize the current one
            finalizeTextCreation();
        }
        // Use setTimeout to ensure any previous state updates (like blur) are processed
        setTimeout(() => {
            const newPos = getMousePosition(event); // Re-get position in case of async delay
            setIsCreatingText({
                id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                x: newPos.x,
                y: newPos.y,
                currentText: '',
                fontSize: currentTextFontSize,
                inputWidth: 150, // Initial width, will adjust
            });
        }, 0);
        return;
    }

    if (gridX < 0 || gridX >= GRID_SIZE || gridY < 0 || gridY >= GRID_SIZE) {
      // Outside grid, only allow panning with middle mouse or ctrl+click
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
          const instanceNamePrefix = baseLabel || 'Token';
          const existingTokensOfTypeAndLabel = tokens.filter(t =>
            (t.type === selectedTokenTemplate.type && t.label === baseLabel) ||
            (t.customImageUrl && t.label === baseLabel) // Check for custom images too
          );
          const count = existingTokensOfTypeAndLabel.length + 1;
          const instanceName = `${instanceNamePrefix} ${count}`;

          const newTokenData: Omit<TokenType, 'id'> = {
            ...selectedTokenTemplate,
             x: gridX,
             y: gridY,
             instanceName: instanceName,
             customImageUrl: selectedTokenTemplate.customImageUrl, // Persist custom image
             icon: selectedTokenTemplate.customImageUrl ? undefined : selectedTokenTemplate.icon, // Clear icon if custom image
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
            fillColor: activeTool !== 'draw_line' ? 'hsla(30, 40%, 25%, 0.5)' : undefined, // Example fill
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
    setDraggingTokenPosition(null); // Reset visual dragging position until actual move
  };

  const handleTokenLabelClick = (event: React.MouseEvent, token: TokenType) => {
    event.stopPropagation(); // Prevent grid click or pan
    if (activeTool === 'select' && !draggingToken) { // Only allow edit if select tool active and not currently dragging this token
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
      onTokenInstanceNameChange(editingTokenId, editingText); // Notify parent
      setEditingTokenId(null);
      setEditingText('');
    }
  };

  const handleEditInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSaveTokenName();
    } else if (event.key === 'Escape') {
      setEditingTokenId(null); // Cancel edit
      setEditingText('');
    }
  };

  const handleTextInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent form submission if inside one
      finalizeTextCreation();
    } else if (event.key === 'Escape') {
      setIsCreatingText(null); // Cancel text creation
    }
  };

  const handleTextInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isCreatingText) {
      const newText = event.target.value;
      // Dynamically adjust input width based on text content
      const tempSpan = document.createElement('span');
      tempSpan.style.font = `${isCreatingText.fontSize}px sans-serif`; // Ensure font matches final display
      tempSpan.style.visibility = 'hidden';
      tempSpan.style.position = 'absolute';
      tempSpan.textContent = newText || " "; // Use a space if empty for min width calculation
      document.body.appendChild(tempSpan);
      const textMetricsWidth = tempSpan.offsetWidth;
      document.body.removeChild(tempSpan);

      // Add padding and a little extra buffer for cursor
      setIsCreatingText(prev => prev ? { ...prev, currentText: newText, inputWidth: textMetricsWidth + TEXT_PADDING.x * 2 + 5 } : null);
    }
  };


  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePosition(event);
    if (isPanning && panStart && svgRef.current) {
      const currentVbParts = viewBox.split(' ').map(Number);
      const svgContainerEl = svgRef.current;
      const svgContainerWidth = svgContainerEl.clientWidth;
      const svgContainerHeight = svgContainerEl.clientHeight;

      if (svgContainerWidth === 0 || svgContainerHeight === 0) return;

      const currentVbX = currentVbParts[0];
      const currentVbY = currentVbParts[1];
      const currentVbRawWidth = currentVbParts[2];
      const currentVbRawHeight = currentVbParts[3];
      
      // Calculate effective visible width/height of the viewBox due to "slice"
      // This is important for accurate panning limits when content aspect != viewport aspect
      const scaleToCover = Math.max(svgContainerWidth / currentVbRawWidth, svgContainerHeight / currentVbRawHeight);
      const effectiveVisibleViewBoxWidth = svgContainerWidth / scaleToCover;
      const effectiveVisibleViewBoxHeight = svgContainerHeight / scaleToCover;

      const screenDeltaX = panStart.x - event.clientX;
      const screenDeltaY = panStart.y - event.clientY;

      // Convert screen delta to viewBox delta
      // The ratio of viewBox dimension to screen dimension gives units per pixel
      const dxViewBox = screenDeltaX * (currentVbRawWidth / svgContainerWidth);
      const dyViewBox = screenDeltaY * (currentVbRawHeight / svgContainerHeight);
      
      let newVx = currentVbX + dxViewBox;
      let newVy = currentVbY + dyViewBox;

      const contentTotalWidth = GRID_SIZE * cellSize;
      const contentTotalHeight = GRID_SIZE * cellSize;
      const currentBorderWidth = showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0;
      const svgPadding = currentBorderWidth / 2;

      // Horizontal Panning Limits
      const vx_bound_origin_start = 0 - svgPadding; // ViewBox origin if content left aligns with ViewBox left
      const vx_bound_origin_end = (contentTotalWidth + currentBorderWidth) - effectiveVisibleViewBoxWidth - svgPadding; // ViewBox origin if content right aligns with ViewBox right
      
      const min_allowed_vx = Math.min(vx_bound_origin_start, vx_bound_origin_end);
      const max_allowed_vx = Math.max(vx_bound_origin_start, vx_bound_origin_end);
      newVx = Math.max(min_allowed_vx, Math.min(newVx, max_allowed_vx));

      // Vertical Panning Limits
      const vy_bound_origin_start = 0 - svgPadding; // ViewBox origin if content top aligns with ViewBox top
      const vy_bound_origin_end = (contentTotalHeight + currentBorderWidth) - effectiveVisibleViewBoxHeight - svgPadding; // ViewBox origin if content bottom aligns with ViewBox bottom

      const min_allowed_vy = Math.min(vy_bound_origin_start, vy_bound_origin_end);
      const max_allowed_vy = Math.max(vy_bound_origin_start, vy_bound_origin_end);
      newVy = Math.max(min_allowed_vy, Math.min(newVy, max_allowed_vy));
      
      setViewBox(`${newVx} ${newVy} ${currentVbRawWidth} ${currentVbRawHeight}`);
      setPanStart({ x: event.clientX, y: event.clientY });
      setHoveredCellWhilePaintingOrErasing(null);

    } else if (draggingToken && dragOffset && activeTool === 'select' && !editingTokenId) {
      const currentMouseSvgPos = getMousePosition(event);
      // Target position for the token's origin (top-left) in SVG coords
      const newTargetTokenOriginX = currentMouseSvgPos.x - dragOffset.x;
      const newTargetTokenOriginY = currentMouseSvgPos.y - dragOffset.y;
      // Convert target SVG origin to grid cell indices
      const gridX = Math.floor(newTargetTokenOriginX / cellSize);
      const gridY = Math.floor(newTargetTokenOriginY / cellSize);
      // Clamp to grid boundaries
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
      const roundedDistInFeet = Math.round(distInFeet * 10) / 10; // Round to one decimal place
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
                const newCells = [...prev.map(r => [...r.map(c => ({...c}))])]; // Deep copy for immutability
                if (newCells[gridY] && newCells[gridY][gridX] && newCells[gridY][gridX].color !== selectedColor) {
                    newCells[gridY][gridX].color = selectedColor;
                    return newCells;
                }
                return prev; // No change needed, return previous state
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
        // If no specific tool action is happening on mouse move, clear any cell hover highlight
        setHoveredCellWhilePaintingOrErasing(null);
    }
  };

  const handleMouseUp = (event: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
    }
    if (draggingToken && activeTool === 'select' && !editingTokenId) {
      if (draggingTokenPosition) { // Ensure a valid grid position was calculated
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
      // Measurement result is already set, it persists until cleared or new one starts
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
    // if (isMeasuring) { /* Optionally finalize measurement if mouse leaves grid */ }
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
    if (draggingTextObjectId) { // If dragging a text object and mouse leaves, finalize drag
        setDraggingTextObjectId(null);
        setTextObjectDragOffset(null);
    }
  };

  const applyZoom = (zoomIn: boolean, customScaleAmount?: number) => {
    if (!svgRef.current) return;
    const scaleAmount = customScaleAmount || ZOOM_AMOUNT;
    const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);

    const svgRect = svgRef.current.getBoundingClientRect();
    // Use center of SVG container as zoom origin in client coordinates
    const clientCenterX = svgRect.left + svgRect.width / 2;
    const clientCenterY = svgRect.top + svgRect.height / 2;

    // Convert client center to SVG/viewBox coordinates
    const centerPos = getMousePosition({ clientX: clientCenterX, clientY: clientCenterY } as MouseEvent);

    let newVw, newVh;
    if (zoomIn) {
      newVw = vw / scaleAmount;
    } else {
      newVw = vw * scaleAmount;
    }

    // Calculate min/max allowed viewBox width based on content width
    const baseContentWidth = GRID_SIZE * cellSize;
    const currentBorderWidth = showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0; // Use current state of grid lines

    const minAllowedVw = baseContentWidth / 10; // Max zoom in (e.g. 10x content width)
    const maxAllowedVw = baseContentWidth + currentBorderWidth; // Max zoom out (fits content width exactly)

    newVw = Math.max(minAllowedVw, Math.min(maxAllowedVw, newVw));
    if (vw !== 0) { newVh = (newVw / vw) * vh; } // Maintain aspect ratio of current viewBox
    else { newVh = newVw; } // Avoid division by zero, assume square if vw was 0


    // Adjust vx, vy so that the zoom appears to be centered on centerPos
    const newVx = centerPos.x - (centerPos.x - vx) * (newVw / vw);
    const newVy = centerPos.y - (centerPos.y - vy) * (newVh / vh);

    setViewBox(`${newVx} ${newVy} ${newVw} ${newVh}`);
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    if (editingTokenId || isCreatingText) return; // Prevent zoom while editing text
    event.preventDefault();
    applyZoom(event.deltaY < 0, ZOOM_AMOUNT); // Zoom in if deltaY is negative
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
    if (activeTool === 'select' && !draggingToken && !draggingTextObjectId) return 'cursor-default'; // Changed from grab to default
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
        <defs>
          {tokens.map(token =>
            token.customImageUrl ? (
              <clipPath key={`clip-${token.id}`} id={`clip-${token.id}`}>
                {/* Circle slightly smaller to ensure border is visible if image is opaque */}
                <circle cx={cellSize / 2} cy={cellSize / 2} r={cellSize / 2 * 0.95} />
              </clipPath>
            ) : null
          )}
          <marker id="arrowhead" markerWidth="12" markerHeight="8.4" refX="11.5" refY="4.2" orient="auto">
            <polygon points="0 0, 12 4.2, 0 8.4" fill="hsl(var(--accent))" />
          </marker>
          <filter id="blurryTextDropShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="1" stdDeviation="0.75" floodColor="#000000" floodOpacity="0.6"/>
          </filter>
        </defs>

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
                    ? 'hsl(var(--ring))' // Highlight color for active cell
                    : showGridLines ? 'black' : 'transparent'
                }
                strokeWidth={
                  isHighlighted
                    ? BORDER_WIDTH_WHEN_VISIBLE + 1 // Thicker border for highlight
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

          // If this token is being dragged, use the temporary dragging position for rendering
          if (draggingToken && token.id === draggingToken.id && draggingTokenPosition && !editingTokenId) {
            currentX = draggingTokenPosition.x;
            currentY = draggingTokenPosition.y;
          }

          const iconDisplaySize = cellSize * 0.8; // Icon takes 80% of cell size
          const iconOffset = (cellSize - iconDisplaySize) / 2; // Center the icon

          const imageDisplaySize = cellSize * 0.95; // Image takes 95% to allow border visibility
          const imageOffset = (cellSize - imageDisplaySize) / 2;


          // Determine background fill based on token type or custom color
          let backgroundFill = token.color; // Fallback to token.color if defined
            if (!token.customImageUrl) { // Only apply type-based default colors if not a custom image token
                switch (token.type) {
                    case 'player': backgroundFill = 'hsl(var(--player-green-bg))'; break;
                    case 'enemy': backgroundFill = 'hsl(var(--destructive))'; break;
                    case 'ally': backgroundFill = 'hsl(var(--app-blue-bg))'; break;
                    case 'item': backgroundFill = 'hsl(270, 40%, 30%)'; break; // Example purple
                    case 'terrain': backgroundFill = 'hsl(var(--muted))'; break;
                    case 'generic': backgroundFill = 'hsl(var(--accent))'; break; // Use accent for generic
                    default: backgroundFill = token.color || 'black'; // Use token's color or black if no type match
                }
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
                isCurrentlyEditing && 'cursor-text', // Cursor for text input
                'drop-shadow-md' // Added drop shadow to the entire token group
              )}
            >
              {/* Background circle */}
              <circle
                cx={cellSize / 2}
                cy={cellSize / 2}
                r={cellSize / 2}
                fill={backgroundFill}
                stroke={
                  isTokenActiveTurn
                    ? 'hsl(var(--ring))' // Active turn highlight
                    : hoveredTokenId === token.id && activeTool === 'select' && !isCurrentlyEditing
                      ? 'hsl(var(--accent))' // Hover highlight when selectable
                      : 'hsl(var(--primary-foreground))' // Default border (whiteish)
                }
                strokeWidth={isTokenActiveTurn ? 3 : 1} // Thicker border for active turn
                onClick={(e) => { if (!isCurrentlyEditing && activeTool === 'select') handleTokenLabelClick(e, token);}}
              />
              {token.customImageUrl ? (
                <>
                  <image
                    href={token.customImageUrl}
                    x={imageOffset}
                    y={imageOffset}
                    width={imageDisplaySize}
                    height={imageDisplaySize}
                    clipPath={`url(#clip-${token.id})`}
                    onClick={(e) => { if (!isCurrentlyEditing && activeTool === 'select') handleTokenLabelClick(e, token);}}
                    className={cn(!isCurrentlyEditing && activeTool === 'select' ? "pointer-events-auto" : "pointer-events-none")}
                  />
                   {/* White border for custom image tokens */}
                   <circle
                    cx={cellSize / 2}
                    cy={cellSize / 2}
                    r={cellSize / 2 * 0.95} // Matches clipPath radius
                    fill="none"
                    strokeWidth="1.5" // Adjust thickness as needed
                    stroke={'hsl(var(--primary-foreground))'} // White border
                    className="pointer-events-none" // So it doesn't interfere with image click
                  />
                </>
              ) : IconComponent ? (
                <IconComponent
                  x={iconOffset}
                  y={iconOffset}
                  width={iconDisplaySize}
                  height={iconDisplaySize}
                  color={'hsl(var(--primary-foreground))'} // Icon color (whiteish)
                  strokeWidth={1.5}
                  onClick={(e) => { if (!isCurrentlyEditing && activeTool === 'select') handleTokenLabelClick(e, token);}}
                  className={cn(
                    !isCurrentlyEditing && activeTool === 'select' ? "pointer-events-auto" : "pointer-events-none"
                  )}
                />
              ) : null}

              {/* Token Instance Name Label */}
              {token.instanceName && !isCurrentlyEditing && (
                <text
                  x={cellSize / 2}
                  y={cellSize + 10} // Position below the token
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  fill="hsl(var(--foreground))"
                  stroke="black" // Black outline for the text
                  strokeWidth="1.25px" // Thicker outline
                  paintOrder="stroke" // Render stroke behind fill
                  filter="url(#blurryTextDropShadow)" // Apply blurry drop shadow
                  className={cn(
                    activeTool === 'select' ? "cursor-text" : "cursor-default", // Text cursor when editable
                    "select-none" // Prevent text selection during normal interaction
                  )}
                  onClick={(e) => handleTokenLabelClick(e, token)}
                >
                  {token.instanceName}
                </text>
              )}
              {isCurrentlyEditing && (
                <foreignObject
                  x={-cellSize / 2} // Adjust to center the input field relative to token center
                  y={cellSize + 2} // Position below the token
                  width={cellSize * 2} // Allow some width for typing
                  height={20} // Fixed height for the input
                >
                  <input
                    ref={foreignObjectInputRef}
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={handleSaveTokenName} // Save on blur
                    onKeyDown={handleEditInputKeyDown} // Save on Enter, cancel on Escape
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
                    onWheelCapture={(e) => e.stopPropagation()} // Prevent grid zoom while editing
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
                e.stopPropagation(); // Prevent grid click
                setDraggingTextObjectId(obj.id);
                const pos = getMousePosition(e); // Use the shared mouse position function
                setTextObjectDragOffset({ x: pos.x - obj.x, y: pos.y - obj.y });
              }
            }}
          >
            <div
              xmlns="http://www.w3.org/1999/xhtml" // Required for foreignObject content
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
                whiteSpace: 'nowrap', // Prevent text wrapping inside the bubble
                overflow: 'hidden', // Clip content if too long (should be handled by calculated width)
                boxSizing: 'border-box',
              }}
            >
              {obj.content}
            </div>
          </foreignObject>
        ))}

        {isCreatingText && (
          <foreignObject
            x={isCreatingText.x} // Position based on click
            y={isCreatingText.y - (isCreatingText.fontSize + TEXT_PADDING.y * 2) / 2} // Center vertically
            width={isCreatingText.inputWidth} // Dynamic width
            height={isCreatingText.fontSize + TEXT_PADDING.y * 2 + 2} // Height based on font size and padding + border
          >
            <input
              ref={textInputRef}
              type="text"
              value={isCreatingText.currentText}
              onChange={handleTextInputChange}
              onKeyDown={handleTextInputKeyDown}
              onBlur={finalizeTextCreation} // Finalize on blur
              style={{
                width: '100%',
                height: '100%',
                padding: `${TEXT_PADDING.y}px ${TEXT_PADDING.x}px`,
                background: 'rgba(0,0,0,0.7)', // Slightly darker for input differentiation
                color: 'white',
                border: '1px solid hsl(var(--accent))', // Accent border for active input
                borderRadius: '8px',
                fontSize: `${isCreatingText.fontSize}px`,
                fontFamily: 'sans-serif',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onWheelCapture={(e) => e.stopPropagation()} // Prevent grid zoom while typing
            />
          </foreignObject>
        )}


        {/* Measurement rendering - should be above tokens and other interactables */}
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
            ) : ( // Radius
              <circle
                cx={measurement.startPoint.x * cellSize + cellSize/2}
                cy={measurement.startPoint.y * cellSize + cellSize/2}
                r={Math.sqrt(Math.pow(measurement.endPoint.x - measurement.startPoint.x, 2) + Math.pow(measurement.endPoint.y - measurement.startPoint.y, 2)) * cellSize}
                strokeDasharray="5 3"
                fill="hsla(30, 80%, 85%, 0.3)" // Example fill for radius
              />
            )}
          </g>
        )}
        {isMeasuring && measurement.endPoint && measurement.result && (
          <text
            x={measurement.endPoint.x * cellSize + cellSize / 2 + 20} // Offset for readability
            y={measurement.endPoint.y * cellSize + cellSize / 2 + 20}
            fill="hsl(var(--accent))"
            fontSize="20"
            paintOrder="stroke"
            stroke="hsl(var(--background))" // Text outline for visibility
            strokeWidth="4px"
            strokeLinecap="butt"
            strokeLinejoin="miter"
            className="pointer-events-none select-none font-bold"
          >
            {/* Display only the numeric value and unit */}
            {measurement.result.replace("Distance: ", "").replace("Radius: ", "")}
          </text>
        )}
         {/* Small circles at start/end points of measurement */}
         {measurement.startPoint && (
           <circle
             cx={measurement.startPoint.x * cellSize + cellSize / 2}
             cy={measurement.startPoint.y * cellSize + cellSize / 2}
             r="4"
             fill="hsl(var(--accent))"
           />
         )}
         {measurement.endPoint && measurement.result && ( // Only show end circle if measurement is active/has result
           <circle
             cx={measurement.endPoint.x * cellSize + cellSize / 2}
             cy={measurement.endPoint.y * cellSize + cellSize / 2}
             r="4"
             fill="hsl(var(--accent))"
           />
         )}

      </svg>
      <TooltipProvider delayDuration={0}>
        <div className="absolute bottom-4 right-4 flex flex-col space-y-2 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowGridLines(!showGridLines)}
                className={cn(
                  "rounded-md shadow-lg h-10 w-10 p-2",
                  showGridLines
                    ? "bg-primary text-primary-foreground hover:bg-primary/90" // Orange-brown when ON
                    : "bg-card text-card-foreground hover:bg-muted" // Default style when OFF
                )}
                aria-label={showGridLines ? "Hide Grid Lines" : "Show Grid Lines"}
              >
                {showGridLines ? <Grid2x2Check className="h-5 w-5" /> : <Grid2x2X className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" align="center">
              <p>{showGridLines ? "Hide Grid Lines" : "Show Grid Lines"}</p>
            </TooltipContent>
          </Tooltip>
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

    