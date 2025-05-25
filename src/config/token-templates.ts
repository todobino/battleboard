
import type { TokenTemplate } from '@/types';
import { PlayerIcon, EnemyIcon, AllyIcon, ItemIcon, TerrainIcon, GenericTokenIcon } from '@/components/icons';

export const tokenTemplates: TokenTemplate[] = [
  { name: 'Player', color: 'hsl(var(--player-green-bg))', icon: PlayerIcon, type: 'player' },
  { name: 'Enemy', color: 'hsl(0, 60%, 30%)', icon: EnemyIcon, type: 'enemy' },
  { name: 'Ally', color: 'hsl(210, 70%, 45%)', icon: AllyIcon, type: 'ally' },
  { name: 'Item', color: 'hsl(270, 40%, 30%)', icon: ItemIcon, type: 'item' },
  { name: 'Terrain', color: 'hsl(var(--muted))', icon: TerrainIcon, type: 'terrain' },
  { name: 'Generic', color: 'hsl(var(--accent))', icon: GenericTokenIcon, type: 'generic' },
];
