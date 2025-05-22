'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, Token, TokenTemplate } from '@/types';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Palette, Smile, Shield, Gem, MountainIcon as TerrainLucideIcon } from 'lucide-react';
import { PlayerIcon, EnemyIcon, ItemIcon, TerrainIcon, GenericTokenIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface ColorToolPanelProps {
  activeTool: ActiveTool;
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  selectedColor: string;
  setSelectedColor: Dispatch<SetStateAction<string>>;
  setSelectedTokenTemplate: Dispatch<SetStateAction<Omit<Token, 'id' | 'x' | 'y'> | null>>;
}

const defaultColors = [
  "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
  "#800000", "#008000", "#000080", "#808000", "#800080", "#008080",
  "#C0C0C0", "#808080", "#000000", "#FFFFFF"
];

const tokenTemplates: TokenTemplate[] = [
  { name: 'Player', color: 'hsl(var(--primary))', icon: PlayerIcon, type: 'player' },
  { name: 'Enemy', color: 'hsl(var(--destructive))', icon: EnemyIcon, type: 'enemy' },
  { name: 'Item', color: 'hsl(var(--accent))', icon: ItemIcon, type: 'item' },
  { name: 'Terrain', color: 'hsl(var(--muted-foreground))', icon: TerrainIcon, type: 'terrain' },
  { name: 'Generic', color: 'hsl(var(--secondary-foreground))', icon: GenericTokenIcon, type: 'item' },
];

export default function ColorToolPanel({
  activeTool, setActiveTool,
  selectedColor, setSelectedColor,
  setSelectedTokenTemplate
}: ColorToolPanelProps) {
  
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
    <AccordionItem value="color-tool">
      <AccordionTrigger>
        <Palette className="mr-2 h-5 w-5" /> Color & Token Tool
      </AccordionTrigger>
      <AccordionContent className="space-y-4 p-1">
        <div>
          <Label htmlFor="color-picker">Cell Paint Color</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              id="color-picker"
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-16 h-10 p-1"
              onFocus={() => setActiveTool('paint_cell')}
            />
            <Button 
              variant={activeTool === 'paint_cell' ? "default" : "outline"}
              onClick={() => setActiveTool('paint_cell')}
              className="flex-1"
            >
              Paint Cell
            </Button>
          </div>
          <div className="grid grid-cols-8 gap-1 mt-2">
            {defaultColors.map(color => (
              <Button
                key={color}
                variant="outline"
                size="icon"
                style={{ backgroundColor: color }}
                className="h-7 w-7 border"
                onClick={() => { setSelectedColor(color); setActiveTool('paint_cell');}}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
        </div>

        <div>
          <Label>Place Token</Label>
          <Card className="mt-1">
            <CardContent className="p-2 grid grid-cols-3 gap-2">
              {tokenTemplates.map(template => {
                const Icon = template.icon;
                return (
                <Button
                  key={template.name}
                  variant="outline"
                  className="h-auto flex flex-col items-center p-2 space-y-1"
                  onClick={() => handleSelectTokenTemplate(template)}
                  aria-label={`Place ${template.name} token`}
                >
                  {Icon && <Icon className="h-6 w-6" style={{color: template.color}} />}
                  <span className="text-xs">{template.name}</span>
                </Button>
                );
              })}
            </CardContent>
          </Card>
        </div>
        
      </AccordionContent>
    </AccordionItem>
  );
}
