
'use client';

import type { GridCellData, Token, DrawnShape, TextObjectType, Participant, UndoableState, DefaultBattleMap, ActiveTool, Measurement } from '@/types';
import React, { useState, useCallback, useEffect } from 'react';
import { GenericTokenIcon } from '@/components/icons'; // Ensure this is correctly pathed
import { tokenTemplates } from '@/config/token-templates';
import { findAvailableSquare as findAvailableSquareGridUtils } from '@/lib/grid-utils'; // Renamed to avoid conflict
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_SHAPE_DRAW_COLOR } from '@/config/shape-colors';

const GRID_ROWS = 40; // Default grid dimensions
const GRID_COLS = 40;
const DEFAULT_TEXT_FONT_SIZE = 16;
const LOCAL_STORAGE_KEY_BBS = 'battleBoardStateV4'; // Updated key for new structure with multi-select

const initialGridCells = (): GridCellData[][] =>
  Array.from({ length: GRID_ROWS }, (_, y) =>
    Array.from({ length: GRID_COLS }, (_, x) => ({
      id: `${y}-${x}`,
      color: undefined,
    }))
  );

export const createInitialUndoableSnapshot = (initialState?: Partial<UndoableState>): UndoableState => ({
  gridCells: initialState?.gridCells || initialGridCells(),
  tokens: (initialState?.tokens || []).map(t => ({ ...t, icon: undefined })), // Icons stripped for history
  drawnShapes: initialState?.drawnShapes || [],
  textObjects: initialState?.textObjects || [],
  participants: initialState?.participants || [],
});

