
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Crop, Grid } from 'lucide-react';

interface ImageCropDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  imageSrc: string | null;
  onCropConfirm: (croppedDataUrl: string) => void;
  onCropCancel: () => void;
}

const MAX_CANVAS_DISPLAY_SIZE = 400; // Max width/height for the canvas in the dialog
const GRID_OVERLAY_CELLS = 30; // For a 30x30 grid overlay

export default function ImageCropDialog({
  isOpen,
  onOpenChange,
  imageSrc,
  onCropConfirm,
  onCropCancel,
}: ImageCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  const [scaleFactor, setScaleFactor] = useState(1); // To map canvas coords to original image coords

  // Crop selection state (on displayed canvas)
  const [cropRect, setCropRect] = useState<{ x: number; y: number; size: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startDragPoint, setStartDragPoint] = useState<{ x: number; y: number } | null>(null);
  
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ width: MAX_CANVAS_DISPLAY_SIZE, height: MAX_CANVAS_DISPLAY_SIZE });


  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgElement) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the image scaled to fit the canvas
    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

    // Draw grid overlay
    const cellWidth = canvas.width / GRID_OVERLAY_CELLS;
    const cellHeight = canvas.height / GRID_OVERLAY_CELLS;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; // Semi-transparent white
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]); // Dashed lines

    for (let i = 1; i < GRID_OVERLAY_CELLS; i++) {
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(i * cellWidth, 0);
      ctx.lineTo(i * cellWidth, canvas.height);
      ctx.stroke();
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, i * cellHeight);
      ctx.lineTo(canvas.width, i * cellHeight);
      ctx.stroke();
    }
    ctx.setLineDash([]); // Reset line dash

    // Draw the crop selection square
    if (cropRect && cropRect.size > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // Bright yellow for visibility
      ctx.lineWidth = 2;
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.size, cropRect.size);
      
      // Add semi-transparent overlay outside the crop area
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      // Outer rectangle (entire canvas)
      ctx.rect(0, 0, canvas.width, canvas.height);
      // Inner rectangle (crop area) - counter-clockwise to create a hole
      ctx.moveTo(cropRect.x, cropRect.y);
      ctx.lineTo(cropRect.x, cropRect.y + cropRect.size);
      ctx.lineTo(cropRect.x + cropRect.size, cropRect.y + cropRect.size);
      ctx.lineTo(cropRect.x + cropRect.size, cropRect.y);
      ctx.closePath();
      ctx.fill();
    }
  }, [imgElement, cropRect, canvasDisplaySize]);

  useEffect(() => {
    if (isOpen && imageSrc) {
      const img = new Image();
      img.onload = () => {
        setImgElement(img);
        const { naturalWidth, naturalHeight } = img;
        const aspectRatio = naturalWidth / naturalHeight;
        let displayWidth, displayHeight;

        if (naturalWidth > naturalHeight) {
          displayWidth = Math.min(naturalWidth, MAX_CANVAS_DISPLAY_SIZE);
          displayHeight = displayWidth / aspectRatio;
        } else {
          displayHeight = Math.min(naturalHeight, MAX_CANVAS_DISPLAY_SIZE);
          displayWidth = displayHeight * aspectRatio;
        }
        
        setCanvasDisplaySize({ width: displayWidth, height: displayHeight });
        if (canvasRef.current) {
          canvasRef.current.width = displayWidth;
          canvasRef.current.height = displayHeight;
        }
        // Calculate scaleFactor based on display width relative to natural width
        setScaleFactor(naturalWidth / displayWidth); 
        setCropRect(null); // Reset crop on new image
      };
      img.onerror = () => {
        // Handle image loading error if necessary
        setImgElement(null);
      }
      img.src = imageSrc;
    } else {
      setImgElement(null); // Clear image when dialog closes or no src
      setCropRect(null);
    }
  }, [isOpen, imageSrc]);
  
  useEffect(() => {
    draw();
  }, [draw, cropRect, canvasDisplaySize]); // Redraw when cropRect or canvas size changes

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imgElement) return;
    const pos = getMousePos(e);
    setStartDragPoint(pos);
    setIsDragging(true);
    setCropRect({ x: pos.x, y: pos.y, size: 0 }); // Start with a point
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !startDragPoint || !imgElement) return;
    const pos = getMousePos(e);
    const dx = pos.x - startDragPoint.x;
    const dy = pos.y - startDragPoint.y;

    // Constrain to square: use the smaller dimension from the drag start
    let size = Math.min(Math.abs(dx), Math.abs(dy));
    
    let newX = startDragPoint.x;
    let newY = startDragPoint.y;

    if (dx < 0) {
      newX = startDragPoint.x - size;
    }
    if (dy < 0) {
      newY = startDragPoint.y - size;
    }
    
    // Ensure crop is within canvas bounds
    const canvas = canvasRef.current;
    if(!canvas) return;

    // Clamp size if it goes out of bounds
    if (newX + size > canvas.width) {
        size = canvas.width - newX;
    }
    if (newY + size > canvas.height) {
        size = canvas.height - newY;
    }
    if (newX < 0) {
        size += newX; // Effectively size = size - Math.abs(newX)
        newX = 0;
    }
    if (newY < 0) {
        size += newY; // Effectively size = size - Math.abs(newY)
        newY = 0;
    }
    size = Math.max(0, size); // Ensure size is not negative


    setCropRect({ x: newX, y: newY, size: size });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setStartDragPoint(null);
    // Crop rect is already set by mouseMove
  };
  
  const handleMouseLeave = () => {
    if (isDragging) {
        // Finalize crop if mouse leaves while dragging
        setIsDragging(false);
        setStartDragPoint(null);
    }
  };

  const handleConfirm = () => {
    if (!imgElement || !imageSrc) {
      onCropCancel(); 
      return;
    }

    if (!cropRect || cropRect.size === 0) {
      // No valid crop selected, or crop selection is zero size. Use the original image.
      onCropConfirm(imageSrc);
      return;
    }

    // Valid crop selected, proceed with cropping
    const offscreenCanvas = document.createElement('canvas');
    const actualX = cropRect.x * scaleFactor;
    const actualY = cropRect.y * scaleFactor;
    const actualSize = cropRect.size * scaleFactor;

    offscreenCanvas.width = actualSize;
    offscreenCanvas.height = actualSize;
    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      imgElement,
      actualX, // source X
      actualY, // source Y
      actualSize, // source Width
      actualSize, // source Height
      0, // destination X
      0, // destination Y
      actualSize, // destination Width
      actualSize  // destination Height
    );
    onCropConfirm(offscreenCanvas.toDataURL(imgElement.src.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'));
  };

  const handleCancelDialog = () => {
    onOpenChange(false); 
    onCropCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) handleCancelDialog(); 
        else onOpenChange(true);
      }}
    >
      <DialogContent className="sm:max-w-[450px] p-0" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center">
            <Crop className="mr-2 h-5 w-5"/> Crop Background Image
          </DialogTitle>
          <DialogDescription>
            Click and drag on the image to select a square area for your battle map background.
            Or, click "Use Image" to use the original uploaded image without cropping.
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 pt-0 flex justify-center items-center" data-ai-hint="image crop tool">
          {imageSrc && (
            <canvas
              ref={canvasRef}
              width={canvasDisplaySize.width}
              height={canvasDisplaySize.height}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              className="cursor-crosshair border border-border rounded-md"
              style={{ maxWidth: '100%', maxHeight: `${MAX_CANVAS_DISPLAY_SIZE}px`, aspectRatio: `${canvasDisplaySize.width} / ${canvasDisplaySize.height}` }}
            />
          )}
        </div>
        <DialogFooter className="p-6 pt-2">
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={handleCancelDialog}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleConfirm} disabled={!imgElement}>
            {cropRect && cropRect.size > 0 ? "Crop & Use Image" : "Use Original Image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
