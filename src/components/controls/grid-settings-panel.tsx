
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool } from '@/types';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Grid, ImageUp, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import ImageCropDialog from '@/components/image-crop-dialog'; // New import

interface GridSettingsPanelProps {
  showGridLines: boolean;
  setShowGridLines: Dispatch<SetStateAction<boolean>>;
  backgroundImageUrl: string | null;
  setBackgroundImageUrl: Dispatch<SetStateAction<string | null>>;
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
}

export default function GridSettingsPanel({
  showGridLines, setShowGridLines,
  backgroundImageUrl, setBackgroundImageUrl,
  setActiveTool
}: GridSettingsPanelProps) {
  const { toast } = useToast();
  const [uncroppedImageSrc, setUncroppedImageSrc] = useState<string | null>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);

  const handleBackgroundImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Upload Error",
          description: "File size exceeds 5MB limit.",
          variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setUncroppedImageSrc(reader.result as string);
        setIsCropDialogOpen(true);
        // Clear the file input so the same file can be re-uploaded if needed
        if (event.target) {
          event.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropConfirm = (croppedDataUrl: string) => {
    setBackgroundImageUrl(croppedDataUrl);
    setIsCropDialogOpen(false);
    setUncroppedImageSrc(null);
    toast({ title: "Background Image Updated" });
  };

  const handleCropCancel = () => {
    setIsCropDialogOpen(false);
    setUncroppedImageSrc(null);
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center text-lg font-semibold mb-3 text-popover-foreground">
        <Grid className="mr-2 h-5 w-5" /> Grid Settings
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="toggle-grid-lines-popover" className="text-popover-foreground">Show Grid Lines</Label>
        <Switch
          id="toggle-grid-lines-popover"
          checked={showGridLines}
          onCheckedChange={setShowGridLines}
          aria-label="Toggle grid lines"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="background-image-upload-popover" className="text-popover-foreground">Background Image</Label>
        <Label 
          htmlFor="background-image-upload-popover"
          className={cn(
            "flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-md cursor-pointer",
            "bg-muted hover:bg-muted/80 border-border hover:border-primary text-muted-foreground transition-colors"
          )}
        >
          <ImageUp className="h-8 w-8 mb-2" />
          <span className="text-sm">Click or drag to upload</span>
        </Label>
        <Input
          id="background-image-upload-popover"
          type="file"
          accept="image/*"
          onChange={handleBackgroundImageUpload}
          className="hidden" // Hide the default input
        />
        {backgroundImageUrl && (
          <Button variant="outline" size="sm" onClick={() => setBackgroundImageUrl(null)} className="w-full">
            <Trash2 className="mr-2 h-4 w-4" /> Remove Background
          </Button>
        )}
      </div>

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
