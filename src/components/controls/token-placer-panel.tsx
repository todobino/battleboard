
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, Token } from '@/types';
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { tokenTemplates } from '@/config/token-templates';
import { UploadCloud, Plus, Minus } from 'lucide-react';
import ImageCropDialog from '@/components/image-crop-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const [currentTokenSize, setCurrentTokenSize] = useState(1);

  const handleSelectTokenTemplate = (template: typeof tokenTemplates[number]) => {
    setSelectedTokenTemplate({
      color: template.color,
      icon: template.icon,
      type: template.type,
      label: template.name,
      size: currentTokenSize,
      customImageUrl: undefined,
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
        if (event.target) event.target.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropConfirmForToken = (croppedDataUrl: string) => {
    setSelectedTokenTemplate({
      customImageUrl: croppedDataUrl,
      type: 'generic',
      label: 'Custom Token',
      color: 'hsl(var(--muted))',
      size: currentTokenSize,
      icon: undefined,
    });
    setActiveTool('place_token');
    setIsCropDialogOpen(false);
    setUncroppedImageSrc(null);
    toast({ title: 'Custom Token Ready', description: 'Click on the grid to place your custom token.' });
    onTokenTemplateSelect?.();
  };

  const handleCropCancelForToken = () => {
    setIsCropDialogOpen(false);
    setUncroppedImageSrc(null);
  };

  return (
    <div>
      <div className="mb-3">
        <Label className="text-sm font-medium">Token Size</Label>
        <div className="flex items-center mt-1 space-x-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentTokenSize(prev => Math.max(1, prev - 1))}
            disabled={currentTokenSize === 1}
            aria-label="Decrease token size"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold w-16 text-center tabular-nums">
            {currentTokenSize}x{currentTokenSize}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentTokenSize(prev => Math.min(9, prev + 1))}
            disabled={currentTokenSize === 9}
            aria-label="Increase token size"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="mb-3 pt-3 border-t border-border">
        <Card className="border-none shadow-none bg-transparent">
          <CardContent className="grid grid-cols-3 gap-2 p-0">
            {tokenTemplates.map(template => {
              const Icon = template.icon;
              return (
              <Button
                key={template.name}
                variant="outline"
                className={cn(
                  "aspect-square h-20 flex flex-col items-center justify-center p-1 space-y-0.5", // Changed h-auto to h-20
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
      </div>

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
