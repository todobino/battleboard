
import type { LucideProps } from 'lucide-react';
import type React from 'react';

export interface Point {
  x: number;
  y: number;
}

export interface GridCellData {
  id: string; // e.g., "0-0", "1-15"
  color?: string; // Background color of the cell
}

export interface Token {
  id: string;
  x: number; // grid column index
  y: number; // grid row index
  color: string; // Token's primary color (e.g., for its circle or icon fill)
  label?: string; // Optional label for the token
  icon?: React.FC<LucideProps> | ((props: { className?: string; color?: string }) => JSX.Element); // Lucide icon or custom SVG component
  type: 'player' | 'enemy' | 'item' | 'terrain' | 'generic';
  size?: number; // in grid units, default 1
}

export interface Participant {
  id: string;
  name: string;
  initiative: number;
  type: 'player' | 'enemy' | 'ally';
  hp?: number;
  ac?: number;
  tokenId?: string; // Optional: links to a token on the grid
}

export type ActiveTool =
  | 'select'
  | 'paint_cell'
  | 'place_token'
  | 'measure_distance'
  | 'measure_radius'
  | 'map_tool'
  | 'token_placer_tool'
  | 'eraser_tool'
  | 'shapes_tool';


export interface TokenTemplate {
  name: string;
  color: string;
  icon?: React.FC<LucideProps> | ((props: { className?: string; color?: string }) => JSX.Element);
  type: 'player' | 'enemy' | 'item' | 'terrain' | 'generic';
}

export interface Measurement {
  startPoint?: Point;
  endPoint?: Point;
  type: 'distance' | 'radius' | null;
  result?: string;
}

export interface BattleGridProps {
  gridCells: GridCellData[][];
  setGridCells: React.Dispatch<React.SetStateAction<GridCellData[][]>>;
  tokens: Token[];
  setTokens: React.Dispatch<React.SetStateAction<Token[]>>;
  showGridLines: boolean;
  backgroundImageUrl: string | null;
  backgroundZoomLevel?: number; // Added for background image zoom
  activeTool: ActiveTool;
  selectedColor: string;
  selectedTokenTemplate: Omit<Token, 'id' | 'x' | 'y'> | null;
  onTokenMove: (tokenId: string, newX: number, newY: number) => void;
  measurement: Measurement;
  setMeasurement: React.Dispatch<React.SetStateAction<Measurement>>;
}
