
'use client';

import type { Point, Token, DrawnShape, GridCellData, TextObjectType, ActiveTool, Measurement } from '@/types';
import type { UseToast } from '@/hooks/use-toast';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { snapToVertex, snapToCellCenter, findAvailableSquare, isSquareOccupied } from '@/lib/grid-utils';
import { distanceToLineSegment, isPointInCircle, isPointInRectangle, dist2, measureText, rectsIntersect } from '@/lib/geometry-utils';

const CLICK_THRESHOLD_SQUARED = 25;
const SHAPE_CLICK_THRESHOLD = 8;
const DOUBLE_CLICK_THRESHOLD_MS = 300;
const FEET_PER_SQUARE = 5;
const TEXT_PADDING = { x: 8, y: 4 };
const MIN_NEW_TEXT_INPUT_WIDTH = 150;

interface UseGridInteractionsProps {
  svgRef: React.RefObject<SVGSVGElement>;
  getMousePosition: (event: React.MouseEvent<SVGSVGElement> | MouseEvent) => Point;
  cellSize: number;
  numRows: number;
  numCols: number;
  activeTool: ActiveTool;
  selectedColor: string; // For paint_cell tool
  selectedShapeDrawColor: string; // For new shapes
  selectedTokenTemplate: Omit<Token, 'id' | 'x' | 'y'> | null;
  currentTextFontSize: number;
  
  tokens: Token[];
  setTokens: React.Dispatch<React.SetStateAction<Token[]>>;
  gridCells: GridCellData[][];
  setGridCells: React.Dispatch<React.SetStateAction<GridCellData[][]>>;
  drawnShapes: DrawnShape[];
  setDrawnShapes: React.Dispatch<React.SetStateAction<DrawnShape[]>>;
  textObjects: TextObjectType[];
  setTextObjects: React.Dispatch<React.SetStateAction<TextObjectType[]>>;
  measurement: Measurement;
  setMeasurement: React.Dispatch<React.SetStateAction<Measurement>>;
  currentDrawingShape: DrawnShape | null;
  setCurrentDrawingShape: React.Dispatch<React.SetStateAction<DrawnShape | null>>;
  
  onTokenMove: (tokenId: string, newX: number, newY: number) => void;
  onTokenErasedOnGrid?: (tokenId: string) => void;
  
  editingTokenId: string | null;
  setEditingTokenId: React.Dispatch<React.SetStateAction<string | null>>;
  editingTextObjectId: string | null;
  setEditingTextObjectId: React.Dispatch<React.SetStateAction<string | null>>;
  editingShapeId: string | null;
  setEditingShapeId: React.Dispatch<React.SetStateAction<string | null>>;

  selectedTokenIds: string[];
  setSelectedTokenIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedShapeIds: string[];
  setSelectedShapeIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedTextObjectIds: string[];
  setSelectedTextObjectIds: React.Dispatch<React.SetStateAction<string[]>>;
  
  isPanning: boolean; 
  panZoomHandlePanStart: (event: React.MouseEvent<SVGSVGElement>) => void;
  panZoomHandlePanMove: (event: React.MouseEvent<SVGSVGElement>) => void;
  panZoomHandlePanEnd: () => void;
  toast: UseToast['toast']; 

  rightClickPopoverState: any; 
  setRightClickPopoverState: React.Dispatch<React.SetStateAction<any>>;
  shapeRadiusInput: string;
  setShapeRadiusInput: React.Dispatch<React.SetStateAction<string>>;
}

