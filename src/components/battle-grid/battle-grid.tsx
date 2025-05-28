
'use client';

import type { Point, BattleGridProps, Token as TokenType, DrawnShape, TextObjectType, Participant, GridCellData } from '@/types';
import type { LucideProps } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Plus, Minus, Grid2x2Check, Grid2x2X, Maximize, Edit3, Trash2, Image as ImageIcon, ListCheck, ListX, Users, CircleDotDashed, VenetianMask, SlidersVertical, ImagePlus, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';


const DEFAULT_CELL_SIZE = 30;
const BORDER_WIDTH_WHEN_VISIBLE = 1;
const FEET_PER_SQUARE = 5;
const ZOOM_AMOUNT = 1.1;
const TEXT_PADDING = { x: 8, y: 4 };
const CLICK_THRESHOLD_SQUARED = 25; // Threshold for differentiating click from drag (pixels squared)
const SHAPE_CLICK_THRESHOLD = 8; // pixels for clicking near a shape
const MIN_NEW_TEXT_INPUT_WIDTH = 150;
const DOUBLE_CLICK_THRESHOLD_MS = 300;


const snapToCellCenter = (pos: Point, cellSize: number): Point => ({
  x: Math.floor(pos.x / cellSize) * cellSize + cellSize / 2,
  y: Math.floor(pos.y / cellSize) * cellSize + cellSize / 2,
});

const snapToVertex = (pos: Point, cellSize: number): Point => ({
  x: Math.round(pos.x / cellSize) * cellSize,
  y: Math.round(pos.y / cellSize) * cellSize,
});

// Helper function for distance squared (avoids sqrt for comparisons)
function dist2(v: Point, w: Point) { return (v.x - w.x)**2 + (v.y - w.y)**2; }

