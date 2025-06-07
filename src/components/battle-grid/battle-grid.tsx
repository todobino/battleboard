
'use client';

import type { BattleGridProps, Point, Token as TokenType, DrawnShape, TextObjectType, Participant, Measurement, ActiveTool } from '@/types';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { usePanZoom } from '@/hooks/usePanZoom';
import { useGridInteractions } from '@/hooks/useGridInteractions';
import { useEscapeKey } from '@/hooks/useEscapeKey';

import GridCellsLayer from './grid-cells-layer';
import ShapesLayer from './shapes-layer';
import TokensLayer from './tokens-layer';
import TextObjectsLayer from './text-objects-layer';
import MeasurementOverlay from './measurement-overlay';
import RightClickMenu from './right-click-menu';
import BattleGridDefs from './battle-grid-defs'; 
import GridToolbar from './grid-toolbar';       
import { dist2, isPointInCircle, isPointInRectangle, distanceToLineSegment } from '@/lib/geometry-utils';


const DEFAULT_CELL_SIZE = 30;
const PAN_TO_TOKEN_DURATION = 300; 

export default function BattleGrid({
  gridCells, setGridCells,
  tokens, setTokens,
  drawnShapes, setDrawnShapes,
  currentDrawingShape, setCurrentDrawingShape, 
  textObjects, setTextObjects,
  showGridLines, setShowGridLines,
  showAllLabels, setShowAllLabels,
  backgroundImageUrl, backgroundZoomLevel = 1,
  activeTool, setActiveTool,
  onTokenMove, onTokenInstanceNameChange, onChangeTokenSize,
  selectedColor, selectedTokenTemplate,
  measurement, setMeasurement,
  activeTurnTokenId, currentTextFontSize,
  onTokenDelete, onTokenErasedOnGrid, onTokenImageChangeRequest,
  selectedTokenIds, setSelectedTokenIds,
  selectedShapeIds, setSelectedShapeIds,
  selectedTextObjectIds, setSelectedTextObjectIds,
  tokenIdToFocus, onFocusHandled,
  onOpenAddCombatantDialogForToken,
  onOpenEditStatsDialogForToken,
  participants, 
  toast, 
}: BattleGridProps & { toast: any }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const numRows = gridCells.length;
  const numCols = gridCells.length > 0 ? gridCells[0].length : 0;
  const cellSize = DEFAULT_CELL_SIZE;

  const escapePressCount = useEscapeKey();

  const {
    viewBox, setViewBox, isPanning, panStart, getMousePosition, applyZoom,
    handleWheel, handlePanStart, handlePanMove, handlePanEnd, handleResetView,
    calculateInitialViewBox,
  } = usePanZoom({ svgRef, numCols, numRows, cellSize, showGridLines });

  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [editingTextObjectId, setEditingTextObjectId] = useState<string | null>(null);
  const [editingTextObjectContent, setEditingTextObjectContent] = useState<string>('');
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [editingShapeLabelText, setEditingShapeLabelText] = useState<string>('');

  const [rightClickPopoverState, setRightClickPopoverState] = useState<{
    type: 'token' | 'shape' | 'text';
    item: TokenType | DrawnShape | TextObjectType;
    x: number; y: number;
  } | null>(null);
  const rightClickPopoverTriggerRef = useRef<HTMLButtonElement>(null);
  const [shapeRadiusInput, setShapeRadiusInput] = useState<string>(''); 


  const interactions = useGridInteractions({
    svgRef, getMousePosition, cellSize, numRows, numCols, activeTool, selectedColor, selectedTokenTemplate, currentTextFontSize,
    tokens, setTokens, gridCells, setGridCells, drawnShapes, setDrawnShapes, textObjects, setTextObjects,
    measurement, setMeasurement, currentDrawingShape, setCurrentDrawingShape,
    onTokenMove, onTokenErasedOnGrid,
    editingTokenId, setEditingTokenId, editingTextObjectId, setEditingTextObjectId, editingShapeId, setEditingShapeId,
    selectedTokenIds, setSelectedTokenIds, selectedShapeIds, setSelectedShapeIds, selectedTextObjectIds, setSelectedTextObjectIds,
    isPanning, 
    panZoomHandlePanStart: handlePanStart, 
    panZoomHandlePanMove: handlePanMove,
    panZoomHandlePanEnd: handlePanEnd,
    toast,
    rightClickPopoverState, setRightClickPopoverState, shapeRadiusInput, setShapeRadiusInput
  });

  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);
  const [hoveredTextObjectId, setHoveredTextObjectId] = useState<string | null>(null);

  const handleSaveTokenName = useCallback(() => {
    if (editingTokenId && onTokenInstanceNameChange) {
      onTokenInstanceNameChange(editingTokenId, editingText);
    }
    setEditingTokenId(null); setEditingText('');
  }, [editingTokenId, editingText, onTokenInstanceNameChange]);

  const handleEditInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSaveTokenName();
    else if (event.key === 'Escape') { setEditingTokenId(null); setEditingText(''); }
  };
  
  const handleTokenLabelClick = (event: React.MouseEvent, token: TokenType) => {
    event.stopPropagation();
    if (activeTool === 'select' && !interactions.draggingToken && !rightClickPopoverState) {
      setSelectedTokenIds([token.id]);
      setSelectedShapeIds([]);
      setSelectedTextObjectIds([]);
      setEditingTokenId(token.id);
      setEditingText(token.instanceName || '');
    }
  };

  const handleSaveShapeLabel = useCallback(() => {
    if (editingShapeId) {
      setDrawnShapes(prevShapes =>
        prevShapes.map(s => s.id === editingShapeId ? { ...s, label: editingShapeLabelText.trim() || undefined } : s)
      );
    }
    setEditingShapeId(null); setEditingShapeLabelText('');
  }, [editingShapeId, editingShapeLabelText, setDrawnShapes]);

  const handleShapeLabelInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSaveShapeLabel();
    else if (event.key === 'Escape') { setEditingShapeId(null); setEditingShapeLabelText(''); }
  };

  const handleShapeLabelClick = (event: React.MouseEvent, shape: DrawnShape) => {
    event.stopPropagation();
    if (activeTool === 'select' && !rightClickPopoverState && !interactions.isActuallyDraggingShape) {
      setSelectedShapeIds([shape.id]);
      setSelectedTokenIds([]);
      setSelectedTextObjectIds([]);
      setEditingShapeId(shape.id);
      setEditingShapeLabelText(shape.label || '');
    }
  };
  
  const handleTextEditInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); interactions.handleFinalizeTextEdit(); }
    else if (event.key === 'Escape') { setEditingTextObjectId(null); setEditingTextObjectContent(''); }
  };

  const handleTextInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); interactions.finalizeTextCreation(); }
    else if (event.key === 'Escape') { interactions.setIsCreatingText(null); }
  };


  const handleContextMenu = (event: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'select' && isPanning) { // If panning was initiated by right-click, don't show menu
      event.preventDefault();
      return;
    }
    event.preventDefault();
    if (editingTokenId || editingShapeId || editingTextObjectId) return;

    const pos = getMousePosition(event);

    const rClickedToken = tokens.find(token => {
        const tokenActualSize = (token.size || 1);
        return pos.x >= token.x * cellSize && pos.x <= (token.x + tokenActualSize) * cellSize &&
               pos.y >= token.y * cellSize && pos.y <= (token.y + tokenActualSize) * cellSize;
    });
    if (rClickedToken) {
        setSelectedTokenIds([rClickedToken.id]); setSelectedShapeIds([]); setSelectedTextObjectIds([]);
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
        if (shape.type === 'line') hit = distanceToLineSegment(pos.x, pos.y, shape.startPoint.x, shape.startPoint.y, shape.endPoint.x, shape.endPoint.y) <= 8;
        else if (shape.type === 'circle') hit = isPointInCircle(pos, shape.startPoint, Math.sqrt(dist2(shape.startPoint, shape.endPoint)));
        else if (shape.type === 'rectangle') hit = isPointInRectangle(pos, Math.min(shape.startPoint.x, shape.endPoint.x), Math.min(shape.startPoint.y, shape.endPoint.y), Math.abs(shape.endPoint.x - shape.startPoint.x), Math.abs(shape.endPoint.y - shape.startPoint.y));
        
        if (hit) {
            setSelectedShapeIds([shape.id]); setSelectedTokenIds([]); setSelectedTextObjectIds([]);
            setRightClickPopoverState({ type: 'shape', item: shape, x: event.clientX, y: event.clientY });
             if (shape.type === 'circle') { 
                const pixelRadius = Math.sqrt(dist2(shape.startPoint, shape.endPoint));
                const radiusInFeet = (pixelRadius / cellSize) * 5; 
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
        setSelectedTextObjectIds([rClickedTextObject.id]); setSelectedTokenIds([]); setSelectedShapeIds([]);
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

  useEffect(() => {
    if (escapePressCount > 0) {
      setRightClickPopoverState(null);
      setEditingTokenId(null);
      setEditingShapeId(null);
      setEditingTextObjectId(null);
      if(interactions.isCreatingText) interactions.finalizeTextCreation(); 
      setHoveredTextObjectId(null); 
      // Clear marquee selection on escape
      if (interactions.isMarqueeSelecting) {
        interactions.setIsMarqueeSelecting(false);
        interactions.setMarqueeStartPoint(null);
        interactions.setMarqueeEndPoint(null);
      }
    }
  }, [escapePressCount, interactions]);

  const animationFrameId = useRef<number | null>(null);
  useEffect(() => {
    if (tokenIdToFocus && svgRef.current) {
      const token = tokens.find(t => t.id === tokenIdToFocus);
      if (token) {
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        const [currentVx, currentVy, currentVw, currentVh] = viewBox.split(' ').map(Number);
        const tokenActualSize = token.size || 1;
        const tokenSvgX = token.x * cellSize + tokenActualSize * cellSize / 2;
        const tokenSvgY = token.y * cellSize + tokenActualSize * cellSize / 2;
        let targetVx = tokenSvgX - currentVw / 2;
        let targetVy = tokenSvgY - currentVh / 2;

        const currentBorderWidth = showGridLines ? 1 : 0;
        const svgPadding = currentBorderWidth / 2;
        const absContentMinX = 0 - svgPadding;
        const absContentMinY = 0 - svgPadding;
        const absContentWidth = numCols * cellSize + currentBorderWidth;
        const absContentHeight = numRows * cellSize + currentBorderWidth;

        if (currentVw >= absContentWidth) targetVx = absContentMinX + (absContentWidth - currentVw) / 2;
        else targetVx = Math.max(absContentMinX, Math.min(targetVx, absContentMinX + absContentWidth - currentVw));
        if (currentVh >= absContentHeight) targetVy = absContentMinY + (absContentHeight - currentVh) / 2;
        else targetVy = Math.max(absContentMinY, Math.min(targetVy, absContentMinY + absContentHeight - currentVh));

        const startVB = { vx: currentVx, vy: currentVy, vw: currentVw, vh: currentVh };
        const targetVB = { vx: targetVx, vy: targetVy, vw: currentVw, vh: currentVh };
        let startTime: number | null = null;
        const animatePan = (timestamp: number) => {
          if (!startTime) startTime = timestamp;
          const progress = Math.min((timestamp - startTime) / PAN_TO_TOKEN_DURATION, 1);
          const easedProgress = 1 - Math.pow(1 - progress, 3);
          const nextVx = startVB.vx + (targetVB.vx - startVB.vx) * easedProgress;
          const nextVy = startVB.vy + (targetVB.vy - startVB.vy) * easedProgress;
          setViewBox(`${nextVx} ${nextVy} ${startVB.vw} ${startVB.vh}`);
          if (progress < 1) animationFrameId.current = requestAnimationFrame(animatePan);
          else { setViewBox(`${targetVB.vx} ${targetVB.vy} ${startVB.vw} ${startVB.vh}`); if (onFocusHandled) onFocusHandled(); }
        };
        animationFrameId.current = requestAnimationFrame(animatePan);
      } else if (onFocusHandled) onFocusHandled();
    }
    return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
  }, [tokenIdToFocus, tokens, viewBox, cellSize, numCols, numRows, showGridLines, setViewBox, onFocusHandled]);


  const getCursorStyle = () => {
    if (editingTokenId || interactions.isCreatingText || editingTextObjectId || editingShapeId) return 'cursor-text';
    if (isPanning) return 'cursor-grabbing'; // This isPanning is from usePanZoom
    if (interactions.draggingToken && activeTool === 'select' && !editingTokenId) return 'cursor-grabbing';
    
    if (activeTool === 'select' && !interactions.draggingToken && !isPanning && !rightClickPopoverState && !interactions.isActuallyDraggingShape) {
        const primarySelectedShapeId = selectedShapeIds.length > 0 ? selectedShapeIds[0] : null; // simplified for now
        const hoveredShape = primarySelectedShapeId ? drawnShapes.find(s => s.id === primarySelectedShapeId) : null;
        if (hoveredShape && hoveredShape.isLocked && (hoveredShape.type === 'circle' || hoveredShape.type === 'rectangle')) {
            return 'cursor-default';
        }
        return 'cursor-pointer'; 
    }
    if (interactions.draggingTextObjectId && activeTool === 'select' && !editingTextObjectId) return 'cursor-grabbing';
    if (interactions.isActuallyDraggingShape && activeTool === 'select' && !editingShapeId) return 'cursor-grabbing';
    if (activeTool === 'type_tool') return 'cursor-text';
    if (['paint_cell', 'place_token', 'measure_distance', 'measure_radius', 'eraser_tool', 'draw_line', 'draw_circle', 'draw_rectangle'].includes(activeTool)) return 'cursor-crosshair';
    if (interactions.isMarqueeSelecting) return 'cursor-crosshair';
    return 'cursor-default';
  };

  const gridContentWidth = numCols * cellSize;
  const gridContentHeight = numRows * cellSize;
  const imgScaledWidth = gridContentWidth * backgroundZoomLevel;
  const imgScaledHeight = gridContentHeight * backgroundZoomLevel;
  const imgScaledX = (gridContentWidth - imgScaledWidth) / 2;
  const imgScaledY = (gridContentHeight - imgScaledHeight) / 2;


  const handleEditTokenNameFromMenu = (tokenId: string, currentName: string) => {
    setSelectedTokenIds([tokenId]);
    setSelectedShapeIds([]);
    setSelectedTextObjectIds([]);
    setEditingTokenId(tokenId);
    setEditingText(currentName);
  };
  const handleEditTextObjectFromMenu = (textObj: TextObjectType) => {
    setSelectedTextObjectIds([textObj.id]);
    setSelectedTokenIds([]);
    setSelectedShapeIds([]);
    setEditingTextObjectId(textObj.id);
    setEditingTextObjectContent(textObj.content);
  };
  const handleDeleteTextObject = (textObjId: string) => {
    setTextObjects(prev => prev.filter(to => to.id !== textObjId));
    setSelectedTextObjectIds(prev => prev.filter(id => id !== textObjId));
  };
  const handleToggleShapeLock = (shapeId: string) => {
    setDrawnShapes(prev => prev.map(s => s.id === shapeId ? { ...s, isLocked: !s.isLocked } : s));
  };
  const handleSetShapeOpacity = (shapeId: string, opacityValue: number) => {
    setDrawnShapes(prev => prev.map(s => s.id === shapeId ? { ...s, opacity: opacityValue } : s));
  };
  const handleShapeRadiusChange = (shapeId: string, newRadiusInFeetString: string) => {
    const newRadiusInFeet = parseFloat(newRadiusInFeetString);
    if (isNaN(newRadiusInFeet) || newRadiusInFeet < (5 / 2)) { 
      const currentShape = drawnShapes.find(s => s.id === shapeId);
      if (currentShape && currentShape.type === 'circle') {
        const currentPixelRadius = Math.sqrt(dist2(currentShape.startPoint, currentShape.endPoint));
        const currentRadiusInFeet = (currentPixelRadius / cellSize) * 5;
        setShapeRadiusInput(String(Math.max(2.5, Math.round(currentRadiusInFeet) )));
      }
      return;
    }
    const newRadiusInPixels = (newRadiusInFeet / 5) * cellSize;
    setDrawnShapes(prev => prev.map(s => (s.id === shapeId && s.type === 'circle') ? { ...s, endPoint: { x: s.startPoint.x + newRadiusInPixels, y: s.startPoint.y } } : s));
  };
  const handleEditShapeLabelFromMenu = (shape: DrawnShape) => {
    setSelectedShapeIds([shape.id]);
    setSelectedTokenIds([]);
    setSelectedTextObjectIds([]);
    setEditingShapeId(shape.id);
    setEditingShapeLabelText(shape.label || '');
  };
  const handleDeleteShape = (shapeId: string) => {
    setDrawnShapes(prev => prev.filter(s => s.id !== shapeId));
    setSelectedShapeIds(prev => prev.filter(id => id !== shapeId));
  };

  return (
    <div className="w-full h-full overflow-hidden bg-battle-grid-bg flex items-center justify-center relative">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className={cn("w-full h-full", getCursorStyle())}
        onMouseDown={interactions.handleGridMouseDown}
        onMouseMove={interactions.handleMouseMove}
        onMouseUp={interactions.handleMouseUp}
        onMouseLeave={interactions.handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        preserveAspectRatio="xMidYMid slice"
        data-ai-hint="battle grid tactical map"
      >
        <BattleGridDefs tokens={tokens} ghostToken={interactions.ghostToken} cellSize={cellSize} />

        {backgroundImageUrl && (
          <image href={backgroundImageUrl} x={imgScaledX} y={imgScaledY} width={imgScaledWidth} height={imgScaledHeight} />
        )}

        <GridCellsLayer
          gridCells={gridCells}
          cellSize={cellSize}
          showGridLines={showGridLines}
          isPainting={interactions.isPainting}
          activeTool={activeTool}
          pendingGridCellsDuringPaint={interactions.pendingGridCellsDuringPaint}
          hoveredCellWhilePaintingOrErasing={interactions.hoveredCellWhilePaintingOrErasing}
          selectedTokenTemplateSize={selectedTokenTemplate?.size || 1}
        />
        <ShapesLayer
          drawnShapes={drawnShapes}
          currentDrawingShape={currentDrawingShape}
          isDrawing={interactions.isDrawing}
          editingShapeId={editingShapeId}
          editingShapeLabelText={editingShapeLabelText}
          setEditingShapeLabelText={setEditingShapeLabelText}
          handleSaveShapeLabel={handleSaveShapeLabel}
          handleShapeLabelInputKeyDown={handleShapeLabelInputKeyDown}
          showAllLabels={showAllLabels}
          selectedShapeIds={selectedShapeIds}
          activeTool={activeTool}
          rightClickPopoverStateActive={!!rightClickPopoverState}
          isActuallyDraggingShape={interactions.isActuallyDraggingShape}
          currentDraggingShapeId={interactions.currentDraggingShapeId}
          onShapeLabelClick={handleShapeLabelClick}
        />
        <TokensLayer
          tokens={tokens}
          cellSize={cellSize}
          draggingToken={interactions.draggingToken}
          draggedTokenVisualPosition={interactions.draggedTokenVisualPosition}
          ghostToken={interactions.ghostToken}
          movementMeasureLine={interactions.movementMeasureLine}
          editingTokenId={editingTokenId}
          editingText={editingText}
          setEditingText={setEditingText}
          handleSaveTokenName={handleSaveTokenName}
          handleEditInputKeyDown={handleEditInputKeyDown}
          activeTurnTokenId={activeTurnTokenId}
          selectedTokenIds={selectedTokenIds}
          hoveredTokenId={hoveredTokenId}
          setHoveredTokenId={setHoveredTokenId}
          showAllLabels={showAllLabels}
          activeTool={activeTool}
          onTokenLabelClick={handleTokenLabelClick}
          rightClickPopoverStateActive={!!rightClickPopoverState}
        />
        <TextObjectsLayer
          textObjects={textObjects}
          editingTextObjectId={editingTextObjectId}
          editingTextObjectContent={editingTextObjectContent}
          setEditingTextObjectContent={setEditingTextObjectContent}
          handleFinalizeTextEdit={interactions.handleFinalizeTextEdit}
          handleTextEditInputKeyDown={handleTextEditInputKeyDown}
          isCreatingText={interactions.isCreatingText}
          setIsCreatingText={interactions.setIsCreatingText}
          finalizeTextCreation={interactions.finalizeTextCreation}
          handleTextInputKeyDown={handleTextInputKeyDown}
          activeTool={activeTool}
          selectedTextObjectIds={selectedTextObjectIds}
          hoveredTextObjectId={hoveredTextObjectId}
          setHoveredTextObjectId={setHoveredTextObjectId}
          draggingTextObjectId={interactions.draggingTextObjectId}
          rightClickPopoverStateActive={!!rightClickPopoverState}
        />
        {interactions.isMarqueeSelecting && interactions.marqueeStartPoint && interactions.marqueeEndPoint && (
          <rect
            x={Math.min(interactions.marqueeStartPoint.x, interactions.marqueeEndPoint.x)}
            y={Math.min(interactions.marqueeStartPoint.y, interactions.marqueeEndPoint.y)}
            width={Math.abs(interactions.marqueeStartPoint.x - interactions.marqueeEndPoint.x)}
            height={Math.abs(interactions.marqueeStartPoint.y - interactions.marqueeEndPoint.y)}
            fill="hsla(var(--accent), 0.1)"
            stroke="hsl(var(--accent))"
            strokeWidth="1"
            strokeDasharray="3 3"
            className="pointer-events-none"
          />
        )}
        <MeasurementOverlay measurement={measurement} cellSize={cellSize} />
      </svg>

      <RightClickMenu
        isOpen={!!rightClickPopoverState}
        onOpenChange={(isOpen) => { if (!isOpen) setRightClickPopoverState(null); }}
        popoverState={rightClickPopoverState}
        triggerRef={rightClickPopoverTriggerRef}
        tokens={tokens} drawnShapes={drawnShapes} participants={participants} cellSize={cellSize}
        onOpenAddCombatantDialogForToken={onOpenAddCombatantDialogForToken}
        onEditTokenName={handleEditTokenNameFromMenu}
        onOpenEditStatsDialogForToken={onOpenEditStatsDialogForToken}
        onTokenImageChangeRequest={onTokenImageChangeRequest}
        onChangeTokenSize={onChangeTokenSize}
        onTokenDelete={onTokenDelete}
        onEditTextObject={handleEditTextObjectFromMenu}
        onDeleteTextObject={handleDeleteTextObject}
        onToggleShapeLock={handleToggleShapeLock}
        onSetShapeOpacity={handleSetShapeOpacity}
        onShapeRadiusChange={handleShapeRadiusChange}
        onEditShapeLabel={handleEditShapeLabelFromMenu}
        onDeleteShape={handleDeleteShape}
      />
      
      <GridToolbar
        showGridLines={showGridLines} setShowGridLines={setShowGridLines}
        showAllLabels={showAllLabels} setShowAllLabels={setShowAllLabels}
        onZoomIn={() => applyZoom(true)}
        onZoomOut={() => applyZoom(false)}
        onResetView={handleResetView}
      />
    </div>
  );
}

