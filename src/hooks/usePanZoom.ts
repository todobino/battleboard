
'use client';

import type { Point } from '@/types';
import React, { useState, useCallback, RefObject, useEffect } from 'react';

const ZOOM_AMOUNT = 1.1;
const BORDER_WIDTH_WHEN_VISIBLE = 1; 

interface UsePanZoomProps {
  svgRef: RefObject<SVGSVGElement>;
  initialViewBox?: string;
  numCols: number;
  numRows: number;
  cellSize: number;
  showGridLines: boolean;
}

export function usePanZoom({
  svgRef,
  initialViewBox: initialVBProp,
  numCols,
  numRows,
  cellSize,
  showGridLines,
}: UsePanZoomProps) {
  const calculateCurrentInitialViewBox = useCallback(() => {
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
    // Fallback if svgRef not ready or dimensions are zero
    return `${0 - svgPadding} ${0 - svgPadding} ${Math.max(1, calculatedTotalContentWidth + currentBorderWidth)} ${Math.max(1, calculatedTotalContentHeight + currentBorderWidth)}`;
  }, [numCols, numRows, cellSize, showGridLines, svgRef]);

  const [viewBox, setViewBox] = useState<string>(initialVBProp || calculateCurrentInitialViewBox());
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);

  const getMousePosition = useCallback((event: React.MouseEvent<SVGSVGElement> | React.WheelEvent<SVGSVGElement> | MouseEvent): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const CTM = svg.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (event.clientX - CTM.e) / CTM.a,
      y: (event.clientY - CTM.f) / CTM.d,
    };
  }, [svgRef]);

  const applyZoom = useCallback((zoomIn: boolean, customScaleAmount?: number) => {
    if (!svgRef.current) return;
    const scaleAmount = customScaleAmount || ZOOM_AMOUNT;
    const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);

    const svgRect = svgRef.current.getBoundingClientRect();
    const clientCenterX = svgRect.left + svgRect.width / 2;
    const clientCenterY = svgRect.top + svgRect.height / 2;

    // Use a mock event for getMousePosition if needed, or pass actual mouse event if zooming at cursor
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

    const maxAllowedVw = absoluteContentWidth * 2; // Allow some overzoom
    const minAllowedVw = Math.max(100, absoluteContentWidth / 10); // Ensure minVw is not too small

    newVw = Math.max(minAllowedVw, Math.min(maxAllowedVw, newVw));
    
    if (vw !== 0) { newVh = (newVw / vw) * vh; }
    else { newVh = (numRows / numCols) * newVw; } // Aspect ratio based calculation

    let newVx = centerPos.x - (centerPos.x - vx) * (newVw / vw);
    let newVy = centerPos.y - (centerPos.y - vy) * (newVh / vh);

    // Boundary checks for viewBox position
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
  }, [viewBox, getMousePosition, numCols, numRows, cellSize, showGridLines, svgRef]);

  const handleWheel = useCallback((event: React.WheelEvent<SVGSVGElement>) => {
    // Check if the target or its parent is an input field to prevent zoom while scrolling in inputs
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, [contenteditable="true"]')) {
      return; // Don't prevent default, allow native scroll
    }
    event.preventDefault();
    const zoomIn = event.deltaY < 0;
    applyZoom(zoomIn);
  }, [applyZoom]);

  const handlePanStartInteraction = (event: React.MouseEvent<SVGSVGElement>) => {
    setIsPanning(true);
    setPanStart({ x: event.clientX, y: event.clientY });
  };

  const handlePanMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning || !panStart || !svgRef.current) return;

    const [currentVbMinX, currentVbMinY, currentVbWidth, currentVbHeight] = viewBox.split(' ').map(Number);
    const svg = svgRef.current;
    const clientWidth = svg.clientWidth;
    const clientHeight = svg.clientHeight;

    if (clientWidth === 0 || clientHeight === 0 || currentVbWidth === 0 || currentVbHeight === 0) return;

    const scaleX = clientWidth / currentVbWidth;
    const scaleY = clientHeight / currentVbHeight; // Not always same as scaleX due to preserveAspectRatio
                                               // For panning, typically use scaleX or average if aspect ratio not preserved

    const dxScreen = event.clientX - panStart.x;
    const dyScreen = event.clientY - panStart.y;
    
    // Convert screen delta to SVG delta
    const dxSvg = dxScreen / scaleX;
    const dySvg = dyScreen / scaleX; // Assuming uniform scaling for pan, or use CTM inverse if complex

    let newVx = currentVbMinX - dxSvg;
    let newVy = currentVbMinY - dySvg;

    const calculatedTotalContentWidth = numCols * cellSize;
    const calculatedTotalContentHeight = numRows * cellSize;
    const currentBorderWidth = showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0;
    const absoluteContentWidth = calculatedTotalContentWidth + currentBorderWidth;
    const absoluteContentHeight = calculatedTotalContentHeight + currentBorderWidth;
    const absoluteContentMinX = 0 - currentBorderWidth / 2;
    const absoluteContentMinY = 0 - currentBorderWidth / 2;

    // Clamp viewBox position
    if (currentVbWidth >= absoluteContentWidth) {
      newVx = absoluteContentMinX + (absoluteContentWidth - currentVbWidth) / 2;
    } else {
      newVx = Math.max(absoluteContentMinX, Math.min(newVx, absoluteContentMinX + absoluteContentWidth - currentVbWidth));
    }
    if (currentVbHeight >= absoluteContentHeight) {
      newVy = absoluteContentMinY + (absoluteContentHeight - currentVbHeight) / 2;
    } else {
      newVy = Math.max(absoluteContentMinY, Math.min(newVy, absoluteContentMinY + absoluteContentHeight - currentVbHeight));
    }
    
    setViewBox(`${newVx} ${newVy} ${currentVbWidth} ${currentVbHeight}`);
    setPanStart({ x: event.clientX, y: event.clientY });
  };

  const handlePanEnd = () => {
    setIsPanning(false);
    setPanStart(null);
  };
  
  const handleResetView = useCallback(() => {
    setViewBox(calculateCurrentInitialViewBox());
  }, [calculateCurrentInitialViewBox]);

  useEffect(() => {
    setViewBox(calculateCurrentInitialViewBox());
  }, [calculateCurrentInitialViewBox, showGridLines, cellSize, numCols, numRows]);


  return {
    viewBox,
    setViewBox, 
    isPanning,
    getMousePosition,
    applyZoom,
    handleWheel,
    handlePanStart: handlePanStartInteraction, // Expose the correctly named handler
    handlePanMove,
    handlePanEnd,
    handleResetView,
    calculateInitialViewBox: calculateCurrentInitialViewBox,
  };
}
