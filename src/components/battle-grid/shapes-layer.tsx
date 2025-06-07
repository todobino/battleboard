
'use client';

import type { DrawnShape, ActiveTool } from '@/types';
import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import { dist2 } from '@/lib/geometry-utils';

interface ShapesLayerProps {
  drawnShapes: DrawnShape[];
  currentDrawingShape: DrawnShape | null;
  isDrawing: boolean;
  editingShapeId: string | null;
  editingShapeLabelText: string;
  setEditingShapeLabelText: (text: string) => void;
  handleSaveShapeLabel: () => void;
  handleShapeLabelInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  showAllLabels: boolean;
  selectedShapeIds: string[]; // Changed from selectedShapeId
  activeTool: ActiveTool;
  rightClickPopoverStateActive: boolean;
  isActuallyDraggingShape: boolean;
  currentDraggingShapeId: string | null;
  onShapeLabelClick: (event: React.MouseEvent, shape: DrawnShape) => void;
}

export default function ShapesLayer({
  drawnShapes,
  currentDrawingShape,
  isDrawing,
  editingShapeId,
  editingShapeLabelText,
  setEditingShapeLabelText,
  handleSaveShapeLabel,
  handleShapeLabelInputKeyDown,
  showAllLabels,
  selectedShapeIds, // Changed
  activeTool,
  rightClickPopoverStateActive,
  isActuallyDraggingShape,
  currentDraggingShapeId,
  onShapeLabelClick,
}: ShapesLayerProps) {
  const shapeLabelInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editingShapeId && shapeLabelInputRef.current) {
      const timerId = setTimeout(() => {
        shapeLabelInputRef.current?.focus();
        shapeLabelInputRef.current?.select();
      }, 0);
      return () => clearTimeout(timerId);
    }
  }, [editingShapeId]);
  
  const renderShape = (shape: DrawnShape, isCurrentDrawing: boolean) => {
    const isCurrentlyEditingThisShapeLabel = editingShapeId === shape.id;
    const isShapeSelected = selectedShapeIds.includes(shape.id); // Check if shape is in selected array
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
      <g 
        key={shape.id + (isCurrentDrawing ? '-drawing' : '')}
        className={cn(
            !isCurrentDrawing && activeTool === 'select' && (shape.type === 'circle' || shape.type === 'rectangle') && !shape.isLocked && !rightClickPopoverStateActive && !isActuallyDraggingShape && 'cursor-pointer',
            !isCurrentDrawing && activeTool === 'select' && (shape.type === 'circle' || shape.type === 'rectangle') && shape.isLocked && 'cursor-default',
            !isCurrentDrawing && activeTool === 'select' && isActuallyDraggingShape && currentDraggingShapeId === shape.id && 'cursor-grabbing',
            !isCurrentDrawing && activeTool === 'select' && shape.type === 'line' && !rightClickPopoverStateActive && 'cursor-pointer'
          )}
      >
        {shape.type === 'line' && (
          <line
            x1={shape.startPoint.x} y1={shape.startPoint.y}
            x2={shape.endPoint.x} y2={shape.endPoint.y}
            stroke={isShapeSelected && !isCurrentDrawing ? 'hsl(var(--ring))' : shape.color}
            strokeWidth={(isShapeSelected && !isCurrentDrawing) ? shape.strokeWidth + 1 : shape.strokeWidth}
            strokeOpacity={shape.opacity ?? 1}
            strokeDasharray={isCurrentDrawing ? "3 3" : undefined}
          />
        )}
        {shape.type === 'circle' && (
          <circle
            cx={shape.startPoint.x} cy={shape.startPoint.y}
            r={Math.sqrt(dist2(shape.startPoint, shape.endPoint))}
            stroke={isShapeSelected && !isCurrentDrawing ? 'hsl(var(--ring))' : shape.color}
            strokeWidth={(isShapeSelected && !isCurrentDrawing) ? shape.strokeWidth + 1 : shape.strokeWidth}
            strokeOpacity={1}
            fill={shape.fillColor}
            fillOpacity={shape.opacity ?? 0.5}
            strokeDasharray={isCurrentDrawing ? "3 3" : undefined}
          />
        )}
        {shape.type === 'rectangle' && (
          <rect
            x={Math.min(shape.startPoint.x, shape.endPoint.x)}
            y={Math.min(shape.startPoint.y, shape.endPoint.y)}
            width={Math.abs(shape.endPoint.x - shape.startPoint.x)}
            height={Math.abs(shape.endPoint.y - shape.startPoint.y)}
            stroke={isShapeSelected && !isCurrentDrawing ? 'hsl(var(--ring))' : shape.color}
            strokeWidth={(isShapeSelected && !isCurrentDrawing) ? shape.strokeWidth + 1 : shape.strokeWidth}
            strokeOpacity={1}
            fill={shape.fillColor}
            fillOpacity={shape.opacity ?? 0.5}
            strokeDasharray={isCurrentDrawing ? "3 3" : undefined}
          />
        )}
        {!isCurrentDrawing && shape.label && !isCurrentlyEditingThisShapeLabel && isLabelVisible && (
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
            className={cn(activeTool === 'select' && !rightClickPopoverStateActive ? "cursor-text" : "cursor-default", "select-none")}
            onClick={(e) => { if(!rightClickPopoverStateActive) onShapeLabelClick(e, shape); }}
          >
            {shape.label}
          </text>
        )}
        {!isCurrentDrawing && isCurrentlyEditingThisShapeLabel && (
          <foreignObject
            x={labelX - 50}
            y={labelY - 11}
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
  };

  return (
    <g>
      {drawnShapes.map(shape => renderShape(shape, false))}
      {currentDrawingShape && isDrawing && renderShape(currentDrawingShape, true)}
    </g>
  );
}
