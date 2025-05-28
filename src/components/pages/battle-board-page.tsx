
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
import { ArrowRight, Camera, Users, Plus, Minus, Shuffle } from 'lucide-react';
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
const MAX_HISTORY_LENGTH = 10;
const WELCOME_DIALOG_STORAGE_KEY = 'hasSeenWelcomeDialogV1';
const LOCAL_STORAGE_KEY = 'battleBoardStateV2';


const initialGridCells = (): GridCellData[][] =>
  Array.from({ length: GRID_ROWS }, (_, y) =>
    Array.from({ length: GRID_COLS }, (_, x) => ({
      id: `${y}-${x}`,
      color: undefined,
    }))
  );

const createInitialSnapshot = (initialState?: Partial<Omit<UndoableState, 'tokens'> & { tokens: Token[] }>): UndoableState => ({
  gridCells: initialState?.gridCells || initialGridCells(),
  tokens: (initialState?.tokens || []).map(t => ({ ...t, icon: undefined })), // Icons stripped for history
  drawnShapes: initialState?.drawnShapes || [],
  textObjects: initialState?.textObjects || [],
  participants: initialState?.participants || [],
});


function isSquareOccupiedLocal(
  targetX: number,
  targetY: number,
  tokenSizeToCheck: number,
  tokens: Token[],
  numCols: number,
  numRows: number,
  excludeTokenId?: string
): boolean {
  if (targetX < 0 || targetX + tokenSizeToCheck > numCols || targetY < 0 || targetY + tokenSizeToCheck > numRows) {
    return true;
  }
  for (const token of tokens) {
    if (token.id === excludeTokenId) continue;
    const existingTokenSize = token.size || 1;

    const tokenLeft = token.x;
    const tokenRight = token.x + existingTokenSize;
    const tokenTop = token.y;
    const tokenBottom = token.y + existingTokenSize;

    const targetLeft = targetX;
    const targetRight = targetX + tokenSizeToCheck;
    const targetTop = targetY;
    const targetBottom = targetY + tokenSizeToCheck;

    if (targetLeft < tokenRight && targetRight > tokenLeft &&
        targetTop < tokenBottom && targetBottom > tokenTop) {
      return true;
    }
  }
  return false;
}