// Helper function for distance to line segment squared
function distToSegmentSquared(p: Point, v: Point, w: Point) {
  const l2 = dist2(v, w);
  if (l2 === 0) return dist2(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

// Helper function for distance to line segment
function distanceToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt(distToSegmentSquared({ x: px, y: py }, { x: x1, y: y1 }, { x: x2, y: y2 }));
}

function isPointInCircle(point: Point, circleCenter: Point, radius: number): boolean {
  return dist2(point, circleCenter) <= radius**2;
}

function isPointInRectangle(point: Point, rectX: number, rectY: number, rectWidth: number, rectHeight: number): boolean {
  return point.x >= rectX && point.x <= rectX + rectWidth && point.y >= rectY && point.y <= rectY + rectHeight;
}


function isSquareOccupied(
  targetX: number,
  targetY: number,
  tokenSizeToCheck: number,
  tokens: TokenType[],
  numCols: number,
  numRows: number,
  excludeTokenId?: string
): boolean {
  // Check grid boundaries for the entire token area
  if (targetX < 0 || targetX + tokenSizeToCheck > numCols || targetY < 0 || targetY + tokenSizeToCheck > numRows) {
    return true; // Occupied by being out of bounds
  }

  for (const token of tokens) {
    if (token.id === excludeTokenId) continue;

    const existingTokenSize = token.size || 1;

    // Check for overlap:
    // If one rectangle is to the left of the other, or above the other, they don't overlap.
    const noOverlap =
      targetX + tokenSizeToCheck <= token.x || // new token is to the left of existing
      targetX >= token.x + existingTokenSize || // new token is to the right of existing
      targetY + tokenSizeToCheck <= token.y || // new token is above existing
      targetY >= token.y + existingTokenSize;   // new token is below existing

    if (!noOverlap) {
      return true; // Overlap detected
    }
  }
  return false; // No overlap with any other token and within bounds
}


function findAvailableSquare(
  preferredX: number,
  preferredY: number,
  tokenSizeToPlace: number,
  tokens: TokenType[],
  numCols: number,
  numRows: number,
  excludeTokenId?: string
): Point | null {
  // Check preferred square first
  if (!isSquareOccupied(preferredX, preferredY, tokenSizeToPlace, tokens, numCols, numRows, excludeTokenId)) {
    return { x: preferredX, y: preferredY };
  }

  // Spiral search outwards
  for (let radius = 1; radius <= Math.max(numCols, numRows); radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        // Only check the perimeter of the current radius square
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
          continue;
        }
        const checkX = preferredX + dx;
        const checkY = preferredY + dy;

        if (!isSquareOccupied(checkX, checkY, tokenSizeToPlace, tokens, numCols, numRows, excludeTokenId)) {
          return { x: checkX, y: checkY };
        }
      }
    }
  }
  return null; // No available square found
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
  showAllLabels,
  setShowAllLabels,
  backgroundImageUrl,
  backgroundZoomLevel = 1,
  activeTool,
  setActiveTool,
  onTokenMove,
  onTokenInstanceNameChange,
  onChangeTokenSize,
  selectedColor,
  selectedTokenTemplate,
  measurement,
  setMeasurement,
  activeTurnTokenId,
  currentTextFontSize,
  onTokenDelete,
  onTokenImageChangeRequest,
  escapePressCount,
  selectedTokenId, setSelectedTokenId,
  selectedShapeId, setSelectedShapeId,
  selectedTextObjectId, setSelectedTextObjectId,
  tokenIdToFocus,
  onFocusHandled,
  onOpenAddCombatantDialogForToken,
  participants,
}: BattleGridProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { toast } = useToast();

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
  const [mouseDownPos, setMouseDownPos] = useState<Point | null>(null);

  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [pendingGridCellsDuringPaint, setPendingGridCellsDuringPaint] = useState<GridCellData[][] | null>(null);
  const [hoveredCellWhilePaintingOrErasing, setHoveredCellWhilePaintingOrErasing] = useState<Point | null>(null);
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingStartPoint, setDrawingStartPoint] = useState<Point | null>(null);

  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const foreignObjectInputRef = useRef<HTMLInputElement>(null);

  const [isCreatingText, setIsCreatingText] = useState<{ id: string; x: number; y: number; currentText: string; fontSize: number; inputWidth: number; } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [draggingTextObjectId, setDraggingTextObjectId] = useState<string | null>(null);
  const [textObjectDragOffset, setTextObjectDragOffset] = useState<Point | null>(null);

  const [editingTextObjectId, setEditingTextObjectId] = useState<string | null>(null);
  const [editingTextObjectContent, setEditingTextObjectContent] = useState<string>('');
  const textObjectEditInputRef = useRef<HTMLInputElement>(null);
  const [lastTextClickInfo, setLastTextClickInfo] = useState<{ id: string | null; time: number }>({ id: null, time: 0 });
  const [hoveredTextObjectId, setHoveredTextObjectId] = useState<string | null>(null);

  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [editingShapeLabelText, setEditingShapeLabelText] = useState<string>('');
  const shapeLabelInputRef = useRef<HTMLInputElement>(null);
  const [shapeRadiusInput, setShapeRadiusInput] = useState<string>('');

  const [potentialDraggingShapeInfo, setPotentialDraggingShapeInfo] = useState<{ id: string; type: DrawnShape['type']; startScreenPos: Point; originalStartPoint: Point; originalEndPoint: Point; } | null>(null);
  const [isActuallyDraggingShape, setIsActuallyDraggingShape] = useState(false);
  const [currentDraggingShapeId, setCurrentDraggingShapeId] = useState<string | null>(null);
  const [shapeDragOffset, setShapeDragOffset] = useState<Point | null>(null);
  
  const [rightClickPopoverState, setRightClickPopoverState] = useState<{
    type: 'token' | 'shape' | 'text';
    item: TokenType | DrawnShape | TextObjectType;
    x: number;
    y: number;
  } | null>(null);
  const rightClickPopoverTriggerRef = useRef<HTMLButtonElement>(null);


  const getMousePosition = useCallback((event: React.MouseEvent<SVGSVGElement> | React.WheelEvent<SVGSVGElement> | MouseEvent): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const CTM = svg.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (event.clientX - CTM.e) / CTM.a,
      y: (event.clientY - CTM.f) / CTM.d,
    };
  }, []);
  
  const applyZoom = useCallback((zoomIn: boolean, customScaleAmount?: number) => {
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
  }, [viewBox, getMousePosition, numCols, numRows, cellSize, showGridLines, setViewBox]);

  const handleWheel = useCallback((event: React.WheelEvent<SVGSVGElement>) => {
    if (editingTokenId || editingShapeId || editingTextObjectId || isCreatingText) {
      const targetIsInput = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (targetIsInput) {
        if (document.activeElement === event.target) return;
      }
    }
    event.preventDefault();
    const zoomIn = event.deltaY < 0;
    applyZoom(zoomIn);
  }, [applyZoom, editingTokenId, editingShapeId, editingTextObjectId, isCreatingText]);

  const measureText = useCallback((text: string, fontSize: number) => {
    if (typeof document === 'undefined') return { width: 0, height: 0};
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
        y: isCreatingText.y - bubbleHeight / 2, // Adjust y to center the bubble on click point
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
        // If content is cleared, delete the text object
        setTextObjects(prev => prev.filter(to => to.id !== editingTextObjectId));
    }
    setEditingTextObjectId(null);
    setEditingTextObjectContent('');
  }, [editingTextObjectId, editingTextObjectContent, textObjects, setTextObjects, measureText]);

  const handleSaveTokenName = useCallback(() => {
    if (editingTokenId) {
      setTokens(prevTokens =>
        prevTokens.map(t =>
          t.id === editingTokenId ? { ...t, instanceName: editingText } : t
        )
      );
      if (onTokenInstanceNameChange) {
        onTokenInstanceNameChange(editingTokenId, editingText);
      }
      setEditingTokenId(null);
      setEditingText('');
    }
  }, [editingTokenId, editingText, setTokens, onTokenInstanceNameChange]);

  const handleSaveShapeLabel = useCallback(() => {
    if (editingShapeId) {
      setDrawnShapes(prevShapes =>
        prevShapes.map(s =>
          s.id === editingShapeId ? { ...s, label: editingShapeLabelText.trim() || undefined } : s
        )
      );
      setEditingShapeId(null);
      setEditingShapeLabelText('');
    }
  }, [editingShapeId, editingShapeLabelText, setDrawnShapes]);
  
  useEffect(() => {
    if (escapePressCount && escapePressCount > 0) {
      setRightClickPopoverState(null);
      setEditingTokenId(null);
      setEditingShapeId(null);
      setEditingTextObjectId(null);
      if(isCreatingText) finalizeTextCreation(); 
      setHoveredTextObjectId(null); 
    }
  }, [escapePressCount, finalizeTextCreation, isCreatingText]);

  const calculateInitialViewBox = useCallback(() => {
    const calculatedTotalContentWidth = numCols * cellSize;
    const calculatedTotalContentHeight = numRows * cellSize;
    const currentBorderWidth = showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0;
    const svgPadding = currentBorderWidth / 2; 

    if (svgRef.current) {
      const svg = svgRef.current;
      const viewportWidth = svg.clientWidth;
      const viewportHeight = svg.clientHeight;

      if (viewportWidth > 0 && viewportHeight > 0 && calculatedTotalContentWidth > 0 && calculatedTotalContentHeight > 0) {
        const scaleToFillViewportWidth = viewportWidth / (calculatedTotalContentWidth + currentBorderWidth);
        const initialViewWidth = calculatedTotalContentWidth + currentBorderWidth;
        const initialViewHeight = viewportHeight / scaleToFillViewportWidth; 
        const initialViewMinX = 0 - svgPadding;
        const initialViewMinY = (0 - svgPadding) + ((calculatedTotalContentHeight + currentBorderWidth) - initialViewHeight) / 2; 
        return `${initialViewMinX} ${initialViewMinY} ${initialViewWidth} ${initialViewHeight}`;
      }
    }
    return `${0 - svgPadding} ${0 - svgPadding} ${Math.max(1, calculatedTotalContentWidth + currentBorderWidth)} ${Math.max(1, calculatedTotalContentHeight + currentBorderWidth)}`;
  }, [numCols, numRows, cellSize, showGridLines]);


  useEffect(() => {
    setViewBox(calculateInitialViewBox());
  }, [showGridLines, cellSize, numCols, numRows, backgroundImageUrl, calculateInitialViewBox]);

  useEffect(() => {
    if (editingTokenId && foreignObjectInputRef.current) {
      const timerId = setTimeout(() => { 
        foreignObjectInputRef.current?.focus();
        foreignObjectInputRef.current?.select();
      }, 0);
      return () => clearTimeout(timerId);
    }
  }, [editingTokenId]);

  useEffect(() => {
    if (isCreatingText && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [isCreatingText]);

  useEffect(() => {
    if (editingTextObjectId && textObjectEditInputRef.current) {
      const timerId = setTimeout(() => {
        textObjectEditInputRef.current?.focus();
        textObjectEditInputRef.current?.select();
      }, 0);
      return () => clearTimeout(timerId);
    }
  }, [editingTextObjectId]);

  useEffect(() => {
    if (editingShapeId && shapeLabelInputRef.current) {
       const timerId = setTimeout(() => {
        shapeLabelInputRef.current?.focus();
        shapeLabelInputRef.current?.select();
      }, 0);
      return () => clearTimeout(timerId);
    }
  }, [editingShapeId]);


  useEffect(() => {
    if (activeTool !== 'select') {
      if (editingTokenId) handleSaveTokenName();
      if (editingTextObjectId) handleFinalizeTextEdit();
      if (editingShapeId) handleSaveShapeLabel();
      setSelectedTokenId(null);
      setSelectedShapeId(null);
      setSelectedTextObjectId(null);
      setRightClickPopoverState(null);
    }
    if (activeTool !== 'type_tool') {
      if (isCreatingText) finalizeTextCreation();
      setHoveredTextObjectId(null);
    }
  }, [activeTool, editingTokenId, handleSaveTokenName, editingTextObjectId, handleFinalizeTextEdit, editingShapeId, handleSaveShapeLabel, isCreatingText, finalizeTextCreation, setSelectedTokenId, setSelectedShapeId, setSelectedTextObjectId]);

  useEffect(() => {
    if (tokenIdToFocus && svgRef.current) {
      const token = tokens.find(t => t.id === tokenIdToFocus);
      if (token) {
        const tokenActualSize = (token.size || 1);
        const [currentVx, currentVy, currentVw, currentVh] = viewBox.split(' ').map(Number);

        const tokenSvgX = token.x * cellSize + tokenActualSize * cellSize / 2;
        const tokenSvgY = token.y * cellSize + tokenActualSize * cellSize / 2;

        let newVx = tokenSvgX - currentVw / 2;
        let newVy = tokenSvgY - currentVh / 2;

        const currentBorderWidth = showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0;
        const svgPadding = currentBorderWidth / 2;
        const absoluteContentMinX = 0 - svgPadding;
        const absoluteContentMinY = 0 - svgPadding;
        const absoluteContentWidth = numCols * cellSize + currentBorderWidth;
        const absoluteContentHeight = numRows * cellSize + currentBorderWidth;

        if (currentVw >= absoluteContentWidth) {
          newVx = absoluteContentMinX + (absoluteContentWidth - currentVw) / 2;
        } else {
          newVx = Math.max(absoluteContentMinX, Math.min(newVx, absoluteContentMinX + absoluteContentWidth - currentVw));
        }

        if (currentVh >= absoluteContentHeight) {
          newVy = absoluteContentMinY + (absoluteContentHeight - currentVh) / 2;
        } else {
          newVy = Math.max(absoluteContentMinY, Math.min(newVy, absoluteContentMinY + absoluteContentHeight - currentVh));
        }

        setViewBox(`${newVx} ${newVy} ${currentVw} ${currentVh}`);
        if (onFocusHandled) {
          onFocusHandled();
        }
      } else if (onFocusHandled) {
        onFocusHandled(); 
      }
    }
  }, [tokenIdToFocus, tokens, viewBox, cellSize, numCols, numRows, showGridLines, setViewBox, onFocusHandled]);


  const eraseContentAtCell = (gridX: number, gridY: number) => {
    setGridCells(prev => {
      const newCells = prev.map(row => row.map(cell => ({ ...cell })));
      if (newCells[gridY] && newCells[gridY][gridX]) {
        newCells[gridY][gridX].color = undefined;
      }
      return newCells;
    });
    setTokens(prev => prev.filter(token => {
      const tokenSize = token.size || 1;
      return !(gridX >= token.x && gridX < token.x + tokenSize &&
               gridY >= token.y && gridY < token.y + tokenSize);
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
          return distToLine > (shape.strokeWidth / 2 + SHAPE_CLICK_THRESHOLD / 2);
        } else if (shape.type === 'circle') {
          const radius = Math.sqrt(dist2(shape.startPoint, shape.endPoint));
          return !isPointInCircle({x: cellCenterX, y: cellCenterY}, shape.startPoint, radius);
        } else if (shape.type === 'rectangle') {
          const rectX = Math.min(shape.startPoint.x, shape.endPoint.x);
          const rectY = Math.min(shape.startPoint.y, shape.endPoint.y);
          const rectWidth = Math.abs(shape.endPoint.x - shape.startPoint.x);
          const rectHeight = Math.abs(shape.endPoint.y - shape.startPoint.y);
          return !isPointInRectangle({x: cellCenterX, y: cellCenterY}, rectX, rectY, rectWidth, rectHeight);
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
    if (event.button === 2) return; 

    if (editingTokenId || editingTextObjectId || editingShapeId) return;
    const pos = getMousePosition(event);
    const gridX = Math.floor(pos.x / cellSize);
    const gridY = Math.floor(pos.y / cellSize);

    setMouseDownPos(pos); 
    setRightClickPopoverState(null); 

    if (activeTool === 'select') {
      const clickedToken = tokens.find(token => {
        const tokenActualSize = (token.size || 1);
        const tokenLeft = token.x * cellSize;
        const tokenRight = (token.x + tokenActualSize) * cellSize;
        const tokenTop = token.y * cellSize;
        const tokenBottom = (token.y + tokenActualSize) * cellSize;
        return pos.x >= tokenLeft && pos.x <= tokenRight && pos.y >= tokenTop && pos.y <= tokenBottom;
      });
      if (clickedToken) {
        event.stopPropagation(); 
        setSelectedTokenId(clickedToken.id);
        setSelectedShapeId(null);
        setSelectedTextObjectId(null);
        setDraggingToken(clickedToken);
        setDragOffset({ x: pos.x - clickedToken.x * cellSize, y: pos.y - clickedToken.y * cellSize });
        setDraggingTokenPosition(null); 
        return;
      }

      const clickedTextObject = textObjects.find(obj => isPointInRectangle(pos, obj.x, obj.y, obj.width, obj.height));
      if (clickedTextObject) {
        event.stopPropagation();
        setSelectedTextObjectId(clickedTextObject.id);
        setSelectedTokenId(null);
        setSelectedShapeId(null);
        setDraggingTextObjectId(clickedTextObject.id);
        setTextObjectDragOffset({ x: pos.x - clickedTextObject.x, y: pos.y - clickedTextObject.y });
        return;
      }

      for (let i = drawnShapes.length - 1; i >= 0; i--) {
        const shape = drawnShapes[i];
        let hit = false;
        if (shape.type === 'line') {
          hit = distanceToLineSegment(pos.x, pos.y, shape.startPoint.x, shape.startPoint.y, shape.endPoint.x, shape.endPoint.y) <= SHAPE_CLICK_THRESHOLD;
        } else if (shape.type === 'circle') {
          const radius = Math.sqrt(dist2(shape.startPoint, shape.endPoint));
          hit = isPointInCircle(pos, shape.startPoint, radius);
        } else if (shape.type === 'rectangle') {
          const rectX = Math.min(shape.startPoint.x, shape.endPoint.x);
          const rectY = Math.min(shape.startPoint.y, shape.endPoint.y);
          const rectWidth = Math.abs(shape.endPoint.x - shape.startPoint.x);
          const rectHeight = Math.abs(shape.endPoint.y - shape.startPoint.y);
          hit = isPointInRectangle(pos, rectX, rectY, rectWidth, rectHeight);
        }

        if (hit) {
          event.stopPropagation();
          setSelectedShapeId(shape.id);
          setSelectedTokenId(null);
          setSelectedTextObjectId(null);
          if (shape.type === 'circle' || shape.type === 'rectangle') {
            setPotentialDraggingShapeInfo({ 
              id: shape.id, type: shape.type, 
              startScreenPos: { x: event.clientX, y: event.clientY },
              originalStartPoint: shape.startPoint, originalEndPoint: shape.endPoint 
            });
          }
          return;
        }
      }

      setSelectedTokenId(null);
      setSelectedShapeId(null);
      setSelectedTextObjectId(null);
      setIsPanning(true);
      setPanStart({ x: event.clientX, y: event.clientY });
      return;
    }

    if (activeTool === 'type_tool') {
        event.stopPropagation(); 
        if (isCreatingText) finalizeTextCreation(); 
        if (editingTextObjectId) handleFinalizeTextEdit(); 

        const clickedTextObjectForInteraction = textObjects.find(obj => isPointInRectangle(pos, obj.x, obj.y, obj.width, obj.height));
        
        if (clickedTextObjectForInteraction) {
            setSelectedTextObjectId(clickedTextObjectForInteraction.id); // Select on single click
            setSelectedTokenId(null);
            setSelectedShapeId(null);

            const currentTime = Date.now();
            if (clickedTextObjectForInteraction.id === lastTextClickInfo.id && currentTime - lastTextClickInfo.time < DOUBLE_CLICK_THRESHOLD_MS) {
                setEditingTextObjectId(clickedTextObjectForInteraction.id);
                setEditingTextObjectContent(clickedTextObjectForInteraction.content);
                setLastTextClickInfo({ id: null, time: 0 }); 
            } else {
                setLastTextClickInfo({ id: clickedTextObjectForInteraction.id, time: currentTime });
            }
            return; 
        } else {
            setLastTextClickInfo({ id: null, time: 0 }); 
            setSelectedTokenId(null); 
            setSelectedShapeId(null);
            setSelectedTextObjectId(null);

            setTimeout(() => {
                if (activeTool === 'type_tool' && !editingTextObjectId && !isCreatingText) { 
                    const newPos = getMousePosition(event); 
                    setIsCreatingText({
                        id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                        x: newPos.x,
                        y: newPos.y,
                        currentText: '',
                        fontSize: currentTextFontSize,
                        inputWidth: MIN_NEW_TEXT_INPUT_WIDTH, 
                    });
                }
            }, 0);
        }
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
        // Initialize pending cells for the stroke
        const initialPendingCells = gridCells.map(row => row.map(cell => ({ ...cell })));
        if (initialPendingCells[gridY]?.[gridX]) {
            initialPendingCells[gridY][gridX].color = selectedColor;
        }
        setPendingGridCellsDuringPaint(initialPendingCells);
        break;
      case 'place_token':
        if (selectedTokenTemplate) {
          const tokenSize = selectedTokenTemplate.size || 1;
          const availableSquare = findAvailableSquare(gridX, gridY, tokenSize, tokens, numCols, numRows);
          if (availableSquare) {
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
              x: availableSquare.x,
              y: availableSquare.y,
              instanceName: instanceName,
              customImageUrl: selectedTokenTemplate.customImageUrl, 
              icon: selectedTokenTemplate.customImageUrl ? undefined : selectedTokenTemplate.icon, 
              size: tokenSize,
            };
            const newToken = {
              ...newTokenData,
              id: `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            };
            setTokens(prev => [...prev, newToken]);
          } else {
             toast({ title: "No Space Available", description: "Could not find an empty square to place the token.", variant: "destructive" });
          }
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
        {
          setIsDrawing(true);
          const startP = snapToVertex(pos, cellSize); 
          setDrawingStartPoint(startP);
          setCurrentDrawingShape({
            id: `shape-${Date.now()}`, 
            type: 'line',
            startPoint: startP,
            endPoint: startP,
            color: 'hsl(var(--accent))',
            strokeWidth: 2, 
            opacity: 1, 
          });
        }
        break;
      case 'draw_circle':
      case 'draw_rectangle':
        {
          setIsDrawing(true);
          const isCircle = activeTool === 'draw_circle';
          const snapFn = isCircle ? snapToCellCenter : snapToVertex;
          const startP = snapFn(pos, cellSize);
          setDrawingStartPoint(startP);
          setCurrentDrawingShape({
            id: `shape-${Date.now()}`,
            type: isCircle ? 'circle' : 'rectangle',
            startPoint: startP,
            endPoint: startP, 
            color: 'hsl(var(--accent))', 
            fillColor: 'hsl(var(--accent))', 
            strokeWidth: 1, 
            opacity: 0.5, 
          });
        }
        break;
    }
  };

  const handleContextMenu = (event: React.MouseEvent<SVGSVGElement>) => {
    event.preventDefault();
    if (activeTool !== 'select' || editingTokenId || editingShapeId || editingTextObjectId) return;

    const pos = getMousePosition(event);

    const rClickedToken = tokens.find(token => {
        const tokenActualSize = (token.size || 1);
        const tokenLeft = token.x * cellSize;
        const tokenRight = (token.x + tokenActualSize) * cellSize;
        const tokenTop = token.y * cellSize;
        const tokenBottom = (token.y + tokenActualSize) * cellSize;
        return pos.x >= tokenLeft && pos.x <= tokenRight && pos.y >= tokenTop && pos.y <= tokenBottom;
    });
    if (rClickedToken) {
        setSelectedTokenId(rClickedToken.id); 
        setSelectedShapeId(null);
        setSelectedTextObjectId(null);
        setRightClickPopoverState({ type: 'token', item: rClickedToken, x: event.clientX, y: event.clientY });
        if (rightClickPopoverTriggerRef.current) {
            rightClickPopoverTriggerRef.current.style.position = 'fixed';
            rightClickPopoverTriggerRef.current.style.left = `${event.clientX}px`;
            rightClickPopoverTriggerRef.current.style.top = `${event.clientY}px`;
            rightClickPopoverTriggerRef.current.click(); 
        }
        return;
    }

    for (let i = drawnShapes.length - 1; i >= 0; i--) {
        const shape = drawnShapes[i];
        let hit = false;
        if (shape.type === 'line') {
          hit = distanceToLineSegment(pos.x, pos.y, shape.startPoint.x, shape.startPoint.y, shape.endPoint.x, shape.endPoint.y) <= SHAPE_CLICK_THRESHOLD;
        } else if (shape.type === 'circle') {
          const radius = Math.sqrt(dist2(shape.startPoint, shape.endPoint));
          hit = isPointInCircle(pos, shape.startPoint, radius);
        } else if (shape.type === 'rectangle') {
          const rectX = Math.min(shape.startPoint.x, shape.endPoint.x);
          const rectY = Math.min(shape.startPoint.y, shape.endPoint.y);
          const rectWidth = Math.abs(shape.endPoint.x - shape.startPoint.x);
          const rectHeight = Math.abs(shape.endPoint.y - shape.startPoint.y);
          hit = isPointInRectangle(pos, rectX, rectY, rectWidth, rectHeight);
        }
        if (hit) {
            setSelectedShapeId(shape.id); 
            setSelectedTokenId(null);
            setSelectedTextObjectId(null);
            setRightClickPopoverState({ type: 'shape', item: shape, x: event.clientX, y: event.clientY });
            if (shape.type === 'circle') { 
                const pixelRadius = Math.sqrt(dist2(shape.startPoint, shape.endPoint));
                const radiusInFeet = (pixelRadius / cellSize) * FEET_PER_SQUARE;
                setShapeRadiusInput(String(Math.round(radiusInFeet))); 
            } else {
                setShapeRadiusInput(''); 
            }
            if (rightClickPopoverTriggerRef.current) {
                rightClickPopoverTriggerRef.current.style.position = 'fixed';
                rightClickPopoverTriggerRef.current.style.left = `${event.clientX}px`;
                rightClickPopoverTriggerRef.current.style.top = `${event.clientY}px`;
                rightClickPopoverTriggerRef.current.click();
            }
            return;
        }
    }
    
    const rClickedTextObject = textObjects.find(obj => isPointInRectangle(pos, obj.x, obj.y, obj.width, obj.height));
    if (rClickedTextObject) {
        setSelectedTextObjectId(rClickedTextObject.id); 
        setSelectedTokenId(null);
        setSelectedShapeId(null);
        setRightClickPopoverState({ type: 'text', item: rClickedTextObject, x: event.clientX, y: event.clientY });
        if (rightClickPopoverTriggerRef.current) {
            rightClickPopoverTriggerRef.current.style.position = 'fixed';
            rightClickPopoverTriggerRef.current.style.left = `${event.clientX}px`;
            rightClickPopoverTriggerRef.current.style.top = `${event.clientY}px`;
            rightClickPopoverTriggerRef.current.click();
        }
        return;
    }

    setRightClickPopoverState(null);
  };


  const handleTokenLabelClick = (event: React.MouseEvent, token: TokenType) => {
    event.stopPropagation(); 
    if (activeTool === 'select' && !draggingToken && !rightClickPopoverState) {
      setSelectedTokenId(token.id); 
      setEditingTokenId(token.id);
      setEditingText(token.instanceName || '');
    }
  };

  const handleShapeLabelClick = (event: React.MouseEvent, shape: DrawnShape) => {
    event.stopPropagation();
    if (activeTool === 'select' && !rightClickPopoverState && !isActuallyDraggingShape) {
      setSelectedShapeId(shape.id); 
      setEditingShapeId(shape.id);
      setEditingShapeLabelText(shape.label || '');
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

  const handleShapeLabelInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSaveShapeLabel();
    } else if (event.key === 'Escape') {
      setEditingShapeId(null);
      setEditingShapeLabelText('');
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
      const calculatedWidth = textMetricsWidth + TEXT_PADDING.x * 2 + 5; 
      setIsCreatingText(prev => {
          if (!prev) return null;
          const newFinalWidth = Math.max(MIN_NEW_TEXT_INPUT_WIDTH, calculatedWidth);
          return { ...prev, currentText: newText, inputWidth: newFinalWidth };
      });
    }
  };


  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePosition(event);
    if (isPanning && panStart && svgRef.current) {
      setRightClickPopoverState(null);
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

      const absoluteContentMinX = 0 - paddingForOrigin;
      const absoluteContentMinY = 0 - paddingForOrigin;
      const absoluteContentWidthWithBorder = calculatedTotalContentWidth + borderWidthForOrigin;
      const absoluteContentHeightWithBorder = calculatedTotalContentHeight + borderWidthForOrigin;

      const max_vb_min_x = absoluteContentMinX + absoluteContentWidthWithBorder - currentVbWidth;
      const max_vb_min_y = absoluteContentMinY + absoluteContentHeightWithBorder - currentVbHeight;
      const min_vb_min_x = absoluteContentMinX;
      const min_vb_min_y = absoluteContentMinY;
      
      let finalNewVx = newCandidateVx;
      if (absoluteContentWidthWithBorder <= currentVbWidth) { 
         finalNewVx = absoluteContentMinX + (absoluteContentWidthWithBorder - currentVbWidth) / 2; 
      } else { 
         finalNewVx = Math.max(min_vb_min_x, Math.min(newCandidateVx, max_vb_min_x));
      }

      let finalNewVy = newCandidateVy;
      if (absoluteContentHeightWithBorder <= currentVbHeight) { 
        finalNewVy = absoluteContentMinY + (absoluteContentHeightWithBorder - currentVbHeight) / 2; 
      } else { 
        finalNewVy = Math.max(min_vb_min_y, Math.min(newCandidateVy, max_vb_min_y));
      }
      
      setViewBox(`${finalNewVx} ${finalNewVy} ${currentVbWidth} ${currentVbHeight}`);
      setPanStart({ x: event.clientX, y: event.clientY });
      setHoveredCellWhilePaintingOrErasing(null);

    } else if (draggingToken && dragOffset && activeTool === 'select' && !editingTokenId) {
      setRightClickPopoverState(null);
      const currentMouseSvgPos = getMousePosition(event);
      const tokenActualSize = draggingToken.size || 1;
      const newTargetTokenOriginX = currentMouseSvgPos.x - dragOffset.x;
      const newTargetTokenOriginY = currentMouseSvgPos.y - dragOffset.y;
      const gridX = Math.floor(newTargetTokenOriginX / cellSize);
      const gridY = Math.floor(newTargetTokenOriginY / cellSize);
      const clampedGridX = Math.max(0, Math.min(gridX, numCols - tokenActualSize));
      const clampedGridY = Math.max(0, Math.min(gridY, numRows - tokenActualSize));

      const isTargetOccupiedByOther = isSquareOccupied(clampedGridX, clampedGridY, tokenActualSize, tokens, numCols, numRows, draggingToken.id);
      
      if (!isTargetOccupiedByOther) {
          if (!draggingTokenPosition || draggingTokenPosition.x !== clampedGridX || draggingTokenPosition.y !== clampedGridY) {
              setDraggingTokenPosition({ x: clampedGridX, y: clampedGridY });
          }
      } 
      setHoveredCellWhilePaintingOrErasing(null);
    } else if (draggingTextObjectId && textObjectDragOffset && activeTool === 'select' && !editingTextObjectId) {
        setRightClickPopoverState(null);
        const newX = pos.x - textObjectDragOffset.x;
        const newY = pos.y - textObjectDragOffset.y;
        setTextObjects(prev => prev.map(obj =>
            obj.id === draggingTextObjectId ? { ...obj, x: newX, y: newY } : obj
        ));
    } else if (potentialDraggingShapeInfo && mouseDownPos && activeTool === 'select' && !editingShapeId) {
        const dxScreen = event.clientX - potentialDraggingShapeInfo.startScreenPos.x;
        const dyScreen = event.clientY - potentialDraggingShapeInfo.startScreenPos.y;
        if (dxScreen * dxScreen + dyScreen * dyScreen > CLICK_THRESHOLD_SQUARED) { 
            setRightClickPopoverState(null);
            setIsActuallyDraggingShape(true);
            setCurrentDraggingShapeId(potentialDraggingShapeInfo.id);
            let initialShapeRefX, initialShapeRefY;
            if (potentialDraggingShapeInfo.type === 'circle') { 
                initialShapeRefX = potentialDraggingShapeInfo.originalStartPoint.x;
                initialShapeRefY = potentialDraggingShapeInfo.originalStartPoint.y;
            } else if (potentialDraggingShapeInfo.type === 'rectangle') { 
                initialShapeRefX = Math.min(potentialDraggingShapeInfo.originalStartPoint.x, potentialDraggingShapeInfo.originalEndPoint.x);
                initialShapeRefY = Math.min(potentialDraggingShapeInfo.originalStartPoint.y, potentialDraggingShapeInfo.originalEndPoint.y);
            } else { return; } 
            setShapeDragOffset({ x: mouseDownPos.x - initialShapeRefX, y: mouseDownPos.y - initialShapeRefY });
            setPotentialDraggingShapeInfo(null); 
        }
    } else if (isActuallyDraggingShape && currentDraggingShapeId && shapeDragOffset && activeTool === 'select' && !editingShapeId) {
        setRightClickPopoverState(null);
        const draggedShape = drawnShapes.find(s => s.id === currentDraggingShapeId);
        if (!draggedShape) return;

        let rawNewRefPoint = { x: pos.x - shapeDragOffset.x, y: pos.y - shapeDragOffset.y };
        let snappedNewRefPoint;
        let newStartPoint, newEndPoint;

        if (draggedShape.type === 'circle') {
            snappedNewRefPoint = snapToCellCenter(rawNewRefPoint, cellSize); 
            const radiusVector = { 
                x: draggedShape.endPoint.x - draggedShape.startPoint.x, 
                y: draggedShape.endPoint.y - draggedShape.startPoint.y, 
            };
            newStartPoint = snappedNewRefPoint;
            newEndPoint = { x: newStartPoint.x + radiusVector.x, y: newStartPoint.y + radiusVector.y };
        } else if (draggedShape.type === 'rectangle') {
            snappedNewRefPoint = snapToVertex(rawNewRefPoint, cellSize); 
            const width = Math.abs(draggedShape.startPoint.x - draggedShape.endPoint.x);
            const height = Math.abs(draggedShape.startPoint.y - draggedShape.endPoint.y);
            newStartPoint = snappedNewRefPoint;
            newEndPoint = { x: newStartPoint.x + width, y: newStartPoint.y + height };
        } else {
            return; 
        }
        
        setDrawnShapes(prevShapes => prevShapes.map(s =>
            s.id === currentDraggingShapeId ? { ...s, startPoint: newStartPoint!, endPoint: newEndPoint! } : s
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
            if (pendingGridCellsDuringPaint &&
                pendingGridCellsDuringPaint[gridY]?.[gridX]?.color !== selectedColor) {
                const updatedPendingCells = pendingGridCellsDuringPaint.map(row => row.map(cell => ({ ...cell })));
                if (updatedPendingCells[gridY]?.[gridX]) {
                   updatedPendingCells[gridY][gridX].color = selectedColor;
                }
                setPendingGridCellsDuringPaint(updatedPendingCells);
            }
        } else {
           setHoveredCellWhilePaintingOrErasing(null);
        }
    } else if (activeTool === 'place_token' && selectedTokenTemplate) {
      const tokenSize = selectedTokenTemplate.size || 1;
      const gridX = Math.floor(pos.x / cellSize);
      const gridY = Math.floor(pos.y / cellSize);
      const clampedGridX = Math.max(0, Math.min(gridX, numCols - tokenSize));
      const clampedGridY = Math.max(0, Math.min(gridY, numRows - tokenSize));
      
      if (clampedGridX >= 0 && clampedGridX + tokenSize <= numCols && clampedGridY >= 0 && clampedGridY + tokenSize <= numRows) {
        setHoveredCellWhilePaintingOrErasing({ x: clampedGridX, y: clampedGridY });
      } else {
        setHoveredCellWhilePaintingOrErasing(null);
      }
    } else if (isDrawing && currentDrawingShape && drawingStartPoint) {
        if (currentDrawingShape.type === 'circle') {
            const rawRadiusEndPoint = pos; 
            const pixelDist = Math.sqrt(dist2(drawingStartPoint, rawRadiusEndPoint));
            const numCellsRadius = Math.max(1, Math.round(pixelDist / cellSize)); 
            const snappedPixelDist = numCellsRadius * cellSize;

            const vectorX = rawRadiusEndPoint.x - drawingStartPoint.x;
            const vectorY = rawRadiusEndPoint.y - drawingStartPoint.y;
            const currentLength = Math.sqrt(vectorX*vectorX + vectorY*vectorY);
            let unitX = 1, unitY = 0; 
            if (currentLength > 0) {
                unitX = vectorX / currentLength;
                unitY = vectorY / currentLength;
            }
            const finalEndPoint = {
                x: drawingStartPoint.x + unitX * snappedPixelDist,
                y: drawingStartPoint.y + unitY * snappedPixelDist,
            };
            setCurrentDrawingShape(prev => prev ? { ...prev, endPoint: finalEndPoint } : null);
        } else {
            const snapFn = currentDrawingShape.type === 'rectangle' ? snapToVertex : (p: Point) => p; 
            const currentEndPoint = snapFn(pos, cellSize);
            setCurrentDrawingShape(prev => prev ? { ...prev, endPoint: currentEndPoint } : null);
        }
        setHoveredCellWhilePaintingOrErasing(null);
    }
     else { 
        setHoveredCellWhilePaintingOrErasing(null);
         if (potentialDraggingShapeInfo === null && !isActuallyDraggingShape && mouseDownPos && selectedShapeId) {
            const dx = pos.x - mouseDownPos.x;
            const dy = pos.y - mouseDownPos.y;
            if (dx * dx + dy * dy >= CLICK_THRESHOLD_SQUARED) { 
                setSelectedShapeId(null); 
            }
        }
    }

    if (activeTool === 'type_tool') {
        const currentHoverPos = getMousePosition(event);
        const currentlyHoveredTextObj = textObjects.find(obj => isPointInRectangle(currentHoverPos, obj.x, obj.y, obj.width, obj.height));
        if (currentlyHoveredTextObj) {
            if (hoveredTextObjectId !== currentlyHoveredTextObj.id) {
                setHoveredTextObjectId(currentlyHoveredTextObj.id);
            }
        } else {
            if (hoveredTextObjectId !== null) {
                setHoveredTextObjectId(null);
            }
        }
    } else if (hoveredTextObjectId !== null) { 
        setHoveredTextObjectId(null);
    }
  };

  const handleMouseUp = (event: React.MouseEvent<SVGSVGElement>) => {
    if (draggingToken && activeTool === 'select' && !editingTokenId) {
      if (draggingTokenPosition) { 
        if (onTokenMove) {
            onTokenMove(draggingToken.id, draggingTokenPosition.x, draggingTokenPosition.y);
        }
      }
      setDraggingToken(null);
      setDragOffset(null);
      setDraggingTokenPosition(null);
    }

    if (draggingTextObjectId && activeTool === 'select' && !editingTextObjectId) {
        setDraggingTextObjectId(null);
        setTextObjectDragOffset(null);
    }
    
    if (potentialDraggingShapeInfo && mouseDownPos && activeTool === 'select' && !editingShapeId) { 
        const dxScreen = event.clientX - potentialDraggingShapeInfo.startScreenPos.x;
        const dyScreen = event.clientY - potentialDraggingShapeInfo.startScreenPos.y;
        if (dxScreen * dxScreen + dyScreen * dyScreen < CLICK_THRESHOLD_SQUARED) { 
            // This was a click, not a drag for shape movement
        }
    }
    setPotentialDraggingShapeInfo(null); 
    setIsActuallyDraggingShape(false);
    setCurrentDraggingShapeId(null);
    setShapeDragOffset(null);
    setMouseDownPos(null); 

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
        if (activeTool === 'paint_cell' && pendingGridCellsDuringPaint) {
            setGridCells(pendingGridCellsDuringPaint);
            setPendingGridCellsDuringPaint(null);
        }
        setIsPainting(false);
        setHoveredCellWhilePaintingOrErasing(null);
    }
    if (isDrawing && currentDrawingShape) {
      let shapeToAdd = { ...currentDrawingShape };

      if (shapeToAdd.type === 'circle') {
          const pixelRadius = Math.sqrt(dist2(shapeToAdd.startPoint, shapeToAdd.endPoint));
          if (pixelRadius < cellSize * 0.5) { 
              setCurrentDrawingShape(null);
              setIsDrawing(false);
              setDrawingStartPoint(null);
              return; 
          }
          const typeCount = drawnShapes.filter(s => s.type === shapeToAdd.type).length;
          const defaultLabel = `Circle ${typeCount + 1}`;
          shapeToAdd.label = defaultLabel;
      } else if (shapeToAdd.type === 'rectangle') {
          const width = Math.abs(shapeToAdd.startPoint.x - shapeToAdd.endPoint.x);
          const height = Math.abs(shapeToAdd.startPoint.y - shapeToAdd.endPoint.y);
          if (width < cellSize * 0.5 || height < cellSize * 0.5) { 
              setCurrentDrawingShape(null);
              setIsDrawing(false);
              setDrawingStartPoint(null);
              return; 
          }
          const typeCount = drawnShapes.filter(s => s.type === shapeToAdd.type).length;
          const defaultLabel = `Rectangle ${typeCount + 1}`;
          shapeToAdd.label = defaultLabel;
      }

      setDrawnShapes(prev => [...prev, shapeToAdd]);
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
    
    if (isErasing || isPainting || activeTool === 'place_token') {
        if (isPainting && activeTool === 'paint_cell' && pendingGridCellsDuringPaint) {
            setGridCells(pendingGridCellsDuringPaint);
            setPendingGridCellsDuringPaint(null);
        }
        setIsErasing(false);
        setIsPainting(false);
        setHoveredCellWhilePaintingOrErasing(null);
    }

    if (draggingToken) {
        if (draggingTokenPosition && onTokenMove) {
             onTokenMove(draggingToken.id, draggingTokenPosition.x, draggingTokenPosition.y);
        }
        setDraggingToken(null);
        setDragOffset(null);
        setDraggingTokenPosition(null);
        setMouseDownPos(null);
    }
    if (draggingTextObjectId) {
        setDraggingTextObjectId(null);
        setTextObjectDragOffset(null);
    }
    if (isActuallyDraggingShape) {
        setIsActuallyDraggingShape(false);
        setCurrentDraggingShapeId(null);
        setShapeDragOffset(null);
    }
    setPotentialDraggingShapeInfo(null); 

    if (isDrawing && currentDrawingShape) {
        let shapeToAdd = { ...currentDrawingShape };
         if (shapeToAdd.type === 'circle') {
            const pixelRadius = Math.sqrt(dist2(shapeToAdd.startPoint, shapeToAdd.endPoint));
            if (pixelRadius < cellSize * 0.5) { 
                setCurrentDrawingShape(null); setIsDrawing(false); setDrawingStartPoint(null); return; 
            }
            const typeCount = drawnShapes.filter(s => s.type === shapeToAdd.type).length;
            shapeToAdd.label = `Circle ${typeCount + 1}`;
        } else if (shapeToAdd.type === 'rectangle') {
            const width = Math.abs(shapeToAdd.startPoint.x - shapeToAdd.endPoint.x);
            const height = Math.abs(shapeToAdd.startPoint.y - shapeToAdd.endPoint.y);
            if (width < cellSize * 0.5 || height < cellSize * 0.5) {
                setCurrentDrawingShape(null); setIsDrawing(false); setDrawingStartPoint(null); return;
            }
            const typeCount = drawnShapes.filter(s => s.type === shapeToAdd.type).length;
            shapeToAdd.label = `Rectangle ${typeCount + 1}`;
        }
        setDrawnShapes(prev => [...prev, shapeToAdd]);
        setCurrentDrawingShape(null);
        setIsDrawing(false);
        setDrawingStartPoint(null);
    }
  };

  const handleZoomButtonClick = (zoomIn: boolean) => {
    applyZoom(zoomIn, ZOOM_AMOUNT);
  };

  const calculateInitialViewBoxCb = useCallback(() => {
    return calculateInitialViewBox();
  }, [calculateInitialViewBox]); 

  const handleResetView = useCallback(() => {
    setViewBox(calculateInitialViewBoxCb());
  }, [calculateInitialViewBoxCb]); 


  const gridContentWidth = numCols * cellSize;
  const gridContentHeight = numRows * cellSize;

  const imgScaledWidth = gridContentWidth * backgroundZoomLevel;
  const imgScaledHeight = gridContentHeight * backgroundZoomLevel;
  const imgScaledX = (gridContentWidth - imgScaledWidth) / 2;
  const imgScaledY = (gridContentHeight - imgScaledHeight) / 2;

 const getCursorStyle = () => {
    if (editingTokenId || isCreatingText || editingTextObjectId || editingShapeId) return 'cursor-text';
    if (isPanning) return 'cursor-grabbing';
    if (draggingToken && activeTool === 'select' && !editingTokenId) return 'cursor-grabbing';
    if (activeTool === 'select' && !draggingToken && !isPanning && !rightClickPopoverState && !isActuallyDraggingShape) return 'cursor-default';
    if (draggingTextObjectId && activeTool === 'select' && !editingTextObjectId) return 'cursor-grabbing';
    if (isActuallyDraggingShape && activeTool === 'select' && !editingShapeId) return 'cursor-grabbing';
    if (activeTool === 'type_tool') return 'cursor-text';

    if ([
      'paint_cell', 'place_token', 'measure_distance', 'measure_radius',
      'eraser_tool', 'draw_line', 'draw_circle', 'draw_rectangle'
    ].includes(activeTool)) return 'cursor-crosshair';
    return 'cursor-default'; 
  };

  const handleSetShapeOpacity = (shapeId: string, opacityValue: number) => {
      setDrawnShapes(prev => prev.map(s =>
          s.id === shapeId ? { ...s, opacity: opacityValue } : s
      ));
      if(rightClickPopoverState?.type === 'shape' && rightClickPopoverState.item.id === shapeId) {
         const currentItem = rightClickPopoverState.item as DrawnShape;
         const updatedItem = { ...currentItem, opacity: opacityValue };
         setRightClickPopoverState(prev => prev ? ({...prev, item: updatedItem }) : null );
      }
  };

  const handleShapeRadiusChange = (shapeId: string, newRadiusInFeetString: string) => {
    const newRadiusInFeet = parseFloat(newRadiusInFeetString);
    if (isNaN(newRadiusInFeet) || newRadiusInFeet < (FEET_PER_SQUARE / 2)) {
      const currentShape = drawnShapes.find(s => s.id === shapeId);
      if (currentShape && currentShape.type === 'circle') {
          const currentPixelRadius = Math.sqrt(dist2(currentShape.startPoint, currentShape.endPoint));
          const currentRadiusInFeet = (currentPixelRadius / cellSize) * FEET_PER_SQUARE;
          setShapeRadiusInput(String(Math.max(FEET_PER_SQUARE / 2, Math.round(currentRadiusInFeet) )));
      }
      return;
    }
    const newRadiusInPixels = (newRadiusInFeet / FEET_PER_SQUARE) * cellSize;

    setDrawnShapes(prev => prev.map(s => {
      if (s.id === shapeId && s.type === 'circle') {
        return { ...s, endPoint: { x: s.startPoint.x + newRadiusInPixels, y: s.startPoint.y } };
      }
      return s;
    }));
    if (rightClickPopoverState?.type === 'shape' && rightClickPopoverState.item.id === shapeId) {
        const currentItem = rightClickPopoverState.item as DrawnShape;
        const updatedItem = {...currentItem, endPoint: {x: currentItem.startPoint.x + newRadiusInPixels, y: currentItem.startPoint.y}};
        setRightClickPopoverState(prev => prev ? ({...prev, item: updatedItem }) : null);
    }
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
        onContextMenu={handleContextMenu}
        preserveAspectRatio="xMidYMid slice" 
        data-ai-hint="battle grid tactical map"
      >
        <defs>
          {tokens.map(token => {
            const tokenActualSize = (token.size || 1);
            return token.customImageUrl ? (
              <clipPath key={`clip-${token.id}`} id={`clip-${token.id}`}>
                <circle 
                    cx={tokenActualSize * cellSize / 2} 
                    cy={tokenActualSize * cellSize / 2} 
                    r={tokenActualSize * cellSize / 2 * 0.95} 
                />
              </clipPath>
            ) : null
          })}
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
              let isHighlightActive = false;
              let highlightSize = 1; 

              if (activeTool === 'place_token' && selectedTokenTemplate) {
                isHighlightActive = true;
                highlightSize = selectedTokenTemplate.size || 1;
              } else if ((isPainting && activeTool === 'paint_cell') || (isErasing && activeTool === 'eraser_tool')) {
                isHighlightActive = true;
              }
              
              const isHighlighted = isHighlightActive &&
                                  hoveredCellWhilePaintingOrErasing &&
                                  hoveredCellWhilePaintingOrErasing.x === x &&
                                  hoveredCellWhilePaintingOrErasing.y === y;
              
              const cellDataToUse = (isPainting && activeTool === 'paint_cell' && pendingGridCellsDuringPaint && pendingGridCellsDuringPaint[y]?.[x])
                ? pendingGridCellsDuringPaint[y][x]
                : cell;

              return (
              <rect
                key={cell.id}
                x={x * cellSize}
                y={y * cellSize}
                width={isHighlighted && activeTool === 'place_token' ? cellSize * highlightSize : cellSize}
                height={isHighlighted && activeTool === 'place_token' ? cellSize * highlightSize : cellSize}
                fill={cellDataToUse.color || 'transparent'}
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
            const isCurrentlyEditingThisShapeLabel = editingShapeId === shape.id;
            const isShapeSelected = shape.id === selectedShapeId;
            const isLabelVisible = showAllLabels || isShapeSelected; 
            
            let labelX = 0, labelY = 0;
            if (shape.type === 'line') {
                labelX = (shape.startPoint.x + shape.endPoint.x) / 2;
                labelY = (shape.startPoint.y + shape.endPoint.y) / 2; 
            } else if (shape.type === 'circle') {
                labelX = shape.startPoint.x; 
                labelY = shape.startPoint.y; 
            } else if (shape.type === 'rectangle') {
                labelX = Math.min(shape.startPoint.x, shape.endPoint.x) + Math.abs(shape.endPoint.x - shape.startPoint.x) / 2;
                labelY = Math.min(shape.startPoint.y, shape.endPoint.y) + Math.abs(shape.endPoint.y - shape.startPoint.y) / 2;
            }

            return (
              <g key={shape.id} className={cn(
                                            activeTool === 'select' && (shape.type === 'circle' || shape.type === 'rectangle') && !rightClickPopoverState && !isActuallyDraggingShape && 'cursor-pointer',
                                            activeTool === 'select' && isActuallyDraggingShape && currentDraggingShapeId === shape.id && 'cursor-grabbing',
                                            activeTool === 'select' && shape.type === 'line' && !rightClickPopoverState && 'cursor-pointer' 
                                          )}>
                {shape.type === 'line' && (
                  <line
                    x1={shape.startPoint.x} y1={shape.startPoint.y}
                    x2={shape.endPoint.x} y2={shape.endPoint.y}
                    stroke={isShapeSelected ? 'hsl(var(--ring))' : shape.color}
                    strokeWidth={isShapeSelected ? shape.strokeWidth + 1 : shape.strokeWidth} 
                    strokeOpacity={shape.opacity ?? 1}
                  />
                )}
                {shape.type === 'circle' && (
                  <circle
                    cx={shape.startPoint.x} cy={shape.startPoint.y}
                    r={Math.sqrt(dist2(shape.startPoint, shape.endPoint))}
                    stroke={isShapeSelected ? 'hsl(var(--ring))' : shape.color}
                    strokeWidth={isShapeSelected ? shape.strokeWidth + 1 : shape.strokeWidth}
                    strokeOpacity={1} 
                    fill={shape.fillColor}
                    fillOpacity={shape.opacity ?? 0.5} 
                  />
                )}
                {shape.type === 'rectangle' && (
                  <rect
                    x={Math.min(shape.startPoint.x, shape.endPoint.x)}
                    y={Math.min(shape.startPoint.y, shape.endPoint.y)}
                    width={Math.abs(shape.endPoint.x - shape.startPoint.x)}
                    height={Math.abs(shape.endPoint.y - shape.startPoint.y)}
                    stroke={isShapeSelected ? 'hsl(var(--ring))' : shape.color}
                    strokeWidth={isShapeSelected ? shape.strokeWidth + 1 : shape.strokeWidth}
                    strokeOpacity={1} 
                    fill={shape.fillColor}
                    fillOpacity={shape.opacity ?? 0.5} 
                  />
                )}
                 {shape.label && !isCurrentlyEditingThisShapeLabel && isLabelVisible && (
                    <text
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        dominantBaseline="middle" 
                        fontSize="10" 
                        fontFamily="sans-serif"
                        fontWeight="bold"
                        fill="hsl(var(--foreground))" 
                        stroke="black" 
                        strokeWidth="1.25px" 
                        paintOrder="stroke" 
                        filter="url(#blurryTextDropShadow)"
                        className={cn(activeTool === 'select' && !rightClickPopoverState ? "cursor-text" : "cursor-default", "select-none")}
                        onClick={(e) => { if(!rightClickPopoverState) handleShapeLabelClick(e, shape) }}
                    >
                        {shape.label}
                    </text>
                )}
                {isCurrentlyEditingThisShapeLabel && (
                    <foreignObject
                        x={labelX - 50} 
                        y={labelY - 11 } 
                        width={100} 
                        height={22} 
                    >
                        <input
                            ref={shapeLabelInputRef}
                            type="text"
                            value={editingShapeLabelText}
                            onChange={(e) => setEditingShapeLabelText(e.target.value)}
                            onBlur={handleSaveShapeLabel}
                            onKeyDown={handleShapeLabelInputKeyDown}
                            style={{
                                background: 'hsla(var(--background), 0.9)', 
                                color: 'hsl(var(--foreground))',
                                border: '1px solid hsl(var(--accent))',
                                borderRadius: '4px',
                                fontSize: '12px', 
                                fontFamily: 'sans-serif',
                                padding: '3px 5px', 
                                width: '100%',
                                height: '100%',
                                textAlign: 'center',
                                outline: 'none',
                                boxShadow: '0 0 5px hsl(var(--accent))', 
                                boxSizing: 'border-box' 
                            }}
                            onWheelCapture={(e) => e.stopPropagation()} 
                        />
                    </foreignObject>
                )}
              </g>
            );
          })}
        </g>

        {currentDrawingShape && isDrawing && (
          <g>
            {currentDrawingShape.type === 'line' && (
              <line
                x1={currentDrawingShape.startPoint.x} y1={currentDrawingShape.startPoint.y}
                x2={currentDrawingShape.endPoint.x} y2={currentDrawingShape.endPoint.y}
                stroke={currentDrawingShape.color}
                strokeWidth={currentDrawingShape.strokeWidth}
                strokeOpacity={currentDrawingShape.opacity ?? 1}
                strokeDasharray="3 3" 
              />
            )}
            {currentDrawingShape.type === 'circle' && (
              <circle
                cx={currentDrawingShape.startPoint.x} cy={currentDrawingShape.startPoint.y}
                r={Math.sqrt( dist2(currentDrawingShape.startPoint, currentDrawingShape.endPoint) )}
                stroke={currentDrawingShape.color}
                strokeWidth={currentDrawingShape.strokeWidth}
                strokeOpacity={1} 
                fill={currentDrawingShape.fillColor}
                fillOpacity={currentDrawingShape.opacity ?? 0.5} 
                strokeDasharray="3 3"
              />
            )}
            {currentDrawingShape.type === 'rectangle' && (
              <rect
                x={Math.min(currentDrawingShape.startPoint.x, currentDrawingShape.endPoint.x)}
                y={Math.min(currentDrawingShape.startPoint.y, currentDrawingShape.endPoint.y)}
                width={Math.abs(currentDrawingShape.endPoint.x - currentDrawingShape.startPoint.x)}
                height={Math.abs(currentDrawingShape.endPoint.y - currentDrawingShape.startPoint.y)}
                stroke={currentDrawingShape.color}
                strokeWidth={currentDrawingShape.strokeWidth}
                strokeOpacity={1} 
                fill={currentDrawingShape.fillColor}
                fillOpacity={currentDrawingShape.opacity ?? 0.5} 
                strokeDasharray="3 3"
              />
            )}
          </g>
        )}

        {tokens.map(token => {
          const IconComponent = token.icon as React.FC<LucideProps & {x?: number; y?:number; width?: string | number; height?: string | number; color?: string}>;
          const tokenActualSize = token.size || 1; 

          let currentX = token.x; 
          let currentY = token.y; 

          if (draggingToken && token.id === draggingToken.id && draggingTokenPosition && !editingTokenId) {
            currentX = draggingTokenPosition.x;
            currentY = draggingTokenPosition.y;
          }

          const iconDisplaySize = tokenActualSize * cellSize * 0.8; 
          const iconOffset = (tokenActualSize * cellSize - iconDisplaySize) / 2;

          const imageDisplaySize = tokenActualSize * cellSize * 0.95; 
          const imageOffset = (tokenActualSize * cellSize - imageDisplaySize) / 2;

          let backgroundFill = token.color; 
            if (!token.customImageUrl) { 
                switch (token.type) {
                    case 'player': backgroundFill = 'hsl(var(--player-green-bg))'; break;
                    case 'enemy': backgroundFill = 'hsl(var(--destructive))'; break;
                    case 'ally': backgroundFill = 'hsl(var(--app-blue-bg))'; break;
                    case 'item': backgroundFill = token.color || 'hsl(270, 40%, 30%)'; break; 
                    case 'terrain': backgroundFill = token.color || 'hsl(var(--muted))'; break; 
                    case 'generic': backgroundFill = token.color || 'hsl(var(--accent))'; break; 
                    default: backgroundFill = token.color || 'black'; 
                }
            }

          const isCurrentlyEditingThisToken = editingTokenId === token.id;
          const isTokenActiveTurn = token.id === activeTurnTokenId;
          const isTokenSelectedByClick = token.id === selectedTokenId;
          const isTokenLabelVisible = showAllLabels || isTokenSelectedByClick;

          const fixedInputWidth = cellSize * 4; // Example: 120px if cellSize is 30
          const fixedInputHeight = 20;

          return (
            <g
              key={token.id}
              transform={`translate(${currentX * cellSize}, ${currentY * cellSize})`}
              onMouseEnter={() => setHoveredTokenId(token.id)}
              onMouseLeave={() => setHoveredTokenId(null)}
              className={cn(
                activeTool === 'select' && !isCurrentlyEditingThisToken && !draggingToken && !rightClickPopoverState && 'cursor-pointer',
                activeTool === 'select' && draggingToken?.id === token.id && !isCurrentlyEditingThisToken && 'cursor-grabbing',
                isCurrentlyEditingThisToken && 'cursor-text',
                'drop-shadow-md', 
                isTokenActiveTurn && "animate-pulse-token origin-center" 
              )}
            >
              <circle
                cx={tokenActualSize * cellSize / 2}
                cy={tokenActualSize * cellSize / 2}
                r={tokenActualSize * cellSize / 2}
                fill={backgroundFill}
                stroke={
                  isTokenSelectedByClick ? 'hsl(200, 100%, 50%)' : 
                  hoveredTokenId === token.id && activeTool === 'select' && !isCurrentlyEditingThisToken && !rightClickPopoverState 
                      ? 'hsl(var(--accent))' 
                      : 'hsl(var(--primary-foreground))' 
                }
                strokeWidth={isTokenSelectedByClick ? 2 : 1} 
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
                    cx={tokenActualSize * cellSize / 2} 
                    cy={tokenActualSize * cellSize / 2} 
                    r={tokenActualSize * cellSize / 2 * 0.95} 
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

              {token.instanceName && !isCurrentlyEditingThisToken && isTokenLabelVisible && (
                <text
                  x={tokenActualSize * cellSize / 2} 
                  y={tokenActualSize * cellSize + 10} 
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  fontSize="10" 
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  fill="hsl(var(--foreground))" 
                  stroke="black" 
                  strokeWidth="1.25px" 
                  paintOrder="stroke" 
                  filter="url(#blurryTextDropShadow)" 
                  className={cn(
                    activeTool === 'select' && !rightClickPopoverState ? "cursor-text" : "cursor-default", 
                    "select-none" 
                  )}
                  onClick={(e) => {if(!rightClickPopoverState) handleTokenLabelClick(e, token)}}
                >
                  {token.instanceName}
                </text>
              )}
              {isCurrentlyEditingThisToken && (
                <foreignObject
                  x={(tokenActualSize * cellSize / 2) - (fixedInputWidth / 2)}
                  y={tokenActualSize * cellSize + 2} 
                  width={fixedInputWidth} 
                  height={fixedInputHeight} 
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
                width={Math.max(obj.width, MIN_NEW_TEXT_INPUT_WIDTH)} 
                height={obj.height + 2} 
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
                  activeTool === 'select' && !editingTextObjectId && !rightClickPopoverState ? 'cursor-pointer' : 
                  activeTool === 'type_tool' ? 'cursor-text' : 'cursor-default', 
                  draggingTextObjectId === obj.id && !editingTextObjectId ? 'cursor-grabbing' : '' 
              )}
              onMouseEnter={() => {
                if (activeTool === 'type_tool') {
                  setHoveredTextObjectId(obj.id);
                }
              }}
              onMouseLeave={() => {
                if (activeTool === 'type_tool') {
                  setHoveredTextObjectId(null);
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
                  border: (selectedTextObjectId === obj.id && activeTool !== 'type_tool') ? '1px solid hsl(var(--ring))' : 
                          (activeTool === 'type_tool' && hoveredTextObjectId === obj.id ? '1px solid hsl(var(--accent))' : 'none'), 
                }}
              >
                {obj.content}
              </div>
            </foreignObject>
          );
        })}

        {isCreatingText && (() => {
          const textForInitialHeight = isCreatingText.currentText.trim() === '' ? 'M' : isCreatingText.currentText;
          const { height: measuredContentHeight } = measureText(textForInitialHeight, isCreatingText.fontSize);
          const bubbleHeight = measuredContentHeight + TEXT_PADDING.y * 2;

          return (
            <foreignObject
              x={isCreatingText.x}
              y={isCreatingText.y - bubbleHeight / 2} 
              width={isCreatingText.inputWidth}
              height={bubbleHeight + 2} 
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
          );
        })()}


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
              measurement.type === 'radius' &&
                <circle
                  cx={measurement.startPoint.x * cellSize + cellSize/2}
                  cy={measurement.startPoint.y * cellSize + cellSize/2}
                  r={Math.sqrt(Math.pow(measurement.endPoint.x - measurement.startPoint.x, 2) + Math.pow(measurement.endPoint.y - measurement.startPoint.y, 2)) * cellSize}
                  strokeDasharray="5 3"
                  fill="hsla(var(--accent), 0.3)" 
                />
            )}
          </g>
        )}
        {measurement.endPoint && measurement.result && (
          <text
            x={measurement.endPoint.x * cellSize + cellSize / 2 + 10} 
            y={measurement.endPoint.y * cellSize + cellSize / 2 + 10} 
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

      <Popover
        open={!!rightClickPopoverState}
        onOpenChange={(isOpen) => {
            if (!isOpen) {
              setRightClickPopoverState(null);
            }
        }}
      >
        <PopoverTrigger asChild>
            <button
                ref={rightClickPopoverTriggerRef}
                style={{
                    position: 'fixed',
                    opacity: 0,
                    pointerEvents: 'none', 
                    width: '1px', height: '1px', 
                }}
                aria-hidden="true" 
            />
        </PopoverTrigger>
        {rightClickPopoverState && ( 
            <PopoverContent
                side="bottom"
                align="center"
                className="w-auto p-1" 
                key={`popover-${rightClickPopoverState.item.id}-${(rightClickPopoverState.type === 'token' && (tokens.find(t => t.id === (rightClickPopoverState.item as TokenType).id)?.size)) || (rightClickPopoverState.type === 'shape' && (rightClickPopoverState.item as DrawnShape).opacity)}`}
                onOpenAutoFocus={(e) => e.preventDefault()} 
            >
              {rightClickPopoverState.type === 'token' && (() => {
                const currentTokenFromGrid = tokens.find(t => t.id === (rightClickPopoverState.item as TokenType).id);
                const currentToken = currentTokenFromGrid || (rightClickPopoverState.item as TokenType);
                const tokenSize = currentToken.size || 1;
                const isLinked = participants.some(p => p.tokenId === currentToken.id);
                return (
                <div className="w-48"> 
                  {onOpenAddCombatantDialogForToken && 
                   !isLinked && 
                   ['player', 'enemy', 'ally'].includes(currentToken.type) && 
                   ( 
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-8 px-2 text-sm flex items-center"
                      onClick={() => {
                        onOpenAddCombatantDialogForToken(currentToken);
                        setRightClickPopoverState(null); 
                      }}
                    >
                      <Users className="mr-2 h-3.5 w-3.5" /> Add to Turn Order
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-8 px-2 text-sm flex items-center"
                    onClick={() => {
                      setEditingTokenId(currentToken.id);
                      setEditingText(currentToken.instanceName || '');
                      setRightClickPopoverState(null); 
                    }}
                  >
                    <Edit3 className="mr-2 h-3.5 w-3.5" /> Rename
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-8 px-2 text-sm flex items-center"
                    onClick={() => {
                      if (onTokenImageChangeRequest) {
                        onTokenImageChangeRequest(currentToken.id);
                      }
                      setRightClickPopoverState(null); 
                    }}
                  >
                    <ImageIcon className="mr-2 h-3.5 w-3.5" /> Change Image
                  </Button>
                  {onChangeTokenSize && (
                    <div className="p-2 space-y-1 border-t border-b my-1">
                      <Label className="text-xs text-muted-foreground">Token Size</Label>
                      <div className="flex items-center space-x-1 justify-center">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onChangeTokenSize(currentToken.id, tokenSize - 1)}
                          disabled={tokenSize <= 1}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs font-semibold w-12 text-center tabular-nums">
                          {tokenSize}x{tokenSize}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onChangeTokenSize(currentToken.id, tokenSize + 1)}
                          disabled={tokenSize >= 9}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                   <Button
                        variant="ghost"
                        className={cn(
                            "w-full justify-start h-8 px-2 text-sm flex items-center",
                            "text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        )}
                        onClick={() => {
                           if (onTokenDelete) { 
                            onTokenDelete(currentToken.id);
                           }
                           setRightClickPopoverState(null); 
                           setSelectedTokenId(null); 
                        }}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </Button>
                </div>
              );})()}

              {rightClickPopoverState.type === 'text' && (
                <div className="w-48">
                    <Button
                        variant="ghost"
                        className="w-full justify-start h-8 px-2 text-sm flex items-center"
                        onClick={() => {
                            const textObj = rightClickPopoverState.item as TextObjectType;
                            setEditingTextObjectId(textObj.id);
                            setEditingTextObjectContent(textObj.content);
                            setRightClickPopoverState(null); 
                        }}
                    >
                        <Edit3 className="mr-2 h-3.5 w-3.5" /> Edit Text
                    </Button>
                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full justify-start h-8 px-2 text-sm flex items-center",
                            "text-destructive hover:bg-destructive hover:text-destructive-foreground" 
                        )}
                        onClick={() => {
                            setTextObjects(prev => prev.filter(to => to.id !== rightClickPopoverState.item.id));
                            setRightClickPopoverState(null); 
                            setSelectedTextObjectId(null); 
                        }}
                    >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Text
                    </Button>
                </div>
              )}

              {rightClickPopoverState.type === 'shape' && (
                <div className="w-60 p-2 space-y-2" key={`shape-popover-${rightClickPopoverState.item.id}-${(rightClickPopoverState.item as DrawnShape).opacity}`}>
                  {(rightClickPopoverState.item as DrawnShape).type === 'line' ? (
                    <Button
                      variant="ghost"
                      className={cn(
                          "w-full justify-start h-8 px-2 text-sm flex items-center",
                          "text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      )}
                      onClick={() => {
                          setDrawnShapes(prev => prev.filter(s => s.id !== rightClickPopoverState.item.id));
                          setRightClickPopoverState(null);
                          setSelectedShapeId(null);
                      }}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Shape
                    </Button>
                  ) : (
                    <>
                      <div className="space-y-1 pt-1">
                          <Label className="text-xs">Shape Opacity</Label>
                          <div
                              className="flex space-x-1"
                              key={`opacity-controls-${rightClickPopoverState.item.id}-${(rightClickPopoverState.item as DrawnShape).opacity ?? 0.5}`}
                          >
                              {[1.0, 0.5, 0.1].map(opacityValue => (
                                  <Button
                                      key={`opacity-${opacityValue}`}
                                      variant={(((rightClickPopoverState.item as DrawnShape).opacity ?? 0.5) === opacityValue) ? 'default' : 'outline'}
                                      className="flex-1 h-8 text-xs"
                                      onClick={() => handleSetShapeOpacity(rightClickPopoverState.item.id, opacityValue)}
                                  >
                                      {`${(opacityValue * 100).toFixed(0)}%`}
                                  </Button>
                              ))}
                          </div>
                      </div>

                      {(rightClickPopoverState.item as DrawnShape).type === 'circle' && (
                          <div className="space-y-1 pt-1">
                              <Label htmlFor={`shape-radius-input-${rightClickPopoverState.item.id}`} className="text-xs flex items-center">
                                 Radius (ft)
                              </Label>
                              <div className="flex items-center space-x-1">
                                  <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                          const currentFeet = parseFloat(shapeRadiusInput) || 0;
                                          const newFeet = Math.max(FEET_PER_SQUARE / 2, currentFeet - FEET_PER_SQUARE);
                                          setShapeRadiusInput(String(newFeet)); 
                                          handleShapeRadiusChange(rightClickPopoverState.item.id, String(newFeet)); 
                                      }}
                                  >
                                      <Minus className="h-4 w-4"/>
                                  </Button>
                                  <Input
                                      id={`shape-radius-input-${rightClickPopoverState.item.id}`}
                                      type="number"
                                      value={shapeRadiusInput}
                                      onChange={(e) => setShapeRadiusInput(e.target.value)}
                                      onBlur={() => handleShapeRadiusChange(rightClickPopoverState.item.id, shapeRadiusInput)}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                              handleShapeRadiusChange(rightClickPopoverState.item.id, shapeRadiusInput);
                                              (e.target as HTMLInputElement).blur(); 
                                          }
                                      }}
                                      className="h-8 text-sm text-center w-16"
                                      min={FEET_PER_SQUARE / 2} 
                                      step={FEET_PER_SQUARE} 
                                  />
                                  <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                          const currentFeet = parseFloat(shapeRadiusInput) || 0;
                                          const newFeet = currentFeet + FEET_PER_SQUARE;
                                          setShapeRadiusInput(String(newFeet)); 
                                          handleShapeRadiusChange(rightClickPopoverState.item.id, String(newFeet)); 
                                      }}
                                  >
                                      <Plus className="h-4 w-4"/>
                                  </Button>
                              </div>
                          </div>
                      )}
                       <Button
                          variant="ghost"
                          className="w-full justify-start h-8 px-2 text-sm flex items-center !mt-3" 
                          onClick={() => {
                              const shape = rightClickPopoverState.item as DrawnShape;
                              setEditingShapeId(shape.id);
                              setEditingShapeLabelText(shape.label || '');
                              setRightClickPopoverState(null); 
                          }}
                      >
                          <Edit3 className="mr-2 h-3.5 w-3.5" /> {(rightClickPopoverState.item as DrawnShape).label ? 'Edit Label' : 'Add Label'}
                      </Button>
                      <Button
                          variant="ghost"
                          className={cn(
                              "w-full justify-start h-8 px-2 text-sm flex items-center mt-1", 
                              "text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          )}
                          onClick={() => {
                              setDrawnShapes(prev => prev.filter(s => s.id !== rightClickPopoverState.item.id));
                              setRightClickPopoverState(null); 
                              setSelectedShapeId(null); 
                          }}
                      >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Shape
                      </Button>
                    </>
                  )}
                </div>
              )}
            </PopoverContent>
        )}
      </Popover>

      <TooltipProvider delayDuration={0}>
        <div className="absolute top-4 right-4 flex flex-col space-y-2 z-10">
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
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowAllLabels(!showAllLabels)}
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
            <TooltipContent side="left" align="center">
              <p>{showAllLabels ? "Hide All Labels" : "Show All Labels"}</p>
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
              <Button variant="outline" size="icon" onClick={handleResetView} className="rounded-md shadow-lg h-10 w-10 p-2 bg-card text-card-foreground hover:bg-muted" aria-label="Reset View">
                <Maximize className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" align="center"><p>Reset View</p></TooltipContent>
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
