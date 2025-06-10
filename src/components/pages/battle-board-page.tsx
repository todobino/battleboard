
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, Dispatch, SetStateAction } from 'react';
import type { GridCellData, Token, Participant, ActiveTool, Measurement, DrawnShape, TextObjectType, UndoableState, BattleBoardPageProps } from '@/types';

import BattleGrid from '@/components/battle-grid/battle-grid';
import SideToolbar from '@/components/side-toolbar';
import InitiativeTrackerPanel from '@/components/controls/initiative-tracker-panel';
import WelcomeDialog from '@/components/welcome-dialog';
import { SidebarProvider, Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ArrowRight, Camera, Users, Plus, Minus, Shuffle, Play } from 'lucide-react';
import ImageCropDialog from '@/components/image-crop-dialog';
import { PlayerIcon, EnemyIcon, AllyIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter as FormDialogFooter, DialogHeader as FormDialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { tokenTemplates } from '@/config/token-templates';

import { useBattleBoardState, createInitialUndoableSnapshot } from '@/hooks/useBattleBoardState';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useEscapeKey } from '@/hooks/useEscapeKey';

const WELCOME_DIALOG_STORAGE_KEY = 'hasSeenWelcomeDialogV1';

// Helper function (can be moved or defined if not from bbs directly)
const initialGridCellsLocal = (): GridCellData[][] =>
  Array.from({ length: 40 }, (_, y) =>
    Array.from({ length: 40 }, (_, x) => ({
      id: `${y}-${x}`,
      color: undefined,
    }))
  );


