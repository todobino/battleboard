
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, Token } from '@/types';
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { tokenTemplates } from '@/config/token-templates';
import { UploadCloud } from 'lucide-react';
import ImageCropDialog from '@/components/image-crop-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input'; // For hidden file input

interface TokenPlacerPanelProps {
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  setSelectedTokenTemplate: Dispatch<SetStateAction<Omit<Token, 'id' | 'x' | 'y'> | null>>;
  onTokenTemplateSelect?: () => void; // Callback to close popover
}

export default function TokenPlacerPanel({
  setActiveTool,
  setSelectedTokenTemplate,
  onTokenTemplateSelect,
}: TokenPlacerPanelProps) {
  const { toast } = useToast();
  const [uncroppedImageSrc, setUncroppedImageSrc] = useState<string | null>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectTokenTemplate = (template: typeof tokenTemplates[number]) => {
    setSelectedTokenTemplate({
      color: template.color,
      icon: template.icon,
      type: template.type,
      label: template.name,
      size: 1,
      customImageUrl: undefined, // Ensure customImageUrl is not carried over from a previous custom selection
    });
    setActiveTool('place_token');
    onTokenTemplateSelect?.();
  };

  const handleCustomTokenImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit for token images
        toast({
          title: 'Upload Error',
          description: 'Token image file size exceeds 2MB limit.',
          variant: 'destructive',
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setUncroppedImageSrc(reader.result as string);
        setIsCropDialogOpen(true);
        if (event.target) event.target.value = ''; // Reset file input
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropConfirmForToken = (croppedDataUrl: string) => {
    setSelectedTokenTemplate({
      customImageUrl: croppedDataUrl,
      type: 'generic', // Default type
      label: 'Custom Token', // Default label
      color: 'hsl(var(--muted))', // Default background for transparent parts
      size: 1,
      icon: undefined, // Explicitly no Lucide icon for custom image tokens
    });
    setActiveTool('place_token');
    setIsCropDialogOpen(false);
    setUncroppedImageSrc(null);
    toast({ title: 'Custom Token Ready', description: 'Click on the grid to place your custom token.' });
    onTokenTemplateSelect?.(); // Close the popover
  };

  const handleCropCancelForToken = () => {
    setIsCropDialogOpen(false);
    setUncroppedImageSrc(null);
  };

  return (
    <div>
      <Card className="border-none shadow-none bg-transparent">
        <CardContent className="grid grid-cols-3 gap-2 p-0">
          {tokenTemplates.map(template => {
            const Icon = template.icon;
            return (
            <Button
              key={template.name}
              variant="outline"
              className={cn(
                "aspect-square h-auto flex flex-col items-center justify-center p-1 space-y-0.5", // Reduced padding and space
                "border-2 border-transparent hover:border-accent"
              )}
              style={{ backgroundColor: template.color }}
              onClick={() => handleSelectTokenTemplate(template)}
              aria-label={`Place ${template.name} token`}
            >
              {Icon && <Icon className="h-5 w-5" color={"hsl(var(--primary-foreground))"} />}
              <span className="text-xs text-primary-foreground text-center leading-tight">{template.name}</span>
            </Button>
            );
          })}
        </CardContent>
      </Card>

      <div className="mt-3 pt-3 border-t border-border">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className="mr-2 h-4 w-4" /> Upload Custom Token
        </Button>
        <Input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleCustomTokenImageUpload}
          className="hidden"
        />
      </div>

      {uncroppedImageSrc && (
        <ImageCropDialog
          isOpen={isCropDialogOpen}
          onOpenChange={setIsCropDialogOpen}
          imageSrc={uncroppedImageSrc}
          onCropConfirm={handleCropConfirmForToken}
          onCropCancel={handleCropCancelForToken}
        />
      )}
    </div>
  );
}
