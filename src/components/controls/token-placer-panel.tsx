
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, Token, TokenTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
// Users icon import removed as header is removed
import { PlayerIcon, EnemyIcon, ItemIcon, TerrainIcon, GenericTokenIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface TokenPlacerPanelProps {
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  setSelectedTokenTemplate: Dispatch<SetStateAction<Omit<Token, 'id' | 'x' | 'y'> | null>>;
  onTokenTemplateSelect?: () => void; // Callback to close popover
}

const tokenTemplates: TokenTemplate[] = [
  { name: 'Player', color: 'hsl(120, 40%, 25%)', icon: PlayerIcon, type: 'player' },
  { name: 'Enemy', color: 'hsl(0, 60%, 30%)', icon: EnemyIcon, type: 'enemy' },
  { name: 'Item', color: 'hsl(270, 40%, 30%)', icon: ItemIcon, type: 'item' },
  { name: 'Terrain', color: 'hsl(var(--muted))', icon: TerrainIcon, type: 'terrain' },
  { name: 'Generic', color: 'hsl(var(--accent))', icon: GenericTokenIcon, type: 'generic' },
];

export default function TokenPlacerPanel({
  setActiveTool,
  setSelectedTokenTemplate,
  onTokenTemplateSelect,
}: TokenPlacerPanelProps) {

  const handleSelectTokenTemplate = (template: TokenTemplate) => {
    setSelectedTokenTemplate({
      color: template.color,
      icon: template.icon,
      type: template.type,
      label: template.name,
      size: 1,
    });
    setActiveTool('place_token');
    onTokenTemplateSelect?.(); // Call the callback to close the popover
  };

  return (
    <div>
      {/* Header div removed */}
      <Card className="border-none shadow-none bg-transparent"> {/* Removed background and border */}
        <CardContent className="grid grid-cols-5 gap-2 p-0"> {/* Removed p-2 */}
          {tokenTemplates.map(template => {
            const Icon = template.icon;
            return (
            <Button
              key={template.name}
              variant="outline"
              className={cn(
                "aspect-square h-auto flex flex-col items-center justify-center p-2 space-y-1"
                // Removed hover:border-accent
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
