
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, Token, TokenTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Puzzle } from 'lucide-react';
import { PlayerIcon, EnemyIcon, ItemIcon, TerrainIcon, GenericTokenIcon } from '@/components/icons';

interface TokenPlacerPanelProps {
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  setSelectedTokenTemplate: Dispatch<SetStateAction<Omit<Token, 'id' | 'x' | 'y'> | null>>;
}

const tokenTemplates: TokenTemplate[] = [
  { name: 'Player', color: 'hsl(var(--primary))', icon: PlayerIcon, type: 'player' },
  { name: 'Enemy', color: 'hsl(var(--destructive))', icon: EnemyIcon, type: 'enemy' },
  { name: 'Item', color: 'hsl(var(--accent))', icon: ItemIcon, type: 'item' },
  { name: 'Terrain', color: 'hsl(var(--muted-foreground))', icon: TerrainIcon, type: 'terrain' },
  { name: 'Generic', color: 'hsl(var(--secondary-foreground))', icon: GenericTokenIcon, type: 'item' },
];

export default function TokenPlacerPanel({
  setActiveTool,
  setSelectedTokenTemplate,
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
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center text-lg font-semibold mb-3 text-popover-foreground">
        <Puzzle className="mr-2 h-5 w-5" /> Tokens & Terrain
      </div>
      <Card className="bg-popover-foreground/5 border-border/50">
        <CardContent className="p-2 grid grid-cols-3 gap-2">
          {tokenTemplates.map(template => {
            const Icon = template.icon;
            return (
            <Button
              key={template.name}
              variant="outline"
              className="h-auto flex flex-col items-center p-2 space-y-1 bg-card hover:bg-muted"
              onClick={() => handleSelectTokenTemplate(template)}
              aria-label={`Place ${template.name} token`}
            >
              {Icon && <Icon className="h-6 w-6" style={{color: template.color}} />}
              <span className="text-xs text-card-foreground">{template.name}</span>
            </Button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
