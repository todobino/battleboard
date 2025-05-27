
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Point, GridCellData, Token, Participant, ActiveTool, Measurement, DrawnShape, TextObjectType, UndoableState, BattleBoardPageProps } from '@/types';
import BattleGrid from '@/components/battle-grid/battle-grid';
import FloatingToolbar from '@/components/floating-toolbar';
import InitiativeTrackerPanel from '@/components/controls/initiative-tracker-panel';
import WelcomeDialog from '@/components/welcome-dialog';
import { SidebarProvider, Sidebar, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LandPlot, Plus, Minus, ArrowRight, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ImageCropDialog from '@/components/image-crop-dialog';
import { PlayerIcon, EnemyIcon, AllyIcon, GenericTokenIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter as FormDialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { tokenTemplates } from '@/config/token-templates';

const GRID_ROWS = 40;
const GRID_COLS = 40;
const DEFAULT_TEXT_FONT_SIZE = 16;
const MAX_HISTORY_LENGTH = 10; // Reduced from 30
const WELCOME_DIALOG_STORAGE_KEY = 'hasSeenWelcomeDialogV1';
const LOCAL_STORAGE_KEY = 'battleBoardStateV2';


const initialGridCells = (): GridCellData[][] =>
  Array.from({ length: GRID_ROWS }, (_, y) =>
    Array.from({ length: GRID_COLS }, (_, x) => ({
      id: `${y}-${x}`,
      color: undefined,
    }))
  );

const createInitialSnapshot = (): UndoableState => ({
  gridCells: initialGridCells(),
  tokens: [],
  drawnShapes: [],
  textObjects: [],
  participants: [],
});


// Helper to check if a square is occupied by a token (local to BattleBoardPage)
function isSquareOccupiedLocal(
  x: number,
  y: number,
  tokens: Token[],
  numCols: number,
  numRows: number,
  excludeTokenId?: string
): boolean {
  if (x < 0 || x >= numCols || y < 0 || y >= numRows) return true;
  return tokens.some(
    (token) =>
      token.id !== excludeTokenId &&
      Math.floor(token.x) === Math.floor(x) &&
      Math.floor(token.y) === Math.floor(y)
  );
}

// Helper to find an available square, spiraling outwards (local to BattleBoardPage)
function findAvailableSquareLocal(
  preferredX: number,
  preferredY: number,
  tokens: Token[],
  numCols: number,
  numRows: number,
  excludeTokenId?: string
): Point | null {
  const checkOccupied = (cx: number, cy: number) =>
    isSquareOccupiedLocal(cx, cy, tokens, numCols, numRows, excludeTokenId);

  if (!checkOccupied(preferredX, preferredY)) {
    return { x: preferredX, y: preferredY };
  }

  let currentX = 0;
  let currentY = 0;
  let dx = 0;
  let dy = -1;
  const maxSearchRadius = Math.max(numCols, numRows);

  for (let i = 0; i < Math.pow(maxSearchRadius * 2 + 1, 2); i++) {
    const checkGridX = preferredX + currentX;
    const checkGridY = preferredY + currentY;

    if (checkGridX >= 0 && checkGridX < numCols && checkGridY >= 0 && checkGridY < numRows) {
      if (!checkOccupied(checkGridX, checkGridY)) {
        return { x: checkGridX, y: checkGridY };
      }
    }
    if (currentX === currentY || (currentX < 0 && currentX === -currentY) || (currentX > 0 && currentX === 1 - currentY)) {
      [dx, dy] = [-dy, dx];
    }
    currentX += dx;
    currentY += dy;
  }
  return null;
}


export default function BattleBoardPage({ defaultBattlemaps }: BattleBoardPageProps) {
  const { toast } = useToast();
  const [gridCells, setGridCells] = useState<GridCellData[][]>(initialGridCells());
  const [tokens, setTokens] = useState<Token[]>([]);
  const [drawnShapes, setDrawnShapes] = useState<DrawnShape[]>([]);
  const [textObjects, setTextObjects] = useState<TextObjectType[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [showGridLines, setShowGridLines] = useState<boolean>(true);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [backgroundZoomLevel, setBackgroundZoomLevel] = useState<number>(1);

  const [currentParticipantIndex, setCurrentParticipantIndex] = useState<number>(-1);
  const [roundCounter, setRoundCounter] = useState<number>(1);
  const [isAutoAdvanceOn, setIsAutoAdvanceOn] = useState<boolean>(false); // Not used yet, but good to have for future
  const [isCombatActive, setIsCombatActive] = useState<boolean>(false);

  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [selectedColor, setSelectedColor] = useState<string>('#FF0000');
  const [selectedTokenTemplate, setSelectedTokenTemplate] = useState<Omit<Token, 'id' | 'x' | 'y'> | null>(null);

  const [measurement, setMeasurement] = useState<Measurement>({type: null});
  const [currentDrawingShape, setCurrentDrawingShape] = useState<DrawnShape | null>(null);
  const [currentTextFontSize, setCurrentTextFontSize] = useState<number>(DEFAULT_TEXT_FONT_SIZE);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantInitiative, setNewParticipantInitiative] = useState('10');
  const [isEditingInitiative, setIsEditingInitiative] = useState(false);
  const [newParticipantHp, setNewParticipantHp] = useState('10');
  const [isEditingHp, setIsEditingHp] = useState(false);
  const [newParticipantAc, setNewParticipantAc] = useState('10');
  const [isEditingAc, setIsEditingAc] = useState(false);
  const [newParticipantQuantity, setNewParticipantQuantity] = useState('1');
  const [isEditingQuantity, setIsEditingQuantity] = useState(false);
  const [newParticipantType, setNewParticipantType] = useState<'player' | 'enemy' | 'ally'>('player');
  const [selectedAssignedTokenId, setSelectedAssignedTokenId] = useState<string>("none");

  const [croppedAvatarDataUrl, setCroppedAvatarDataUrl] = useState<string | null>(null);
  const [uncroppedAvatarImageSrc, setUncroppedAvatarImageSrc] = useState<string | null>(null);
  const [isAvatarCropDialogOpen, setIsAvatarCropDialogOpen] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<UndoableState[]>([createInitialSnapshot()]);
  const [historyPointer, setHistoryPointer] = useState<number>(0);
  const isUndoRedoOperation = useRef<boolean>(false);

  const [tokenToChangeImage, setTokenToChangeImage] = useState<string | null>(null);
  const [uncroppedTokenImageSrc, setUncroppedTokenImageSrc] = useState<string | null>(null);
  const [isTokenCropDialogOpen, setIsTokenCropDialogOpen] = useState(false);

  const [showWelcomeDialog, setShowWelcomeDialog] = useState<boolean>(false);
  const [escapePressCount, setEscapePressCount] = useState(0);

  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  const rehydrateToken = useCallback((tokenFromFile: Omit<Token, 'icon'>): Token => {
    const tokenData = tokenFromFile as Token; // Cast to allow access to label/type for template lookup
    if (tokenData.customImageUrl) {
      return { ...tokenData, icon: undefined };
    }
    const template = tokenTemplates.find(t => t.type === tokenData.type && t.name === tokenData.label) ||
                     tokenTemplates.find(t => t.type === tokenData.type);
    return {
      ...tokenData,
      icon: template ? template.icon : GenericTokenIcon,
    };
  }, []);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeen = localStorage.getItem(WELCOME_DIALOG_STORAGE_KEY);
      if (!hasSeen) {
        setShowWelcomeDialog(true);
      }
    }
  }, []);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedStateJSON) {
      try {
        const loadedState = JSON.parse(savedStateJSON) as {
          gridCells: GridCellData[][];
          tokens: Omit<Token, 'icon'>[]; // Icons are stripped
          drawnShapes: DrawnShape[];
          textObjects: TextObjectType[];
          participants: Participant[];
          showGridLines: boolean;
          backgroundImageUrl: string | null;
          backgroundZoomLevel: number;
          currentParticipantIndex: number;
          roundCounter: number;
          isCombatActive: boolean;
          history: (Omit<UndoableState, 'tokens'> & { tokens: Omit<Token, 'icon'>[] })[]; // History has stripped icons
          historyPointer: number;
        };

        setGridCells(loadedState.gridCells || initialGridCells());
        setTokens((loadedState.tokens || []).map(rehydrateToken));
        setDrawnShapes(loadedState.drawnShapes || []);
        setTextObjects(loadedState.textObjects || []);
        setParticipants(loadedState.participants || []);
        setShowGridLines(loadedState.showGridLines !== undefined ? loadedState.showGridLines : true);
        setBackgroundImageUrl(loadedState.backgroundImageUrl || null);
        setBackgroundZoomLevel(loadedState.backgroundZoomLevel || 1);
        setCurrentParticipantIndex(loadedState.currentParticipantIndex !== undefined ? loadedState.currentParticipantIndex : -1);
        setRoundCounter(loadedState.roundCounter || 1);
        setIsCombatActive(loadedState.isCombatActive || false);

        const rehydratedHistory = (loadedState.history || [createInitialSnapshot()]).map(snapshot => ({
          ...snapshot,
          tokens: (snapshot.tokens || []).map(rehydrateToken),
        }));
        setHistory(rehydratedHistory);
        setHistoryPointer(loadedState.historyPointer !== undefined ? loadedState.historyPointer : (rehydratedHistory.length > 0 ? rehydratedHistory.length - 1 : 0));

      } catch (error) {
        console.error("Failed to load or parse saved state from localStorage:", error);
        // If parsing fails, remove the potentially corrupted item
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        setHistory([createInitialSnapshot()]);
        setHistoryPointer(0);
      }
    } else {
      setHistory([createInitialSnapshot()]);
      setHistoryPointer(0);
    }
    setIsInitialLoadComplete(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rehydrateToken]); // rehydrateToken is stable due to useCallback

  // Save state to localStorage when relevant states change
  useEffect(() => {
    if (!isInitialLoadComplete) {
      return; // Don't save until initial load/hydration is complete
    }

    const stripTokenIcons = (tokensToStrip: Token[]): Omit<Token, 'icon'>[] => {
        return tokensToStrip.map(({ icon, ...restOfToken }) => restOfToken);
    };

    const stripIconsFromSnapshot = (snapshot: UndoableState): Omit<UndoableState, 'tokens'> & { tokens: Omit<Token, 'icon'>[] } => {
        return {
            ...snapshot,
            tokens: stripTokenIcons(snapshot.tokens),
        };
    };

    const stateToSave = {
      gridCells,
      tokens: stripTokenIcons(tokens),
      drawnShapes,
      textObjects,
      participants,
      showGridLines,
      backgroundImageUrl,
      backgroundZoomLevel,
      currentParticipantIndex,
      roundCounter,
      isCombatActive,
      history: history.map(stripIconsFromSnapshot),
      historyPointer,
    };

    try {
      const serializedState = JSON.stringify(stateToSave);
      localStorage.setItem(LOCAL_STORAGE_KEY, serializedState);
    } catch (error) {
      console.error("Failed to save state to localStorage:", error);
      // Potentially add more sophisticated error handling or user notification here
      // For now, we'll just log it, but this is where you might clear history or reduce data
    }
  }, [
    gridCells, tokens, drawnShapes, textObjects, participants,
    showGridLines, backgroundImageUrl, backgroundZoomLevel,
    currentParticipantIndex, roundCounter, isCombatActive,
    history, historyPointer,
    isInitialLoadComplete
  ]);


  const handleCloseWelcomeDialog = () => {
    setShowWelcomeDialog(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(WELCOME_DIALOG_STORAGE_KEY, 'true');
    }
  };

  const getCurrentUndoableState = useCallback((): UndoableState => {
    return JSON.parse(JSON.stringify({ // Deep clone to ensure no mutation issues
      gridCells,
      tokens, // Will contain icon functions here, handled by strip/rehydrate for storage/load
      drawnShapes,
      textObjects,
      participants,
    }));
  }, [gridCells, tokens, drawnShapes, textObjects, participants]);

  useEffect(() => {
    if (!isInitialLoadComplete || isUndoRedoOperation.current) {
      if(isUndoRedoOperation.current) isUndoRedoOperation.current = false;
      return;
    }
    if (historyPointer === -1 && history.length === 0) {
        const initialSnapshot = createInitialSnapshot();
        setHistory([initialSnapshot]);
        setHistoryPointer(0);
        return;
    }
    if (historyPointer === -1) return; // Should ideally not happen if initialized properly

    const newSnapshot = getCurrentUndoableState();

    const newHistoryBase = history.slice(0, historyPointer + 1);
    const updatedHistory = [...newHistoryBase, newSnapshot].slice(-MAX_HISTORY_LENGTH);

    setHistory(updatedHistory);
    setHistoryPointer(updatedHistory.length - 1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridCells, tokens, drawnShapes, textObjects, participants, isInitialLoadComplete]); // getCurrentUndoableState ensures stability

  const restoreStateFromSnapshot = useCallback((snapshot: UndoableState) => {
    setGridCells(snapshot.gridCells);
    setTokens(snapshot.tokens.map(rehydrateToken)); // Rehydrate tokens from history snapshot
    setDrawnShapes(snapshot.drawnShapes);
    setTextObjects(snapshot.textObjects);
    setParticipants(snapshot.participants);
  }, [rehydrateToken]);

  const handleUndo = useCallback(() => {
    if (historyPointer <= 0) {
      toast({ title: "Nothing to undo", duration: 2000 });
      return;
    }
    isUndoRedoOperation.current = true;
    const newPointer = historyPointer - 1;
    restoreStateFromSnapshot(history[newPointer]);
    setHistoryPointer(newPointer);
  }, [history, historyPointer, toast, restoreStateFromSnapshot]);

  const handleRedo = useCallback(() => {
    if (historyPointer >= history.length - 1 || historyPointer < 0) {
      toast({ title: "Nothing to redo", duration: 2000 });
      return;
    }
    isUndoRedoOperation.current = true;
    const newPointer = historyPointer + 1;
    restoreStateFromSnapshot(history[newPointer]);
    setHistoryPointer(newPointer);
  }, [history, historyPointer, toast, restoreStateFromSnapshot]);

  const handleResetBoard = useCallback(() => {
    setGridCells(initialGridCells());
    setTokens([]);
    setDrawnShapes([]);
    setTextObjects([]);
    setParticipants([]);
    setBackgroundImageUrl(null);
    setBackgroundZoomLevel(1);
    setMeasurement({type: null});
    setCurrentParticipantIndex(-1);
    setRoundCounter(1);
    setIsCombatActive(false);

    const initialSnapshot = createInitialSnapshot();
    setHistory([initialSnapshot]);
    setHistoryPointer(0);
    isUndoRedoOperation.current = false;

    if (typeof window !== 'undefined') {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    toast({ title: "Battle Board Cleared", description: "Everything has been reset." });
  }, [toast]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (event.key === 'Escape') {
        if (isInputFocused) {
          // Allow default behavior for inputs (e.g., blur, cancel edit)
          return;
        }
        event.preventDefault();
        setActiveTool('select');
        setEscapePressCount(prev => prev + 1); // Increment to trigger effects in child components
        return; // Stop further processing for Escape key here
      }

      if (isInputFocused) {
        return; // Don't process other hotkeys if an input is focused
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

      if (ctrlOrCmd && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        handleUndo();
      } else if (ctrlOrCmd && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo, setActiveTool]);


 useEffect(() => {
    if (activeTool === 'measure_distance' || activeTool === 'measure_radius') {
      setMeasurement({ type: activeTool === 'measure_distance' ? 'distance' : 'radius', startPoint: undefined, endPoint: undefined, result: undefined });
    } else if (measurement.type !== null && activeTool !== 'measure_distance' && activeTool !== 'measure_radius') {
       if (measurement.startPoint || measurement.endPoint || measurement.result) {
        setMeasurement({ type: null, startPoint: undefined, endPoint: undefined, result: undefined });
      }
    }
    if (currentDrawingShape && !['draw_line', 'draw_circle', 'draw_rectangle'].includes(activeTool)) {
      setCurrentDrawingShape(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  useEffect(() => {
    if (participants.length === 0) {
      if (currentParticipantIndex !== -1) setCurrentParticipantIndex(-1);
    } else {
      if (currentParticipantIndex < 0 || currentParticipantIndex >= participants.length) {
        setCurrentParticipantIndex(0);
      }
    }
  }, [participants, currentParticipantIndex]);

  const handleTokenMove = useCallback((tokenId: string, newX: number, newY: number) => {
    setTokens(prevTokens =>
      prevTokens.map(token =>
        token.id === tokenId ? { ...token, x: newX, y: newY } : token
      )
    );
  }, []);

  const handleTokenInstanceNameChange = useCallback((tokenId: string, newName: string) => {
    setTokens(prevTokens =>
      prevTokens.map(token =>
        token.id === tokenId ? { ...token, instanceName: newName } : token
      )
    );
    setParticipants(prevParticipants =>
      prevParticipants.map(p =>
        p.tokenId === tokenId ? { ...p, name: newName } : p
      )
    );
  }, []);

  const handleRenameParticipant = useCallback((participantId: string, newName: string) => {
    setParticipants(prevParticipants =>
      prevParticipants.map(p =>
        p.id === participantId ? { ...p, name: newName } : p
      )
    );
    const participant = participants.find(p => p.id === participantId);
    if (participant?.tokenId) {
      setTokens(prevTokens =>
        prevTokens.map(token =>
          token.id === participant.tokenId ? { ...token, instanceName: newName } : token
        )
      );
    }
  }, [participants]);

  const handleChangeParticipantTokenImage = useCallback((participantId: string, newImageUrl: string) => {
    setParticipants(prevParticipants => {
        const participant = prevParticipants.find(p => p.id === participantId);
        if (!participant) return prevParticipants;

        if (participant.tokenId) {
            setTokens(prevTokens =>
                prevTokens.map(token =>
                    token.id === participant.tokenId
                        ? { ...token, customImageUrl: newImageUrl, icon: undefined, label: token.label || 'Custom' }
                        : token
                )
            );
        } else {
            const middleX = Math.floor(GRID_COLS / 2);
            const middleY = Math.floor(GRID_ROWS / 2);
            const availableSquare = findAvailableSquareLocal(middleX, middleY, tokens, GRID_COLS, GRID_ROWS);
            if (!availableSquare) {
                toast({ title: "Cannot Add Token", description: "No available space on the grid for the new token.", variant: "destructive"});
                return prevParticipants;
            }
            const newToken: Token = {
                id: `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                x: availableSquare.x,
                y: availableSquare.y,
                color: 'hsl(var(--muted))',
                customImageUrl: newImageUrl,
                icon: undefined,
                type: 'generic',
                label: 'Custom',
                instanceName: participant.name,
                size: 1,
            };
            setTokens(prevTokens => [...prevTokens, newToken]);

            return prevParticipants.map(p =>
                p.id === participantId ? { ...p, tokenId: newToken.id } : p
            );
        }
        return prevParticipants;
    });
  }, [tokens, toast]);

  const handleTokenDelete = useCallback((tokenId: string) => {
    setTokens(prev => prev.filter(t => t.id !== tokenId));
    setParticipants(prev => {
      const newParticipants = prev.map(p => p.tokenId === tokenId ? { ...p, tokenId: undefined } : p);
      const activeParticipant = prev[currentParticipantIndex];
      if (activeParticipant && activeParticipant.tokenId === tokenId) {
        const updatedCurrentParticipant = { ...activeParticipant, tokenId: undefined };
        const idx = newParticipants.findIndex(p => p.id === activeParticipant.id);
        if (idx !== -1) {
          newParticipants[idx] = updatedCurrentParticipant;
        }
      }
      return newParticipants;
    });
    toast({ title: "Token Deleted" });
  }, [currentParticipantIndex, toast]);

  const handleRequestTokenImageChange = useCallback((tokenId: string) => {
    setTokenToChangeImage(tokenId);
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                toast({ title: "Upload Error", description: "Image file size exceeds 2MB limit.", variant: "destructive" });
                setTokenToChangeImage(null);
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setUncroppedTokenImageSrc(reader.result as string);
                setIsTokenCropDialogOpen(true);
            };
            reader.readAsDataURL(file);
        } else {
            setTokenToChangeImage(null);
        }
    };
    fileInput.click();
  }, [toast]);


  const handleStartCombat = () => {
    if (participants.length === 0) {
      toast({
        title: 'Cannot Start Combat',
        description: 'Add combatants to the turn order first.',
        variant: 'destructive',
      });
      return;
    }
    setIsCombatActive(true);
    setRoundCounter(1);
    if (participants.length > 0) {
      setCurrentParticipantIndex(0);
    } else {
      setCurrentParticipantIndex(-1);
    }
  };

  const handleEndCombat = () => {
    setIsCombatActive(false);
    setRoundCounter(1);
  };

  const handleAdvanceTurn = () => {
    if (!isCombatActive || participants.length === 0) {
      return;
    }
    let nextIndex = currentParticipantIndex + 1;
    let currentRound = roundCounter;
    if (nextIndex >= participants.length) {
      nextIndex = 0;
      currentRound = roundCounter + 1;
      setRoundCounter(currentRound);
    }
    setCurrentParticipantIndex(nextIndex);
  };

  const handleAddParticipantToList = useCallback((
    participantData: Omit<Participant, 'id' | 'tokenId'>,
    explicitTokenId?: string,
    avatarUrl?: string | null
  ) => {
    const participantName = participantData.name.trim();
    let finalTokenId: string | undefined = explicitTokenId;
    let newTokensCreated: Token[] = [];

    if (!finalTokenId || finalTokenId === "none") {
      finalTokenId = undefined;
      const middleX = Math.floor(GRID_COLS / 2);
      const middleY = Math.floor(GRID_ROWS / 2);
      const availableSquare = findAvailableSquareLocal(middleX, middleY, tokens, GRID_COLS, GRID_ROWS);

      if (!availableSquare) {
        toast({ title: "Cannot Add Token", description: "No available space on the grid for the new token.", variant: "destructive"});
        return false;
      }

      const template = tokenTemplates.find(t => t.type === participantData.type);
      const newToken: Token = {
        id: `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        x: availableSquare.x,
        y: availableSquare.y,
        customImageUrl: avatarUrl || undefined,
        icon: avatarUrl ? undefined : template?.icon,
        color: avatarUrl ? 'hsl(var(--muted))' : (template?.color || 'hsl(var(--accent))'),
        type: participantData.type,
        label: avatarUrl ? 'Custom Avatar' : (template?.name || 'Generic'),
        instanceName: participantName,
        size: 1,
      };
      newTokensCreated.push(newToken);
      finalTokenId = newToken.id;
    }

    setTokens(prev => [...prev, ...newTokensCreated]);

    const newParticipant: Participant = {
      ...participantData,
      id: `participant-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: participantName,
      tokenId: finalTokenId,
    };

    setParticipants(prev => {
      const newList = [...prev, newParticipant].sort((a, b) => b.initiative - a.initiative);
      if (isCombatActive) {
        const oldActiveParticipantId = prev[currentParticipantIndex]?.id;
        let newActiveIndex = newList.findIndex(p => p.id === oldActiveParticipantId);
        if (newActiveIndex === -1 && newList.length > 0) newActiveIndex = Math.min(currentParticipantIndex, newList.length -1);
        if (newActiveIndex === -1 && newList.length > 0) newActiveIndex = 0;
        setCurrentParticipantIndex(newActiveIndex);
      } else {
        if (prev.length === 0 && newList.length > 0) setCurrentParticipantIndex(0);
        else {
            const oldActiveParticipantId = prev[currentParticipantIndex]?.id;
            const newActiveIndex = newList.findIndex(p => p.id === oldActiveParticipantId);
            if (newActiveIndex !== -1) setCurrentParticipantIndex(newActiveIndex);
            else if (newList.length > 0 && currentParticipantIndex === -1) setCurrentParticipantIndex(0);
        }
      }
      return newList;
    });
    return true;
  }, [isCombatActive, currentParticipantIndex, tokens, toast]);


  const handleAddCombatantFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const participantNameInput = newParticipantName.trim();
    if (!participantNameInput || !newParticipantInitiative.trim()) {
      return;
    }
    const initiativeValue = parseInt(newParticipantInitiative, 10);
    if (isNaN(initiativeValue)) {
      return;
    }

    const hpString = newParticipantHp.trim();
    const acString = newParticipantAc.trim();
    const hpValue = hpString === '' ? undefined : parseInt(hpString, 10);
    const acValue = acString === '' ? undefined : parseInt(acString, 10);

    if (hpString !== '' && (isNaN(hpValue as number) || (hpValue as number) < 0) ) return;
    if (acString !== '' && (isNaN(acValue as number) || (acValue as number) < 0) ) return;

    const quantity = (selectedAssignedTokenId && selectedAssignedTokenId !== "none") ? 1 : (parseInt(newParticipantQuantity, 10) || 1);
    if (quantity < 1) {
        return;
    }

    let allAddedSuccessfully = true;
    for (let i = 0; i < quantity; i++) {
      const finalName = (quantity > 1 && (selectedAssignedTokenId === "none" || !selectedAssignedTokenId)) ? `${participantNameInput} ${i + 1}` : participantNameInput;
      const newParticipantData: Omit<Participant, 'id' | 'tokenId'> = {
        name: finalName,
        initiative: initiativeValue,
        type: newParticipantType,
        hp: hpValue,
        ac: acValue,
      };

      let success;
      if (selectedAssignedTokenId && selectedAssignedTokenId !== "none") {
        success = handleAddParticipantToList(newParticipantData, selectedAssignedTokenId, croppedAvatarDataUrl);
        if (success) {
            const newTypeTemplate = tokenTemplates.find(t => t.type === newParticipantType);
            setTokens(prevTokens => prevTokens.map(t => {
            if (t.id === selectedAssignedTokenId) {
                const isAvatarProvided = !!croppedAvatarDataUrl;
                return {
                  ...t,
                  instanceName: finalName,
                  type: newParticipantType,
                  color: isAvatarProvided ? (t.customImageUrl ? t.color : 'hsl(var(--muted))') : (newTypeTemplate ? newTypeTemplate.color : t.color),
                  icon: isAvatarProvided ? undefined : (newTypeTemplate ? newTypeTemplate.icon : t.icon),
                  customImageUrl: isAvatarProvided ? croppedAvatarDataUrl! : (t.customImageUrl || undefined),
                };
            }
            return t;
            }));
        }
      } else {
         success = handleAddParticipantToList(newParticipantData, undefined, croppedAvatarDataUrl);
      }
      if (!success) {
        allAddedSuccessfully = false;
        break;
      }
    }

    if (allAddedSuccessfully) {
        setNewParticipantName('');
        setNewParticipantInitiative('10');
        setIsEditingInitiative(false);
        setNewParticipantHp('10');
        setIsEditingHp(false);
        setNewParticipantAc('10');
        setIsEditingAc(false);
        setNewParticipantQuantity('1');
        setIsEditingQuantity(false);
        setNewParticipantType('player');
        setSelectedAssignedTokenId("none");
        setCroppedAvatarDataUrl(null);
        setDialogOpen(false);
    }
  };

 const handleRemoveParticipantFromList = useCallback((participantId: string) => {
    const participantToRemove = participants.find(p => p.id === participantId);
    if (!participantToRemove) return;

    setTokens(prevTokens => {
      if (participantToRemove.tokenId) {
        return prevTokens.map(token => {
          if (token.id === participantToRemove.tokenId) {
            const baseTemplate = tokenTemplates.find(t => t.type === token.type) || tokenTemplates.find(t => t.type === 'generic');
            return {
              ...token,
              instanceName: undefined, // Clear specific instance name
              customImageUrl: undefined, // Clear custom image if it was from this participant
              // Revert to base template icon and color unless it's a generic token that should retain its specific visual
              icon: baseTemplate?.icon,
              color: baseTemplate?.color || 'hsl(var(--accent))',
            };
          }
          return token;
        });
      }
      return prevTokens;
    });

    const updatedParticipants = participants.filter(p => p.id !== participantId);
    setParticipants(updatedParticipants);

    if (updatedParticipants.length === 0) {
      setCurrentParticipantIndex(-1);
      if (isCombatActive) setRoundCounter(1); // Reset round if combat was active and list is now empty
      setIsCombatActive(false); // End combat if no participants left
    } else {
      let newIndex = currentParticipantIndex;
      const removedIndex = participants.findIndex(p => p.id === participantId);

      if (newIndex === removedIndex) {
        // If current was removed, try to keep index same (next person takes over)
        // If it was the last one, move to 0 (or -1 if empty)
        newIndex = (newIndex >= updatedParticipants.length) ? 0 : newIndex;
      } else if (newIndex > removedIndex) {
        // If removed participant was before current, decrement current index
        newIndex = Math.max(0, newIndex - 1);
      }
      // If current is -1 or current becomes invalid after removal, reset to 0 if list not empty
      if (newIndex >= updatedParticipants.length || newIndex < 0 ) {
          newIndex = updatedParticipants.length > 0 ? 0 : -1;
      }
      setCurrentParticipantIndex(newIndex);
      // Specific edge case: if the one removed was the *last* in a round,
      // and current was already 0 (meaning next round just started),
      // then currentParticipantIndex should remain 0. The round counter should not change here.
      if(updatedParticipants.length > 0 && currentParticipantIndex === 0 && newIndex === 0 && roundCounter > 1 && removedIndex === participants.length -1) {
        // No change to roundCounter needed here, as the next turn was already the start of a new round
      }
    }
    toast({ title: "Participant Removed", description: `${participantToRemove.name} removed from turn order.` });
  }, [participants, currentParticipantIndex, toast, isCombatActive, roundCounter]);


  const renderNumericInput = (
    value: string,
    setValue: Dispatch<SetStateAction<string>>,
    isEditing: boolean,
    setIsEditing: Dispatch<SetStateAction<boolean>>,
    label: string,
    idPrefix: string,
    optional: boolean = false,
    disabled: boolean = false
  ) => (
    <div className="flex-1 min-w-0 space-y-1 border border-border rounded-md p-3">
      <Label htmlFor={disabled ? undefined : `${idPrefix}-input`}>{label}</Label>
      {isEditing && !disabled ? (
        <Input
          id={`${idPrefix}-input`} type="number" value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            const isQuantityField = idPrefix === 'participant-quantity-dialog';
            if (isQuantityField) {
              const num = parseInt(value, 10);
              if (isNaN(num) || num < 1) setValue('1');
            } else {
              if (optional && value.trim() === '') { /* Keep empty if optional */ }
              else {
                const num = parseInt(value, 10);
                if (isNaN(num) || (!optional && num < 0) || (optional && num < 0 && value.trim() !== '')) {
                    setValue('10'); // Default to 10 if invalid non-optional or invalid negative optional
                } else if (optional && num < 0 && value.trim() !== '') {
                    setValue('0'); // Default to 0 if invalid negative optional (but was explicitly entered)
                }
              }
            }
            setIsEditing(false);
          }}
          autoFocus className="w-full text-center"
          disabled={disabled}
        />
      ) : (
        <div className="flex items-center gap-1 mt-1">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0"
            onClick={() => {
                if(disabled) return;
                const currentValue = parseInt(value, 10) || 0;
                const isQuantityField = idPrefix === 'participant-quantity-dialog';
                const minValue = isQuantityField ? 1 : (optional ? -Infinity : 0); // Allow negative for optional stats if desired, else 0
                setValue(String(Math.max(minValue, currentValue - 1)));
            }}
            disabled={disabled}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" id={`${idPrefix}-display`}
            onClick={() => !disabled && setIsEditing(true)}
            className="h-8 px-2 text-base w-full justify-center"
            disabled={disabled} >
            {value || (idPrefix === 'participant-quantity-dialog' ? '1' : (optional ? 'N/A' : '10'))}
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0"
            onClick={() => {
                if(disabled) return;
                const currentValue = parseInt(value,10) || (idPrefix === 'participant-quantity-dialog' ? 0 : (optional && value === '' ? -1 : 0));
                setValue(String(currentValue + 1));
            }}
            disabled={disabled}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  const activeParticipant = participants[currentParticipantIndex];
  const activeTokenId = activeParticipant?.tokenId || null;

  const participantTypeButtonConfig = {
    player: {
      label: 'Player',
      icon: PlayerIcon,
      selectedClass: 'bg-[hsl(var(--player-green-bg))] text-[hsl(var(--player-green-foreground))] hover:bg-[hsl(var(--player-green-hover-bg))]',
      unselectedHoverClass: 'hover:bg-[hsl(var(--player-green-bg))] hover:text-[hsl(var(--player-green-foreground))]',
    },
    enemy: {
      label: 'Enemy',
      icon: EnemyIcon,
      selectedClass: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      unselectedHoverClass: 'hover:bg-destructive hover:text-destructive-foreground',
    },
    ally: {
      label: 'Ally',
      icon: AllyIcon,
      selectedClass: 'bg-[hsl(var(--app-blue-bg))] text-[hsl(var(--app-blue-foreground))] hover:bg-[hsl(var(--app-blue-hover-bg))]',
      unselectedHoverClass: 'hover:bg-[hsl(var(--app-blue-bg))] hover:text-[hsl(var(--app-blue-foreground))]',
    },
  };

  const unassignedTokens = useMemo(() => tokens.filter(token =>
    ['player', 'enemy', 'ally'].includes(token.type) &&
    !participants.some(p => p.tokenId === token.id)
  ), [tokens, participants]);

  const handleDialogClose = (isOpen: boolean) => {
    setDialogOpen(isOpen);
    if (!isOpen) {
      // Reset form fields when dialog closes
      setNewParticipantName('');
      setNewParticipantInitiative('10');
      setNewParticipantHp('10');
      setNewParticipantAc('10');
      setNewParticipantQuantity('1');
      setNewParticipantType('player');
      setSelectedAssignedTokenId("none");
      setIsEditingInitiative(false);
      setIsEditingHp(false);
      setIsEditingAc(false);
      setIsEditingQuantity(false);
      setCroppedAvatarDataUrl(null);
      setUncroppedAvatarImageSrc(null);
      setIsAvatarCropDialogOpen(false);
    }
  };

  const handleAvatarImageUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          title: 'Upload Error',
          description: 'Avatar image file size exceeds 2MB limit.',
          variant: 'destructive',
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setUncroppedAvatarImageSrc(reader.result as string);
        setIsAvatarCropDialogOpen(true);
        if (event.target) event.target.value = ''; // Reset file input
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarCropConfirm = (croppedDataUrl: string) => {
    setCroppedAvatarDataUrl(croppedDataUrl);
    setIsAvatarCropDialogOpen(false);
    setUncroppedAvatarImageSrc(null);
  };

  const handleAvatarCropCancel = () => {
    setIsAvatarCropDialogOpen(false);
    setUncroppedAvatarImageSrc(null);
  };


  return (
    <div className="flex h-screen">
       {typeof window !== 'undefined' && <WelcomeDialog isOpen={showWelcomeDialog} onClose={handleCloseWelcomeDialog} />}
      <div className="flex-1 relative">
          <BattleGrid
            gridCells={gridCells} setGridCells={setGridCells}
            tokens={tokens} setTokens={setTokens}
            drawnShapes={drawnShapes} setDrawnShapes={setDrawnShapes}
            currentDrawingShape={currentDrawingShape} setCurrentDrawingShape={setCurrentDrawingShape}
            textObjects={textObjects} setTextObjects={setTextObjects}
            showGridLines={showGridLines}
            setShowGridLines={setShowGridLines}
            backgroundImageUrl={backgroundImageUrl}
            backgroundZoomLevel={backgroundZoomLevel}
            activeTool={activeTool} setActiveTool={setActiveTool}
            selectedColor={selectedColor}
            selectedTokenTemplate={selectedTokenTemplate}
            onTokenMove={handleTokenMove}
            onTokenInstanceNameChange={handleTokenInstanceNameChange}
            measurement={measurement} setMeasurement={setMeasurement}
            activeTokenId={activeTokenId}
            currentTextFontSize={currentTextFontSize}
            onTokenDelete={handleTokenDelete}
            onTokenImageChangeRequest={handleRequestTokenImageChange}
            escapePressCount={escapePressCount}
          />
          <FloatingToolbar
            activeTool={activeTool} setActiveTool={setActiveTool}
            title="Battle Board" Icon={LandPlot}
            selectedColor={selectedColor} setSelectedColor={setSelectedColor}
            selectedTokenTemplate={selectedTokenTemplate} setSelectedTokenTemplate={setSelectedTokenTemplate}
            backgroundImageUrl={backgroundImageUrl} setBackgroundImageUrl={setBackgroundImageUrl}
            showGridLines={showGridLines} setShowGridLines={setShowGridLines}
            measurement={measurement} setMeasurement={setMeasurement}
            backgroundZoomLevel={backgroundZoomLevel} setBackgroundZoomLevel={setBackgroundZoomLevel}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={historyPointer > 0}
            canRedo={historyPointer < history.length - 1 && historyPointer !== -1}
            onResetBoard={handleResetBoard}
            defaultBattlemaps={defaultBattlemaps}
            escapePressCount={escapePressCount}
          />
      </div>

      {uncroppedTokenImageSrc && tokenToChangeImage && (
        <ImageCropDialog
          isOpen={isTokenCropDialogOpen}
          onOpenChange={setIsTokenCropDialogOpen}
          imageSrc={uncroppedTokenImageSrc}
          onCropConfirm={(croppedDataUrl) => {
            if (tokenToChangeImage) {
              setTokens(prev => prev.map(t => t.id === tokenToChangeImage ? { ...t, customImageUrl: croppedDataUrl, icon: undefined, label: t.label || 'Custom' } : t));
              toast({ title: "Token Image Updated" });
            }
            setIsTokenCropDialogOpen(false);
            setUncroppedTokenImageSrc(null);
            setTokenToChangeImage(null);
          }}
          onCropCancel={() => {
            setIsTokenCropDialogOpen(false);
            setUncroppedTokenImageSrc(null);
            setTokenToChangeImage(null);
          }}
        />
      )}

      {uncroppedAvatarImageSrc && (
        <ImageCropDialog
          isOpen={isAvatarCropDialogOpen}
          onOpenChange={setIsAvatarCropDialogOpen}
          imageSrc={uncroppedAvatarImageSrc}
          onCropConfirm={handleAvatarCropConfirm}
          onCropCancel={handleAvatarCropCancel}
        />
      )}


      <SidebarProvider defaultOpen={true}>
        <Sidebar variant="sidebar" collapsible="icon" side="right">
          <SidebarContent className="p-3 flex flex-col flex-grow">
            <InitiativeTrackerPanel
              participantsProp={participants}
              tokens={tokens}
              currentParticipantIndex={currentParticipantIndex}
              roundCounter={roundCounter}
              onRemoveParticipant={handleRemoveParticipantFromList}
              onRenameParticipant={handleRenameParticipant}
              onChangeParticipantTokenImage={handleChangeParticipantTokenImage}
            />
          </SidebarContent>

          <div className="p-2 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
            <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button className="w-full"> Add Combatant </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-16 h-16 rounded-full p-0 relative overflow-hidden border-2 border-dashed hover:border-primary flex items-center justify-center"
                        onClick={() => avatarFileInputRef.current?.click()}
                        aria-label="Upload combatant avatar"
                      >
                        {croppedAvatarDataUrl ? (
                          <img src={croppedAvatarDataUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                        ) : (
                          <Camera className="w-7 h-7 text-muted-foreground" />
                        )}
                      </Button>
                      <Input
                        ref={avatarFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarImageUploadChange}
                        className="hidden"
                      />
                    </div>
                    <div className="flex-grow">
                      <DialogTitle>Add New Combatant</DialogTitle>
                      <DialogDescription>Enter the details for the new combatant.</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <form onSubmit={handleAddCombatantFormSubmit} className="space-y-4 pt-4">
                  <div className="space-y-1">
                      {/* Label for Type section removed */}
                      <div className="flex space-x-2">
                      {(Object.keys(participantTypeButtonConfig) as Array<keyof typeof participantTypeButtonConfig>).map((type) => {
                          const config = participantTypeButtonConfig[type];
                          const isSelected = newParticipantType === type;
                          const IconComponent = config.icon;
                          return (
                          <Button
                              key={type}
                              type="button"
                              variant={isSelected ? undefined : 'outline'}
                              onClick={() => setNewParticipantType(type)}
                              className={cn(
                              "flex-1 flex items-center justify-center gap-2",
                              isSelected ? config.selectedClass : ["border-border", config.unselectedHoverClass]
                              )}
                          >
                              <IconComponent className="h-4 w-4" />
                              {config.label}
                          </Button>
                          );
                      })}
                      </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="participant-name-dialog">Name</Label>
                      <Input id="participant-name-dialog" value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} placeholder="e.g., Gorok the Barbarian" required />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="assign-token-select">Assign Token</Label>
                      <Select
                        value={selectedAssignedTokenId}
                        onValueChange={(value) => {
                          setSelectedAssignedTokenId(value);
                          if (value !== "none") {
                            setNewParticipantQuantity('1');
                          }
                        }}
                      >
                        <SelectTrigger id="assign-token-select">
                          <SelectValue placeholder="None (Create new token)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (Create new token)</SelectItem>
                          {unassignedTokens.map(token => (
                            <SelectItem key={token.id} value={token.id}>
                              {token.instanceName || token.label || `Token ID: ${token.id.substring(0,6)}`} ({token.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>


                  <div className="flex flex-col sm:flex-row gap-3">
                    {renderNumericInput(newParticipantInitiative, setNewParticipantInitiative, isEditingInitiative, setIsEditingInitiative, "Initiative", "participant-initiative-dialog", false, false)}
                    {renderNumericInput(newParticipantHp, setNewParticipantHp, isEditingHp, setIsEditingHp, "Health", "participant-hp-dialog", true, false)}
                    {renderNumericInput(newParticipantAc, setNewParticipantAc, isEditingAc, setIsEditingAc, "Armor", "participant-ac-dialog", true, false)}
                    {renderNumericInput(newParticipantQuantity, setNewParticipantQuantity, isEditingQuantity, setIsEditingQuantity, "Quantity", "participant-quantity-dialog", false, selectedAssignedTokenId !== "none")}
                  </div>

                  <FormDialogFooter>
                    <Button type="submit" className="w-full"> Add to Turn Order </Button>
                  </FormDialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <SidebarFooter className="p-2 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
            {!isCombatActive ? (
              <Button
                onClick={handleStartCombat}
                className="w-full bg-[hsl(var(--player-green-bg))] hover:bg-[hsl(var(--player-green-hover-bg))] text-[hsl(var(--player-green-foreground))]"
              >
                Start Combat
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleAdvanceTurn} className="flex-1 bg-[hsl(var(--app-blue-bg))] hover:bg-[hsl(var(--app-blue-hover-bg))] text-[hsl(var(--app-blue-foreground))]">
                   Next Turn <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button onClick={handleEndCombat} variant="destructive" className="flex-1"> End Combat </Button>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}
