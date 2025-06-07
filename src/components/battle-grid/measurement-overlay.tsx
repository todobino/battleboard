
'use client';

import type { Measurement } from '@/types';
import React from 'react';

interface MeasurementOverlayProps {
  measurement: Measurement;
  cellSize: number;
}

export default function MeasurementOverlay({
  measurement,
  cellSize,
}: MeasurementOverlayProps) {
  if (!measurement.startPoint || !measurement.endPoint) {
    return null;
  }

  return (
    <g stroke="hsl(var(--accent))" strokeWidth="3" fill="none" className="pointer-events-none">
      {measurement.type === 'distance' ? (
        <line
          x1={measurement.startPoint.x * cellSize + cellSize / 2}
          y1={measurement.startPoint.y * cellSize + cellSize / 2}
          x2={measurement.endPoint.x * cellSize + cellSize / 2}
          y2={measurement.endPoint.y * cellSize + cellSize / 2}
          markerEnd="url(#arrowhead)"
        />
      ) : (
        measurement.type === 'radius' &&
        <circle
          cx={measurement.startPoint.x * cellSize + cellSize / 2}
          cy={measurement.startPoint.y * cellSize + cellSize / 2}
          r={Math.sqrt(Math.pow(measurement.endPoint.x - measurement.startPoint.x, 2) + Math.pow(measurement.endPoint.y - measurement.startPoint.y, 2)) * cellSize}
          strokeDasharray="5 3"
          fill="hsla(var(--accent), 0.3)"
        />
      )}
      {measurement.result && (
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
          className="select-none font-bold"
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
    </g>
  );
}