function findAvailableSquareLocal(
  preferredX: number,
  preferredY: number,
  tokenSizeToPlace: number,
  tokens: Token[],
  numCols: number,
  numRows: number,
  excludeTokenId?: string
): Point | null {
  const checkOccupied = (cx: number, cy: number) =>
    isSquareOccupiedLocal(cx, cy, tokenSizeToPlace, tokens, numCols, numRows, excludeTokenId);

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

    if (checkGridX >= 0 && checkGridX + tokenSizeToPlace <= numCols &&
        checkGridY >= 0 && checkGridY + tokenSizeToPlace <= numRows) {
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
  const [showAllLabels, setShowAllLabels] = useState<boolean>(true);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [backgroundZoomLevel, setBackgroundZoomLevel] = useState<number>(1);

  const [currentParticipantIndex, setCurrentParticipantIndex] = useState<number>(-1);
  const [roundCounter, setRoundCounter] = useState<number>(1);
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

  const [history, setHistory] = useState<UndoableState[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);
  const isUndoRedoOperation = useRef<boolean>(false);

  const [tokenToChangeImage, setTokenToChangeImage] = useState<string | null>(null);
  const [uncroppedTokenImageSrc, setUncroppedTokenImageSrc] = useState<string | null>(null);
  const [isTokenCropDialogOpen, setIsTokenCropDialogOpen] = useState(false);

  const [showWelcomeDialog, setShowWelcomeDialog] = useState<boolean>(false);
  const [escapePressCount, setEscapePressCount] = useState(0);

  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedTextObjectId, setSelectedTextObjectId] = useState<string | null>(null);
  const [tokenIdToFocus, setTokenIdToFocus] = useState<string | null>(null);


  const rehydrateToken = useCallback((tokenFromFile: Omit<Token, 'icon'>): Token => {
    const tokenData = tokenFromFile as Token;
    if (tokenData.customImageUrl) {
      return { ...tokenData, icon: undefined };
    }
    const template = tokenTemplates.find(t => t.type === tokenData.type && t.name === tokenData.label) ||
                     tokenTemplates.find(t => t.type === tokenData.type);
    return {
      ...tokenData,
      icon: template ? template.icon : GenericTokenIcon,
      size: tokenData.size || 1,
    };
  }, []);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeen = localStorage.getItem(WELCOME_DIALOG_STORAGE_KEY);
      if (!hasSeen) {
        setShowWelcomeDialog(true);
      }

      const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
      let initialSnapshotForSession: UndoableState;

      if (savedStateJSON) {
        try {
          const loadedState = JSON.parse(savedStateJSON) as Omit<UndoableState, 'tokens' | 'history' | 'historyPointer'> & {
              tokens: Omit<Token, 'icon'>[];
              showGridLines: boolean;
              showAllLabels: boolean;
              backgroundImageUrl: string | null;
              backgroundZoomLevel: number;
              currentParticipantIndex: number;
              roundCounter: number;
              isCombatActive: boolean;
          };

          const rehydratedTokens = (loadedState.tokens || []).map(rehydrateToken);

          setGridCells(loadedState.gridCells || initialGridCells());
          setTokens(rehydratedTokens);
          setDrawnShapes(loadedState.drawnShapes || []);
          setTextObjects(loadedState.textObjects || []);
          setParticipants(loadedState.participants || []);
          setShowGridLines(loadedState.showGridLines !== undefined ? loadedState.showGridLines : true);
          setShowAllLabels(loadedState.showAllLabels !== undefined ? loadedState.showAllLabels : true);
          setBackgroundImageUrl(loadedState.backgroundImageUrl || null);
          setBackgroundZoomLevel(loadedState.backgroundZoomLevel || 1);
          setCurrentParticipantIndex(loadedState.currentParticipantIndex !== undefined ? loadedState.currentParticipantIndex : -1);
          setRoundCounter(loadedState.roundCounter || 1);
          setIsCombatActive(loadedState.isCombatActive || false);

          initialSnapshotForSession = createInitialSnapshot({
            gridCells: loadedState.gridCells || initialGridCells(),
            tokens: rehydratedTokens,
            drawnShapes: loadedState.drawnShapes || [],
            textObjects: loadedState.textObjects || [],
            participants: loadedState.participants || [],
          });

        } catch (error) {
          console.error("Failed to load or parse saved state from localStorage:", error);
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          initialSnapshotForSession = createInitialSnapshot({tokens: []});
        }
      } else {
        initialSnapshotForSession = createInitialSnapshot({tokens: []});
      }
      setHistory([initialSnapshotForSession]);
      setHistoryPointer(0);
    }
    setIsInitialLoadComplete(true);
  }, [rehydrateToken]);

  useEffect(() => {
    if (!isInitialLoadComplete || isUndoRedoOperation.current) {
      return;
    }

    const stripIconsForStorage = (currentTokens: Token[]): Omit<Token, 'icon'>[] => {
        return currentTokens.map(({ icon, ...rest }) => rest);
    };

    const stateToSave = {
      gridCells,
      tokens: stripIconsForStorage(tokens),
      drawnShapes,
      textObjects,
      participants,
      showGridLines,
      showAllLabels,
      backgroundImageUrl,
      backgroundZoomLevel,
      currentParticipantIndex,
      roundCounter,
      isCombatActive,
    };

    try {
      const serializedState = JSON.stringify(stateToSave);
      localStorage.setItem(LOCAL_STORAGE_KEY, serializedState);
    } catch (error) {
      console.error("Failed to save state to localStorage:", error);
    }
  }, [
    gridCells, tokens, drawnShapes, textObjects, participants,
    showGridLines, showAllLabels, backgroundImageUrl, backgroundZoomLevel,
    currentParticipantIndex, roundCounter, isCombatActive,
    isInitialLoadComplete
  ]);


  const handleCloseWelcomeDialog = () => {
    setShowWelcomeDialog(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(WELCOME_DIALOG_STORAGE_KEY, 'true');
    }
  };

  const getCurrentUndoableState = useCallback((): UndoableState => {
    const stripIconsForHistory = (currentTokens: Token[]): Omit<Token, 'icon'>[] => {
        return currentTokens.map(({ icon, ...rest }) => rest);
    };
    return JSON.parse(JSON.stringify({ // Deep copy
      gridCells,
      tokens: stripIconsForHistory(tokens),
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
     if (history.length === 0 && isInitialLoadComplete) {
        const initialSnapshot = getCurrentUndoableState();
        setHistory([initialSnapshot]);
        setHistoryPointer(0);
        return;
    }

    const newSnapshot = getCurrentUndoableState();

    if (history.length > 0 && history[historyPointer] && JSON.stringify(history[historyPointer]) === JSON.stringify(newSnapshot)) {
      return;
    }

    const newHistoryBase = history.slice(0, historyPointer + 1);
    const updatedHistory = [...newHistoryBase, newSnapshot].slice(-MAX_HISTORY_LENGTH);

    setHistory(updatedHistory);
    setHistoryPointer(updatedHistory.length - 1);

  }, [gridCells, tokens, drawnShapes, textObjects, participants, isInitialLoadComplete, history, historyPointer, getCurrentUndoableState]);

  const restoreStateFromSnapshot = useCallback((snapshot: UndoableState) => {
    isUndoRedoOperation.current = true;
    setGridCells(snapshot.gridCells);
    setTokens(snapshot.tokens.map(rehydrateToken));
    setDrawnShapes(snapshot.drawnShapes);
    setTextObjects(snapshot.textObjects);
    setParticipants(snapshot.participants);
  }, [rehydrateToken]);

  const handleUndo = useCallback(() => {
    if (historyPointer <= 0) {
      toast({ title: "Nothing to undo", duration: 2000 });
      return;
    }
    const newPointer = historyPointer - 1;
    restoreStateFromSnapshot(history[newPointer]);
    setHistoryPointer(newPointer);
  }, [history, historyPointer, toast, restoreStateFromSnapshot]);

  const handleRedo = useCallback(() => {
    if (historyPointer >= history.length - 1 || historyPointer < 0) {
      toast({ title: "Nothing to redo", duration: 2000 });
      return;
    }
    const newPointer = historyPointer + 1;
    restoreStateFromSnapshot(history[newPointer]);
    setHistoryPointer(newPointer);
  }, [history, historyPointer, toast, restoreStateFromSnapshot]);

  const handleResetBoard = useCallback(() => {
    isUndoRedoOperation.current = true;

    const defaultGridCells = initialGridCells();
    const defaultTokens: Token[] = [];
    const defaultDrawnShapes: DrawnShape[] = [];
    const defaultTextObjects: TextObjectType[] = [];
    const defaultParticipants: Participant[] = [];

    setGridCells(defaultGridCells);
    setTokens(defaultTokens);
    setDrawnShapes(defaultDrawnShapes);
    setTextObjects(defaultTextObjects);
    setParticipants(defaultParticipants);
    setBackgroundImageUrl(null);
    setBackgroundZoomLevel(1);
    setShowGridLines(true);
    setShowAllLabels(true);
    setMeasurement({type: null});
    setCurrentParticipantIndex(-1);
    setRoundCounter(1);
    setIsCombatActive(false);
    setSelectedTokenId(null);
    setSelectedShapeId(null);
    setSelectedTextObjectId(null);
    setTokenIdToFocus(null);

    const freshSnapshot = createInitialSnapshot({
        gridCells: defaultGridCells,
        tokens: defaultTokens,
        drawnShapes: defaultDrawnShapes,
        textObjects: defaultTextObjects,
        participants: defaultParticipants,
    });
    setHistory([freshSnapshot]);
    setHistoryPointer(0);

    if (typeof window !== 'undefined') {
        const stateToSave = {
            gridCells: defaultGridCells,
            tokens: [],
            drawnShapes: defaultDrawnShapes,
            textObjects: defaultTextObjects,
            participants: defaultParticipants,
            showGridLines: true,
            showAllLabels: true,
            backgroundImageUrl: null,
            backgroundZoomLevel: 1,
            currentParticipantIndex: -1,
            roundCounter: 1,
            isCombatActive: false,
        };
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (error) {
            console.error("Failed to save reset state to localStorage:", error);
        }
    }
    toast({ title: "Battle Board Cleared", description: "Everything has been reset." });

    setTimeout(() => { isUndoRedoOperation.current = false; }, 0);
  }, [toast]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (event.key === 'Escape') {
        if (isInputFocused && (document.activeElement === target || (document.activeElement && document.activeElement.contains(target)))) {
          return;
        }
        event.preventDefault();
        setActiveTool('select');
        setSelectedTokenId(null);
        setSelectedShapeId(null);
        setSelectedTextObjectId(null);
        setEscapePressCount(prev => prev + 1);
        return;
      }

      if (isInputFocused) {
        return;
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
    if (activeTool !== 'select') {
        setSelectedTokenId(null);
        setSelectedShapeId(null);
        setSelectedTextObjectId(null);
    }
  }, [activeTool, currentDrawingShape, measurement.type]);

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
            const availableSquare = findAvailableSquareLocal(middleX, middleY, 1, tokens, GRID_COLS, GRID_ROWS);
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
        return prevParticipants.map(p => p.id === participantId ? {...p, customImageUrl: newImageUrl} : p);
    });
  }, [tokens, toast]);

  const handleRemoveParticipantFromList = useCallback((participantId: string) => {
    const participantToRemove = participants.find(p => p.id === participantId);
    if (!participantToRemove) return;

    const updatedParticipants = participants.filter(p => p.id !== participantId);
    const activeParticipantIdBeforeRemove = isCombatActive && currentParticipantIndex >= 0 && currentParticipantIndex < participants.length ? participants[currentParticipantIndex].id : null;

    setParticipants(updatedParticipants);

    // Token remains on the grid, only its link to the turn order is severed.

    if (updatedParticipants.length === 0) {
      setCurrentParticipantIndex(-1);
      if (isCombatActive) setRoundCounter(1);
      setIsCombatActive(false);
    } else if (isCombatActive && activeParticipantIdBeforeRemove) {
        const newActiveIndex = updatedParticipants.findIndex(p => p.id === activeParticipantIdBeforeRemove);
        if (newActiveIndex !== -1) {
            setCurrentParticipantIndex(newActiveIndex);
        } else {
            const removedIndexOriginal = participants.findIndex(p => p.id === participantId);
            if (currentParticipantIndex >= removedIndexOriginal && currentParticipantIndex > 0) {
                setCurrentParticipantIndex(Math.max(0, currentParticipantIndex -1));
            } else if (currentParticipantIndex >= updatedParticipants.length) {
                 setCurrentParticipantIndex(0);
            }
            if (currentParticipantIndex < 0 || currentParticipantIndex >= updatedParticipants.length) {
                setCurrentParticipantIndex(updatedParticipants.length > 0 ? 0 : -1);
            }
        }
    } else if (!isCombatActive) {
        const oldActiveParticipantId = participants[currentParticipantIndex]?.id;
        if (oldActiveParticipantId){
            const newActiveIndex = updatedParticipants.findIndex(p => p.id === oldActiveParticipantId);
             setCurrentParticipantIndex(newActiveIndex !== -1 ? newActiveIndex : (updatedParticipants.length > 0 ? 0 : -1));
        } else {
            setCurrentParticipantIndex(updatedParticipants.length > 0 ? 0 : -1);
        }
    }
  }, [participants, currentParticipantIndex, isCombatActive]);

  const handleTokenErasedOnGrid = useCallback((tokenId: string) => {
    setTokens(prev => prev.filter(t => t.id !== tokenId));
    const participantLinked = participants.find(p => p.tokenId === tokenId);
    if (participantLinked) {
      handleRemoveParticipantFromList(participantLinked.id);
    }
    if (selectedTokenId === tokenId) setSelectedTokenId(null);
  }, [participants, handleRemoveParticipantFromList, selectedTokenId]);

  const handleTokenDelete = useCallback((tokenId: string) => {
    const tokenBeingDeleted = tokens.find(t => t.id === tokenId);
    const participantLinked = participants.find(p => p.tokenId === tokenId);

    setTokens(prev => prev.filter(t => t.id !== tokenId));

    if (participantLinked) {
      handleRemoveParticipantFromList(participantLinked.id);
    }

    if (selectedTokenId === tokenId) setSelectedTokenId(null);

    if (!participantLinked) {
      toast({ title: "Token Deleted", description: `Token "${tokenBeingDeleted?.instanceName || tokenBeingDeleted?.label || 'Unnamed'}" removed.` });
    }
  }, [tokens, participants, toast, selectedTokenId, handleRemoveParticipantFromList]);


  const handleRequestTokenImageChange = useCallback((tokenId: string) => {
    setTokenToChangeImage(tokenId);
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                setTimeout(() => {
                    toast({ title: "Upload Error", description: "Image file size exceeds 2MB limit.", variant: "destructive" });
                },0);
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

  const handleTokenSizeChange = useCallback((tokenId: string, requestedNewSize: number) => {
    const newSize = Math.max(1, Math.min(9, requestedNewSize));

    setTokens(prevTokens => {
      const tokenIndex = prevTokens.findIndex(t => t.id === tokenId);
      if (tokenIndex === -1) return prevTokens;

      const tokenToResize = prevTokens[tokenIndex];

      if (tokenToResize.x + newSize > GRID_COLS || tokenToResize.y + newSize > GRID_ROWS) {
        setTimeout(() => {
          toast({ title: "Cannot Resize", description: "Token would extend beyond grid boundaries.", variant: "destructive" });
        }, 0);
        return prevTokens;
      }

      if (newSize > (tokenToResize.size || 1)) {
        for (const otherToken of prevTokens) {
          if (otherToken.id === tokenId) continue;

          const otherTokenSize = otherToken.size || 1;
          const overlapX = Math.max(0, Math.min(tokenToResize.x + newSize, otherToken.x + otherTokenSize) - Math.max(tokenToResize.x, otherToken.x));
          const overlapY = Math.max(0, Math.min(tokenToResize.y + newSize, otherToken.y + otherTokenSize) - Math.max(tokenToResize.y, otherToken.y));

          if (overlapX > 0 && overlapY > 0) {
             setTimeout(() => {
              toast({ title: "Cannot Resize", description: "Enlarged token would overlap with another token.", variant: "destructive" });
            }, 0);
            return prevTokens;
          }
        }
      }

      const updatedTokens = [...prevTokens];
      updatedTokens[tokenIndex] = { ...tokenToResize, size: newSize };

      return updatedTokens;
    });
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
    const participantNameInput = participantData.name.trim();
    let finalTokenId: string | undefined = explicitTokenId !== "none" ? explicitTokenId : undefined;
    let newTokensCreated: Token[] = [];
    let tokenSize = 1;

    if (finalTokenId) {
        const existingToken = tokens.find(t => t.id === finalTokenId);
        if (existingToken) tokenSize = existingToken.size || 1;
    } else if (selectedTokenTemplate) {
        tokenSize = selectedTokenTemplate.size || 1;
    }


    if (!finalTokenId) {
      const middleX = Math.floor(GRID_COLS / 2) - Math.floor(tokenSize / 2);
      const middleY = Math.floor(GRID_ROWS / 2) - Math.floor(tokenSize / 2);
      const availableSquare = findAvailableSquareLocal(middleX, middleY, tokenSize, tokens, GRID_COLS, GRID_ROWS);

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
        instanceName: participantNameInput,
        size: tokenSize,
      };
      newTokensCreated.push(newToken);
      finalTokenId = newToken.id;
    }

    setTokens(prev => [...prev, ...newTokensCreated]);

    const newParticipant: Participant = {
      ...participantData,
      id: `participant-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: participantNameInput,
      tokenId: finalTokenId,
      customImageUrl: avatarUrl || undefined,
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
  }, [isCombatActive, currentParticipantIndex, tokens, toast, selectedTokenTemplate]);


  const handleAddCombatantFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const participantNameInput = newParticipantName.trim();
    if (!participantNameInput || !newParticipantInitiative.trim()) {
      toast({ title: "Missing Fields", description: "Name and Initiative are required.", variant: "destructive"});
      return;
    }
    const initiativeValue = parseInt(newParticipantInitiative, 10);
    if (isNaN(initiativeValue)) {
      toast({ title: "Invalid Initiative", description: "Initiative must be a number.", variant: "destructive"});
      return;
    }

    const hpString = newParticipantHp.trim();
    const acString = newParticipantAc.trim();
    const hpValue = hpString === '' ? undefined : parseInt(hpString, 10);
    const acValue = acString === '' ? undefined : parseInt(acString, 10);

    if (hpString !== '' && (isNaN(hpValue as number) || (hpValue as number) < 0) ) {
        toast({ title: "Invalid Health", description: "Health must be a non-negative number or empty.", variant: "destructive"});
        return;
    }
    if (acString !== '' && (isNaN(acValue as number) || (acValue as number) < 0) ) {
        toast({ title: "Invalid Armor", description: "Armor must be a non-negative number or empty.", variant: "destructive"});
        return;
    }

    const quantity = (selectedAssignedTokenId && selectedAssignedTokenId !== "none") ? 1 : (parseInt(newParticipantQuantity, 10) || 1);
    if (quantity < 1) {
        toast({ title: "Invalid Quantity", description: "Quantity must be at least 1.", variant: "destructive"});
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
                  icon: isAvatarProvided ? undefined : (newTypeTemplate ? newTypeTemplate.icon : (t.customImageUrl ? undefined : t.icon)),
                  customImageUrl: isAvatarProvided ? croppedAvatarDataUrl! : (t.customImageUrl || undefined),
                  label: isAvatarProvided ? 'Custom Avatar' : (newTypeTemplate ? newTypeTemplate.name : t.label),
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
  }, [
    newParticipantName, newParticipantInitiative, newParticipantHp, newParticipantAc,
    newParticipantQuantity, newParticipantType, selectedAssignedTokenId,
    croppedAvatarDataUrl, handleAddParticipantToList, toast
  ]);

  const handleFocusToken = useCallback((tokenId: string) => {
    setSelectedTokenId(tokenId);
    setTokenIdToFocus(tokenId);
  }, []);

  const handleOpenAddCombatantDialogForToken = useCallback((token: Token) => {
    setNewParticipantName(token.instanceName || token.label || 'Unnamed Token');
    if (['player', 'enemy', 'ally'].includes(token.type)) {
      setNewParticipantType(token.type as 'player' | 'enemy' | 'ally');
    } else {
      setNewParticipantType('player');
    }
    setSelectedAssignedTokenId(token.id);
    setCroppedAvatarDataUrl(null);

    setNewParticipantInitiative('10');
    setNewParticipantHp('10');
    setNewParticipantAc('10');
    setNewParticipantQuantity('1');

    setDialogOpen(true);
  }, []);

  const handleMoveParticipant = useCallback((participantId: string, direction: 'up' | 'down') => {
    setParticipants(prevParticipants => {
      const currentIndex = prevParticipants.findIndex(p => p.id === participantId);
      if (currentIndex === -1) return prevParticipants;

      let newInitiative: number;
      if (direction === 'up') {
        if (currentIndex === 0) return prevParticipants;
        const participantAbove = prevParticipants[currentIndex - 1];
        newInitiative = participantAbove.initiative + 1;
      } else {
        if (currentIndex === prevParticipants.length - 1) return prevParticipants;
        const participantBelow = prevParticipants[currentIndex + 1];
        newInitiative = participantBelow.initiative - 1;
      }

      const updatedParticipants = prevParticipants.map(p =>
        p.id === participantId ? { ...p, initiative: newInitiative } : p
      );

      updatedParticipants.sort((a, b) => b.initiative - a.initiative);

      if (isCombatActive) {
        const activeParticipantId = prevParticipants[currentParticipantIndex]?.id;
        if (activeParticipantId) {
          const newActiveIndex = updatedParticipants.findIndex(p => p.id === activeParticipantId);
          setCurrentParticipantIndex(newActiveIndex !== -1 ? newActiveIndex : 0);
        }
      }
      return updatedParticipants;
    });
  }, [isCombatActive, currentParticipantIndex]);

  const handleMoveParticipantUp = useCallback((participantId: string) => {
    handleMoveParticipant(participantId, 'up');
  }, [handleMoveParticipant]);

  const handleMoveParticipantDown = useCallback((participantId: string) => {
    handleMoveParticipant(participantId, 'down');
  }, [handleMoveParticipant]);

  const handleUpdateParticipantStats = useCallback((participantId: string, newStats: { initiative?: number; hp?: number; ac?: number }) => {
    setParticipants(prevParticipants => {
      let participantUpdated = false;
      const updatedParticipantsList = prevParticipants.map(p => {
        if (p.id === participantId) {
          participantUpdated = true;
          return {
            ...p,
            initiative: newStats.initiative !== undefined ? newStats.initiative : p.initiative,
            hp: newStats.hp !== undefined ? newStats.hp : p.hp,
            ac: newStats.ac !== undefined ? newStats.ac : p.ac,
          };
        }
        return p;
      });

      if (!participantUpdated) return prevParticipants;

      if (newStats.initiative !== undefined) {
        updatedParticipantsList.sort((a, b) => b.initiative - a.initiative);
        if (isCombatActive) {
          const activeParticipant = prevParticipants[currentParticipantIndex];
          if (activeParticipant) {
            const newActiveIndex = updatedParticipantsList.findIndex(p => p.id === activeParticipant.id);
            if (newActiveIndex !== -1) {
              setCurrentParticipantIndex(newActiveIndex);
            } else {
              setCurrentParticipantIndex(updatedParticipantsList.length > 0 ? 0 : -1);
            }
          } else {
             setCurrentParticipantIndex(updatedParticipantsList.length > 0 ? 0 : -1);
          }
        }
      }
      toast({ title: "Stats Updated", description: `Stats for ${updatedParticipantsList.find(p=>p.id === participantId)?.name} updated.`});
      return updatedParticipantsList;
    });
  }, [isCombatActive, currentParticipantIndex, toast]);


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
    <div className={cn("flex-1 min-w-0 space-y-1 border border-border rounded-md p-3", disabled && "opacity-50")}>
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
                    setValue('10');
                } else if (optional && num < 0 && value.trim() !== '') {
                    setValue('0');
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
                const currentValue = parseInt(value, 10) || (idPrefix === 'participant-quantity-dialog' ? 1 : (optional && value === '' ? 0 : 0));
                const isQuantityField = idPrefix === 'participant-quantity-dialog';
                const minValue = isQuantityField ? 1 : (optional ? -Infinity : 0);
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

  const activeTurnTokenId = participants[currentParticipantIndex]?.tokenId || null;

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

  const unassignedTokensForDialog = useMemo(() => tokens.filter(token =>
    ['player', 'enemy', 'ally', 'generic'].includes(token.type) &&
    !participants.some(p => p.tokenId === token.id)
  ), [tokens, participants]);

  const unassignedTokensForAutoRoll = useMemo(() => {
    return tokens.filter(
      (token) =>
        ['player', 'enemy', 'ally'].includes(token.type) &&
        !participants.some((p) => p.tokenId === token.id)
    );
  }, [tokens, participants]);

  const handleDialogClose = (isOpen: boolean) => {
    setDialogOpen(isOpen);
    if (!isOpen) {
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
      if (file.size > 2 * 1024 * 1024) {
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
        if (event.target) event.target.value = '';
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

  const handleAutoRollInitiative = useCallback(() => {
    const tokensToRoll = tokens.filter(
      (token) =>
        ['player', 'enemy', 'ally'].includes(token.type) &&
        !participants.some((p) => p.tokenId === token.id)
    );

    if (tokensToRoll.length === 0) {
      toast({
        title: "No Tokens to Roll",
        description: "All eligible tokens are already in the turn order.",
      });
      return;
    }

    const newParticipantsFromTokens: Participant[] = tokensToRoll.map((token) => {
      const initiative = Math.floor(Math.random() * 20) + 1;
      return {
        id: `participant-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${token.id}`,
        name: token.instanceName || token.label || 'Unnamed Token',
        initiative,
        type: token.type as 'player' | 'enemy' | 'ally',
        tokenId: token.id,
        customImageUrl: token.customImageUrl,
      };
    });

    setParticipants(prevParticipants => {
      const combinedParticipants = [...prevParticipants, ...newParticipantsFromTokens];
      const sortedParticipants = combinedParticipants.sort((a, b) => {
        if (b.initiative === a.initiative) {
          return a.name.localeCompare(b.name);
        }
        return b.initiative - a.initiative;
      });

      if (isCombatActive) {
        const activeId = prevParticipants[currentParticipantIndex]?.id;
        const newCurrentIndex = activeId ? sortedParticipants.findIndex(p => p.id === activeId) : -1;
        setCurrentParticipantIndex(newCurrentIndex !== -1 ? newCurrentIndex : (sortedParticipants.length > 0 ? 0 : -1));
      } else {
        const selectedId = prevParticipants[currentParticipantIndex]?.id;
        let newSelectionIndex = selectedId ? sortedParticipants.findIndex(p => p.id === selectedId) : -1;
        if (newSelectionIndex === -1 && sortedParticipants.length > 0) {
          newSelectionIndex = 0;
        }
        setCurrentParticipantIndex(newSelectionIndex);
      }
      return sortedParticipants;
    });

    toast({
      title: "Initiative Auto-Rolled",
      description: `${newParticipantsFromTokens.length} combatant(s) added to the turn order.`,
    });

  }, [tokens, participants, isCombatActive, currentParticipantIndex, toast]);

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
            showAllLabels={showAllLabels}
            setShowAllLabels={setShowAllLabels}
            backgroundImageUrl={backgroundImageUrl}
            backgroundZoomLevel={backgroundZoomLevel}
            activeTool={activeTool} setActiveTool={setActiveTool}
            selectedColor={selectedColor}
            selectedTokenTemplate={selectedTokenTemplate}
            onTokenMove={handleTokenMove}
            onTokenInstanceNameChange={handleTokenInstanceNameChange}
            onChangeTokenSize={handleTokenSizeChange}
            measurement={measurement} setMeasurement={setMeasurement}
            activeTurnTokenId={activeTurnTokenId}
            currentTextFontSize={currentTextFontSize}
            onTokenDelete={handleTokenDelete}
            onTokenErasedOnGrid={handleTokenErasedOnGrid}
            onTokenImageChangeRequest={handleRequestTokenImageChange}
            escapePressCount={escapePressCount}
            selectedTokenId={selectedTokenId} setSelectedTokenId={setSelectedTokenId}
            selectedShapeId={selectedShapeId} setSelectedShapeId={setSelectedShapeId}
            selectedTextObjectId={selectedTextObjectId} setSelectedTextObjectId={setSelectedTextObjectId}
            tokenIdToFocus={tokenIdToFocus}
            onFocusHandled={() => setTokenIdToFocus(null)}
            onOpenAddCombatantDialogForToken={handleOpenAddCombatantDialogForToken}
            participants={participants}
          />
          <FloatingToolbar
            activeTool={activeTool} setActiveTool={setActiveTool}
            selectedColor={selectedColor} setSelectedColor={setSelectedColor}
            selectedTokenTemplate={selectedTokenTemplate} setSelectedTokenTemplate={setSelectedTokenTemplate}
            backgroundImageUrl={backgroundImageUrl} setBackgroundImageUrl={setBackgroundImageUrl}
            showGridLines={showGridLines} setShowGridLines={setShowGridLines}
            showAllLabels={showAllLabels} setShowAllLabels={setShowAllLabels}
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
              onFocusToken={handleFocusToken}
              onMoveParticipantUp={handleMoveParticipantUp}
              onMoveParticipantDown={handleMoveParticipantDown}
              onUpdateParticipantStats={handleUpdateParticipantStats}
            />
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
            {!isCombatActive ? (
              <div className="flex gap-2">
                <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
                  <DialogTrigger asChild>
                    <Button className="flex-1"> Add Combatant </Button>
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
                              <SelectValue placeholder="Select existing token..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (Create new token)</SelectItem>
                              {unassignedTokensForDialog.map(token => (
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
                <Button
                  onClick={handleAutoRollInitiative}
                  className="flex-1"
                  variant="outline"
                  disabled={unassignedTokensForAutoRoll.length === 0}
                >
                  <Shuffle className="mr-2 h-4 w-4" /> Auto Roll
                </Button>
              </div>
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

    