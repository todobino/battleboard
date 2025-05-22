'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool } from '@/types';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Grid, ZoomIn, ZoomOut, ImageUp, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GridSettingsPanelProps {
  showGridLines: boolean;
  setShowGridLines: Dispatch<SetStateAction<boolean>>;
  zoomLevel: number;
  setZoomLevel: Dispatch<SetStateAction<number>>; // This will be removed as zoom is handled by SVG viewBox
  backgroundImageUrl: string | null;
  setBackgroundImageUrl: Dispatch<SetStateAction<string | null>>;
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
}

export default function GridSettingsPanel({
  showGridLines, setShowGridLines,
  // zoomLevel, setZoomLevel, // Zoom is handled by SVG directly now
  backgroundImageUrl, setBackgroundImageUrl,
  setActiveTool
}: GridSettingsPanelProps) {
  const { toast } = useToast();

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
        setBackgroundImageUrl(reader.result as string);
        toast({ title: "Background Image Updated" });
      };
      reader.readAsDataURL(file);
    }
  };

  // Zoom controls here would manipulate the SVG's viewBox.
  // For simplicity in this scaffold, direct manipulation via BattleGrid's wheel event is implemented.
  // Buttons here could call functions on BattleGrid ref if needed.

  return (
    <AccordionItem value="grid-settings">
      <AccordionTrigger>
        <Grid className="mr-2 h-5 w-5" /> Grid Settings
      </AccordionTrigger>
      <AccordionContent className="space-y-4 p-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="toggle-grid-lines">Show Grid Lines</Label>
          <Switch
            id="toggle-grid-lines"
            checked={showGridLines}
            onCheckedChange={setShowGridLines}
            aria-label="Toggle grid lines"
          />
        </div>
        
        {/* Zoom buttons are illustrative; actual zoom is via mouse wheel on grid for now */}
        {/* <div className="space-y-2">
          <Label>Zoom</Label>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))} aria-label="Zoom out">
              <ZoomOut />
            </Button>
            <Slider 
              value={[zoomLevel]} 
              onValueChange={(value) => setZoomLevel(value[0])} 
              min={0.5} max={2} step={0.1} 
              className="flex-1"
              aria-label="Zoom level"
            />
            <Button variant="outline" size="icon" onClick={() => setZoomLevel(prev => Math.min(2, prev + 0.1))} aria-label="Zoom in">
              <ZoomIn />
            </Button>
          </div>
        </div> */}

        <div className="space-y-2">
          <Label htmlFor="background-image-upload">Background Image</Label>
          <Input
            id="background-image-upload"
            type="file"
            accept="image/*"
            onChange={handleBackgroundImageUpload}
            className="text-sm"
          />
          {backgroundImageUrl && (
            <Button variant="outline" size="sm" onClick={() => setBackgroundImageUrl(null)} className="w-full">
              <Trash2 className="mr-2 h-4 w-4" /> Remove Background
            </Button>
          )}
        </div>
         <Button variant="outline" onClick={() => setActiveTool('select')} className="w-full">
            Select/Pan Tool (Ctrl+Click or Middle Mouse to Pan, Wheel to Zoom)
        </Button>
      </AccordionContent>
    </AccordionItem>
  );
}
