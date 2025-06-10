

import type { LucideProps } from 'lucide-react';
import type React from 'react';
import type { UseToast } from '@/hooks/use-toast'; // For BattleGridProps

export interface Point {
  x: number;
  y: number;
}

export interface GridCellData {
  id: string; // e.g., "0-0", "1-15"
  color?: string; // Background color of the cell
}

export interface Token {
  id:string;
  x: number; // grid column index
  y: number; // grid row index
  color: string; // Token's primary color (e.g., for its icon fill or background for transparent custom image)
  label?: string; // Optional label for the token (e.g., from template like "Player", "Enemy")
  instanceName?: string; // Specific name for this token instance (e.g., "Player 1", "Goblin Archer")
  icon?: React.FC<LucideProps & {x?: number; y?:number; width?: string | number; height?: string | number; color?: string}>; // Optional if customImageUrl is used
  customImageUrl?: string; // New field for custom images (data URI)
  type: 'player' | 'enemy' | 'ally' | 'item' | 'terrain' | 'generic';
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
  customImageUrl?: string; // Added to participant for initiative tracker display consistency
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
  | 'draw_rectangle'
  | 'type_tool';


export interface TokenTemplate {
  name: string;
  color: string;
  icon?: React.FC<LucideProps> | ((props: { className?: string; color?: string }) => JSX.Element);
  type: 'player' | 'enemy' | 'ally' | 'item' | 'terrain' | 'generic';
  size?: number; // Added to allow default sizes from templates if needed
}

export interface Measurement {
  startPoint?: Point;
  endPoint?: Point;
  type: 'distance' | 'radius' | null;
  result?: string;
}

export interface DrawnShape {
  id:string;
  type: 'line' | 'circle' | 'rectangle';
  startPoint: Point; // For line: start; for circle: center; for rectangle: top-left
  endPoint: Point;   // For line: end; for circle: point on circumference; for rectangle: bottom-right
  color: string; // Stroke color for line, border color for circle/rectangle
  fillColor?: string; // Fill color for circle/rectangle - will typically be same as 'color' but with different opacity rule
  strokeWidth: number;
  label?: string;
  opacity?: number; // For fill opacity of circles/rectangles, stroke opacity for lines
  isLocked?: boolean; // Added to allow shapes to be locked
}

export interface TextObjectType {
  id: string;
  x: number;
  y: number;
  content: string;
  fontSize: number;
  width: number; // Calculated width for the background bubble
  height: number; // Calculated height for the background bubble
}

export interface DefaultBattleMap {
  name: string;
  url: string;
  hint: string;
}

// Props for the main BattleGrid component, now acting more as a container
export interface BattleGridProps {
  gridCells: GridCellData[][];
  setGridCells: React.Dispatch<React.SetStateAction<GridCellData[][]>>;
  tokens: Token[];
  setTokens: React.Dispatch<React.SetStateAction<Token[]>>;
  drawnShapes: DrawnShape[];
  setDrawnShapes: React.Dispatch<React.SetStateAction<DrawnShape[]>>;
  currentDrawingShape: DrawnShape | null; // Still needed for interactions hook
  setCurrentDrawingShape: React.Dispatch<React.SetStateAction<DrawnShape | null>>; // Still needed for interactions hook
  textObjects: TextObjectType[];
  setTextObjects: React.Dispatch<React.SetStateAction<TextObjectType[]>>;
  showGridLines: boolean;
  setShowGridLines: React.Dispatch<React.SetStateAction<boolean>>;
  showAllLabels: boolean;
  setShowAllLabels: React.Dispatch<React.SetStateAction<boolean>>;
  backgroundImageUrl: string | null;
  backgroundZoomLevel?: number;
  activeTool: ActiveTool;
  setActiveTool: React.Dispatch<React.SetStateAction<ActiveTool>>;
  selectedColor: string; // For paint_cell tool
  selectedTokenTemplate: Omit<Token, 'id' | 'x' | 'y'> | null;
  selectedShapeDrawColor: string; // For new shapes
  onTokenMove: (tokenId: string, newX: number, newY: number) => void;
  onTokenInstanceNameChange: (tokenId: string, newName: string) => void;
  measurement: Measurement;
  setMeasurement: React.Dispatch<React.SetStateAction<Measurement>>;
  activeTurnTokenId?: string | null;
  currentTextFontSize: number;
  onTokenDelete: (tokenId: string) => void;
  onTokenErasedOnGrid?: (tokenId: string) => void;
  onTokenImageChangeRequest: (tokenId: string) => void;
  onChangeTokenSize?: (tokenId: string, newSize: number) => void;
  onSetShapeColor: (shapeId: string, newColor: string) => void; // For RightClickMenu

