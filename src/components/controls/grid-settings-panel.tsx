
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, GridSettingsPanelProps as GridSettingsPanelPropsType, DefaultBattleMap } from '@/types'; // Updated imports
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Switch import removed as toggle is removed
import { ImageUp, Trash2, ZoomIn } from 'lucide-react'; // Grid icon removed
import { cn } from '@/lib/utils';
import ImageCropDialog from '@/components/image-crop-dialog';
import { Slider } from '@/components/ui/slider';
import NextImage from 'next/image';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

// Using the imported GridSettingsPanelPropsType
interface GridSettingsPanelProps extends GridSettingsPanelPropsType {}


export default function GridSettingsPanel({
  showGridLines, // Prop kept for now, but UI element removed
  setShowGridLines, // Prop kept for now, but UI element removed
  backgroundImageUrl,
  setBackgroundImageUrl,
  setActiveTool,
  backgroundZoomLevel,
  setBackgroundZoomLevel,
  defaultBattlemaps, // Added prop
}: GridSettingsPanelProps) {
  const [uncroppedImageSrc, setUncroppedImageSrc] = useState<string | null>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);

  const handleBackgroundImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setUncroppedImageSrc(reader.result as string);
        setIsCropDialogOpen(true); // Open the crop dialog
        event.target.value = ''; // Reset file input
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropConfirm = (croppedDataUrl: string) => {
    setBackgroundImageUrl(croppedDataUrl);
    setIsCropDialogOpen(false);
    setUncroppedImageSrc(null);
    setBackgroundZoomLevel(1); // Reset zoom when new image is set
  };

  const handleCropCancel = () => {
    setIsCropDialogOpen(false);
    setUncroppedImageSrc(null);
  };

  const handleSelectDefaultMap = (url: string) => {
    setBackgroundImageUrl(url);
    setBackgroundZoomLevel(1); // Reset zoom for default maps
  };

  return (
    <div className="space-y-4"> {/* Removed p-4 */}
      {/* Header: Title and Grid Lines Toggle REMOVED */}
      {/* 
      <div className="flex items-center justify-between text-lg font-semibold mb-3 text-popover-foreground">
        <div className="flex items-center">
          <Grid className="mr-2 h-5 w-5" /> Map & Grid Settings
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="toggle-grid-lines-popover-header" className="text-sm text-popover-foreground">
            Grid Lines
          </Label>
          <Switch
            id="toggle-grid-lines-popover-header"
            checked={showGridLines}
            onCheckedChange={setShowGridLines}
            aria-label="Toggle grid lines"
          />
        </div>
      </div> 
      */}

      {/* Main content row: Left Col (Default Maps), Right Col (Uploader) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start pt-2"> {/* Added pt-2 to compensate for removed header */}
        {/* Left Column: Default Maps */}
        <div className="lg:w-3/5 space-y-4">
          <div>
            <Label className="text-popover-foreground flex items-center">Default Battlemaps</Label>
            {defaultBattlemaps && defaultBattlemaps.length > 0 ? (
              <ScrollArea className="w-full h-28 rounded-md border border-border mt-1">
                <div className="flex space-x-2 p-2">
                  {defaultBattlemaps.map((map) => (
                    <button
                      key={map.name}
                      onClick={() => handleSelectDefaultMap(map.url)}
                      className={cn(
                        'relative aspect-square w-24 h-24 shrink-0 rounded-md overflow-hidden border-2 hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all',
                        backgroundImageUrl === map.url ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-border'
                      )}
                      title={`Select ${map.name}`}
                    >
                      <NextImage
                        src={map.url}
                        alt={map.name}
                        layout="fill"
                        objectFit="cover"
                        data-ai-hint={map.hint}
                        unoptimized={map.url.endsWith('.webp')}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-1 text-center">
                        <span className="text-xs text-white truncate">{map.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            ) : (
              <div className="w-full h-28 rounded-md border border-border mt-1 flex items-center justify-center text-sm text-muted-foreground">
                No default maps found.
              </div>
            )}
            {backgroundImageUrl &&
              defaultBattlemaps.some((m) => m.url === backgroundImageUrl) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBackgroundImageUrl(null);
                    setBackgroundZoomLevel(1);
                  }}
                  className="w-full mt-2"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Clear Default Background
                </Button>
              )}
          </div>
        </div>

        {/* Right Column: Image Uploader */}
        <div className="lg:w-2/5 space-y-4">
          <div>
            <Label
              htmlFor="background-image-upload-popover-main"
              className="text-popover-foreground flex items-center"
            >
              Upload Background
            </Label>
            <Label
              htmlFor="background-image-upload-popover-main"
              className={cn(
                'flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-md cursor-pointer mt-2',
                'bg-muted hover:bg-muted/80 border-border hover:border-primary text-muted-foreground transition-colors'
              )}
            >
              <ImageUp className="h-8 w-8 mb-2" />
              <span className="text-sm">Click or drag to upload</span>
            </Label>
            <Input
              id="background-image-upload-popover-main"
              type="file"
              accept="image/*"
              onChange={handleBackgroundImageUpload}
              className="hidden"
            />
            {backgroundImageUrl &&
              !defaultBattlemaps.some((m) => m.url === backgroundImageUrl) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBackgroundImageUrl(null);
                    setBackgroundZoomLevel(1);
                  }}
                  className="w-full mt-2"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Remove Custom Background
                </Button>
              )}
          </div>
        </div>
      </div>

      {/* Background Zoom Section - Moved to span full width below the two columns */}
      {backgroundImageUrl && (
        <div className="space-y-2 pt-4 border-t border-border mt-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="background-zoom-slider" className="text-popover-foreground flex items-center">
              <ZoomIn className="mr-2 h-4 w-4" /> Background Zoom
            </Label>
            <span className="text-sm text-muted-foreground">
              {(backgroundZoomLevel * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            id="background-zoom-slider"
            min={0.2}
            max={3}
            step={0.05}
            value={[backgroundZoomLevel]}
            onValueChange={(val) => setBackgroundZoomLevel(val[0])}
          />
        </div>
      )}

      {uncroppedImageSrc && (
        <ImageCropDialog
          isOpen={isCropDialogOpen}
          onOpenChange={setIsCropDialogOpen}
          imageSrc={uncroppedImageSrc}
          onCropConfirm={handleCropConfirm}
          onCropCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
