
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
  color: string; // Token's primary color (e.g., for its icon fill)
  label?: string; // Optional label for the token (e.g., from template like "Player", "Enemy")
  instanceName?: string; // Specific name for this token instance (e.g., "Player 1", "Goblin Archer")
  icon?: React.FC<LucideProps> | ((props: { className?: string; color?: string }) => JSX.Element); // Lucide icon or custom SVG component
  type: 'player' | 'enemy' | 'ally' | 'item' | 'terrain' | 'generic'; // Added 'ally'
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
  | 'shapes_tool' // Parent tool for shapes popover
  | 'draw_line'
  | 'draw_circle'
  | 'draw_square'
  | 'type_tool';


export interface TokenTemplate {
  name: string;
  color: string;
  icon?: React.FC<LucideProps> | ((props: { className?: string; color?: string }) => JSX.Element);
  type: 'player' | 'enemy' | 'ally' | 'item' | 'terrain' | 'generic'; // Added 'ally'
}

export interface Measurement {
  startPoint?: Point;
  endPoint?: Point;
  type: 'distance' | 'radius' | null;
  result?: string;
}

export interface DrawnShape {
  id:string;
  type: 'line' | 'circle' | 'square';
  startPoint: Point; // For line: start; for circle: center; for square: top-left
  endPoint: Point;   // For line: end; for circle: point on circumference; for square: bottom-right
  color: string; // Stroke color for line, border color for circle/square
  fillColor?: string; // Fill color for circle/square
  strokeWidth: number;
}

export interface BattleGridProps {
  gridCells: GridCellData[][];
  setGridCells: React.Dispatch<React.SetStateAction<GridCellData[][]>>;
  tokens: Token[];
  setTokens: React.Dispatch<React.SetStateAction<Token[]>>;
  drawnShapes: DrawnShape[];
  setDrawnShapes: React.Dispatch<React.SetStateAction<DrawnShape[]>>;
  currentDrawingShape: DrawnShape | null;
  setCurrentDrawingShape: React.Dispatch<React.SetStateAction<DrawnShape | null>>;
  showGridLines: boolean;
  backgroundImageUrl: string | null;
  backgroundZoomLevel?: number;
  activeTool: ActiveTool;
  setActiveTool: React.Dispatch<React.SetStateAction<ActiveTool>>;
  selectedColor: string;
  selectedTokenTemplate: Omit<Token, 'id' | 'x' | 'y'> | null;
  onTokenMove: (tokenId: string, newX: number, newY: number) => void;
  onTokenInstanceNameChange: (tokenId: string, newName: string) => void; // Added prop
  measurement: Measurement;
  setMeasurement: React.Dispatch<React.SetStateAction<Measurement>>;
}