export default function BattleBoardPage({ defaultBattlemaps }: BattleBoardPageProps) {
  const bbs = useBattleBoardState(defaultBattlemaps);
  const { toast } = bbs;

  const [showWelcomeDialog, setShowWelcomeDialog] = useState<boolean>(false);
  const escapePressCount = useEscapeKey();

  const { undo, redo, canUndo, canRedo, addSnapshot, resetHistory, isRestoring: isUndoRedoRestoring } = useUndoRedo({
    initialSnapshot: createInitialUndoableSnapshot({
        gridCells: bbs.gridCells,
        tokens: bbs.stripIconsForStorage(bbs.tokens),
        drawnShapes: bbs.drawnShapes,
        textObjects: bbs.textObjects,
        participants: bbs.participants,
    }),
    getCurrentSnapshot: bbs.getCurrentSnapshot,
    restoreSnapshot: bbs.restoreSnapshot,
    onStateRestored: () => {
      bbs.setSelectedTokenIds([]);
      bbs.setSelectedShapeIds([]);
      bbs.setSelectedTextObjectIds([]);
    }
  });

  useEffect(() => {
    if (bbs.isInitialLoadComplete && !isUndoRedoRestoring.current) {
        addSnapshot();
    }
  }, [
    bbs.gridCells, bbs.tokens, bbs.drawnShapes, bbs.textObjects, bbs.participants,
    addSnapshot, bbs.isInitialLoadComplete, isUndoRedoRestoring
  ]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeen = localStorage.getItem(WELCOME_DIALOG_STORAGE_KEY);
      if (!hasSeen) setShowWelcomeDialog(true);
    }
  }, []);

  const handleCloseWelcomeDialog = () => {
    setShowWelcomeDialog(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(WELCOME_DIALOG_STORAGE_KEY, 'true');
    }
  };

  // Single tokenIdToFocus remains for camera movement
  const [tokenIdToFocus, setTokenIdToFocus] = useState<string | null>(null);

  // State for "Add Participant" Dialog
  const [addParticipantDialogOpen, setAddParticipantDialogOpen] = useState(false);
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

  // State for "Edit Stats" Dialog (moved from InitiativeTrackerPanel)
  const [isEditStatsDialogOpen, setIsEditStatsDialogOpen] = useState(false);
  const [participantToEditStats, setParticipantToEditStats] = useState<Participant | null>(null);
  const [dialogInitiative, setDialogInitiative] = useState('');
  const [dialogHp, setDialogHp] = useState('');
  const [dialogAc, setDialogAc] = useState('');
  const [isEditingDialogIni, setIsEditingDialogIni] = useState(false);
  const [isEditingDialogHpVal, setIsEditingDialogHpVal] = useState(false);
  const [isEditingDialogAcVal, setIsEditingDialogAcVal] = useState(false);

  useEffect(() => {
    if (participantToEditStats) {
      setDialogInitiative(String(participantToEditStats.initiative));
      setDialogHp(participantToEditStats.hp !== undefined ? String(participantToEditStats.hp) : '');
      setDialogAc(participantToEditStats.ac !== undefined ? String(participantToEditStats.ac) : '');
      setIsEditingDialogIni(false);
      setIsEditingDialogHpVal(false);
      setIsEditingDialogAcVal(false);
    }
  }, [participantToEditStats]);


  const [tokenToChangeImage, setTokenToChangeImage] = useState<string | null>(null);
  const [uncroppedTokenImageSrc, setUncroppedTokenImageSrc] = useState<string | null>(null);
  const [isTokenCropDialogOpen, setIsTokenCropDialogOpen] = useState(false);


  const handleResetBoard = useCallback(() => {
    bbs.setGridCells(initialGridCellsLocal());
    bbs.setTokens([]);
    bbs.setDrawnShapes([]);
    bbs.setTextObjects([]);
    bbs.setParticipants([]);
    bbs.setBackgroundImageUrl(null);
    bbs.setBackgroundZoomLevel(1);
    bbs.setShowGridLines(true);
    bbs.setShowAllLabels(true);
    bbs.setMeasurement({type: null});
    bbs.setCurrentParticipantIndex(-1);
    bbs.setRoundCounter(1);
    bbs.setIsCombatActive(false);
    bbs.setSelectedTokenIds([]);
    bbs.setSelectedShapeIds([]);
    bbs.setSelectedTextObjectIds([]);
    setTokenIdToFocus(null);
    bbs.setSelectedShapeDrawColor(bbs.DEFAULT_SHAPE_DRAW_COLOR); // Reset shape draw color

    resetHistory(createInitialUndoableSnapshot({
        gridCells: initialGridCellsLocal(), tokens: [], drawnShapes: [], textObjects: [], participants: []
    }));
    setTimeout(() => toast({ title: "Battle Board Cleared", description: "Everything has been reset." }), 0);
  }, [bbs, resetHistory, toast]);


  useEffect(() => {
    if (escapePressCount > 0) {
      setAddParticipantDialogOpen(false);
      setIsEditStatsDialogOpen(false);
      setIsAvatarCropDialogOpen(false);
      setIsTokenCropDialogOpen(false);
    }
  }, [escapePressCount]);

  const handleTokenMove = useCallback((tokenId: string, newX: number, newY: number) => {
    bbs.setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, x: newX, y: newY } : t));
  }, [bbs]);

  const handleTokenInstanceNameChange = useCallback((tokenId: string, newName: string) => {
    bbs.setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, instanceName: newName } : t));
    bbs.setParticipants(prev => prev.map(p => p.tokenId === tokenId ? { ...p, name: newName } : p));
  }, [bbs]);

  const handleUpdateParticipantStats = useCallback((participantId: string, newStats: Partial<Pick<Participant, 'initiative' | 'hp' | 'ac'>>) => {
    let participantNameForToast: string | undefined;
    bbs.setParticipants(prevParticipants => {
      const participantIndex = prevParticipants.findIndex(p => p.id === participantId);
      if (participantIndex === -1) return prevParticipants;
      participantNameForToast = prevParticipants[participantIndex].name;

      const updatedParticipants = prevParticipants.map(p =>
        p.id === participantId ? { ...p, ...newStats } : p
      ).sort((a,b) => b.initiative - a.initiative);

      if (bbs.isCombatActive) {
        const activeParticipant = prevParticipants[bbs.currentParticipantIndex];
        if (activeParticipant) {
          const newActiveIndex = updatedParticipants.findIndex(p => p.id === activeParticipant.id);
          bbs.setCurrentParticipantIndex(newActiveIndex !== -1 ? newActiveIndex : 0);
        }
      }
      return updatedParticipants;
    });
    if (participantNameForToast) {
      setTimeout(() => toast({ title: "Stats Updated", description: `${participantNameForToast}'s stats have been saved.` }), 0);
    }
  }, [bbs, toast]);

  const handleTokenSizeChange = useCallback((tokenId: string, requestedNewSize: number) => {
    const newSize = Math.max(1, Math.min(9, requestedNewSize));
    bbs.setTokens(prevTokens => {
      const tokenIndex = prevTokens.findIndex(t => t.id === tokenId);
      if (tokenIndex === -1) return prevTokens;
      const tokenToResize = prevTokens[tokenIndex];
      if (tokenToResize.x + newSize > bbs.GRID_COLS || tokenToResize.y + newSize > bbs.GRID_ROWS) {
        setTimeout(() => toast({ title: "Cannot Resize", description: "Token would extend beyond grid boundaries.", variant: "destructive" }), 0);
        return prevTokens;
      }
      return prevTokens.map(t => t.id === tokenId ? { ...t, size: newSize } : t);
    });
  }, [bbs, toast]);

  const handleTokenErasedOnGrid = useCallback((tokenId: string) => {
    bbs.setTokens(prev => prev.filter(t => t.id !== tokenId));
    const participantLinked = bbs.participants.find(p => p.tokenId === tokenId);
    if (participantLinked) {
      bbs.setParticipants(prevP => prevP.filter(p => p.id !== participantLinked.id));
    }
    bbs.setSelectedTokenIds(prev => prev.filter(id => id !== tokenId));
  }, [bbs]);

  const handleTokenDelete = useCallback((tokenId: string) => {
    const tokenBeingDeleted = bbs.tokens.find(t => t.id === tokenId);
    bbs.setTokens(prev => prev.filter(t => t.id !== tokenId));
    const participantLinked = bbs.participants.find(p => p.tokenId === tokenId);
    if (participantLinked) {
      bbs.setParticipants(prevP => prevP.filter(p => p.id !== participantLinked.id));
    }
    bbs.setSelectedTokenIds(prev => prev.filter(id => id !== tokenId));
    if (!participantLinked && tokenBeingDeleted) {
      setTimeout(() => toast({ title: "Token Deleted", description: `Token "${tokenBeingDeleted?.instanceName || tokenBeingDeleted?.label || 'Unnamed'}" removed.` }),0);
    }
  }, [bbs, toast]);

  const handleSetShapeColor = useCallback((shapeId: string, newColor: string) => {
    bbs.setDrawnShapes(prevShapes =>
      prevShapes.map(s =>
        s.id === shapeId ? { ...s, color: newColor, fillColor: newColor } : s
      )
    );
  }, [bbs]);

  const handleRequestTokenImageChange = useCallback((tokenId: string) => {
    setTokenToChangeImage(tokenId);
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          setTimeout(() => toast({ title: "Upload Error", description: "Image file size exceeds 2MB limit.", variant: "destructive" }), 0);
          setTokenToChangeImage(null); return;
        }
        const reader = new FileReader();
        reader.onloadend = () => { setUncroppedTokenImageSrc(reader.result as string); setIsTokenCropDialogOpen(true); };
        reader.readAsDataURL(file);
      } else { setTokenToChangeImage(null); }
    };
    fileInput.click();
  }, [toast]);

  const handleRemoveParticipant = useCallback((participantId: string) => {
    bbs.setParticipants(prev => {
        const newParticipants = prev.filter(p => p.id !== participantId);
        if (newParticipants.length === 0) {
            bbs.setIsCombatActive(false);
            bbs.setRoundCounter(1);
            bbs.setCurrentParticipantIndex(-1);
        } else if (bbs.isCombatActive) {
            const oldIndex = prev.findIndex(p => p.id === participantId);
            let newCurrentIndex = bbs.currentParticipantIndex;

            if (oldIndex < newCurrentIndex) {
                newCurrentIndex--;
            } else if (oldIndex === newCurrentIndex && newCurrentIndex >= newParticipants.length) {
                newCurrentIndex = newParticipants.length > 0 ? 0 : -1;
                if (newParticipants.length > 0 && oldIndex === prev.length -1) bbs.setRoundCounter(r => r + 1);
            }
             bbs.setCurrentParticipantIndex(Math.max(-1, Math.min(newCurrentIndex, newParticipants.length - 1)));
        }
        return newParticipants;
    });
  }, [bbs]);

  const handleRenameParticipant = useCallback((participantId: string, newName: string) => {
    bbs.setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, name: newName } : p));
    const pToUpdate = bbs.participants.find(p => p.id === participantId);
    if (pToUpdate?.tokenId) {
      bbs.setTokens(prev => prev.map(t => t.id === pToUpdate.tokenId ? { ...t, instanceName: newName } : t));
    }
  }, [bbs]);

  const handleChangeParticipantTokenImage = useCallback((participantId: string, newImageUrl: string) => {
    bbs.setParticipants(prevParticipants => {
        const participant = prevParticipants.find(p => p.id === participantId);
        if (!participant) return prevParticipants;
        if (participant.tokenId) {
            bbs.setTokens(prevTokens => prevTokens.map(token => token.id === participant.tokenId ? { ...token, customImageUrl: newImageUrl, icon: undefined, label: token.label || 'Custom' } : token));
        } else {
            const availableSquare = bbs.findAvailableSquare(Math.floor(bbs.GRID_COLS / 2), Math.floor(bbs.GRID_ROWS / 2), 1, bbs.tokens, bbs.GRID_COLS, bbs.GRID_ROWS);
            if (!availableSquare) { setTimeout(() => toast({ title: "Cannot Add Token", description: "No available square on grid to place a new token.", variant: "destructive" }), 0); return prevParticipants; }
            const newToken: Token = { id: `token-${Date.now()}`, x: availableSquare.x, y: availableSquare.y, customImageUrl: newImageUrl, type: 'generic', label: 'Custom', instanceName: participant.name, size: 1, color: 'hsl(var(--muted))' };
            bbs.setTokens(prevTokens => [...prevTokens, newToken]);
            return prevParticipants.map(p => p.id === participantId ? { ...p, tokenId: newToken.id, customImageUrl: newImageUrl } : p);
        }
        return prevParticipants.map(p => p.id === participantId ? {...p, customImageUrl: newImageUrl} : p);
    });
  }, [bbs, toast]);

  const handleFocusToken = useCallback((tokenId: string) => {
    bbs.setSelectedTokenIds([tokenId]);
    bbs.setSelectedShapeIds([]);
    bbs.setSelectedTextObjectIds([]);
    setTokenIdToFocus(tokenId);
  }, [bbs]);

  const handleMoveParticipant = useCallback((participantId: string, direction: 'up' | 'down') => {
    bbs.setParticipants(prevParticipants => {
      const currentIndex = prevParticipants.findIndex(p => p.id === participantId);
      if (currentIndex === -1) return prevParticipants;
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prevParticipants.length) return prevParticipants;

      const newParticipants = [...prevParticipants];
      const [participantToMove] = newParticipants.splice(currentIndex, 1);
      newParticipants.splice(targetIndex, 0, participantToMove);

      if (bbs.isCombatActive) {
        const activeId = prevParticipants[bbs.currentParticipantIndex]?.id;
        if (activeId) {
            bbs.setCurrentParticipantIndex(newParticipants.findIndex(p => p.id === activeId));
        }
      }
      return newParticipants;
    });
  }, [bbs]);

  const handleAddParticipantToList = useCallback((participantData: Omit<Participant, 'id' | 'tokenId'>, explicitTokenId?: string, avatarUrl?: string | null) => {
    const participantNameInput = participantData.name.trim();
    let finalTokenId: string | undefined = explicitTokenId !== "none" ? explicitTokenId : undefined;
    let tokenSize = 1;

    if (finalTokenId) {
      const t = bbs.tokens.find(tk => tk.id === finalTokenId);
      if (t) tokenSize = t.size || 1;
    } else if (bbs.selectedTokenTemplate) {
      tokenSize = bbs.selectedTokenTemplate.size || 1;
    }

    if (!finalTokenId) {
      const availableSquare = bbs.findAvailableSquare(Math.floor(bbs.GRID_COLS / 2), Math.floor(bbs.GRID_ROWS / 2), tokenSize, bbs.tokens, bbs.GRID_COLS, bbs.GRID_ROWS);
      if (!availableSquare) {
        setTimeout(() => toast({ title: "Cannot Add Token", description: "No available square on grid.", variant: "destructive" }), 0);
        return false;
      }
      const template = tokenTemplates.find(t => t.type === participantData.type);
      const newToken: Token = {
        id: `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        x: availableSquare.x, y: availableSquare.y,
        customImageUrl: avatarUrl || undefined,
        icon: avatarUrl ? undefined : template?.icon,
        color: avatarUrl ? 'hsl(var(--muted))' : (template?.color || 'hsl(var(--accent))'),
        type: participantData.type,
        label: avatarUrl ? 'Custom Avatar' : (template?.name || 'Generic'),
        instanceName: participantNameInput, size: tokenSize
      };
      bbs.setTokens(prev => [...prev, newToken]);
      finalTokenId = newToken.id;
    }

    const newParticipant: Participant = { ...participantData, id: `participant-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, name: participantNameInput, tokenId: finalTokenId, customImageUrl: avatarUrl || undefined };

    bbs.setParticipants(prev => {
      const newListUnsorted = [...prev, newParticipant];
      const newListSorted = newListUnsorted.sort((a, b) => b.initiative - a.initiative);

      if (bbs.isCombatActive) {
          const previouslyActiveParticipantId = prev[bbs.currentParticipantIndex]?.id;
          if (previouslyActiveParticipantId) {
              const previousActiveNewIdx = newListSorted.findIndex(p => p.id === previouslyActiveParticipantId);
              bbs.setCurrentParticipantIndex(previousActiveNewIdx !== -1 ? previousActiveNewIdx : 0);
          } else if (newListSorted.length > 0) {
              bbs.setCurrentParticipantIndex(0);
          } else {
              bbs.setCurrentParticipantIndex(-1);
          }
      } else if (newListSorted.length > 0) {
        bbs.setCurrentParticipantIndex(newListSorted.length === 1 ? 0 : (prev.length === 0 ? 0 : -1) );
      } else {
         bbs.setCurrentParticipantIndex(-1);
      }
      return newListSorted;
    });
    return true;
  }, [bbs, toast]);

  const handleAddCombatantFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const quantity = (selectedAssignedTokenId && selectedAssignedTokenId !== "none") ? 1 : (parseInt(newParticipantQuantity, 10) || 1);
    if (!newParticipantName.trim()) {
        setTimeout(() => toast({title: "Invalid Name", description: "Participant name cannot be empty.", variant:"destructive"}), 0);
        return;
    }
    const initiative = parseInt(newParticipantInitiative, 10);
    if (isNaN(initiative)) {
        setTimeout(() => toast({title: "Invalid Initiative", description: "Please enter a valid number for initiative.", variant:"destructive"}), 0);
        return;
    }

    for (let i = 0; i < quantity; i++) {
      const finalName = (quantity > 1 && (selectedAssignedTokenId === "none" || !selectedAssignedTokenId)) ? `${newParticipantName.trim()} ${i + 1}` : newParticipantName.trim();
      const hp = newParticipantHp.trim() === '' ? undefined : parseInt(newParticipantHp, 10);
      const ac = newParticipantAc.trim() === '' ? undefined : parseInt(newParticipantAc, 10);

      const success = handleAddParticipantToList({ name: finalName, initiative, type: newParticipantType, hp, ac }, selectedAssignedTokenId, croppedAvatarDataUrl);
      if (success && selectedAssignedTokenId && selectedAssignedTokenId !== "none") {
        const newTypeTemplate = tokenTemplates.find(t => t.type === newParticipantType);
        bbs.setTokens(prevTokens => prevTokens.map(t => t.id === selectedAssignedTokenId ? { ...t, instanceName: finalName, type: newParticipantType, color: croppedAvatarDataUrl ? t.color : (newTypeTemplate?.color || t.color), icon: croppedAvatarDataUrl ? undefined : (newTypeTemplate?.icon || t.icon), customImageUrl: croppedAvatarDataUrl || t.customImageUrl, label: croppedAvatarDataUrl ? 'Custom Avatar' : (newTypeTemplate?.name || t.label) } : t));
      }
      if (!success) break;
    }
    setNewParticipantName(''); setNewParticipantInitiative('10'); setNewParticipantHp('10'); setNewParticipantAc('10'); setNewParticipantQuantity('1'); setNewParticipantType('player'); setSelectedAssignedTokenId("none"); setCroppedAvatarDataUrl(null);
    setIsEditingInitiative(false); setIsEditingHp(false); setIsEditingAc(false); setIsEditingQuantity(false);
    setAddParticipantDialogOpen(false);
  }, [newParticipantName, newParticipantInitiative, newParticipantHp, newParticipantAc, newParticipantQuantity, newParticipantType, selectedAssignedTokenId, croppedAvatarDataUrl, handleAddParticipantToList, bbs, toast]);

  const handleAddParticipantDialogClose = useCallback((open: boolean) => {
    setAddParticipantDialogOpen(open);
    if (!open) {
      setNewParticipantName('');
      setNewParticipantInitiative('10');
      setNewParticipantHp('10');
      setNewParticipantAc('10');
      setNewParticipantQuantity('1');
      setNewParticipantType('player');
      setSelectedAssignedTokenId("none");
      setCroppedAvatarDataUrl(null);
      setUncroppedAvatarImageSrc(null);
      setIsEditingInitiative(false);
      setIsEditingHp(false);
      setIsEditingAc(false);
      setIsEditingQuantity(false);
    }
  }, []);

  const handleOpenAddCombatantDialogForToken = useCallback((token: Token) => {
    setNewParticipantName(token.instanceName || token.label || 'Unnamed Token');
    if (['player', 'enemy', 'ally'].includes(token.type)) setNewParticipantType(token.type as 'player' | 'enemy' | 'ally'); else setNewParticipantType('player');
    setSelectedAssignedTokenId(token.id); setCroppedAvatarDataUrl(token.customImageUrl || null);
    setNewParticipantInitiative('10'); setNewParticipantHp('10'); setNewParticipantAc('10'); setNewParticipantQuantity('1');
    setIsEditingInitiative(false); setIsEditingHp(false); setIsEditingAc(false); setIsEditingQuantity(false);
    setAddParticipantDialogOpen(true);
  }, []);

  const handleOpenEditStatsDialog = (participant: Participant) => {
    setParticipantToEditStats(participant);
    setIsEditStatsDialogOpen(true);
  };

  const handleOpenEditStatsDialogFromToken = (tokenId: string) => {
    const p = bbs.participants.find(pt => pt.tokenId === tokenId);
    if (p) handleOpenEditStatsDialog(p);
    else setTimeout(() => toast({ title: "No Participant Linked", description: "This token is not linked to an entry in the turn order.", variant: "destructive" }), 0);
  };

  const handleSaveStats = useCallback(() => {
    if (!participantToEditStats) return;
    const initiative = parseInt(dialogInitiative, 10);
    const hp = dialogHp.trim() === '' ? undefined : parseInt(dialogHp, 10);
    const ac = dialogAc.trim() === '' ? undefined : parseInt(dialogAc, 10);

    if (isNaN(initiative)) {
        setTimeout(() => toast({title: "Invalid Initiative", description: "Please enter a valid number for initiative.", variant:"destructive"}), 0);
        return;
    }
    if (dialogHp.trim() !== '' && isNaN(hp as number)) {
        setTimeout(() => toast({title: "Invalid HP", description: "Please enter a valid number for HP or leave it blank.", variant:"destructive"}), 0);
        return;
    }
    if (dialogAc.trim() !== '' && isNaN(ac as number)) {
        setTimeout(() => toast({title: "Invalid AC", description: "Please enter a valid number for AC or leave it blank.", variant:"destructive"}), 0);
        return;
    }

    handleUpdateParticipantStats(participantToEditStats.id, { initiative, hp, ac });
    setIsEditStatsDialogOpen(false); setParticipantToEditStats(null);
  }, [participantToEditStats, dialogInitiative, dialogHp, dialogAc, handleUpdateParticipantStats, toast]);


  const handleAvatarImageUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) {
            setTimeout(() => toast({ title: "Upload Error", description: "Avatar image file size exceeds 2MB limit.", variant: "destructive" }), 0);
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => { setUncroppedAvatarImageSrc(reader.result as string); setIsAvatarCropDialogOpen(true); };
        reader.readAsDataURL(file);
        if(event.target) event.target.value = '';
    }
  };
  const handleAvatarCropConfirm = (croppedDataUrl: string) => { setCroppedAvatarDataUrl(croppedDataUrl); setIsAvatarCropDialogOpen(false); setUncroppedAvatarImageSrc(null); };
  const handleAvatarCropCancel = () => { setIsAvatarCropDialogOpen(false); setUncroppedAvatarImageSrc(null); };

  const handleStartCombat = () => {
    if (bbs.participants.length === 0) { setTimeout(() => toast({ title: 'Cannot Start Combat', description: 'Add participants to the turn order first.', variant: 'destructive' }), 0); return; }
    bbs.setIsCombatActive(true); bbs.setRoundCounter(1); bbs.setCurrentParticipantIndex(bbs.participants.length > 0 ? 0 : -1);
  };
  const handleEndCombat = () => { bbs.setIsCombatActive(false); bbs.setRoundCounter(1); };
  const handleAdvanceTurn = () => {
    if (!bbs.isCombatActive || bbs.participants.length === 0) return;
    let nextIndex = bbs.currentParticipantIndex + 1;
    if (nextIndex >= bbs.participants.length) { nextIndex = 0; bbs.setRoundCounter(r => r + 1); }
    bbs.setCurrentParticipantIndex(nextIndex);
  };

  const renderNumericInput = (
    value: string, setValue: Dispatch<SetStateAction<string>>, isEditing: boolean, setIsEditing: Dispatch<SetStateAction<boolean>>,
    label: string, idPrefix: string, optional: boolean = false, disabled: boolean = false
  ) => (
    <div className={cn("flex-1 min-w-0 space-y-1 border border-border rounded-md p-3", disabled && "opacity-50")}>
      <Label htmlFor={disabled ? undefined : `${idPrefix}-input`}>{label}</Label>
      {isEditing && !disabled ? (
        <Input id={`${idPrefix}-input`} type="number" value={value} onChange={(e) => setValue(e.target.value)}
          onBlur={() => { if(value.trim() === '' && !optional) setValue('0'); setIsEditing(false); }} autoFocus className="w-full text-center" disabled={disabled} />
      ) : (
        <div className="flex items-center gap-1 mt-1">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => !disabled && setValue(String(Math.max((optional && value === '' ? -1 : (parseInt(value,10)||0))-1, (optional ? -Infinity : 0) )))} disabled={disabled}><Minus className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" id={`${idPrefix}-display`} onClick={() => !disabled && setIsEditing(true)} className="h-8 px-2 text-base w-full justify-center" disabled={disabled}>{value || (optional?'N/A':'0')}</Button>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => !disabled && setValue(String((parseInt(value,10)||0)+1))} disabled={disabled}><Plus className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );

  const unassignedTokensForDialog = useMemo(() => bbs.tokens.filter(token => ['player', 'enemy', 'ally', 'generic'].includes(token.type) && !bbs.participants.some(p => p.tokenId === token.id)), [bbs.tokens, bbs.participants]);

  const unassignedTokensForAutoRoll = useMemo(() => bbs.tokens.filter(token => ['player', 'enemy', 'ally'].includes(token.type) && !bbs.participants.some(p => p.tokenId === token.id)), [bbs.tokens, bbs.participants]);

  const handleAutoRollInitiative = useCallback(() => {
    const unassigned = unassignedTokensForAutoRoll;
    if (unassigned.length === 0) {
      setTimeout(() => toast({ title: "No Tokens to Roll For", description: "All suitable tokens are already in the turn order.", variant: "default" }), 0);
      return;
    }
    let participantsAddedCount = 0;
    unassigned.forEach(token => {
      const initiativeRoll = Math.floor(Math.random() * 20) + 1;
      const name = token.instanceName || token.label || `Token ${token.id.substring(0,4)}`;
      const type = token.type as 'player' | 'enemy' | 'ally';
      const success = handleAddParticipantToList({ name, initiative: initiativeRoll, type, hp: undefined, ac: undefined }, token.id, token.customImageUrl || null);
      if (success) participantsAddedCount++;
    });

    if (participantsAddedCount > 0) {
      setTimeout(() => toast({ title: "Initiative Rolled", description: `Added ${participantsAddedCount} token(s) to the turn order with random initiative.` }), 0);
    } else {
      setTimeout(() => toast({ title: "Auto-Roll Failed", description: "Could not add any tokens to the turn order. Check grid space.", variant: "destructive" }), 0);
    }
  }, [bbs, toast, handleAddParticipantToList, unassignedTokensForAutoRoll]);

  const participantTypeButtonConfig: Record<'player' | 'enemy' | 'ally', {label: string; icon: React.ElementType; selectedClass: string; unselectedHoverClass: string;}> = {
    player: {label:'Player', icon:PlayerIcon, selectedClass:'bg-[hsl(var(--player-green-bg))] text-[hsl(var(--player-green-foreground))] hover:bg-[hsl(var(--player-green-hover-bg))]', unselectedHoverClass:'hover:bg-[hsl(var(--player-green-bg))] hover:text-[hsl(var(--player-green-foreground))]'},
    enemy: {label:'Enemy', icon:EnemyIcon, selectedClass:'bg-destructive text-destructive-foreground hover:bg-destructive/90', unselectedHoverClass:'hover:bg-destructive hover:text-destructive-foreground'},
    ally: {label:'Ally', icon:AllyIcon, selectedClass:'bg-[hsl(var(--app-blue-bg))] text-[hsl(var(--app-blue-foreground))] hover:bg-[hsl(var(--app-blue-hover-bg))]', unselectedHoverClass:'hover:bg-[hsl(var(--app-blue-bg))] hover:text-[hsl(var(--app-blue-foreground))]'}
  };

  return (
    <div className="flex h-screen bg-background">
      {typeof window !== 'undefined' && <WelcomeDialog isOpen={showWelcomeDialog} onClose={handleCloseWelcomeDialog} />}

      <Dialog open={addParticipantDialogOpen} onOpenChange={handleAddParticipantDialogClose}>
        <DialogContent className="sm:max-w-2xl">
            <FormDialogHeader>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" className="w-16 h-16 rounded-full p-0 relative overflow-hidden border-2 border-dashed" onClick={() => avatarFileInputRef.current?.click()}>
                    {croppedAvatarDataUrl ? <img src={croppedAvatarDataUrl} alt="Avatar" className="w-full h-full object-cover" /> : <Camera className="w-7 h-7 text-muted-foreground" />}
                </Button>
                <Input ref={avatarFileInputRef} type="file" accept="image/*" onChange={handleAvatarImageUploadChange} className="hidden" />
                <div className="flex-grow">
                    <DialogTitle>Add New Combatant</DialogTitle>
                    <DialogDescription>Enter the combatant's details below. An avatar can be uploaded, or a token selected.</DialogDescription>
                </div>
              </div>
            </FormDialogHeader>
            <form onSubmit={handleAddCombatantFormSubmit} className="space-y-4 pt-4">
             <div className="space-y-1">
                <Label>Type</Label>
                <div className="flex space-x-2">
                    {(Object.keys(participantTypeButtonConfig) as Array<keyof typeof participantTypeButtonConfig>).map(type => {
                      const config = participantTypeButtonConfig[type];
                      const IconComponent = config.icon;
                      return (
                        <Button key={type} type="button" variant={newParticipantType === type ? undefined : 'outline'} onClick={() => setNewParticipantType(type)} className={cn("flex-1", newParticipantType === type ? config.selectedClass : config.unselectedHoverClass)}>
                          <IconComponent className="h-4 w-4 mr-2"/>
                          {config.label}
                        </Button>
                      );
                    })}
                </div>
             </div>
             <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1"><Label htmlFor="p-name">Name</Label><Input id="p-name" value={newParticipantName} onChange={e=>setNewParticipantName(e.target.value)} required/></div>
                <div className="flex-1 space-y-1"><Label htmlFor="assign-token">Assign Token (Optional)</Label>
                    <Select value={selectedAssignedTokenId} onValueChange={v=>{setSelectedAssignedTokenId(v); if(v!=="none"){setNewParticipantQuantity('1'); const t=bbs.tokens.find(tk=>tk.id===v); if(t){setCroppedAvatarDataUrl(t.customImageUrl||null); if(['player','enemy','ally'].includes(t.type)) setNewParticipantType(t.type as any);}} else {setCroppedAvatarDataUrl(null);}}}>
                        <SelectTrigger><SelectValue placeholder="Select existing token or create new" /></SelectTrigger>
                        <SelectContent><SelectItem value="none">None (New Token)</SelectItem>{unassignedTokensForDialog.map(t=>(<SelectItem key={t.id} value={t.id}>{t.instanceName||t.label} ({t.type})</SelectItem>))}</SelectContent>
                    </Select>
                </div>
             </div>
             <div className="flex flex-col sm:flex-row gap-3">
                {renderNumericInput(newParticipantInitiative, setNewParticipantInitiative, isEditingInitiative, setIsEditingInitiative, "Initiative", "p-ini", false, false)}
                {renderNumericInput(newParticipantHp, setNewParticipantHp, isEditingHp, setIsEditingHp, "Health", "p-hp", true, false)}
                {renderNumericInput(newParticipantAc, setNewParticipantAc, isEditingAc, setIsEditingAc, "Armor", "p-ac", true, false)}
                {renderNumericInput(newParticipantQuantity, setNewParticipantQuantity, isEditingQuantity, setIsEditingQuantity, "Quantity", "p-qty", false, selectedAssignedTokenId !== "none")}
             </div>
             <FormDialogFooter><Button type="submit" className="w-full">Add to Turn Order</Button></FormDialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {participantToEditStats && (
        <Dialog open={isEditStatsDialogOpen} onOpenChange={(open) => {setIsEditStatsDialogOpen(open); if(!open)setParticipantToEditStats(null);}}>
          <DialogContent className="sm:max-w-md">
            <FormDialogHeader><DialogTitle>Edit Stats for {participantToEditStats.name}</DialogTitle></FormDialogHeader>
            <div className="py-4 space-y-4">
              {renderNumericInput(dialogInitiative, setDialogInitiative, isEditingDialogIni, setIsEditingDialogIni, "Initiative", "edit-ini", false)}
              {renderNumericInput(dialogHp, setDialogHp, isEditingDialogHpVal, setIsEditingDialogHpVal, "Health", "edit-hp", true)}
              {renderNumericInput(dialogAc, setDialogAc, isEditingDialogAcVal, setIsEditingDialogAcVal, "Armor", "edit-ac", true)}
            </div>
            <FormDialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsEditStatsDialogOpen(false); setParticipantToEditStats(null); }}>Cancel</Button>
                <Button type="button" onClick={handleSaveStats}>Save Stats</Button>
            </FormDialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {uncroppedTokenImageSrc && tokenToChangeImage && (
        <ImageCropDialog isOpen={isTokenCropDialogOpen} onOpenChange={setIsTokenCropDialogOpen} imageSrc={uncroppedTokenImageSrc}
          onCropConfirm={(url) => { if(tokenToChangeImage) bbs.setTokens(p=>p.map(t=>t.id===tokenToChangeImage ? {...t, customImageUrl:url, icon:undefined} : t)); setIsTokenCropDialogOpen(false); setUncroppedTokenImageSrc(null); setTokenToChangeImage(null); setTimeout(() => toast({title:"Token Image Updated"}), 0); }}
          onCropCancel={() => { setIsTokenCropDialogOpen(false); setUncroppedTokenImageSrc(null); setTokenToChangeImage(null); }}/>
      )}
      {uncroppedAvatarImageSrc && ( <ImageCropDialog isOpen={isAvatarCropDialogOpen} onOpenChange={setIsAvatarCropDialogOpen} imageSrc={uncroppedAvatarImageSrc} onCropConfirm={handleAvatarCropConfirm} onCropCancel={handleAvatarCropCancel}/> )}

      <SideToolbar
        activeTool={bbs.activeTool} setActiveTool={bbs.setActiveTool}
        selectedColor={bbs.selectedColor} setSelectedColor={bbs.setSelectedColor}
        selectedTokenTemplate={bbs.selectedTokenTemplate} setSelectedTokenTemplate={bbs.setSelectedTokenTemplate}
        selectedShapeDrawColor={bbs.selectedShapeDrawColor} setSelectedShapeDrawColor={bbs.setSelectedShapeDrawColor}
        backgroundImageUrl={bbs.backgroundImageUrl} setBackgroundImageUrl={bbs.setBackgroundImageUrl}
        showGridLines={bbs.showGridLines} setShowGridLines={bbs.setShowGridLines}
        showAllLabels={bbs.showAllLabels} setShowAllLabels={bbs.setShowAllLabels}
        measurement={bbs.measurement} setMeasurement={bbs.setMeasurement}
        backgroundZoomLevel={bbs.backgroundZoomLevel} setBackgroundZoomLevel={bbs.setBackgroundZoomLevel}
        onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
        onResetBoard={handleResetBoard}
        defaultBattlemaps={defaultBattlemaps}
        escapePressCount={escapePressCount}
      />
      <div className="flex-1 relative overflow-hidden"> {/* Grid container taking remaining space */}
          <BattleGrid
            gridCells={bbs.gridCells} setGridCells={bbs.setGridCells}
            tokens={bbs.tokens} setTokens={bbs.setTokens}
            drawnShapes={bbs.drawnShapes} setDrawnShapes={bbs.setDrawnShapes}
            currentDrawingShape={null} setCurrentDrawingShape={() => {}} // Placeholder, drawing state is in useGridInteractions
            textObjects={bbs.textObjects} setTextObjects={bbs.setTextObjects}
            showGridLines={bbs.showGridLines} setShowGridLines={bbs.setShowGridLines}
            showAllLabels={bbs.showAllLabels} setShowAllLabels={bbs.setShowAllLabels}
            backgroundImageUrl={bbs.backgroundImageUrl} backgroundZoomLevel={bbs.backgroundZoomLevel}
            activeTool={bbs.activeTool} setActiveTool={bbs.setActiveTool}
            selectedColor={bbs.selectedColor} selectedTokenTemplate={bbs.selectedTokenTemplate}
            selectedShapeDrawColor={bbs.selectedShapeDrawColor} // Pass down selected shape draw color
            onTokenMove={handleTokenMove} onTokenInstanceNameChange={handleTokenInstanceNameChange}
            onChangeTokenSize={handleTokenSizeChange}
            onSetShapeColor={handleSetShapeColor} // Pass down shape color setter
            measurement={bbs.measurement} setMeasurement={bbs.setMeasurement}
            activeTurnTokenId={bbs.participants[bbs.currentParticipantIndex]?.tokenId || null}
            currentTextFontSize={bbs.currentTextFontSize}
            onTokenDelete={handleTokenDelete} onTokenErasedOnGrid={handleTokenErasedOnGrid}
            onTokenImageChangeRequest={handleRequestTokenImageChange}
            selectedTokenIds={bbs.selectedTokenIds} setSelectedTokenIds={bbs.setSelectedTokenIds}
            selectedShapeIds={bbs.selectedShapeIds} setSelectedShapeIds={bbs.setSelectedShapeIds}
            selectedTextObjectIds={bbs.selectedTextObjectIds} setSelectedTextObjectIds={bbs.setSelectedTextObjectIds}
            tokenIdToFocus={tokenIdToFocus} onFocusHandled={() => setTokenIdToFocus(null)}
            onOpenAddCombatantDialogForToken={handleOpenAddCombatantDialogForToken}
            onOpenEditStatsDialogForToken={handleOpenEditStatsDialogFromToken}
            participants={bbs.participants}
            toast={toast}
          />
      </div>

      <SidebarProvider defaultOpen={true}>
        <Sidebar variant="sidebar" collapsible="icon" side="right">
          <SidebarHeader className="p-3 border-b border-input">
            <div className="text-lg flex justify-between items-center text-sidebar-foreground">
              <span className="font-semibold">Turn Order</span>
              <span className="text-sm font-normal text-muted-foreground">Round: {bbs.roundCounter}</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="flex flex-col flex-grow p-0">
            <div className="flex-grow overflow-auto p-3">
                <InitiativeTrackerPanel
                  participantsProp={bbs.participants} tokens={bbs.tokens} currentParticipantIndex={bbs.currentParticipantIndex}
                  onRemoveParticipant={handleRemoveParticipant} onRenameParticipant={handleRenameParticipant}
                  onChangeParticipantTokenImage={handleChangeParticipantTokenImage}
                  onFocusToken={handleFocusToken}
                  onMoveParticipantUp={(id) => handleMoveParticipant(id, 'up')}
                  onMoveParticipantDown={(id) => handleMoveParticipant(id, 'down')}
                  onOpenEditStatsDialogForParticipant={handleOpenEditStatsDialog}
                />
            </div>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:hidden p-3">
            {!bbs.isCombatActive ? (
              <div className="flex flex-col gap-2">
                 <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => setAddParticipantDialogOpen(true)}>Add Combatant</Button>
                    <Button onClick={handleAutoRollInitiative} className="flex-1" variant="outline" disabled={unassignedTokensForAutoRoll.length === 0}><Shuffle className="mr-2 h-4 w-4" /> Auto Roll</Button>
                 </div>
                 <Button onClick={handleStartCombat} className="w-full" disabled={bbs.participants.length === 0}><Play className="mr-2 h-4 w-4" /> Start Combat</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleAdvanceTurn} className="flex-1 bg-[hsl(var(--app-blue-bg))] hover:bg-[hsl(var(--app-blue-hover-bg))] text-[hsl(var(--app-blue-foreground))]">Next Turn <ArrowRight className="ml-2 h-4 w-4" /></Button>
                <Button onClick={handleEndCombat} variant="destructive" className="flex-1">End Combat</Button>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>

    </div>
  );
}