export function useBattleBoardState(defaultBattlemaps: DefaultBattleMap[]) {
  const { toast } = useToast();
  const [gridCells, setGridCells] = useState<GridCellData[][]>(initialGridCells());
  const [tokens, setTokens] = useState<Token[]>([]);
  const [drawnShapes, setDrawnShapes] = useState<DrawnShape[]>([]);
  const [textObjects, setTextObjects] = useState<TextObjectType[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [selectedTextObjectIds, setSelectedTextObjectIds] = useState<string[]>([]);

  const [showGridLines, setShowGridLines] = useState<boolean>(true);
  const [showAllLabels, setShowAllLabels] = useState<boolean>(true);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [backgroundZoomLevel, setBackgroundZoomLevel] = useState<number>(1);

  const [currentParticipantIndex, setCurrentParticipantIndex] = useState<number>(-1);
  const [roundCounter, setRoundCounter] = useState<number>(1);
  const [isCombatActive, setIsCombatActive] = useState<boolean>(false);

  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [selectedColor, setSelectedColor] = useState<string>('#FF0000'); // For paint_cell
  const [selectedTokenTemplate, setSelectedTokenTemplate] = useState<Omit<Token, 'id' | 'x' | 'y'> | null>(null);
  const [selectedShapeDrawColor, setSelectedShapeDrawColor] = useState<string>(DEFAULT_SHAPE_DRAW_COLOR); // For new shapes
  
  const [measurement, setMeasurement] = useState<Measurement>({type: null});
  const [currentTextFontSize, setCurrentTextFontSize] = useState<number>(DEFAULT_TEXT_FONT_SIZE);

  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState<'top' | 'bottom'>('top');

  const rehydrateToken = useCallback((tokenFromFile: Omit<Token, 'icon'>): Token => {
    const tokenData = tokenFromFile as Token; // Cast to include size
    if (tokenData.customImageUrl) {
      return { ...tokenData, icon: undefined, size: tokenData.size || 1 };
    }
    const template = tokenTemplates.find(t => t.type === tokenData.type && t.name === tokenData.label) ||
                     tokenTemplates.find(t => t.type === tokenData.type);
    return {
      ...tokenData,
      icon: template ? template.icon : GenericTokenIcon,
      size: tokenData.size || 1,
    };
  }, []);

  const stripIconsForStorage = (currentTokens: Token[]): Omit<Token, 'icon'>[] => {
    return currentTokens.map(({ icon, ...rest }) => rest);
  };

  // Load state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY_BBS);
      if (savedStateJSON) {
        try {
          const loaded = JSON.parse(savedStateJSON);
          setGridCells(loaded.gridCells || initialGridCells());
          setTokens((loaded.tokens || []).map(rehydrateToken));
          setDrawnShapes(loaded.drawnShapes || []);
          setTextObjects(loaded.textObjects || []);
          setParticipants(loaded.participants || []);
          setShowGridLines(loaded.showGridLines !== undefined ? loaded.showGridLines : true);
          setShowAllLabels(loaded.showAllLabels !== undefined ? loaded.showAllLabels : true);
          setBackgroundImageUrl(loaded.backgroundImageUrl || null);
          setBackgroundZoomLevel(loaded.backgroundZoomLevel || 1);
          setCurrentParticipantIndex(loaded.currentParticipantIndex !== undefined ? loaded.currentParticipantIndex : -1);
          setRoundCounter(loaded.roundCounter || 1);
          setIsCombatActive(loaded.isCombatActive || false);
          setToolbarPosition(loaded.toolbarPosition || 'top');
          setSelectedTokenIds(loaded.selectedTokenIds || []);
          setSelectedShapeIds(loaded.selectedShapeIds || []);
          setSelectedTextObjectIds(loaded.selectedTextObjectIds || []);
          setSelectedShapeDrawColor(loaded.selectedShapeDrawColor || DEFAULT_SHAPE_DRAW_COLOR);
        } catch (error) {
          console.error("Failed to load state from localStorage:", error);
          localStorage.removeItem(LOCAL_STORAGE_KEY_BBS); // Clear corrupted state
        }
      }
      setIsInitialLoadComplete(true);
    }
  }, [rehydrateToken]);

  // Save state to localStorage
  useEffect(() => {
    if (!isInitialLoadComplete) return;

    const stateToSave = {
      gridCells, tokens: stripIconsForStorage(tokens), drawnShapes, textObjects, participants,
      showGridLines, showAllLabels, backgroundImageUrl, backgroundZoomLevel,
      currentParticipantIndex, roundCounter, isCombatActive, toolbarPosition,
      selectedTokenIds, selectedShapeIds, selectedTextObjectIds,
      selectedShapeDrawColor, // Save selected shape draw color
    };
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_BBS, JSON.stringify(stateToSave));
    } catch (error) {
      console.error("Failed to save state to localStorage:", error);
    }
  }, [
    gridCells, tokens, drawnShapes, textObjects, participants,
    showGridLines, showAllLabels, backgroundImageUrl, backgroundZoomLevel,
    currentParticipantIndex, roundCounter, isCombatActive, toolbarPosition,
    selectedTokenIds, selectedShapeIds, selectedTextObjectIds,
    selectedShapeDrawColor, // Include in dependency array
    isInitialLoadComplete
  ]);
  
  const getCurrentSnapshot = useCallback((): UndoableState => {
    return {
      gridCells: JSON.parse(JSON.stringify(gridCells)), // Deep copy
      tokens: stripIconsForStorage(JSON.parse(JSON.stringify(tokens))),
      drawnShapes: JSON.parse(JSON.stringify(drawnShapes)),
      textObjects: JSON.parse(JSON.stringify(textObjects)),
      participants: JSON.parse(JSON.stringify(participants)),
    };
  }, [gridCells, tokens, drawnShapes, textObjects, participants]);

  const restoreSnapshot = useCallback((snapshot: UndoableState) => {
    setGridCells(snapshot.gridCells);
    setTokens(snapshot.tokens.map(rehydrateToken));
    setDrawnShapes(snapshot.drawnShapes);
    setTextObjects(snapshot.textObjects);
    setParticipants(snapshot.participants);
    setSelectedTokenIds([]);
    setSelectedShapeIds([]);
    setSelectedTextObjectIds([]);
  }, [rehydrateToken]);


  return {
    gridCells, setGridCells,
    tokens, setTokens,
    drawnShapes, setDrawnShapes,
    textObjects, setTextObjects,
    participants, setParticipants,

    selectedTokenIds, setSelectedTokenIds,
    selectedShapeIds, setSelectedShapeIds,
    selectedTextObjectIds, setSelectedTextObjectIds,

    showGridLines, setShowGridLines,
    showAllLabels, setShowAllLabels,
    backgroundImageUrl, setBackgroundImageUrl,
    backgroundZoomLevel, setBackgroundZoomLevel,
    currentParticipantIndex, setCurrentParticipantIndex,
    roundCounter, setRoundCounter,
    isCombatActive, setIsCombatActive,
    activeTool, setActiveTool,
    selectedColor, setSelectedColor, // For paint_cell
    selectedTokenTemplate, setSelectedTokenTemplate,
    selectedShapeDrawColor, setSelectedShapeDrawColor, // For new shapes
    measurement, setMeasurement,
    currentTextFontSize, setCurrentTextFontSize,
    isInitialLoadComplete, setIsInitialLoadComplete,
    toolbarPosition, setToolbarPosition,
    getCurrentSnapshot, 
    restoreSnapshot,   
    GRID_ROWS, GRID_COLS, 
    rehydrateToken, stripIconsForStorage, 
    toast, 
    findAvailableSquare: findAvailableSquareGridUtils, 
  };
}
