
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GridCellData, Token, Participant, ActiveTool, Measurement, DrawnShape, TextObjectType, UndoableState, BattleBoardPageProps, DefaultBattleMap } from '@/types';
import BattleGrid from '@/components/battle-grid/battle-grid';
import FloatingToolbar from '@/components/floating-toolbar';
import InitiativeTrackerPanel from '@/components/controls/initiative-tracker-panel';
import WelcomeDialog from '@/components/welcome-dialog';
import { SidebarProvider, Sidebar, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LandPlot, Plus, Minus, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ImageCropDialog from '@/components/image-crop-dialog';
import { PlayerIcon, EnemyIcon, AllyIcon } from '@/components/icons';
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
const MAX_HISTORY_LENGTH = 30;
const WELCOME_DIALOG_STORAGE_KEY = 'hasSeenWelcomeDialogV1';


const initialGridCells = (): GridCellData[][] =>
  Array.from({ length: GRID_ROWS }, (_, y) =>
    Array.from({ length: GRID_COLS }, (_, x) => ({
      id: `${y}-${x}`,
      color: undefined,
    }))
  );

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
  const [isAutoAdvanceOn, setIsAutoAdvanceOn] = useState<boolean>(false);
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
  const [selectedAssignedTokenId, setSelectedAssignedTokenId] = useState<string | undefined>(undefined);


  // Undo/Redo State
  const [history, setHistory] = useState<UndoableState[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);
  const isUndoRedoOperation = useRef<boolean>(false);

  // State for changing a specific token's image
  const [tokenToChangeImage, setTokenToChangeImage] = useState<string | null>(null);
  const [uncroppedTokenImageSrc, setUncroppedTokenImageSrc] = useState<string | null>(null);
  const [isTokenCropDialogOpen, setIsTokenCropDialogOpen] = useState(false);

  // Welcome Dialog State
  const [showWelcomeDialog, setShowWelcomeDialog] = useState<boolean>(false);

  // Escape key global handler state
  const [escapePressCount, setEscapePressCount] = useState(0);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeen = localStorage.getItem(WELCOME_DIALOG_STORAGE_KEY);
      if (!hasSeen) {
        setShowWelcomeDialog(true);
      }
    }
  }, []);

  const handleCloseWelcomeDialog = () => {
    setShowWelcomeDialog(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(WELCOME_DIALOG_STORAGE_KEY, 'true');
    }
  };


  const getCurrentUndoableState = useCallback((): UndoableState => {
    return JSON.parse(JSON.stringify({
      gridCells,
      tokens,
      drawnShapes,
      textObjects,
      participants,
    }));
  }, [gridCells, tokens, drawnShapes, textObjects, participants]);

  useEffect(() => {
    const initialSnapshot = {
      gridCells: initialGridCells(),
      tokens: [],
      drawnShapes: [],
      textObjects: [],
      participants: [],
    };
    setHistory([initialSnapshot]);
    setHistoryPointer(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isUndoRedoOperation.current) {
      isUndoRedoOperation.current = false;
      return;
    }

    if (historyPointer === -1) return;

    const newSnapshot = getCurrentUndoableState();

    // Prevent adding identical state to history
    const currentHistoryState = history[historyPointer];
    if (currentHistoryState && JSON.stringify(newSnapshot) === JSON.stringify(currentHistoryState)) {
        return;
    }
    
    const newHistoryBase = history.slice(0, historyPointer + 1);
    const updatedHistory = [...newHistoryBase, newSnapshot].slice(-MAX_HISTORY_LENGTH);

    setHistory(updatedHistory);
    setHistoryPointer(updatedHistory.length - 1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridCells, tokens, drawnShapes, textObjects, participants]);

  const restoreStateFromSnapshot = (snapshot: UndoableState) => {
    setGridCells(snapshot.gridCells);
    setTokens(snapshot.tokens.map(tokenFromFile => {
        const template = tokenTemplates.find(t => t.type === tokenFromFile.type && t.name === tokenFromFile.label) || tokenTemplates.find(t => t.type === tokenFromFile.type);
        return {
            ...tokenFromFile,
            icon: tokenFromFile.customImageUrl ? undefined : template?.icon,
        };
    }));
    setDrawnShapes(snapshot.drawnShapes);
    setTextObjects(snapshot.textObjects);
    setParticipants(snapshot.participants);
  };

  const handleUndo = useCallback(() => {
    if (historyPointer <= 0) {
      toast({ title: "Nothing to undo", duration: 2000 });
      return;
    }
    isUndoRedoOperation.current = true;
    const newPointer = historyPointer - 1;
    restoreStateFromSnapshot(history[newPointer]);
    setHistoryPointer(newPointer);
  }, [history, historyPointer, toast]);

  const handleRedo = useCallback(() => {
    if (historyPointer >= history.length - 1 || historyPointer < 0) {
      toast({ title: "Nothing to redo", duration: 2000 });
      return;
    }
    isUndoRedoOperation.current = true;
    const newPointer = historyPointer + 1;
    restoreStateFromSnapshot(history[newPointer]);
    setHistoryPointer(newPointer);
  }, [history, historyPointer, toast]);

  // Global keydown listener for Undo/Redo and Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (event.key === 'Escape') {
        if (isInputFocused) {
          // Allow Escape for inputs to blur or cancel their own actions
          return;
        }
        event.preventDefault(); // Prevent other default Escape key behaviors
        setActiveTool('select');
        setEscapePressCount(prev => prev + 1);
        return; // Return after handling escape
      }
      
      // For Undo/Redo, don't act if an input is focused
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
    if (currentDrawingShape && !['draw_line', 'draw_circle', 'draw_square'].includes(activeTool)) {
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
            // Create a new token if one doesn't exist
            const middleX = Math.floor(GRID_COLS / 2);
            const middleY = Math.floor(GRID_ROWS / 2);
            const newToken: Token = {
                id: `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                x: middleX,
                y: middleY,
                color: 'hsl(var(--muted))', // Default for custom
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
  }, []);

  const handleTokenDelete = useCallback((tokenId: string) => {
    setTokens(prev => prev.filter(t => t.id !== tokenId));
    setParticipants(prev => {
      const newParticipants = prev.map(p => p.tokenId === tokenId ? { ...p, tokenId: undefined } : p);
      return newParticipants;
    });
    toast({ title: "Token Deleted" });
  }, [toast]);

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
    explicitTokenId?: string 
  ) => {
    const participantName = participantData.name.trim();
    let finalTokenId: string | undefined = explicitTokenId;

    if (!finalTokenId) { 
      const template = tokenTemplates.find(t => t.type === participantData.type);
      if (template) {
        const middleX = Math.floor(GRID_COLS / 2);
        const middleY = Math.floor(GRID_ROWS / 2);
        const newToken: Token = {
          id: `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          x: middleX, y: middleY,
          color: template.color, icon: template.icon,
          type: template.type, label: template.name,
          instanceName: participantName, size: 1,
        };
        setTokens(prev => [...prev, newToken]);
        finalTokenId = newToken.id;
      }
    }

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
  }, [isCombatActive, currentParticipantIndex]);


  const handleRemoveParticipantFromList = (idToRemove: string) => {
    const participantToRemove = participants.find(p => p.id === idToRemove);
    setParticipants(prevParticipants => {
      const isRemovingCurrentTurn = prevParticipants[currentParticipantIndex]?.id === idToRemove;
      const newList = prevParticipants.filter(p => p.id !== idToRemove);

      if (newList.length === 0) {
        setCurrentParticipantIndex(-1);
      } else if (isRemovingCurrentTurn) {
        setCurrentParticipantIndex(currentParticipantIndex % newList.length);
      } else {
        const oldActiveParticipantId = prevParticipants[currentParticipantIndex]?.id;
        const newActiveIndex = newList.findIndex(p => p.id === oldActiveParticipantId);
        if (newActiveIndex !== -1) {
          setCurrentParticipantIndex(newActiveIndex);
        } else {
          setCurrentParticipantIndex(currentParticipantIndex >= newList.length ? Math.max(0, newList.length -1) : currentParticipantIndex);
        }
      }
      return newList;
    });
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAutoAdvanceOn && isCombatActive && participants.length > 0 && currentParticipantIndex !== -1) {
      timer = setTimeout(() => { handleAdvanceTurn(); }, 5000);
    }
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoAdvanceOn, isCombatActive, currentParticipantIndex, participants]);

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
    
    const quantity = selectedAssignedTokenId ? 1 : (parseInt(newParticipantQuantity, 10) || 1);
    if (quantity < 1) {
        return;
    }

    for (let i = 0; i < quantity; i++) {
      const finalName = (quantity > 1 && !selectedAssignedTokenId) ? `${participantNameInput} ${i + 1}` : participantNameInput;
      const newParticipantData: Omit<Participant, 'id' | 'tokenId'> = {
        name: finalName,
        initiative: initiativeValue,
        type: newParticipantType,
        hp: hpValue,
        ac: acValue,
      };
      
      if (selectedAssignedTokenId) {
        handleAddParticipantToList(newParticipantData, selectedAssignedTokenId);
        
        const newTypeTemplate = tokenTemplates.find(t => t.type === newParticipantType);

        setTokens(prevTokens => prevTokens.map(t => {
          if (t.id === selectedAssignedTokenId) {
            return {
              ...t,
              instanceName: finalName,
              type: newParticipantType,
              ...(newTypeTemplate && { color: newTypeTemplate.color }),
              ...(newTypeTemplate && { icon: t.customImageUrl ? undefined : newTypeTemplate.icon }),
            };
          }
          return t;
        }));
      } else {
        handleAddParticipantToList(newParticipantData);
      }
    }

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
    setSelectedAssignedTokenId(undefined);
    setDialogOpen(false);
  };

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
    <div className="flex-1 space-y-1">
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
                const currentValue = parseInt(value, 10) || 0;
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
                const currentValue = parseInt(value,10) || (idPrefix === 'participant-quantity-dialog' ? 0 : (optional && value === '' ? 0 : 0)); 
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
      // Reset form fields when dialog is closed
      setNewParticipantName('');
      setNewParticipantInitiative('10');
      setNewParticipantHp('10');
      setNewParticipantAc('10');
      setNewParticipantQuantity('1');
      setNewParticipantType('player');
      setSelectedAssignedTokenId(undefined);
      setIsEditingInitiative(false);
      setIsEditingHp(false);
      setIsEditingAc(false);
      setIsEditingQuantity(false);
    }
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
              const linkedParticipant = participants.find(p => p.tokenId === tokenToChangeImage);
              if (linkedParticipant) {
                // Participant's token image is updated via token state
              }
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
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Combatant</DialogTitle>
                  <DialogDescription> Enter the details for the new combatant. </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddCombatantFormSubmit} className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="participant-name-dialog">Name</Label>
                    <Input id="participant-name-dialog" value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} placeholder="e.g., Gorok the Barbarian" required />
                  </div>
                  <div>
                    <Label htmlFor="assign-token-select">Assign To Token (Optional)</Label>
                    <Select
                      value={selectedAssignedTokenId}
                      onValueChange={(value) => {
                        const newSelectedId = value === 'none' ? undefined : value;
                        setSelectedAssignedTokenId(newSelectedId);
                        if (newSelectedId) {
                          setNewParticipantQuantity('1');
                        }
                      }}
                    >
                      <SelectTrigger id="assign-token-select">
                        <SelectValue placeholder="Select existing token..." />
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

                  <div className="flex flex-col sm:flex-row gap-3">
                    {renderNumericInput(newParticipantInitiative, setNewParticipantInitiative, isEditingInitiative, setIsEditingInitiative, "Initiative*", "participant-initiative-dialog", false, false)}
                    {renderNumericInput(newParticipantHp, setNewParticipantHp, isEditingHp, setIsEditingHp, "HP", "participant-hp-dialog", true, false)}
                    {renderNumericInput(newParticipantAc, setNewParticipantAc, isEditingAc, setIsEditingAc, "AC", "participant-ac-dialog", true, false)}
                    {renderNumericInput(newParticipantQuantity, setNewParticipantQuantity, isEditingQuantity, setIsEditingQuantity, "Qty*", "participant-quantity-dialog", false, !!selectedAssignedTokenId)}
                  </div>
                  <div>
                    <Label>Type</Label>
                    <div className="flex space-x-2 mt-1">
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
                  <FormDialogFooter> <Button type="submit"> Add to Turn Order </Button> </FormDialogFooter>
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
    

    





