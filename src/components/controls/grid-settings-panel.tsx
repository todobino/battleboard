'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool } from '@/types';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Grid, ImageUp, Trash2, ZoomIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import ImageCropDialog from '@/components/image-crop-dialog';
import { Slider } from '@/components/ui/slider';
import NextImage from 'next/image';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface GridSettingsPanelProps {
  showGridLines: boolean;
  setShowGridLines: Dispatch<SetStateAction<boolean>>;
  backgroundImageUrl: string | null;
  setBackgroundImageUrl: Dispatch<SetStateAction<string | null>>;
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  backgroundZoomLevel: number;
  setBackgroundZoomLevel: Dispatch<SetStateAction<number>>;
}

const defaultBattlemaps = [
  { name: 'Forest Clearing', url: 'https://placehold.co/600x600.png', hint: 'forest clearing' },
  { name: 'Dungeon Corridor', url: 'https://placehold.co/600x600.png', hint: 'dungeon corridor' },
  { name: 'Cobblestone Street', url: 'https://placehold.co/600x600.png', hint: 'cobblestone street' },
  { name: 'Tavern Interior', url: 'https://placehold.co/600x600.png', hint: 'tavern interior' },
  { name: 'Cave System', url: 'https://placehold.co/600x600.png', hint: 'cave system' },
  { name: 'Desert Oasis', url: 'https://placehold.co/600x600.png', hint: 'desert oasis' },
  { name: 'Swamp Marsh', url: 'https://placehold.co/600x600.png', hint: 'swamp marsh' },
  { name: 'Castle Courtyard', url: 'https://placehold.co/600x600.png', hint: 'castle courtyard' },
  { name: 'Ship Deck', url: 'https://placehold.co/600x600.png', hint: 'ship deck' },
  { name: 'Mountain Pass', url: 'https://placehold.co/600x600.png', hint: 'mountain pass' },
];

export default function GridSettingsPanel({
  showGridLines,
  setShowGridLines,
  backgroundImageUrl,
  setBackgroundImageUrl,
  setActiveTool,
  backgroundZoomLevel,
  setBackgroundZoomLevel,
}: GridSettingsPanelProps) {
  const { toast } = useToast();
  const [uncroppedImageSrc, setUncroppedImageSrc] = useState<string | null>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);

  const handleBackgroundImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Upload Error',
          description: 'File size exceeds 5MB limit.',
          variant: 'destructive',
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setUncroppedImageSrc(reader.result as string);
        setIsCropDialogOpen(true);
        event.target.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropConfirm = (croppedDataUrl: string) => {
    setBackgroundImageUrl(croppedDataUrl);
    setIsCropDialogOpen(false);
    setUncroppedImageSrc(null);
    setBackgroundZoomLevel(1);
    toast({ title: 'Background Image Updated' });
  };

  const handleCropCancel = () => {
    setIsCropDialogOpen(false);
    setUncroppedImageSrc(null);
  };

  const handleSelectDefaultMap = (url: string) => {
    setBackgroundImageUrl(url);
    setBackgroundZoomLevel(1);
    toast({ title: 'Default Battlemap Selected' });
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
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

      {/* Default Maps & Upload Row */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Default Maps Carousel */}
        <div className="lg:w-3/5 space-y-2">
          <Label className="text-popover-foreground flex items-center">Default Battlemaps</Label>
          <ScrollArea className="w-full h-28 rounded-md border border-border">
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
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-1 text-center">
                    <span className="text-xs text-white truncate">{map.name}</span>
                  </div>
                </button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
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

        {/* Image Uploader (match carousel height) */}
        <div className="lg:w-2/5 space-y-2">
          <Label
            htmlFor="background-image-upload-popover-main"
            className="text-popover-foreground flex items-center"
          >
            Upload Background
          </Label>
          <Label
            htmlFor="background-image-upload-popover-main"
            className={cn(
              'flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-md cursor-pointer',
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
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove Custom Background
              </Button>
            )}
        </div>
      </div>

      {/* Zoom Slider */}
      {backgroundImageUrl && (
        <div className="space-y-2 pt-4">
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
