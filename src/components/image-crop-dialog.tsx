
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
import { Crop } from 'lucide-react';

interface ImageCropDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  imageSrc: string | null;
  onCropConfirm: (croppedDataUrl: string) => void;
  onCropCancel: () => void;
}

const MAX_CANVAS_DISPLAY_SIZE = 400; // Max width/height for the canvas in the dialog

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

    // Draw the crop selection square
    if (cropRect) {
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
  }, [imgElement, cropRect]);

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
        setScaleFactor(naturalWidth / displayWidth);
        setCropRect(null); // Reset crop on new image
      };
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

    // Constrain to square: use the smaller dimension
    const size = Math.min(Math.abs(dx), Math.abs(dy));
    
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

    const finalX = Math.max(0, Math.min(newX, canvas.width - size));
    const finalY = Math.max(0, Math.min(newY, canvas.height - size));
    const finalSize = Math.min(size, canvas.width - finalX, canvas.height - finalY);


    setCropRect({ x: finalX, y: finalY, size: finalSize });
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
    if (!cropRect || !imgElement || cropRect.size === 0) {
      onCropCancel(); // Or show a message
      return;
    }

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
    onOpenChange(false); // This will trigger the onCropCancel in GridSettingsPanel if needed via useEffect
    onCropCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) handleCancelDialog(); // Ensure cancel logic runs if dialog is closed externally
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
          <Button type="button" onClick={handleConfirm} disabled={!cropRect || cropRect.size === 0}>
            Crop Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