export function useGridInteractions({
  svgRef, getMousePosition, cellSize, numRows, numCols, activeTool, selectedColor, selectedShapeDrawColor, selectedTokenTemplate, currentTextFontSize,
  tokens, setTokens, gridCells, setGridCells, drawnShapes, setDrawnShapes, textObjects, setTextObjects,
  measurement, setMeasurement, currentDrawingShape, setCurrentDrawingShape,
  onTokenMove, onTokenErasedOnGrid,
  editingTokenId, setEditingTokenId, editingTextObjectId, setEditingTextObjectId, editingShapeId, setEditingShapeId,
  selectedTokenIds, setSelectedTokenIds, selectedShapeIds, setSelectedShapeIds, selectedTextObjectIds, setSelectedTextObjectIds,
  isPanning, panZoomHandlePanStart, panZoomHandlePanMove, panZoomHandlePanEnd, 
  toast,
  rightClickPopoverState, setRightClickPopoverState, shapeRadiusInput, setShapeRadiusInput
}: UseGridInteractionsProps) {

  const [draggingToken, setDraggingToken] = useState<Token | null>(null);
  const [dragOffset, setDragOffset] = useState<Point | null>(null);
  const [draggingTokenGridPosition, setDraggingTokenGridPosition] = useState<Point | null>(null);
  const [draggedTokenVisualPosition, setDraggedTokenVisualPosition] = useState<Point | null>(null);
  const [mouseDownPos, setMouseDownPos] = useState<Point | null>(null);

  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [pendingGridCellsDuringPaint, setPendingGridCellsDuringPaint] = useState<GridCellData[][] | null>(null);
  const [hoveredCellWhilePaintingOrErasing, setHoveredCellWhilePaintingOrErasing] = useState<Point | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingStartPoint, setDrawingStartPoint] = useState<Point | null>(null);

  const [isCreatingText, setIsCreatingTextInternal] = useState<{ id: string; x: number; y: number; currentText: string; fontSize: number; inputWidth: number; } | null>(null);
  const [draggingTextObjectId, setDraggingTextObjectId] = useState<string | null>(null);
  const [textObjectDragOffset, setTextObjectDragOffset] = useState<Point | null>(null);
  const [lastTextClickInfo, setLastTextClickInfo] = useState<{ id: string | null; time: number }>({ id: null, time: 0 });
  
  const [potentialDraggingShapeInfo, setPotentialDraggingShapeInfo] = useState<{ id: string; type: DrawnShape['type']; startScreenPos: Point; originalStartPoint: Point; originalEndPoint: Point; } | null>(null);
  const [isActuallyDraggingShape, setIsActuallyDraggingShape] = useState(false);
  const [currentDraggingShapeId, setCurrentDraggingShapeId] = useState<string | null>(null);
  const [shapeDragOffset, setShapeDragOffset] = useState<Point | null>(null);
  
  const [ghostToken, setGhostToken] = useState<Token | null>(null);
  const [movementMeasureLine, setMovementMeasureLine] = useState<{ startSvgCenter: Point; currentSvgCenter: Point; distanceText: string; } | null>(null);

  const [isMarqueeSelecting, setIsMarqueeSelectingInternal] = useState(false);
  const [marqueeStartPoint, setMarqueeStartPointInternal] = useState<Point | null>(null);
  const [marqueeEndPoint, setMarqueeEndPointInternal] = useState<Point | null>(null);

  const setIsMarqueeSelecting = useCallback((val: boolean) => setIsMarqueeSelectingInternal(val), [setIsMarqueeSelectingInternal]);
  const setMarqueeStartPoint = useCallback((val: Point | null) => setMarqueeStartPointInternal(val), [setMarqueeStartPointInternal]);
  const setMarqueeEndPoint = useCallback((val: Point | null) => setMarqueeEndPointInternal(val), [setMarqueeEndPointInternal]);
  const setIsCreatingText = useCallback((val: any) => setIsCreatingTextInternal(val), [setIsCreatingTextInternal]);


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
    setIsCreatingTextInternal(null);
  }, [isCreatingText, setTextObjects, setIsCreatingTextInternal]);

  const handleFinalizeTextEdit = useCallback(() => {
    if (editingTextObjectId) {
        const textObject = textObjects.find(to => to.id === editingTextObjectId);
        if (textObject) {
            const content = (document.getElementById(`text-edit-input-${editingTextObjectId}`) as HTMLInputElement)?.value || textObject.content;
            if (content.trim() !== '') {
                const { width: newTextContentWidth, height: newTextContentHeight } = measureText(content, textObject.fontSize);
                const newBubbleWidth = newTextContentWidth + TEXT_PADDING.x * 2;
                const newBubbleHeight = newTextContentHeight + TEXT_PADDING.y * 2;
                setTextObjects(prev => prev.map(to =>
                    to.id === editingTextObjectId ? { ...to, content, width: newBubbleWidth, height: newBubbleHeight } : to
                ));
            } else {
                 setTextObjects(prev => prev.filter(to => to.id !== editingTextObjectId));
            }
        }
    }
    setEditingTextObjectId(null);
  }, [editingTextObjectId, textObjects, setTextObjects]);

  const eraseContentAtCell = useCallback((gridX: number, gridY: number) => {
    setGridCells(prev => {
      const newCells = prev.map(row => row.map(cell => ({ ...cell })));
      if (newCells[gridY] && newCells[gridY][gridX]) {
        newCells[gridY][gridX].color = undefined;
      }
      return newCells;
    });

    const tokensToBeErasedByThisCellAction: string[] = [];
    tokens.forEach(token => { 
        const tokenSize = token.size || 1;
        if (gridX >= token.x && gridX < token.x + tokenSize && gridY >= token.y && gridY < token.y + tokenSize) {
            tokensToBeErasedByThisCellAction.push(token.id);
        }
    });

    if (onTokenErasedOnGrid && tokensToBeErasedByThisCellAction.length > 0) {
        tokensToBeErasedByThisCellAction.forEach(id => onTokenErasedOnGrid(id));
    }
    
    setTokens(prevTokens => prevTokens.filter(token => {
        const tokenSize = token.size || 1;
        return !(gridX >= token.x && gridX < token.x + tokenSize && gridY >= token.y && gridY < token.y + tokenSize);
    }));

    const cellCenterX = gridX * cellSize + cellSize / 2;
    const cellCenterY = gridY * cellSize + cellSize / 2;

    setDrawnShapes(prevShapes =>
      prevShapes.filter(shape => {
        if (shape.type === 'line') {
          return distanceToLineSegment(cellCenterX, cellCenterY, shape.startPoint.x, shape.startPoint.y, shape.endPoint.x, shape.endPoint.y) > (shape.strokeWidth / 2 + SHAPE_CLICK_THRESHOLD / 2);
        } else if (shape.type === 'circle') {
          return !isPointInCircle({x: cellCenterX, y: cellCenterY}, shape.startPoint, Math.sqrt(dist2(shape.startPoint, shape.endPoint)));
        } else if (shape.type === 'rectangle') {
          return !isPointInRectangle({x: cellCenterX, y: cellCenterY}, Math.min(shape.startPoint.x, shape.endPoint.x), Math.min(shape.startPoint.y, shape.endPoint.y), Math.abs(shape.endPoint.x - shape.startPoint.x), Math.abs(shape.endPoint.y - shape.startPoint.y));
        }
        return true; 
      })
    );
    setTextObjects(prev => prev.filter(obj => !(cellCenterX >= obj.x && cellCenterX <= obj.x + obj.width && cellCenterY >= obj.y && cellCenterY <= obj.y + obj.height)));
  }, [setGridCells, tokens, setTokens, setDrawnShapes, setTextObjects, cellSize, onTokenErasedOnGrid]);

  const handleGridMouseDown = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (editingTokenId || editingTextObjectId || editingShapeId) return;
    const pos = getMousePosition(event);
    const gridX = Math.floor(pos.x / cellSize);
    const gridY = Math.floor(pos.y / cellSize);

    setMouseDownPos(pos);
    if (rightClickPopoverState) setRightClickPopoverState(null);

    if (activeTool === 'select') {
      if (event.button === 0) { // LEFT CLICK for select tool
        let itemClicked = false;
        const clickedToken = tokens.find(token => {
          const tokenActualSize = (token.size || 1);
          return pos.x >= token.x * cellSize && pos.x <= (token.x + tokenActualSize) * cellSize &&
                 pos.y >= token.y * cellSize && pos.y <= (token.y + tokenActualSize) * cellSize;
        });
        if (clickedToken) {
          event.stopPropagation();
          setSelectedTokenIds([clickedToken.id]);
          setSelectedShapeIds([]);
          setSelectedTextObjectIds([]);
          setDraggingToken(clickedToken);
          setDragOffset({ x: pos.x - clickedToken.x * cellSize, y: pos.y - clickedToken.y * cellSize });
          setDraggedTokenVisualPosition({ x: clickedToken.x * cellSize, y: clickedToken.y * cellSize });
          setDraggingTokenGridPosition({ x: clickedToken.x, y: clickedToken.y });
          if (['player', 'enemy', 'ally'].includes(clickedToken.type)) {
            setGhostToken({ ...clickedToken });
            const tokenActualSize = clickedToken.size || 1;
            const startSvgCenterX = clickedToken.x * cellSize + (tokenActualSize * cellSize) / 2;
            const startSvgCenterY = clickedToken.y * cellSize + (tokenActualSize * cellSize) / 2;
            setMovementMeasureLine({ startSvgCenter: { x: startSvgCenterX, y: startSvgCenterY }, currentSvgCenter: { x: startSvgCenterX, y: startSvgCenterY }, distanceText: '0 ft' });
          }
          itemClicked = true;
        } else {
          const clickedTextObject = textObjects.find(obj => isPointInRectangle(pos, obj.x, obj.y, obj.width, obj.height));
          if (clickedTextObject) {
            event.stopPropagation();
            setSelectedTextObjectIds([clickedTextObject.id]);
            setSelectedTokenIds([]);
            setSelectedShapeIds([]);
            setDraggingTextObjectId(clickedTextObject.id);
            setTextObjectDragOffset({ x: pos.x - clickedTextObject.x, y: pos.y - clickedTextObject.y });
            itemClicked = true;
          } else {
            for (let i = drawnShapes.length - 1; i >= 0; i--) {
              const shape = drawnShapes[i];
              let hit = false;
              if (shape.type === 'line') hit = distanceToLineSegment(pos.x, pos.y, shape.startPoint.x, shape.startPoint.y, shape.endPoint.x, shape.endPoint.y) <= SHAPE_CLICK_THRESHOLD;
              else if (shape.type === 'circle') hit = isPointInCircle(pos, shape.startPoint, Math.sqrt(dist2(shape.startPoint, shape.endPoint)));
              else if (shape.type === 'rectangle') hit = isPointInRectangle(pos, Math.min(shape.startPoint.x, shape.endPoint.x), Math.min(shape.startPoint.y, shape.endPoint.y), Math.abs(shape.endPoint.x - shape.startPoint.x), Math.abs(shape.endPoint.y - shape.startPoint.y));
              
              if (hit) {
                event.stopPropagation();
                setSelectedShapeIds([shape.id]);
                setSelectedTokenIds([]);
                setSelectedTextObjectIds([]);
                if ((shape.type === 'circle' || shape.type === 'rectangle') && !shape.isLocked) {
                  setPotentialDraggingShapeInfo({ id: shape.id, type: shape.type, startScreenPos: { x: event.clientX, y: event.clientY }, originalStartPoint: shape.startPoint, originalEndPoint: shape.endPoint });
                }
                itemClicked = true;
                break;
              }
            }
          }
        }
        
        if (!itemClicked) { // Clicked on empty space, start marquee selection
          setIsMarqueeSelectingInternal(true);
          setMarqueeStartPointInternal(pos);
          setMarqueeEndPointInternal(pos); // Initialize end point same as start
          setSelectedTokenIds([]); 
          setSelectedShapeIds([]);
          setSelectedTextObjectIds([]);
        }
        return;

      } else if (event.button === 2) { // RIGHT CLICK for select tool (PAN)
        event.preventDefault();
        panZoomHandlePanStart(event);
        return;
      }
    }


    if (activeTool === 'type_tool') {
        event.stopPropagation(); 
        if (isCreatingText) finalizeTextCreation(); 
        if (editingTextObjectId) handleFinalizeTextEdit(); 

        const clickedTextObjectForInteraction = textObjects.find(obj => isPointInRectangle(pos, obj.x, obj.y, obj.width, obj.height));
        
        if (clickedTextObjectForInteraction) {
            setSelectedTextObjectIds([clickedTextObjectForInteraction.id]); 
            setSelectedTokenIds([]); setSelectedShapeIds([]);
            const currentTime = Date.now();
            if (clickedTextObjectForInteraction.id === lastTextClickInfo.id && currentTime - lastTextClickInfo.time < DOUBLE_CLICK_THRESHOLD_MS) {
                setEditingTextObjectId(clickedTextObjectForInteraction.id);
                setLastTextClickInfo({ id: null, time: 0 }); 
            } else {
                setLastTextClickInfo({ id: clickedTextObjectForInteraction.id, time: currentTime });
            }
            return; 
        } else {
            setLastTextClickInfo({ id: null, time: 0 }); 
            setSelectedTokenIds([]); setSelectedShapeIds([]); setSelectedTextObjectIds([]);
            setTimeout(() => { 
                if (activeTool === 'type_tool' && !editingTextObjectId && !isCreatingText) {
                    const newPos = getMousePosition(event); 
                    setIsCreatingTextInternal({
                        id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                        x: newPos.x, y: newPos.y, currentText: '', fontSize: currentTextFontSize, inputWidth: MIN_NEW_TEXT_INPUT_WIDTH,
                    });
                }
            }, 0);
        }
        return;
    }

    if (event.button === 1 || (event.button === 0 && (event.ctrlKey || event.metaKey) )) {  // Middle click or Ctrl/Cmd + Left for pan (fallback)
         panZoomHandlePanStart(event);
         return;
    }
    
    if (gridX < 0 || gridX >= numCols || gridY < 0 || gridY >= numRows) return;
    
    switch (activeTool) {
      case 'paint_cell':
        setIsPainting(true);
        setHoveredCellWhilePaintingOrErasing({ x: gridX, y: gridY });
        const initialPendingCells = gridCells.map(row => row.map(cell => ({ ...cell })));
        if (initialPendingCells[gridY]?.[gridX]) initialPendingCells[gridY][gridX].color = selectedColor;
        setPendingGridCellsDuringPaint(initialPendingCells);
        break;
      case 'place_token':
        if (selectedTokenTemplate) {
          const tokenSize = selectedTokenTemplate.size || 1;
          const availableSquare = findAvailableSquare(gridX, gridY, tokenSize, tokens, numCols, numRows);
          if (availableSquare) {
            const baseLabel = selectedTokenTemplate.label || selectedTokenTemplate.type;
            const instanceNamePrefix = baseLabel || 'Token';
            const count = tokens.filter(t => (t.type === selectedTokenTemplate.type && t.label === baseLabel) || (t.customImageUrl && t.label === baseLabel)).length + 1;
            const instanceName = `${instanceNamePrefix} ${count}`;
            const newTokenData: Omit<Token, 'id'> = { ...selectedTokenTemplate, x: availableSquare.x, y: availableSquare.y, instanceName, size: tokenSize };
            setTokens(prev => [...prev, { ...newTokenData, id: `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }]);
          } else {
             toast({ title: "No Space Available", description: "Could not find an empty square to place the token.", variant: "destructive" });
          }
        }
        break;
      case 'measure_distance':
      case 'measure_radius':
        setIsMeasuring(true);
        setMeasurement({ startPoint: { x: gridX, y: gridY }, type: activeTool === 'measure_distance' ? 'distance' : 'radius', endPoint: { x: gridX, y: gridY }, result: undefined });
        break;
      case 'eraser_tool':
        setIsErasing(true);
        setHoveredCellWhilePaintingOrErasing({ x: gridX, y: gridY });
        eraseContentAtCell(gridX, gridY);
        break;
      case 'draw_line':
      case 'draw_circle':
      case 'draw_rectangle':
        {
          setIsDrawing(true);
          const isCircle = activeTool === 'draw_circle';
          const snapFn = isCircle ? snapToCellCenter : snapToVertex;
          const startP = snapFn(pos, cellSize);
          setDrawingStartPoint(startP);
          setCurrentDrawingShape({
            id: `shape-${Date.now()}`, type: isCircle ? 'circle' : (activeTool === 'draw_rectangle' ? 'rectangle' : 'line'),
            startPoint: startP, endPoint: startP, 
            color: selectedShapeDrawColor, // Use selected draw color
            fillColor: (isCircle || activeTool === 'draw_rectangle') ? selectedShapeDrawColor : undefined, // Use selected draw color
            strokeWidth: activeTool === 'draw_line' ? 2 : 1, 
            opacity: activeTool === 'draw_line' ? 1 : 0.5,
          });
        }
        break;
    }
  }, [
    activeTool, cellSize, tokens, textObjects, drawnShapes, gridCells, numCols, numRows,
    getMousePosition, editingTokenId, editingTextObjectId, editingShapeId,
    setTokens, setTextObjects, setDrawnShapes, setGridCells, setMeasurement, setCurrentDrawingShape,
    setSelectedTokenIds, setSelectedShapeIds, setSelectedTextObjectIds,
    isCreatingText, finalizeTextCreation, handleFinalizeTextEdit, lastTextClickInfo, currentTextFontSize,
    selectedColor, selectedShapeDrawColor, selectedTokenTemplate, toast, panZoomHandlePanStart, eraseContentAtCell,
    rightClickPopoverState, setRightClickPopoverState, setIsCreatingTextInternal,
    setIsMarqueeSelectingInternal, setMarqueeStartPointInternal, setMarqueeEndPointInternal
  ]);

  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePosition(event);

    if (isPanning) { 
      panZoomHandlePanMove(event);
      return;
    }
    if (isMarqueeSelecting) {
      setMarqueeEndPointInternal(pos);
      return;
    }

    if (draggingToken && dragOffset && activeTool === 'select' && !editingTokenId) {
      const tokenActualSize = draggingToken.size || 1;
      const rawVisualSvgX = pos.x - dragOffset.x;
      const rawVisualSvgY = pos.y - dragOffset.y;
      const snappedVisualSvgX = Math.round(rawVisualSvgX / cellSize) * cellSize;
      const snappedVisualSvgY = Math.round(rawVisualSvgY / cellSize) * cellSize;
      setDraggedTokenVisualPosition({ x: snappedVisualSvgX, y: snappedVisualSvgY });

      const potentialDropGridX = Math.floor((snappedVisualSvgX + cellSize / 2) / cellSize);
      const potentialDropGridY = Math.floor((snappedVisualSvgY + cellSize / 2) / cellSize);
      const clampedDropGridX = Math.max(0, Math.min(potentialDropGridX, numCols - tokenActualSize));
      const clampedDropGridY = Math.max(0, Math.min(potentialDropGridY, numRows - tokenActualSize));
      
      setDraggingTokenGridPosition(isSquareOccupied(clampedDropGridX, clampedDropGridY, tokenActualSize, tokens, numCols, numRows, draggingToken.id) ? null : { x: clampedDropGridX, y: clampedDropGridY });
      
      if (ghostToken && movementMeasureLine && ['player', 'enemy', 'ally'].includes(draggingToken.type)) {
        const currentTargetSvgCenterX = snappedVisualSvgX + (tokenActualSize * cellSize) / 2;
        const currentTargetSvgCenterY = snappedVisualSvgY + (tokenActualSize * cellSize) / 2;
        const dxSvg = currentTargetSvgCenterX - movementMeasureLine.startSvgCenter.x;
        const dySvg = currentTargetSvgCenterY - movementMeasureLine.startSvgCenter.y;
        const distInPixels = Math.sqrt(dxSvg * dxSvg + dySvg * dySvg);
        const distInFeet = (distInPixels / cellSize) * FEET_PER_SQUARE;
        setMovementMeasureLine(prev => ({ ...prev!, currentSvgCenter: { x: currentTargetSvgCenterX, y: currentTargetSvgCenterY }, distanceText: `${Math.round(distInFeet * 10) / 10} ft` }));
      }
    } else if (draggingTextObjectId && textObjectDragOffset && activeTool === 'select' && !editingTextObjectId) {
      setTextObjects(prev => prev.map(obj => obj.id === draggingTextObjectId ? { ...obj, x: pos.x - textObjectDragOffset.x, y: pos.y - textObjectDragOffset.y } : obj));
    } else if (potentialDraggingShapeInfo && mouseDownPos && activeTool === 'select' && !editingShapeId) {
        const dxScreen = event.clientX - potentialDraggingShapeInfo.startScreenPos.x;
        const dyScreen = event.clientY - potentialDraggingShapeInfo.startScreenPos.y;
        if (dxScreen * dxScreen + dyScreen * dyScreen > CLICK_THRESHOLD_SQUARED) { 
            const shapeToDrag = drawnShapes.find(s => s.id === potentialDraggingShapeInfo.id);
            if (shapeToDrag && !shapeToDrag.isLocked) {
                setIsActuallyDraggingShape(true);
                setCurrentDraggingShapeId(potentialDraggingShapeInfo.id);
                let initialShapeRefX = shapeToDrag.type === 'circle' ? shapeToDrag.startPoint.x : Math.min(shapeToDrag.startPoint.x, shapeToDrag.endPoint.x);
                let initialShapeRefY = shapeToDrag.type === 'circle' ? shapeToDrag.startPoint.y : Math.min(shapeToDrag.startPoint.y, shapeToDrag.endPoint.y);
                setShapeDragOffset({ x: mouseDownPos.x - initialShapeRefX, y: mouseDownPos.y - initialShapeRefY });
            }
            setPotentialDraggingShapeInfo(null); 
        }
    } else if (isActuallyDraggingShape && currentDraggingShapeId && shapeDragOffset && activeTool === 'select' && !editingShapeId) {
        const draggedShape = drawnShapes.find(s => s.id === currentDraggingShapeId);
        if (!draggedShape || draggedShape.isLocked) { setIsActuallyDraggingShape(false); setCurrentDraggingShapeId(null); setShapeDragOffset(null); return; }
        let rawNewRefPoint = { x: pos.x - shapeDragOffset.x, y: pos.y - shapeDragOffset.y };
        let snappedNewRefPoint, newStartPoint, newEndPoint;
        if (draggedShape.type === 'circle') {
            snappedNewRefPoint = snapToCellCenter(rawNewRefPoint, cellSize);
            const radiusVector = { x: draggedShape.endPoint.x - draggedShape.startPoint.x, y: draggedShape.endPoint.y - draggedShape.startPoint.y };
            newStartPoint = snappedNewRefPoint;
            newEndPoint = { x: newStartPoint.x + radiusVector.x, y: newStartPoint.y + radiusVector.y };
        } else if (draggedShape.type === 'rectangle') {
            snappedNewRefPoint = snapToVertex(rawNewRefPoint, cellSize);
            const width = Math.abs(draggedShape.startPoint.x - draggedShape.endPoint.x);
            const height = Math.abs(draggedShape.startPoint.y - draggedShape.endPoint.y);
            newStartPoint = snappedNewRefPoint;
            newEndPoint = { x: newStartPoint.x + width, y: newStartPoint.y + height };
        } else { return; }
        setDrawnShapes(prevShapes => prevShapes.map(s => s.id === currentDraggingShapeId ? { ...s, startPoint: newStartPoint!, endPoint: newEndPoint! } : s));
    } else if (isMeasuring && measurement.startPoint && (activeTool === 'measure_distance' || activeTool === 'measure_radius')) {
      const gridX = Math.floor(pos.x / cellSize);
      const gridY = Math.floor(pos.y / cellSize);
      const endPoint = { x: Math.max(0, Math.min(gridX, numCols - 1)), y: Math.max(0, Math.min(gridY, numRows - 1)) };
      const dxSquares = endPoint.x - measurement.startPoint.x;
      const dySquares = endPoint.y - measurement.startPoint.y;
      const distInSquares = Math.sqrt(dxSquares * dxSquares + dySquares * dySquares);
      const distInFeet = distInSquares * FEET_PER_SQUARE;
      setMeasurement(prev => ({ ...prev!, endPoint, result: `${measurement.type === 'distance' ? 'Distance' : 'Radius'}: ${Math.round(distInFeet * 10) / 10} ft` }));
    } else if (isErasing && activeTool === 'eraser_tool') {
        const gridX = Math.floor(pos.x / cellSize);
        const gridY = Math.floor(pos.y / cellSize);
        if (gridX >= 0 && gridX < numCols && gridY >= 0 && gridY < numRows) {
             setHoveredCellWhilePaintingOrErasing({ x: gridX, y: gridY });
             eraseContentAtCell(gridX, gridY);
        } else {
           setHoveredCellWhilePaintingOrErasing(null);
        }
    } else if (isPainting && activeTool === 'paint_cell' && pendingGridCellsDuringPaint) {
        const gridX = Math.floor(pos.x / cellSize);
        const gridY = Math.floor(pos.y / cellSize);
        if (gridX >= 0 && gridX < numCols && gridY >= 0 && gridY < numRows) {
            setHoveredCellWhilePaintingOrErasing({ x: gridX, y: gridY });
            if (pendingGridCellsDuringPaint[gridY]?.[gridX]?.color !== selectedColor) {
                const updatedPendingCells = pendingGridCellsDuringPaint.map((row, rIdx) => row.map((cell, cIdx) => (rIdx === gridY && cIdx === gridX) ? { ...cell, color: selectedColor } : cell));
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
      setHoveredCellWhilePaintingOrErasing((clampedGridX >= 0 && clampedGridX + tokenSize <= numCols && clampedGridY >= 0 && clampedGridY + tokenSize <= numRows) ? { x: clampedGridX, y: clampedGridY } : null);
    } else if (isDrawing && currentDrawingShape && drawingStartPoint) {
        if (currentDrawingShape.type === 'circle') {
            const pixelDist = Math.sqrt(dist2(drawingStartPoint, pos));
            const numCellsRadius = Math.max(1, Math.round(pixelDist / cellSize));
            const snappedPixelDist = numCellsRadius * cellSize;
            const vectorX = pos.x - drawingStartPoint.x;
            const vectorY = pos.y - drawingStartPoint.y;
            const currentLength = Math.sqrt(vectorX*vectorX + vectorY*vectorY);
            let unitX = 1, unitY = 0; 
            if (currentLength > 0) { unitX = vectorX / currentLength; unitY = vectorY / currentLength; }
            setCurrentDrawingShape(prev => prev ? { ...prev, endPoint: { x: drawingStartPoint.x + unitX * snappedPixelDist, y: drawingStartPoint.y + unitY * snappedPixelDist } } : null);
        } else {
            setCurrentDrawingShape(prev => prev ? { ...prev, endPoint: (currentDrawingShape.type === 'rectangle' ? snapToVertex(pos, cellSize) : pos) } : null);
        }
    } else {
        setHoveredCellWhilePaintingOrErasing(null);
    }
  }, [
    isPanning, panZoomHandlePanMove, getMousePosition, draggingToken, dragOffset, activeTool, editingTokenId, editingTextObjectId, editingShapeId,
    cellSize, numCols, numRows, tokens, drawnShapes,
    setTextObjects, textObjectDragOffset,
    potentialDraggingShapeInfo, mouseDownPos, isActuallyDraggingShape, currentDraggingShapeId, shapeDragOffset,
    setDrawnShapes, ghostToken, movementMeasureLine,
    isMeasuring, measurement, setMeasurement,
    isErasing, eraseContentAtCell, isPainting, pendingGridCellsDuringPaint, setPendingGridCellsDuringPaint, selectedColor,
    selectedTokenTemplate, isDrawing, currentDrawingShape, drawingStartPoint, setCurrentDrawingShape,
    isMarqueeSelecting, setMarqueeEndPointInternal
  ]);

  const handleMouseUp = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    const wasPanningOnMouseDown = isPanning; 

    if (event.button === 0) { 
      if (isMarqueeSelecting && marqueeStartPoint && marqueeEndPoint) {
        const newSelectedTokenIds: string[] = [];
        const newSelectedShapeIds: string[] = [];
        const newSelectedTextObjectIds: string[] = [];

        const marqueeRectSvg = {
            x: Math.min(marqueeStartPoint.x, marqueeEndPoint.x),
            y: Math.min(marqueeStartPoint.y, marqueeEndPoint.y),
            width: Math.abs(marqueeStartPoint.x - marqueeEndPoint.x),
            height: Math.abs(marqueeStartPoint.y - marqueeEndPoint.y),
        };

        tokens.forEach(token => {
            const tokenActualSize = token.size || 1;
            const tokenRect = {
                x: token.x * cellSize,
                y: token.y * cellSize,
                width: tokenActualSize * cellSize,
                height: tokenActualSize * cellSize,
            };
            if (rectsIntersect(marqueeRectSvg, tokenRect)) {
                newSelectedTokenIds.push(token.id);
            }
        });
        drawnShapes.forEach(shape => {
            let shapeIntersects = false;
            if (shape.type === 'line') {
                if (isPointInRectangle(shape.startPoint, marqueeRectSvg.x, marqueeRectSvg.y, marqueeRectSvg.width, marqueeRectSvg.height) ||
                    isPointInRectangle(shape.endPoint, marqueeRectSvg.x, marqueeRectSvg.y, marqueeRectSvg.width, marqueeRectSvg.height)) {
                    shapeIntersects = true;
                }
            } else if (shape.type === 'circle') {
                const circle = { x: shape.startPoint.x, y: shape.startPoint.y, r: Math.sqrt(dist2(shape.startPoint, shape.endPoint)) };
                if (isPointInCircle({ x: marqueeRectSvg.x + marqueeRectSvg.width / 2, y: marqueeRectSvg.y + marqueeRectSvg.height / 2 }, circle, circle.r) ||
                    isPointInRectangle(circle, marqueeRectSvg.x, marqueeRectSvg.y, marqueeRectSvg.width, marqueeRectSvg.height)) {
                     shapeIntersects = true;   
                }
            } else if (shape.type === 'rectangle') {
                const drawnShapeRect = {
                    x: Math.min(shape.startPoint.x, shape.endPoint.x),
                    y: Math.min(shape.startPoint.y, shape.endPoint.y),
                    width: Math.abs(shape.startPoint.x - shape.endPoint.x),
                    height: Math.abs(shape.startPoint.y - shape.endPoint.y),
                };
                if (rectsIntersect(marqueeRectSvg, drawnShapeRect)) {
                    shapeIntersects = true;
                }
            }
            if (shapeIntersects) newSelectedShapeIds.push(shape.id);
        });
        textObjects.forEach(obj => {
            const textRect = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
            if (rectsIntersect(marqueeRectSvg, textRect)) {
                newSelectedTextObjectIds.push(obj.id);
            }
        });
        setSelectedTokenIds(newSelectedTokenIds);
        setSelectedShapeIds(newSelectedShapeIds);
        setSelectedTextObjectIds(newSelectedTextObjectIds);

        setIsMarqueeSelectingInternal(false);
        setMarqueeStartPointInternal(null);
        setMarqueeEndPointInternal(null);
      }
    }

    if (draggingToken && activeTool === 'select' && !editingTokenId) {
      if (draggingTokenGridPosition && onTokenMove) {
        onTokenMove(draggingToken.id, draggingTokenGridPosition.x, draggingTokenGridPosition.y);
      }
      setDraggingToken(null); setDragOffset(null); setDraggingTokenGridPosition(null); setDraggedTokenVisualPosition(null);
      setGhostToken(null); setMovementMeasureLine(null);
    }
    if (draggingTextObjectId && activeTool === 'select' && !editingTextObjectId) {
      setDraggingTextObjectId(null); setTextObjectDragOffset(null);
    }
    setPotentialDraggingShapeInfo(null); setIsActuallyDraggingShape(false); setCurrentDraggingShapeId(null); setShapeDragOffset(null);
    
    if (isMeasuring) setIsMeasuring(false);
    if (isErasing) { setIsErasing(false); setHoveredCellWhilePaintingOrErasing(null); }
    if (isPainting) {
      if (activeTool === 'paint_cell' && pendingGridCellsDuringPaint) {
        setGridCells(pendingGridCellsDuringPaint); setPendingGridCellsDuringPaint(null);
      }
      setIsPainting(false); setHoveredCellWhilePaintingOrErasing(null);
    }
    if (isDrawing && currentDrawingShape) {
      let shapeToAdd = { ...currentDrawingShape };
      const minSizeThreshold = cellSize * 0.5;
      if (shapeToAdd.type === 'circle') {
        if (Math.sqrt(dist2(shapeToAdd.startPoint, shapeToAdd.endPoint)) < minSizeThreshold) { setCurrentDrawingShape(null); setIsDrawing(false); setDrawingStartPoint(null); return; }
        shapeToAdd.label = `Circle ${drawnShapes.filter(s => s.type === 'circle').length + 1}`;
      } else if (shapeToAdd.type === 'rectangle') {
        if (Math.abs(shapeToAdd.startPoint.x - shapeToAdd.endPoint.x) < minSizeThreshold || Math.abs(shapeToAdd.startPoint.y - shapeToAdd.endPoint.y) < minSizeThreshold) { setCurrentDrawingShape(null); setIsDrawing(false); setDrawingStartPoint(null); return; }
        shapeToAdd.label = `Rectangle ${drawnShapes.filter(s => s.type === 'rectangle').length + 1}`;
      } else if (shapeToAdd.type === 'line') {
        if (dist2(shapeToAdd.startPoint, shapeToAdd.endPoint) < minSizeThreshold * minSizeThreshold) { setCurrentDrawingShape(null); setIsDrawing(false); setDrawingStartPoint(null); return;}
        // No default label for line
      }
      setDrawnShapes(prev => [...prev, shapeToAdd]);
      setCurrentDrawingShape(null); setIsDrawing(false); setDrawingStartPoint(null);
    }

    if (wasPanningOnMouseDown) { 
      panZoomHandlePanEnd();
    }
    setMouseDownPos(null);
  }, [
    isPanning, panZoomHandlePanEnd, 
    draggingToken, activeTool, editingTokenId, editingTextObjectId, draggingTokenGridPosition, onTokenMove,
    draggingTextObjectId, isMeasuring, isErasing, isPainting, pendingGridCellsDuringPaint, setGridCells,
    isDrawing, currentDrawingShape, setDrawnShapes, drawnShapes, cellSize, setCurrentDrawingShape,
    isMarqueeSelecting, marqueeStartPoint, marqueeEndPoint,
    tokens, textObjects,
    setSelectedTokenIds, setSelectedShapeIds, setSelectedTextObjectIds,
    setIsMarqueeSelectingInternal, setMarqueeStartPointInternal, setMarqueeEndPointInternal
  ]);

  const handleMouseLeave = useCallback(() => {
    if (isPanning) {
      panZoomHandlePanEnd();
    }
    if (draggingToken && draggingTokenGridPosition && onTokenMove) {
      onTokenMove(draggingToken.id, draggingTokenGridPosition.x, draggingTokenGridPosition.y);
    }
    setDraggingToken(null); setDragOffset(null); setDraggingTokenGridPosition(null); setDraggedTokenVisualPosition(null);
    setGhostToken(null); setMovementMeasureLine(null);
    setDraggingTextObjectId(null); setTextObjectDragOffset(null);
    setIsActuallyDraggingShape(false); setCurrentDraggingShapeId(null); setShapeDragOffset(null);
    setPotentialDraggingShapeInfo(null);

    if (isPainting && activeTool === 'paint_cell' && pendingGridCellsDuringPaint) {
      setGridCells(pendingGridCellsDuringPaint); setPendingGridCellsDuringPaint(null);
    }
    setIsPainting(false); setIsErasing(false); setHoveredCellWhilePaintingOrErasing(null);

    if (isDrawing && currentDrawingShape) { 
      let shapeToAdd = { ...currentDrawingShape };
      const minSizeThreshold = cellSize * 0.5;
      if (shapeToAdd.type === 'circle') {
        if (Math.sqrt(dist2(shapeToAdd.startPoint, shapeToAdd.endPoint)) < minSizeThreshold) { setCurrentDrawingShape(null); setIsDrawing(false); setDrawingStartPoint(null); return; }
        shapeToAdd.label = `Circle ${drawnShapes.filter(s => s.type === 'circle').length + 1}`;
      } else if (shapeToAdd.type === 'rectangle') {
        if (Math.abs(shapeToAdd.startPoint.x - shapeToAdd.endPoint.x) < minSizeThreshold || Math.abs(shapeToAdd.startPoint.y - shapeToAdd.endPoint.y) < minSizeThreshold) { setCurrentDrawingShape(null); setIsDrawing(false); setDrawingStartPoint(null); return; }
        shapeToAdd.label = `Rectangle ${drawnShapes.filter(s => s.type === 'rectangle').length + 1}`;
      } else if (shapeToAdd.type === 'line') {
        if (dist2(shapeToAdd.startPoint, shapeToAdd.endPoint) < minSizeThreshold * minSizeThreshold) { setCurrentDrawingShape(null); setIsDrawing(false); setDrawingStartPoint(null); return;}
      }
      setDrawnShapes(prev => [...prev, shapeToAdd]);
      setCurrentDrawingShape(null); setIsDrawing(false); setDrawingStartPoint(null);
    }
    if (isMarqueeSelecting) {
        setIsMarqueeSelectingInternal(false);
        setMarqueeStartPointInternal(null);
        setMarqueeEndPointInternal(null);
    }
  }, [
    isPanning, panZoomHandlePanEnd, 
    draggingToken, draggingTokenGridPosition, onTokenMove, activeTool, pendingGridCellsDuringPaint, 
    setGridCells, isDrawing, currentDrawingShape, setCurrentDrawingShape, setDrawnShapes, drawnShapes, cellSize,
    isMarqueeSelecting, setIsMarqueeSelectingInternal, setMarqueeStartPointInternal, setMarqueeEndPointInternal
  ]);

  useEffect(() => {
    if (activeTool !== 'select') {
        if (editingTokenId) setEditingTokenId(null); 
        if (editingTextObjectId) handleFinalizeTextEdit();
        if (editingShapeId) setEditingShapeId(null); 
        setSelectedTokenIds([]); setSelectedShapeIds([]); setSelectedTextObjectIds([]);
        if (rightClickPopoverState) setRightClickPopoverState(null);
        if (isMarqueeSelecting) {
            setIsMarqueeSelectingInternal(false);
            setMarqueeStartPointInternal(null);
            setMarqueeEndPointInternal(null);
        }
    }
    if (activeTool !== 'type_tool') {
        if (isCreatingText) finalizeTextCreation();
    }
    setDraggingToken(null); setDragOffset(null); setDraggingTokenGridPosition(null); setDraggedTokenVisualPosition(null);
    setGhostToken(null); setMovementMeasureLine(null);
    setIsMeasuring(false);
    setIsErasing(false); setIsPainting(false); setPendingGridCellsDuringPaint(null); setHoveredCellWhilePaintingOrErasing(null);
    setIsDrawing(false); setDrawingStartPoint(null); if (activeTool !== 'draw_line' && activeTool !== 'draw_circle' && activeTool !== 'draw_rectangle') setCurrentDrawingShape(null);
    setDraggingTextObjectId(null); setTextObjectDragOffset(null);
    setPotentialDraggingShapeInfo(null); setIsActuallyDraggingShape(false); setCurrentDraggingShapeId(null); setShapeDragOffset(null);

  }, [activeTool, finalizeTextCreation, handleFinalizeTextEdit, isCreatingText, editingTokenId, editingTextObjectId, editingShapeId, 
      setEditingTokenId, setEditingShapeId, setSelectedTokenIds, setSelectedShapeIds, setSelectedTextObjectIds, 
      setCurrentDrawingShape, rightClickPopoverState, setRightClickPopoverState,
      isMarqueeSelecting, setIsMarqueeSelectingInternal, setMarqueeStartPointInternal, setMarqueeEndPointInternal]);

  return {
    handleGridMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    draggingToken, draggedTokenVisualPosition, 
    ghostToken, movementMeasureLine, 
    isPainting, pendingGridCellsDuringPaint, hoveredCellWhilePaintingOrErasing, 
    isDrawing, 
    isCreatingText, setIsCreatingText, 
    finalizeTextCreation, 
    handleFinalizeTextEdit, 
    isActuallyDraggingShape, draggingTextObjectId,
    isMarqueeSelecting: isMarqueeSelecting, 
    setIsMarqueeSelecting, 
    marqueeStartPoint: marqueeStartPoint,   
    setMarqueeStartPoint, 
    marqueeEndPoint: marqueeEndPoint,     
    setMarqueeEndPoint,   
    currentDraggingShapeId, // Expose currentDraggingShapeId
  };
}
