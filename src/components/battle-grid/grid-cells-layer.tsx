
'use client';

import type { GridCellData, Point, ActiveTool } from '@/types'; // Added ActiveTool
import React from 'react';

const BORDER_WIDTH_WHEN_VISIBLE = 1;

interface GridCellsLayerProps {
  gridCells: GridCellData[][];
  cellSize: number;
  showGridLines: boolean;
  isPainting: boolean;
  activeTool: ActiveTool; 
  pendingGridCellsDuringPaint: GridCellData[][] | null;
  hoveredCellWhilePaintingOrErasing: Point | null;
  selectedTokenTemplateSize: number; 
}

export default function GridCellsLayer({
  gridCells,
  cellSize,
  showGridLines,
  isPainting,
  activeTool,
  pendingGridCellsDuringPaint,
  hoveredCellWhilePaintingOrErasing,
  selectedTokenTemplateSize,
}: GridCellsLayerProps) {
  return (
    <g shapeRendering="crispEdges">
      {gridCells.flatMap((row, y) =>
        row.map((cell, x) => {
          let isHighlightActive = false;
          let highlightSize = 1;

          if (activeTool === 'place_token') {
            isHighlightActive = true;
            highlightSize = selectedTokenTemplateSize;
          } else if (isPainting && activeTool === 'paint_cell') {
            isHighlightActive = true;
          } else if (activeTool === 'eraser_tool') {
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
              className="pointer-events-none" 
            />
          );
        })
      )}
    </g>
  );
}