  selectedTokenIds: string[];
  setSelectedTokenIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedShapeIds: string[];
  setSelectedShapeIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedTextObjectIds: string[];
  setSelectedTextObjectIds: React.Dispatch<React.SetStateAction<string[]>>;

  tokenIdToFocus?: string | null;
  onFocusHandled?: () => void;

  onOpenAddCombatantDialogForToken?: (token: Token) => void;
  onOpenEditStatsDialogForToken?: (tokenId: string) => void;
  participants: Participant[]; // For right-click menu context
  toast: UseToast['toast']; // Pass toast function
}


export interface UndoableState {
  gridCells: GridCellData[][];
  tokens: Omit<Token, 'icon'>[]; // Icons are stripped for storage
  drawnShapes: DrawnShape[];
  textObjects: TextObjectType[];
  participants: Participant[];
}


export interface BattleBoardPageProps {
  defaultBattlemaps: DefaultBattleMap[];
}

export interface FloatingToolbarProps {
  activeTool: ActiveTool;
  setActiveTool: React.Dispatch<React.SetStateAction<ActiveTool>>;
  selectedColor: string; // For paint_cell
  setSelectedColor: React.Dispatch<React.SetStateAction<string>>; // For paint_cell
  selectedTokenTemplate: Omit<Token, 'id' | 'x' | 'y'> | null;
  setSelectedTokenTemplate: React.Dispatch<React.SetStateAction<Omit<Token, 'id' | 'x' | 'y'> | null>>;
  selectedShapeDrawColor: string; // For new shapes
  setSelectedShapeDrawColor: React.Dispatch<React.SetStateAction<string>>; // For new shapes
  backgroundImageUrl: string | null;
  setBackgroundImageUrl: React.Dispatch<React.SetStateAction<string | null>>;
  showGridLines: boolean;
  setShowGridLines: React.Dispatch<React.SetStateAction<boolean>>;
  showAllLabels: boolean;
  setShowAllLabels: React.Dispatch<React.SetStateAction<boolean>>;
  measurement: Measurement;
  setMeasurement: React.Dispatch<React.SetStateAction<Measurement>>;
  backgroundZoomLevel: number;
  setBackgroundZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onResetBoard: () => void;
  defaultBattlemaps: DefaultBattleMap[];
  escapePressCount: number; // Passed from BattleBoardPage
  toolbarPosition: 'top' | 'bottom';
  setToolbarPosition: React.Dispatch<React.SetStateAction<'top' | 'bottom'>>;
}

export interface GridSettingsPanelProps {
  showGridLines: boolean;
  setShowGridLines: React.Dispatch<React.SetStateAction<boolean>>;
  backgroundImageUrl: string | null;
  setBackgroundImageUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveTool: React.Dispatch<React.SetStateAction<ActiveTool>>; // May not be needed if popover closes on tool select
  backgroundZoomLevel: number;
  setBackgroundZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  defaultBattlemaps: DefaultBattleMap[];
}

export interface InitiativeTrackerPanelProps {
  participantsProp?: Participant[];
  tokens: Token[];
  currentParticipantIndex: number;
  roundCounter?: number; // Made optional as it's displayed in BattleBoardPage header
  onRemoveParticipant: (id: string) => void;
  onRenameParticipant: (id: string, newName: string) => void;
  onChangeParticipantTokenImage: (id: string, newImageUrl: string) => void;
  onFocusToken?: (tokenId: string) => void;
  onMoveParticipantUp?: (participantId: string) => void;
  onMoveParticipantDown?: (participantId: string) => void;
  onOpenEditStatsDialogForParticipant?: (participant: Participant) => void;
}

export interface ShapeToolPanelProps {
  setActiveTool: React.Dispatch<React.SetStateAction<ActiveTool>>;
  selectedShapeDrawColor: string;
  setSelectedShapeDrawColor: React.Dispatch<React.SetStateAction<string>>;
  onToolSelect?: () => void; // Callback to close popover after shape TYPE selection
}
