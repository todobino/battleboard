
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GridCellData, Token, Participant, ActiveTool, Measurement, DrawnShape, TextObjectType, UndoableState } from '@/types';
import BattleGrid from '@/components/battle-grid/battle-grid';
import FloatingToolbar from '@/components/floating-toolbar';
import InitiativeTrackerPanel from '@/components/controls/initiative-tracker-panel';
import { SidebarProvider, Sidebar, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LandPlot, Play, SkipForward, Square, PlusCircle, Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import { tokenTemplates } from '@/config/token-templates'; 

const GRID_ROWS = 40;
const GRID_COLS = 40;
const DEFAULT_TEXT_FONT_SIZE = 16;
const MAX_HISTORY_LENGTH = 30;


const initialGridCells = (): GridCellData[][] =>
  Array.from({ length: GRID_ROWS }, (_, y) =>
    Array.from({ length: GRID_COLS }, (_, x) => ({
      id: `${y}-${x}`,
      color: undefined,
    }))
  );

export default function BattleBoardPage() {
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
  const [newParticipantType, setNewParticipantType] = useState<'player' | 'enemy' | 'ally'>('player');

  const { toast } = useToast();

  // Undo/Redo State
  const [history, setHistory] = useState<UndoableState[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);
  const isUndoRedoOperation = useRef<boolean>(false);

  // Helper to get current undoable state (with deep copies)
  const getCurrentUndoableState = useCallback((): UndoableState => {
    // WARNING: JSON.stringify will strip function components (like Lucide icons in tokens)
    // Custom image URLs in tokens will be preserved.
    return JSON.parse(JSON.stringify({
      gridCells,
      tokens,
      drawnShapes,
      textObjects,
      participants,
    }));
  }, [gridCells, tokens, drawnShapes, textObjects, participants]);
  
  // Initialize history with the very first state
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
  }, []); // Run only once on mount

  // Effect to record history when relevant states change
  useEffect(() => {
    if (isUndoRedoOperation.current) {
      isUndoRedoOperation.current = false; // Reset flag for next user action
      return; // Don't record if change was due to undo/redo
    }

    if (historyPointer === -1) return; // History not initialized yet

    const newSnapshot = getCurrentUndoableState();
    
    // Avoid re-adding if the state is identical to the current one in history
    // This is a shallow check for now; a deep check could be added but is more complex
    if (history[historyPointer] && JSON.stringify(newSnapshot) === JSON.stringify(history[historyPointer])) {
        return;
    }

    const newHistoryBase = history.slice(0, historyPointer + 1); // Truncate "redo" states
    const updatedHistory = [...newHistoryBase, newSnapshot].slice(-MAX_HISTORY_LENGTH);
    
    setHistory(updatedHistory);
    setHistoryPointer(updatedHistory.length - 1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridCells, tokens, drawnShapes, textObjects, participants]); // Dependencies are the core states

  const restoreStateFromSnapshot = (snapshot: UndoableState) => {
    setGridCells(snapshot.gridCells);
    // Re-construct tokens to attempt to re-assign icons if they were stripped by JSON.stringify
    setTokens(snapshot.tokens.map(tokenFromFile => {
        const template = tokenTemplates.find(t => t.type === tokenFromFile.type);
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
      toast({ title: "Nothing to undo" });
      return;
    }
    isUndoRedoOperation.current = true;
    const newPointer = historyPointer - 1;
    restoreStateFromSnapshot(history[newPointer]);
    setHistoryPointer(newPointer);
    toast({ title: "Action Undone" });
  }, [history, historyPointer, toast]);

  const handleRedo = useCallback(() => {
    if (historyPointer >= history.length - 1 || historyPointer < 0) {
      toast({ title: "Nothing to redo" });
      return;
    }
    isUndoRedoOperation.current = true;
    const newPointer = historyPointer + 1;
    restoreStateFromSnapshot(history[newPointer]);
    setHistoryPointer(newPointer);
    toast({ title: "Action Redone" });
  }, [history, historyPointer, toast]);

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
  }, [handleUndo, handleRedo]);


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

  const handleStartCombat = () => {
    setIsCombatActive(true);
    setRoundCounter(1);
    if (participants.length > 0) {
      setCurrentParticipantIndex(0);
      toast({ title: "Combat Started!", description: `Round 1. ${participants[0]?.name}'s turn.`});
    } else {
      setCurrentParticipantIndex(-1);
      toast({ title: "Combat Started!", description: "Round 1. Add participants to the turn order."});
    }
  };

  const handleEndCombat = () => {
    setIsCombatActive(false);
    setRoundCounter(1);
    toast({ title: "Combat Ended."});
  };

  const handleAdvanceTurn = () => {
    if (!isCombatActive || participants.length === 0) {
      toast({ title: "Cannot Advance Turn", description: "No participants in combat or combat not started."});
      return;
    }
    let nextIndex = currentParticipantIndex + 1;
    let currentRound = roundCounter;
    if (nextIndex >= participants.length) {
      nextIndex = 0;
      currentRound = roundCounter + 1;
      setRoundCounter(currentRound);
      toast({ title: `Round ${currentRound} Starting!` });
    }
    setCurrentParticipantIndex(nextIndex);
    if (participants[nextIndex]) {
       toast({ title: "Next Turn", description: `${participants[nextIndex].name}'s turn.`});
    }
  };

  const handleAddParticipantToList = (participantData: Omit<Participant, 'id' | 'tokenId'> & { tokenId?: string}) => {
    const participantName = participantData.name.trim();
    const template = tokenTemplates.find(t => t.type === participantData.type);

    let newToken: Token | undefined = undefined;
    if (template) {
      const middleX = Math.floor(GRID_COLS / 2);
      const middleY = Math.floor(GRID_ROWS / 2);
      newToken = {
        id: `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        x: middleX, 
        y: middleY,
        color: template.color,
        icon: template.icon,
        type: template.type,
        label: template.name,
        instanceName: participantName, 
        size: 1,
      };
      setTokens(prev => [...prev, newToken!]);
    }

    const newParticipant: Participant = {
      ...participantData,
      id: `participant-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: participantName,
      tokenId: newToken?.id,
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
    toast({ title: "Participant Added", description: `${newParticipant.name} added to turn order. ${newToken ? `Their token has been placed at (${newToken.x},${newToken.y}).` : ''}` });
  };

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

    if (participantToRemove?.tokenId) {
      setTokens(prevTokens => prevTokens.filter(t => t.id !== participantToRemove.tokenId));
      toast({ title: "Participant Removed", description: `${participantToRemove.name} removed from turn order and grid.` });
    } else {
      toast({ title: "Participant Removed", description: `${participantToRemove?.name || 'Participant'} removed from turn order.` });
    }
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
    if (!newParticipantName.trim() || !newParticipantInitiative.trim()) {
      toast({ title: "Error", description: "Name and initiative are required.", variant: "destructive" });
      return;
    }
    const initiativeValue = parseInt(newParticipantInitiative, 10);
    if (isNaN(initiativeValue)) {
      toast({ title: "Error", description: "Initiative must be a number.", variant: "destructive" });
      return;
    }
    const hpString = newParticipantHp.trim();
    const acString = newParticipantAc.trim();
    const hpValue = hpString === '' ? undefined : parseInt(hpString, 10);
    const acValue = acString === '' ? undefined : parseInt(acString, 10);
    if (hpString !== '' && (isNaN(hpValue as number) || (hpValue as number) < 0) ) {
      toast({ title: "Error", description: "Health Points must be a non-negative number or empty.", variant: "destructive" });
      return;
    }
    if (acString !== '' && (isNaN(acValue as number) || (acValue as number) < 0) ) {
      toast({ title: "Error", description: "Armor Class must be a non-negative number or empty.", variant: "destructive" });
      return;
    }

    const newParticipantData: Omit<Participant, 'id' | 'tokenId'> = {
      name: newParticipantName.trim(),
      initiative: initiativeValue,
      type: newParticipantType,
      hp: hpValue,
      ac: acValue,
    };
    handleAddParticipantToList(newParticipantData);
    setNewParticipantName('');
    setNewParticipantInitiative('10'); 
    setIsEditingInitiative(false); 
    setNewParticipantHp('10');
    setIsEditingHp(false);
    setNewParticipantAc('10');
    setIsEditingAc(false);
    setNewParticipantType('player'); 
    setDialogOpen(false);
  };
  
  const renderNumericInput = (
    value: string,
    setValue: Dispatch<SetStateAction<string>>,
    isEditing: boolean,
    setIsEditing: Dispatch<SetStateAction<boolean>>,
    label: string,
    idPrefix: string,
    optional: boolean = false
  ) => (
    <div className="flex-1 space-y-1">
      <Label htmlFor={`${idPrefix}-display`}>{label}</Label>
      {isEditing ? (
        <Input
          id={`${idPrefix}-input`} type="number" value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            if (optional && value.trim() === '') { /* Keep empty if optional */ } 
            else {
              const num = parseInt(value, 10);
              if (isNaN(num) || (!optional && num < 0) || (optional && num <0 && value.trim() !== '')) setValue('10');
              else if (optional && num < 0 && value.trim() !== '') setValue('0');
            }
            setIsEditing(false);
          }}
          autoFocus className="w-full text-center"
        />
      ) : (
        <div className="flex items-center gap-1 mt-1">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0"
            onClick={() => { const cv = parseInt(value,10) || (optional && value === '' ? 0 : 0); setValue(String(Math.max((optional?-Infinity:0), cv - 1))); }}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" id={`${idPrefix}-display`} onClick={() => setIsEditing(true)} className="h-8 px-2 text-base w-full justify-center" >
            {value || (optional ? 'N/A' : '10')}
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0"
            onClick={() => { const cv = parseInt(value,10) || (optional && value === '' ? 0 : 0); setValue(String(cv + 1)); }}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  const activeParticipant = participants[currentParticipantIndex];
  const activeTokenId = activeParticipant?.tokenId || null;

  return (
    <div className="flex h-screen">
      <div className="flex-1 relative">
          <BattleGrid
            gridCells={gridCells} setGridCells={setGridCells}
            tokens={tokens} setTokens={setTokens}
            drawnShapes={drawnShapes} setDrawnShapes={setDrawnShapes}
            currentDrawingShape={currentDrawingShape} setCurrentDrawingShape={setCurrentDrawingShape}
            textObjects={textObjects} setTextObjects={setTextObjects}
            showGridLines={showGridLines}
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
          />
      </div>

      <SidebarProvider defaultOpen={true}>
        <Sidebar variant="sidebar" collapsible="icon" side="right">
          <SidebarContent className="p-4 flex flex-col flex-grow"> {/* Ensure this allows InitiativeTrackerPanel to grow */}
            <InitiativeTrackerPanel
              participantsProp={participants}
              currentParticipantIndex={currentParticipantIndex}
              roundCounter={roundCounter}
              onRemoveParticipant={handleRemoveParticipantFromList}
            />
          </SidebarContent>
          
          <div className="p-2 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full"> <PlusCircle className="mr-2 h-4 w-4" /> Add Combatant </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Combatant</DialogTitle>
                  <DialogDescription> Enter the details for the new combatant. </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddCombatantFormSubmit} className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="participant-name-dialog">Name</Label>
                    <Input id="participant-name-dialog" value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} placeholder="e.g., Gorok the Barbarian" />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    {renderNumericInput(newParticipantInitiative, setNewParticipantInitiative, isEditingInitiative, setIsEditingInitiative, "Initiative*", "participant-initiative-dialog")}
                    {renderNumericInput(newParticipantHp, setNewParticipantHp, isEditingHp, setIsEditingHp, "Health Points", "participant-hp-dialog", true)}
                    {renderNumericInput(newParticipantAc, setNewParticipantAc, isEditingAc, setIsEditingAc, "Armor Class", "participant-ac-dialog", true)}
                  </div>
                  <div>
                    <Label>Type</Label>
                    <div className="flex space-x-2 mt-1">
                      {['player', 'enemy', 'ally'].map(type => (
                        <Button key={type} type="button" variant={newParticipantType === type ? 'default' : 'outline'} onClick={() => setNewParticipantType(type as 'player' | 'enemy' | 'ally')} className="flex-1" >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <FormDialogFooter> <Button type="submit"> Add to Turn Order </Button> </FormDialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <SidebarFooter className="p-2 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
            {!isCombatActive ? (
              <Button onClick={handleStartCombat} className="w-full bg-green-600 hover:bg-green-700 text-primary-foreground"> <Play className="mr-2 h-4 w-4" /> Start Combat </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleAdvanceTurn} className="flex-1 bg-blue-600 hover:bg-blue-700 text-primary-foreground"> <SkipForward className="mr-2 h-4 w-4" /> Next Turn </Button>
                <Button onClick={handleEndCombat} variant="destructive" className="flex-1"> <Square className="mr-2 h-4 w-4" /> End Combat </Button>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}
