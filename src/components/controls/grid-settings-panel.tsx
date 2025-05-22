
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Grid, ImageUp, Trash2 } from 'lucide-react'; // Removed MousePointerSquareDashed
import { useToast } from '@/hooks/use-toast';

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

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center text-lg font-semibold mb-3 text-popover-foreground">
        <Grid className="mr-2 h-5 w-5" /> Grid Settings
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="toggle-grid-lines-popover">Show Grid Lines</Label>
        <Switch
          id="toggle-grid-lines-popover"
          checked={showGridLines}
          onCheckedChange={setShowGridLines}
          aria-label="Toggle grid lines"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="background-image-upload-popover">Background Image</Label>
        <Input
          id="background-image-upload-popover"
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
      {/* Removed Select/Pan Tool button from here */}
    </div>
  );
}
