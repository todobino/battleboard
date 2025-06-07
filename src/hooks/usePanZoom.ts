
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

  const applyZoomInternal = useCallback((zoomIn: boolean, customScaleAmount?: number) => {
    if (!svgRef.current) return;
    const scaleFactor = customScaleAmount || ZOOM_AMOUNT;
    
    setViewBox(currentViewBoxString => {
      const [vx, vy, vw, vh] = currentViewBoxString.split(' ').map(Number);

      const svgRect = svgRef.current!.getBoundingClientRect(); // svgRef.current is checked, so ! is safe
      const clientCenterX = svgRect.left + svgRect.width / 2;
      const clientCenterY = svgRect.top + svgRect.height / 2;
      const centerPos = getMousePosition({ clientX: clientCenterX, clientY: clientCenterY } as MouseEvent);

      let newVw = zoomIn ? vw / scaleFactor : vw * scaleFactor;
      
      const calculatedTotalContentWidth = numCols * cellSize;
      const currentBorderWidth = showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0;
      const absoluteContentWidth = calculatedTotalContentWidth + currentBorderWidth;
      const absoluteContentHeight = (numRows * cellSize) + currentBorderWidth;
      const absoluteContentMinX = 0 - (showGridLines ? BORDER_WIDTH_WHEN_VISIBLE / 2 : 0);
      const absoluteContentMinY = 0 - (showGridLines ? BORDER_WIDTH_WHEN_VISIBLE / 2 : 0);

      const maxAllowedVw = absoluteContentWidth * 3; // Increased slightly
      const minAllowedVw = Math.max(50, absoluteContentWidth / 20); // Increased slightly

      newVw = Math.max(minAllowedVw, Math.min(maxAllowedVw, newVw));
      
      const newVh = vw !== 0 ? (newVw / vw) * vh : (numRows / numCols) * newVw;

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
      
      return `${newVx} ${newVy} ${newVw} ${newVh}`;
    });
  }, [getMousePosition, numCols, numRows, cellSize, showGridLines, svgRef]);

  const zoomIn = useCallback(() => applyZoomInternal(true), [applyZoomInternal]);
  const zoomOut = useCallback(() => applyZoomInternal(false), [applyZoomInternal]);

  const handleWheel = useCallback((event: React.WheelEvent<SVGSVGElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, [contenteditable="true"]')) {
      return; 
    }
    event.preventDefault();
    const isZoomIn = event.deltaY < 0;
    applyZoomInternal(isZoomIn);
  }, [applyZoomInternal]);

  const handlePanStartInteraction = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    setIsPanning(true);
    setPanStart({ x: event.clientX, y: event.clientY });
  }, []);

  const handlePanMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning || !panStart || !svgRef.current) return;

    setViewBox(currentViewBoxString => {
      const [currentVbMinX, currentVbMinY, currentVbWidth, currentVbHeight] = currentViewBoxString.split(' ').map(Number);
      const svg = svgRef.current!; // Safe due to check
      const clientWidth = svg.clientWidth;
      const clientHeight = svg.clientHeight;

      if (clientWidth === 0 || clientHeight === 0 || currentVbWidth === 0 || currentVbHeight === 0) return currentViewBoxString;

      const scaleX = clientWidth / currentVbWidth;
      
      const dxScreen = event.clientX - panStart.x;
      const dyScreen = event.clientY - panStart.y;
      const dxSvg = dxScreen / scaleX;
      const dySvg = dyScreen / scaleX;

      let newVx = currentVbMinX - dxSvg;
      let newVy = currentVbMinY - dySvg;

      const calculatedTotalContentWidth = numCols * cellSize;
      const calculatedTotalContentHeight = numRows * cellSize;
      const currentBorderWidth = showGridLines ? BORDER_WIDTH_WHEN_VISIBLE : 0;
      const absoluteContentWidth = calculatedTotalContentWidth + currentBorderWidth;
      const absoluteContentHeight = calculatedTotalContentHeight + currentBorderWidth;
      const absoluteContentMinX = 0 - currentBorderWidth / 2;
      const absoluteContentMinY = 0 - currentBorderWidth / 2;

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
      
      return `${newVx} ${newVy} ${currentVbWidth} ${currentVbHeight}`;
    });
    setPanStart({ x: event.clientX, y: event.clientY }); // Update panStart for next move delta
  }, [isPanning, panStart, svgRef, numCols, numRows, cellSize, showGridLines]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
  }, []);
  
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
    applyZoom: applyZoomInternal, // Keep original applyZoom if needed internally, or remove if zoomIn/Out are sufficient
    zoomIn,
    zoomOut,
    handleWheel,
    handlePanStart: handlePanStartInteraction,
    handlePanMove,
    handlePanEnd,
    handleResetView,
    calculateInitialViewBox: calculateCurrentInitialViewBox,
  };
}
