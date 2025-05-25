
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, Token } from '@/types'; // TokenTemplate removed, Token used for Omit
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { tokenTemplates } from '@/config/token-templates'; // Import from new config file

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

  const handleSelectTokenTemplate = (template: typeof tokenTemplates[number]) => {
    setSelectedTokenTemplate({
      color: template.color,
      icon: template.icon,
      type: template.type,
      label: template.name, // This becomes the base for instanceName if not overridden
      size: 1,
    });
    setActiveTool('place_token');
    onTokenTemplateSelect?.(); 
  };

  return (
    <div>
      <Card className="border-none shadow-none bg-transparent">
        <CardContent className="grid grid-cols-3 gap-2 p-0"> {/* Changed to grid-cols-3 */}
          {tokenTemplates.map(template => {
            const Icon = template.icon;
            return (
            <Button
              key={template.name}
              variant="outline"
              className={cn(
                "aspect-square h-auto flex flex-col items-center justify-center p-2 space-y-1",
                "border-2 border-transparent hover:border-accent"
              )}
              style={{ backgroundColor: template.color }}
              onClick={() => handleSelectTokenTemplate(template)}
              aria-label={`Place ${template.name} token`}
            >
              {Icon && <Icon className="h-6 w-6" color={"hsl(var(--primary-foreground))"} />}
              <span className="text-xs text-primary-foreground text-center leading-tight">{template.name}</span>
            </Button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

