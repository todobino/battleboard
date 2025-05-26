
'use client';

import type { Point, BattleGridProps, Token as TokenType, DrawnShape, TextObjectType } from '@/types';
import type { LucideProps } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Plus, Minus, Grid2x2Check, Grid2x2X, MoreVertical, Edit3, Trash2, Image as ImageIcon } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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


const DEFAULT_CELL_SIZE = 30; // Pixel size of each cell.
const BORDER_WIDTH_WHEN_VISIBLE = 1;
const FEET_PER_SQUARE = 5;
const ZOOM_AMOUNT = 1.1;
const TEXT_PADDING = { x: 8, y: 4 }; // Padding for text bubbles
const CLICK_THRESHOLD_SQUARED = 25; // For distinguishing click vs drag (5px threshold)


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
  onTokenDelete,
  onTokenImageChangeRequest,
}: BattleGridProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const numRows = gridCells.length;
  const numCols = gridCells.length > 0 ? gridCells[0].length : 0;
  const cellSize = DEFAULT_CELL_SIZE; 

  const [viewBox, setViewBox] = useState(() => {
    const initialContentWidth = numCols * cellSize;
    const initialContentHeight = numRows * cellSize;
    return `0 0 ${initialContentWidth || 100} ${initialContentHeight || 100}`;
  });

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);

  const [draggingToken, setDraggingToken] = useState<TokenType | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [draggingTokenPosition, setDraggingTokenPosition] = useState<Point | null>(null);
  const [mouseDownPos, setMouseDownPos] = useState<Point | null>(null); // For token click vs drag detection

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
  const textInputRef = useRef<HTMLInputElement>(null); // For new text creation

  // Text Object interaction state
  const [isCreatingText, setIsCreatingText] = useState<{ id: string; x: number; y: number; currentText: string; fontSize: number; inputWidth: number; } | null>(null);
  const [draggingTextObjectId, setDraggingTextObjectId] = useState<string | null>(null);
  const [textObjectDragOffset, setTextObjectDragOffset] = useState<Point | null>(null);
  const [textObjectDragStartPos, setTextObjectDragStartPos] = useState<Point | null>(null); // SVG coords for click/drag
  const [textObjectDragStartScreenPos, setTextObjectDragStartScreenPos] = useState<Point | null>(null); // Screen coords for click/drag

  // Text Object Popover State
  const textObjectPopoverTriggerRef = useRef<HTMLButtonElement>(null);
  const [textObjectPopoverOpen, setTextObjectPopoverOpen] = useState(false);
  const [activePopoverTextObject, setActivePopoverTextObject] = useState<TextObjectType | null>(null);
  const [textObjectDeleteAlertOpen, setTextObjectDeleteAlertOpen] = useState(false);
  const [editingTextObjectId, setEditingTextObjectId] = useState<string | null>(null);
  const [editingTextObjectContent, setEditingTextObjectContent] = useState<string>('');
  const textObjectEditInputRef = useRef<HTMLInputElement>(null);


  // Token Popover State
  const popoverTriggerRef = useRef<HTMLButtonElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [activePopoverToken, setActivePopoverToken] = useState<TokenType | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);


   useEffect(() => {
    const calculatedTotalContentWidth = numCols * cellSize;
    const calculatedTotalContentHeight = numRows * cellSize;
    const currentBorderWidth = showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0;
    const svgPadding = currentBorderWidth / 2; 

    const actualTotalContentMinX = 0 - svgPadding;
    const actualTotalContentMinY = 0 - svgPadding;
    const actualTotalContentWidth = calculatedTotalContentWidth + currentBorderWidth;
    const actualTotalContentHeight = calculatedTotalContentHeight + currentBorderWidth;

    if (svgRef.current) {
      const svg = svgRef.current;
      const viewportWidth = svg.clientWidth;
      const viewportHeight = svg.clientHeight;

      if (viewportWidth > 0 && viewportHeight > 0 && actualTotalContentWidth > 0 && actualTotalContentHeight > 0) {
        const scaleToFillViewportWidth = viewportWidth / actualTotalContentWidth;
        const initialViewWidth = actualTotalContentWidth;
        const initialViewHeight = viewportHeight / scaleToFillViewportWidth;
        const initialViewMinX = actualTotalContentMinX;
        const initialViewMinY = actualTotalContentMinY + (actualTotalContentHeight - initialViewHeight) / 2;
        
        setViewBox(`${initialViewMinX} ${initialViewMinY} ${initialViewWidth} ${initialViewHeight}`);
      } else {
        setViewBox(`${actualTotalContentMinX} ${actualTotalContentMinY} ${Math.max(1, actualTotalContentWidth)} ${Math.max(1, actualTotalContentHeight)}`);
      }
    } else {
      setViewBox(`${actualTotalContentMinX} ${actualTotalContentMinY} ${Math.max(1, actualTotalContentWidth)} ${Math.max(1, actualTotalContentHeight)}`);
    }
  }, [showGridLines, cellSize, numCols, numRows, backgroundImageUrl]); 

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

  useEffect(() => {
    if (editingTextObjectId && textObjectEditInputRef.current) {
        textObjectEditInputRef.current.focus();
        textObjectEditInputRef.current.select();
    }
  }, [editingTextObjectId]);


  const measureText = useCallback((text: string, fontSize: number) => {
    if (typeof document === 'undefined') return { width: 0, height: 0}; // Guard for SSR or test environments
    const tempSpan = document.createElement('span');
    document.body.appendChild(tempSpan);
    tempSpan.style.font = `${fontSize}px sans-serif`;
    tempSpan.style.whiteSpace = 'nowrap';
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.textContent = text || " "; // Ensure textContent is not empty for measurement
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

  const handleFinalizeTextEdit = useCallback(() => {
    if (editingTextObjectId && editingTextObjectContent.trim() !== '') {
        const originalTextObject = textObjects.find(to => to.id === editingTextObjectId);
        if (!originalTextObject) {
            setEditingTextObjectId(null);
            setEditingTextObjectContent('');
            return;
        }

        const { width: newTextContentWidth, height: newTextContentHeight } = measureText(editingTextObjectContent, originalTextObject.fontSize);
        const newBubbleWidth = newTextContentWidth + TEXT_PADDING.x * 2;
        const newBubbleHeight = newTextContentHeight + TEXT_PADDING.y * 2;

        setTextObjects(prev => prev.map(to =>
            to.id === editingTextObjectId
                ? { ...to, content: editingTextObjectContent, width: newBubbleWidth, height: newBubbleHeight }
                : to
        ));
    } else if (editingTextObjectId && editingTextObjectContent.trim() === '') {
        // If edited to be empty, delete it
        setTextObjects(prev => prev.filter(to => to.id !== editingTextObjectId));
    }
    setEditingTextObjectId(null);
    setEditingTextObjectContent('');
  }, [editingTextObjectId, editingTextObjectContent, textObjects, setTextObjects, measureText]);


  useEffect(() => {
    if (activeTool !== 'select') {
      if (editingTokenId) {
        handleSaveTokenName(); // Finalize token name edit if tool changes
      }
      if (editingTextObjectId) {
        handleFinalizeTextEdit(); // Finalize text object edit if tool changes
      }
    }
    if (activeTool !== 'type_tool') {
      if (isCreatingText) {
        finalizeTextCreation();
      }
    }
  }, [activeTool, editingTokenId, editingTextObjectId, isCreatingText, finalizeTextCreation, handleFinalizeTextEdit]);


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
    if (editingTokenId || editingTextObjectId) return;

    const pos = getMousePosition(event);
    const gridX = Math.floor(pos.x / cellSize);
    const gridY = Math.floor(pos.y / cellSize);

    if (activeTool === 'select' && (event.button === 0 || event.button === 1)) {
        // Check for text object click handled by foreignObject's onMouseDown
        // If not clicking a text object or token, start panning.
        const clickedOnToken = tokens.some(token => {
            const tokenLeft = token.x * cellSize;
            const tokenRight = (token.x + (token.size || 1)) * cellSize;
            const tokenTop = token.y * cellSize;
            const tokenBottom = (token.y + (token.size || 1)) * cellSize;
            return pos.x >= tokenLeft && pos.x <= tokenRight && pos.y >= tokenTop && pos.y <= tokenBottom;
        });
        
        // Check if clicked on a text object (its onMouseDown will stopPropagation if so)
        // If a text object was clicked, its own handler will deal with popovers/dragging
        // So, if we reach here and it wasn't a token, and it's not a text object being dragged, pan.
        if (!clickedOnToken && !draggingTextObjectId) {
            if (popoverOpen) {
                setPopoverOpen(false);
                setActivePopoverToken(null); 
            }
            if (textObjectPopoverOpen && !textObjectDeleteAlertOpen) {
                setTextObjectPopoverOpen(false);
                setActivePopoverTextObject(null);
            }
            setIsPanning(true);
            setPanStart({ x: event.clientX, y: event.clientY });
        }
        return;
    }
    
    if (popoverOpen && !isDeleteAlertOpen) {
      setPopoverOpen(false);
      setActivePopoverToken(null);
    }
    if (textObjectPopoverOpen && !textObjectDeleteAlertOpen) {
        setTextObjectPopoverOpen(false);
        setActivePopoverTextObject(null);
    }


    if (activeTool === 'type_tool') {
        event.stopPropagation(); 
        if (isCreatingText) { 
            finalizeTextCreation();
        }
        // If editing existing text, finalize that too
        if (editingTextObjectId) {
            handleFinalizeTextEdit();
        }
        setTimeout(() => { // Timeout to ensure any blur events fire first
            const newPos = getMousePosition(event); 
            setIsCreatingText({
                id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                x: newPos.x,
                y: newPos.y,
                currentText: '',
                fontSize: currentTextFontSize,
                inputWidth: 150, 
            });
        }, 0);
        return;
    }

    if (gridX < 0 || gridX >= numCols || gridY < 0 || gridY >= numRows) {
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
            (t.customImageUrl && t.label === baseLabel) 
          );
          const count = existingTokensOfTypeAndLabel.length + 1;
          const instanceName = `${instanceNamePrefix} ${count}`;

          const newTokenData: Omit<TokenType, 'id'> = {
            ...selectedTokenTemplate,
             x: gridX,
             y: gridY,
             instanceName: instanceName,
             customImageUrl: selectedTokenTemplate.customImageUrl, 
             icon: selectedTokenTemplate.customImageUrl ? undefined : selectedTokenTemplate.icon, 
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
    if (activeTool === 'select' && !editingTokenId) {
        event.stopPropagation(); // Prevent grid pan if clicking token
        setDraggingToken(token);
        const pos = getMousePosition(event);
        setMouseDownPos(pos); 
        setDragOffset({ x: pos.x - token.x * cellSize, y: pos.y - token.y * cellSize });
        setDraggingTokenPosition(null);

        if (popoverOpen && activePopoverToken?.id !== token.id) {
            setPopoverOpen(false); 
            setActivePopoverToken(null);
        }
        if (textObjectPopoverOpen) { // Close text popover if interacting with token
            setTextObjectPopoverOpen(false);
            setActivePopoverTextObject(null);
        }
    } else if (activeTool !== 'select' && popoverOpen && !isDeleteAlertOpen) {
        setPopoverOpen(false);
        setActivePopoverToken(null);
    }
  };


  const handleTokenLabelClick = (event: React.MouseEvent, token: TokenType) => {
    event.stopPropagation(); 
    if (activeTool === 'select' && !draggingToken && !popoverOpen && !isDeleteAlertOpen) { 
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

  const handleTextEditInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        handleFinalizeTextEdit();
    } else if (event.key === 'Escape') {
        setEditingTextObjectId(null);
        setEditingTextObjectContent('');
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
      const {width: textMetricsWidth} = measureText(newText || " ", isCreatingText.fontSize);
      setIsCreatingText(prev => prev ? { ...prev, currentText: newText, inputWidth: textMetricsWidth + TEXT_PADDING.x * 2 + 5 } : null);
    }
  };


  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePosition(event);
    if (isPanning && panStart && svgRef.current) {
      if (popoverOpen && !isDeleteAlertOpen) {
          setPopoverOpen(false);
          setActivePopoverToken(null);
      }
      if (textObjectPopoverOpen && !textObjectDeleteAlertOpen) {
          setTextObjectPopoverOpen(false);
          setActivePopoverTextObject(null);
      }
      const [currentVbMinX, currentVbMinY, currentVbWidth, currentVbHeight] = viewBox.split(' ').map(Number);
      const svgContainerEl = svgRef.current;
      const svgContainerWidth = svgContainerEl.clientWidth;
      const svgContainerHeight = svgContainerEl.clientHeight;

      if (svgContainerWidth === 0 || svgContainerHeight === 0 || currentVbWidth === 0 || currentVbHeight === 0) return;
      
      const scaleXViewBoxToViewport = svgContainerWidth / currentVbWidth;

      const screenDeltaX = panStart.x - event.clientX;
      const screenDeltaY = panStart.y - event.clientY;

      const dx_vb = screenDeltaX / scaleXViewBoxToViewport; 
      const dy_vb = screenDeltaY / scaleXViewBoxToViewport; 
      
      let newCandidateVx = currentVbMinX + dx_vb;
      let newCandidateVy = currentVbMinY + dy_vb;

      const calculatedTotalContentWidth = numCols * cellSize;
      const calculatedTotalContentHeight = numRows * cellSize;
      const borderWidthForOrigin = showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0;
      const paddingForOrigin = borderWidthForOrigin / 2;
      
      const absoluteContentWidth = calculatedTotalContentWidth + borderWidthForOrigin;
      const absoluteContentHeight = calculatedTotalContentHeight + borderWidthForOrigin;
      const absoluteContentMinX = 0 - paddingForOrigin;
      const absoluteContentMinY = 0 - paddingForOrigin;
      
      const max_vb_min_x = absoluteContentMinX + absoluteContentWidth - currentVbWidth;
      const max_vb_min_y = absoluteContentMinY + absoluteContentHeight - currentVbHeight;

      const min_vb_min_x = absoluteContentMinX; 
      const min_vb_min_y = absoluteContentMinY; 
      
      let finalNewVx = newCandidateVx;
      if (absoluteContentWidth <= currentVbWidth) { 
         finalNewVx = absoluteContentMinX + (absoluteContentWidth - currentVbWidth) / 2;
      } else { 
         finalNewVx = Math.max(min_vb_min_x, Math.min(newCandidateVx, max_vb_min_x));
      }

      let finalNewVy = newCandidateVy;
      if (absoluteContentHeight <= currentVbHeight) {
        finalNewVy = absoluteContentMinY + (absoluteContentHeight - currentVbHeight) / 2;
      } else {
        finalNewVy = Math.max(min_vb_min_y, Math.min(newCandidateVy, max_vb_min_y));
      }
      
      setViewBox(`${finalNewVx} ${finalNewVy} ${currentVbWidth} ${currentVbHeight}`);
      setPanStart({ x: event.clientX, y: event.clientY });
      setHoveredCellWhilePaintingOrErasing(null);

    } else if (draggingToken && dragOffset && activeTool === 'select' && !editingTokenId) {
      if (popoverOpen && !isDeleteAlertOpen) { 
          setPopoverOpen(false);
          setActivePopoverToken(null);
      }
      const currentMouseSvgPos = getMousePosition(event);
      const newTargetTokenOriginX = currentMouseSvgPos.x - dragOffset.x;
      const newTargetTokenOriginY = currentMouseSvgPos.y - dragOffset.y;
      const gridX = Math.floor(newTargetTokenOriginX / cellSize);
      const gridY = Math.floor(newTargetTokenOriginY / cellSize);
      const clampedGridX = Math.max(0, Math.min(gridX, numCols - 1));
      const clampedGridY = Math.max(0, Math.min(gridY, numRows - 1));
      if (!draggingTokenPosition || draggingTokenPosition.x !== clampedGridX || draggingTokenPosition.y !== clampedGridY) {
        setDraggingTokenPosition({ x: clampedGridX, y: clampedGridY });
      }
      setHoveredCellWhilePaintingOrErasing(null);
    } else if (draggingTextObjectId && textObjectDragOffset && activeTool === 'select' && !editingTextObjectId) {
        const newX = pos.x - textObjectDragOffset.x;
        const newY = pos.y - textObjectDragOffset.y;
        setTextObjects(prev => prev.map(obj =>
            obj.id === draggingTextObjectId ? { ...obj, x: newX, y: newY } : obj
        ));
    } else if (isMeasuring && measurement.startPoint && (activeTool === 'measure_distance' || activeTool === 'measure_radius')) {
      const gridX = Math.floor(pos.x / cellSize);
      const gridY = Math.floor(pos.y / cellSize);
      const endPoint = { x: Math.max(0, Math.min(gridX, numCols -1)), y: Math.max(0, Math.min(gridY, numRows -1)) };
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
        if (gridX >= 0 && gridX < numCols && gridY >= 0 && gridY < numRows) {
             setHoveredCellWhilePaintingOrErasing({ x: gridX, y: gridY });
             eraseContentAtCell(gridX, gridY);
        } else {
           setHoveredCellWhilePaintingOrErasing(null);
        }
    } else if (isPainting && activeTool === 'paint_cell') {
        const gridX = Math.floor(pos.x / cellSize);
        const gridY = Math.floor(pos.y / cellSize);
        if (gridX >= 0 && gridX < numCols && gridY >= 0 && gridY < numRows) {
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
      if (gridX >= 0 && gridX < numCols && gridY >= 0 && gridY < numRows) {
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
    if (draggingToken && mouseDownPos && activeTool === 'select' && !editingTokenId) {
      const currentMouseSvgPos = getMousePosition(event);
      const dx = currentMouseSvgPos.x - mouseDownPos.x;
      const dy = currentMouseSvgPos.y - mouseDownPos.y;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared < CLICK_THRESHOLD_SQUARED) { // It's a click
        if (activePopoverToken?.id === draggingToken.id && popoverOpen) {
            setPopoverOpen(false);
            // setActivePopoverToken(null); // Handled by Popover onOpenChange
        } else {
            setActivePopoverToken(draggingToken);
            if (popoverTriggerRef.current) {
                popoverTriggerRef.current.style.position = 'fixed';
                popoverTriggerRef.current.style.left = `${event.clientX}px`;
                popoverTriggerRef.current.style.top = `${event.clientY}px`;
            }
            setPopoverOpen(true);
        }
      } else if (draggingTokenPosition) { // It's a drag that moved to a new cell
        onTokenMove(draggingToken.id, draggingTokenPosition.x, draggingTokenPosition.y);
      }
      // Always clear dragging state for token
      setDraggingToken(null); 
      setDragOffset(null);
      setDraggingTokenPosition(null);
    } else if (draggingToken) { // Failsafe if drag started but conditions not met
        setDraggingToken(null);
        setDragOffset(null);
        setDraggingTokenPosition(null);
    }
    setMouseDownPos(null);

    // Text Object Click vs Drag Handling
    if (draggingTextObjectId && textObjectDragStartScreenPos && textObjectDragStartPos && textObjectDragOffset) {
        const currentMouseScreenPos = { x: event.clientX, y: event.clientY };
        const dxScreen = currentMouseScreenPos.x - textObjectDragStartScreenPos.x;
        const dyScreen = currentMouseScreenPos.y - textObjectDragStartScreenPos.y;
        const distanceSquared = dxScreen * dxScreen + dyScreen * dyScreen;

        const textObj = textObjects.find(to => to.id === draggingTextObjectId);

        if (distanceSquared < CLICK_THRESHOLD_SQUARED && textObj) { // Click on Text Object
            // Revert any minor position change from the click-drag
            setTextObjects(prev => prev.map(obj =>
                obj.id === draggingTextObjectId 
                    ? { ...obj, x: textObjectDragStartPos!.x - textObjectDragOffset!.x, y: textObjectDragStartPos!.y - textObjectDragOffset!.y } 
                    : obj
            ));

            if (activePopoverTextObject?.id === textObj.id && textObjectPopoverOpen) {
                setTextObjectPopoverOpen(false);
                // setActivePopoverTextObject(null); // Handled by Popover onOpenChange
            } else {
                setActivePopoverTextObject(textObj);
                if (textObjectPopoverTriggerRef.current) {
                    textObjectPopoverTriggerRef.current.style.position = 'fixed';
                    textObjectPopoverTriggerRef.current.style.left = `${event.clientX}px`;
                    textObjectPopoverTriggerRef.current.style.top = `${event.clientY}px`;
                }
                setTextObjectPopoverOpen(true);
            }
        } else { // Drag of Text Object
            // Position is already updated by handleMouseMove. No further action needed here for position.
        }
        // Clear dragging state for text object
        setDraggingTextObjectId(null);
        setTextObjectDragOffset(null);
        setTextObjectDragStartPos(null);
        setTextObjectDragStartScreenPos(null);
    }


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
        setTextObjectDragStartPos(null);
        setTextObjectDragStartScreenPos(null);
    }
    if (draggingToken) {
        if (draggingTokenPosition) {
             onTokenMove(draggingToken.id, draggingTokenPosition.x, draggingTokenPosition.y);
        }
        setDraggingToken(null);
        setDragOffset(null);
        setDraggingTokenPosition(null);
        setMouseDownPos(null);
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
    } else {
      newVw = vw * scaleAmount;
    }

    const calculatedTotalContentWidth = numCols * cellSize;
    const currentBorderWidth = showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0;
    const absoluteContentWidth = calculatedTotalContentWidth + currentBorderWidth;
    const absoluteContentHeight = (numRows * cellSize) + currentBorderWidth; 
    const absoluteContentMinX = 0 - (showGridLines ? BORDER_WIDTH_WHEN_VISIBLE / 2 : 0);
    const absoluteContentMinY = 0 - (showGridLines ? BORDER_WIDTH_WHEN_VISIBLE / 2 : 0);

    const maxAllowedVw = absoluteContentWidth;
    const minAllowedVw = absoluteContentWidth / 10; 
    
    newVw = Math.max(minAllowedVw, Math.min(maxAllowedVw, newVw));

    if (vw !== 0) { newVh = (newVw / vw) * vh; } 
    else { newVh = (numRows / numCols) * newVw; } 


    let newVx = centerPos.x - (centerPos.x - vx) * (newVw / vw);
    let newVy = centerPos.y - (centerPos.y - vy) * (newVh / vh);
    
    if (newVw >= absoluteContentWidth) {
        newVx = absoluteContentMinX + (absoluteContentWidth - newVw) / 2;
    } else {
        newVx = Math.max(absoluteContentMinX, Math.min(newVx, absoluteContentMinX + absoluteContentWidth - newVw));
    }

    if (newVh >= absoluteContentHeight) {
        newVy = absoluteContentMinY + (absoluteContentHeight - newVh) / 2;
    } else {
        newVy = Math.max(absoluteContentMinY, Math.min(newVy, absoluteContentMinY + absoluteContentHeight - newVh));
    }

    setViewBox(`${newVx} ${newVy} ${newVw} ${newVh}`);
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    if (editingTokenId || isCreatingText || popoverOpen || textObjectPopoverOpen || editingTextObjectId) return; 
    event.preventDefault();
    applyZoom(event.deltaY < 0, ZOOM_AMOUNT); 
  };

  const handleZoomButtonClick = (zoomIn: boolean) => {
    applyZoom(zoomIn, ZOOM_AMOUNT);
  };

  const gridContentWidth = numCols * cellSize;
  const gridContentHeight = numRows * cellSize;

  const imgScaledWidth = gridContentWidth * backgroundZoomLevel;
  const imgScaledHeight = gridContentHeight * backgroundZoomLevel;
  const imgScaledX = (gridContentWidth - imgScaledWidth) / 2;
  const imgScaledY = (gridContentHeight - imgScaledHeight) / 2;

 const getCursorStyle = () => {
    if (editingTokenId || isCreatingText || editingTextObjectId) return 'cursor-text';
    if (isPanning) return 'cursor-grabbing';
    if (draggingToken && activeTool === 'select' && !editingTokenId) return 'cursor-grabbing';
    // Token hover cursor is handled directly on token G element
    if (activeTool === 'select' && !draggingToken && !isPanning && !popoverOpen && !textObjectPopoverOpen) return 'cursor-default'; // Base select cursor
    if (draggingTextObjectId && activeTool === 'select' && !editingTextObjectId) return 'cursor-grabbing';
    // Text object hover cursor is handled directly on foreignObject
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

          const imageDisplaySize = cellSize * 0.95; 
          const imageOffset = (cellSize - imageDisplaySize) / 2;

          let backgroundFill = token.color; 
            if (!token.customImageUrl) { 
                switch (token.type) {
                    case 'player': backgroundFill = 'hsl(var(--player-green-bg))'; break;
                    case 'enemy': backgroundFill = 'hsl(var(--destructive))'; break;
                    case 'ally': backgroundFill = 'hsl(var(--app-blue-bg))'; break;
                    case 'item': backgroundFill = 'hsl(270, 40%, 30%)'; break; 
                    case 'terrain': backgroundFill = 'hsl(var(--muted))'; break;
                    case 'generic': backgroundFill = 'hsl(var(--accent))'; break; 
                    default: backgroundFill = token.color || 'black'; 
                }
            }

          const isCurrentlyEditingThisToken = editingTokenId === token.id;
          const isTokenActiveTurn = token.id === activeTokenId;

          return (
            <g
              key={token.id}
              transform={`translate(${currentX * cellSize}, ${currentY * cellSize})`}
              onMouseDown={(e) => handleTokenMouseDown(e, token)}
              onMouseEnter={() => setHoveredTokenId(token.id)}
              onMouseLeave={() => setHoveredTokenId(null)}
              className={cn(
                activeTool === 'select' && !isCurrentlyEditingThisToken && !draggingToken && !popoverOpen && 'cursor-pointer',
                activeTool === 'select' && draggingToken?.id === token.id && !isCurrentlyEditingThisToken && 'cursor-grabbing',
                isCurrentlyEditingThisToken && 'cursor-text', 
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
                    : hoveredTokenId === token.id && activeTool === 'select' && !isCurrentlyEditingThisToken && !popoverOpen
                      ? 'hsl(var(--accent))' 
                      : 'hsl(var(--primary-foreground))' 
                }
                strokeWidth={isTokenActiveTurn ? 3 : 1} 
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
                    className={cn(!isCurrentlyEditingThisToken && activeTool === 'select' ? "pointer-events-auto" : "pointer-events-none")}
                  />
                   <circle
                    cx={cellSize / 2}
                    cy={cellSize / 2}
                    r={cellSize / 2 * 0.95} 
                    fill="none"
                    strokeWidth="1.5" 
                    stroke={'hsl(var(--primary-foreground))'} 
                    className="pointer-events-none" 
                  />
                </>
              ) : IconComponent ? (
                <IconComponent
                  x={iconOffset}
                  y={iconOffset}
                  width={iconDisplaySize}
                  height={iconDisplaySize}
                  color={'hsl(var(--primary-foreground))'} 
                  strokeWidth={1.5}
                  className={cn(
                    !isCurrentlyEditingThisToken && activeTool === 'select' ? "pointer-events-auto" : "pointer-events-none"
                  )}
                />
              ) : null}

              {token.instanceName && !isCurrentlyEditingThisToken && (
                <text
                  x={cellSize / 2}
                  y={cellSize + 10} 
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  fill="hsl(var(--foreground))"
                  stroke="black" 
                  strokeWidth="1.25px" 
                  paintOrder="stroke" 
                  filter="url(#blurryTextDropShadow)" 
                  className={cn(
                    activeTool === 'select' && !popoverOpen && !isDeleteAlertOpen ? "cursor-text" : "cursor-default", 
                    "select-none" 
                  )}
                  onClick={(e) => {if(!popoverOpen && !isDeleteAlertOpen) handleTokenLabelClick(e, token)}}
                >
                  {token.instanceName}
                </text>
              )}
              {isCurrentlyEditingThisToken && (
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

        {textObjects.map(obj => {
          const isCurrentlyEditingThisText = editingTextObjectId === obj.id;
          return isCurrentlyEditingThisText ? (
             <foreignObject
                key={`edit-${obj.id}`}
                x={obj.x}
                y={obj.y}
                width={Math.max(obj.width, 150)} // Ensure a minimum width for editing
                height={obj.height + 2} // Add some padding for border
            >
                <input
                    ref={textObjectEditInputRef}
                    type="text"
                    value={editingTextObjectContent}
                    onChange={(e) => setEditingTextObjectContent(e.target.value)}
                    onKeyDown={handleTextEditInputKeyDown}
                    onBlur={handleFinalizeTextEdit}
                    style={{
                        width: '100%',
                        height: '100%',
                        padding: `${TEXT_PADDING.y}px ${TEXT_PADDING.x}px`,
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        border: '1px solid hsl(var(--accent))',
                        borderRadius: '8px',
                        fontSize: `${obj.fontSize}px`,
                        fontFamily: 'sans-serif',
                        outline: 'none',
                        boxSizing: 'border-box',
                    }}
                    onWheelCapture={(e) => e.stopPropagation()}
                />
            </foreignObject>
          ) : (
            <foreignObject
              key={obj.id}
              x={obj.x}
              y={obj.y}
              width={obj.width}
              height={obj.height}
              className={cn(
                  activeTool === 'select' && !editingTextObjectId ? 'cursor-pointer' : 'cursor-default',
                  draggingTextObjectId === obj.id && !editingTextObjectId ? 'cursor-grabbing' : ''
              )}
              onMouseDown={(e) => {
                if (activeTool === 'select' && !editingTextObjectId) {
                  e.stopPropagation();
                  const pos = getMousePosition(e);
                  setTextObjectDragStartPos(pos);
                  setTextObjectDragStartScreenPos({ x: e.clientX, y: e.clientY });
                  setDraggingTextObjectId(obj.id);
                  setTextObjectDragOffset({ x: pos.x - obj.x, y: pos.y - obj.y });

                  if (popoverOpen) { // Close token popover if interacting with text
                      setPopoverOpen(false);
                      setActivePopoverToken(null);
                  }
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
          );
        })}

        {isCreatingText && (
          <foreignObject
            x={isCreatingText.x} 
            y={isCreatingText.y - (measureText(isCreatingText.currentText || " ", isCreatingText.fontSize).height + TEXT_PADDING.y * 2) / 2} 
            width={isCreatingText.inputWidth} 
            height={measureText(isCreatingText.currentText || " ", isCreatingText.fontSize).height + TEXT_PADDING.y * 2 + 2} 
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
           <circle
             cx={measurement.startPoint.x * cellSize + cellSize / 2}
             cy={measurement.startPoint.y * cellSize + cellSize / 2}
             r="4"
             fill="hsl(var(--accent))"
           />
         )}
         {measurement.endPoint && measurement.result && ( 
           <circle
             cx={measurement.endPoint.x * cellSize + cellSize / 2}
             cy={measurement.endPoint.y * cellSize + cellSize / 2}
             r="4"
             fill="hsl(var(--accent))"
           />
         )}
      </svg>

      {/* Token Popover */}
      <Popover 
        open={popoverOpen} 
        onOpenChange={(isOpen) => {
            setPopoverOpen(isOpen);
            if (!isOpen) {
                setActivePopoverToken(null); 
            }
        }}
      >
        <PopoverTrigger asChild>
            <button
                ref={popoverTriggerRef}
                style={{
                    position: 'fixed',
                    opacity: 0,
                    pointerEvents: 'none',
                    width: '1px', height: '1px',
                }}
                aria-hidden="true"
            />
        </PopoverTrigger>
        {activePopoverToken && (
            <PopoverContent 
                side="bottom" 
                align="center" 
                className="w-48 p-1"
                onOpenAutoFocus={(e) => e.preventDefault()} 
            >
                <Button
                  variant="ghost"
                  className="w-full justify-start h-8 px-2 text-sm flex items-center"
                  onClick={() => {
                    if (activePopoverToken) {
                        setEditingTokenId(activePopoverToken.id);
                        setEditingText(activePopoverToken.instanceName || '');
                        setPopoverOpen(false); 
                    }
                  }}
                >
                  <Edit3 className="mr-2 h-3.5 w-3.5" /> Rename
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start h-8 px-2 text-sm flex items-center"
                  onClick={() => {
                    if (activePopoverToken) {
                        onTokenImageChangeRequest(activePopoverToken.id);
                        setPopoverOpen(false); 
                    }
                  }}
                >
                  <ImageIcon className="mr-2 h-3.5 w-3.5" /> Change Image
                </Button>
                <AlertDialog 
                    open={isDeleteAlertOpen} 
                    onOpenChange={(isOpen) => {
                        setIsDeleteAlertOpen(isOpen);
                        if (!isOpen && popoverOpen) { // If dialog closes, but popover was meant to be open
                           // Potentially re-focus popover or handle focus management
                        } else if (!isOpen && !popoverOpen) { // If dialog closes AND popover is also closed
                            setActivePopoverToken(null); // Clean up active token context
                        }
                    }}
                >
                  <AlertDialogTrigger asChild>
                    <Button 
                        variant="ghost"
                        className={cn(
                            "w-full justify-start h-8 px-2 text-sm flex items-center",
                            "text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        )}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onPointerDownOutside={(e) => e.preventDefault()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {activePopoverToken?.instanceName || 'Token'}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will remove the token from the grid.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel> 
                      <AlertDialogAction
                        onClick={() => {
                          if (activePopoverToken) {
                            onTokenDelete(activePopoverToken.id);
                          }
                          setPopoverOpen(false); // Ensure popover closes after delete action
                        }}
                        className={buttonVariants({ variant: "destructive" })}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </PopoverContent>
        )}
      </Popover>

      {/* Text Object Popover */}
        <Popover
            open={textObjectPopoverOpen}
            onOpenChange={(isOpen) => {
                setTextObjectPopoverOpen(isOpen);
                if (!isOpen) {
                    setActivePopoverTextObject(null);
                }
            }}
        >
            <PopoverTrigger asChild>
                <button
                    ref={textObjectPopoverTriggerRef}
                    style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px' }}
                    aria-hidden="true"
                />
            </PopoverTrigger>
            {activePopoverTextObject && (
                <PopoverContent side="bottom" align="center" className="w-48 p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Button
                        variant="ghost"
                        className="w-full justify-start h-8 px-2 text-sm flex items-center"
                        onClick={() => {
                            if (activePopoverTextObject) {
                                setEditingTextObjectId(activePopoverTextObject.id);
                                setEditingTextObjectContent(activePopoverTextObject.content);
                                setTextObjectPopoverOpen(false); // Close popover to start editing
                            }
                        }}
                    >
                        <Edit3 className="mr-2 h-3.5 w-3.5" /> Edit Text
                    </Button>
                    <AlertDialog
                        open={textObjectDeleteAlertOpen}
                        onOpenChange={(isOpen) => {
                            setTextObjectDeleteAlertOpen(isOpen);
                             if (!isOpen && textObjectPopoverOpen) {
                                // Do nothing specific, popover should remain
                            } else if (!isOpen && !textObjectPopoverOpen) {
                                setActivePopoverTextObject(null);
                            }
                        }}
                    >
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start h-8 px-2 text-sm flex items-center",
                                    "text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                )}
                            >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Text
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onPointerDownOutside={(e) => e.preventDefault()}>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete this text bubble?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. The text "{activePopoverTextObject.content.substring(0, 30)}{activePopoverTextObject.content.length > 30 ? '...' : ''}" will be removed.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => {
                                        if (activePopoverTextObject) {
                                            setTextObjects(prev => prev.filter(to => to.id !== activePopoverTextObject!.id));
                                        }
                                        setTextObjectPopoverOpen(false); // Ensure popover closes
                                    }}
                                    className={buttonVariants({ variant: "destructive" })}
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </PopoverContent>
            )}
        </Popover>


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
                    ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                    : "bg-card text-card-foreground hover:bg-muted" 
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
