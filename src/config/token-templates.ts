
import type { TokenTemplate } from '@/types';
import { PlayerIcon, EnemyIcon, AllyIcon, ItemIcon, TerrainIcon, GenericTokenIcon } from '@/components/icons';

export const tokenTemplates: TokenTemplate[] = [
  { name: 'Player', color: 'hsl(var(--player-green-bg))', icon: PlayerIcon, type: 'player' },
  { name: 'Enemy', color: 'hsl(var(--destructive))', icon: EnemyIcon, type: 'enemy' },
  { name: 'Ally', color: 'hsl(var(--app-blue-bg))', icon: AllyIcon, type: 'ally' },
  { name: 'Item', color: 'hsl(270, 40%, 30%)', icon: ItemIcon, type: 'item' },
  { name: 'Obstacle', color: 'hsl(var(--muted))', icon: TerrainIcon, type: 'terrain' },
  { name: 'Random', color: 'hsl(var(--accent))', icon: GenericTokenIcon, type: 'generic' },
];
