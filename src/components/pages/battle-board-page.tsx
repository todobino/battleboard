
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { GridCellData, Token, Participant, ActiveTool, Measurement } from '@/types';
import BattleGrid from '@/components/battle-grid/battle-grid';
import FloatingToolbar from '@/components/floating-toolbar';
import InitiativeTrackerPanel from '@/components/controls/initiative-tracker-panel';
import { SidebarProvider, Sidebar, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LandPlot, Play, SkipForward, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


const GRID_ROWS = 30;
const GRID_COLS = 30;

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
  const [showGridLines, setShowGridLines] = useState<boolean>(true);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentParticipantIndex, setCurrentParticipantIndex] = useState<number>(-1);
  const [roundCounter, setRoundCounter] = useState<number>(1);
  const [isAutoAdvanceOn, setIsAutoAdvanceOn] = useState<boolean>(false);
  const [isCombatActive, setIsCombatActive] = useState<boolean>(false);

  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [selectedColor, setSelectedColor] = useState<string>('#FF0000');
  const [selectedTokenTemplate, setSelectedTokenTemplate] = useState<Omit<Token, 'id' | 'x' | 'y'> | null>(null);

  const [measurement, setMeasurement] = useState<Measurement>({type: null});

  const { toast } = useToast();

  useEffect(() => {
    if (activeTool === 'measure_distance' || activeTool === 'measure_radius') {
      setMeasurement({
        type: activeTool === 'measure_distance' ? 'distance' : 'radius',
        startPoint: undefined,
        endPoint: undefined,
        result: undefined
      });
    } else if (measurement.type !== null && activeTool !== 'measure_distance' && activeTool !== 'measure_radius') {
      // Clear measurement if switching away from a measurement tool
      setMeasurement({
        type: null,
        startPoint: undefined,
        endPoint: undefined,
        result: undefined
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]); // Only depend on activeTool

  useEffect(() => {
    if (participants.length === 0) {
      if (currentParticipantIndex !== -1) setCurrentParticipantIndex(-1);
    } else {
      // Ensure currentParticipantIndex is valid
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
    toast({ title: "Token Moved", description: `Token updated to position (${newX}, ${newY}).` });
  }, [toast]);

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
    setRoundCounter(1); // Reset round counter
    setCurrentParticipantIndex(-1); // No active participant
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

  const handleAddParticipantToList = (participantData: Omit<Participant, 'id'>) => {
    const newParticipant: Participant = {
      ...participantData,
      id: `participant-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };

    setParticipants(prev => {
      const newList = [...prev, newParticipant].sort((a, b) => b.initiative - a.initiative);
      // If combat is active, try to maintain the current turn focus if possible,
      // otherwise, if it's a new combatant, it will be sorted.
      // If combat is not active, and it's the first participant, set them as active.
      if (isCombatActive) {
        const oldActiveParticipantId = prev[currentParticipantIndex]?.id;
        let newActiveIndex = newList.findIndex(p => p.id === oldActiveParticipantId);
        if (newActiveIndex === -1 && newList.length > 0 && currentParticipantIndex >=0) {
          // If the old active participant is gone (shouldn't happen on add) or index was valid but now isn't
          // This logic might need refinement based on desired behavior when adding during combat
          newActiveIndex = (currentParticipantIndex < newList.length) ? currentParticipantIndex : 0;
        } else if (newActiveIndex === -1 && newList.length > 0){
          newActiveIndex = 0;
        }
        setCurrentParticipantIndex(newActiveIndex);
      } else {
        // If not in combat, or adding the first participant
        if (newList.length === 1 && currentParticipantIndex === -1) {
          setCurrentParticipantIndex(0);
        } else if (prev.length === 0 && newList.length > 0) {
           setCurrentParticipantIndex(0);
        }
        // Otherwise, currentParticipantIndex remains -1 or its current value until combat starts
      }
      return newList;
    });
    toast({ title: "Participant Added", description: `${newParticipant.name} added.` });
  };

  const handleRemoveParticipantFromList = (id: string) => {
    setParticipants(prev => {
      const participantToRemove = prev.find(p => p.id === id);
      if (!participantToRemove) return prev;

      const isRemovingCurrentTurn = prev[currentParticipantIndex]?.id === id;
      const filteredList = prev.filter(p => p.id !== id);

      if (filteredList.length === 0) {
        setCurrentParticipantIndex(-1);
      } else if (isRemovingCurrentTurn) {
        // If removing the current turn holder, advance to the "next" one (which could be the start of the list)
        // The index remains the same, but the participant at that index is now different.
        // Or, if it was the last, loop to 0.
        setCurrentParticipantIndex(currentParticipantIndex % filteredList.length);
      } else {
        // If removing someone else, find the ID of the current turn holder in the new list
        const oldActiveParticipantId = prev[currentParticipantIndex]?.id;
        const newActiveIndex = filteredList.findIndex(p => p.id === oldActiveParticipantId);
        if (newActiveIndex !== -1) {
          setCurrentParticipantIndex(newActiveIndex);
        } else {
          // Should not happen if currentParticipantIndex was valid and participant wasn't the one removed
          // But as a fallback, if the current index is out of bounds, reset to 0
          setCurrentParticipantIndex(currentParticipantIndex >= filteredList.length ? 0 : currentParticipantIndex);
        }
      }
      return filteredList;
    });
    toast({ title: "Participant Removed" });
  };

  const handleResetInitiativeAndCombat = () => {
    setParticipants([]);
    setCurrentParticipantIndex(-1);
    setRoundCounter(1);
    setIsCombatActive(false);
    toast({ title: "Turn Order Reset & Combat Ended" });
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAutoAdvanceOn && isCombatActive && participants.length > 0 && currentParticipantIndex !== -1) {
      timer = setTimeout(() => {
        handleAdvanceTurn();
      }, 5000); // Auto-advance every 5 seconds
    }
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoAdvanceOn, isCombatActive, currentParticipantIndex, participants]); // Dependencies for auto-advance


  return (
    <div className="flex h-screen">
      {/* Main Content Area */}
      <div className="flex-1 relative">
          <BattleGrid
            gridCells={gridCells}
            setGridCells={setGridCells}
            tokens={tokens}
            setTokens={setTokens}
            showGridLines={showGridLines}
            backgroundImageUrl={backgroundImageUrl}
            activeTool={activeTool}
            selectedColor={selectedColor}
            selectedTokenTemplate={selectedTokenTemplate}
            onTokenMove={handleTokenMove}
            measurement={measurement}
            setMeasurement={setMeasurement}
          />
          <FloatingToolbar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            title="Battle Board"
            Icon={LandPlot}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            selectedTokenTemplate={selectedTokenTemplate}
            setSelectedTokenTemplate={setSelectedTokenTemplate}
            backgroundImageUrl={backgroundImageUrl}
            setBackgroundImageUrl={setBackgroundImageUrl}
            showGridLines={showGridLines}
            setShowGridLines={setShowGridLines}
            measurement={measurement}
            setMeasurement={setMeasurement}
          />
      </div>

      {/* Right Sidebar for Initiative Tracker */}
      <SidebarProvider defaultOpen={true}>
        <Sidebar variant="sidebar" collapsible="icon" side="right">
          <SidebarContent className="p-4 space-y-4">
            <InitiativeTrackerPanel
              participantsProp={participants}
              currentParticipantIndex={currentParticipantIndex}
              roundCounter={roundCounter}
              isAutoAdvanceOn={isAutoAdvanceOn}
              setIsAutoAdvanceOn={setIsAutoAdvanceOn}
              onAddParticipant={handleAddParticipantToList}
              onRemoveParticipant={handleRemoveParticipantFromList}
              onResetInitiative={handleResetInitiativeAndCombat}
            />
          </SidebarContent>
          <div className="p-4 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
            <Button className="w-full opacity-50 cursor-not-allowed" disabled>
              Load from QuestFlow
            </Button>
          </div>
          <SidebarFooter className="p-2 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
            {!isCombatActive ? (
              <Button onClick={handleStartCombat} className="w-full">
                <Play className="mr-2 h-4 w-4" /> Start Combat
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleAdvanceTurn} className="flex-1">
                  <SkipForward className="mr-2 h-4 w-4" /> Next Turn
                </Button>
                <Button onClick={handleEndCombat} variant="destructive" className="flex-1">
                  <Square className="mr-2 h-4 w-4" /> End Combat
                </Button>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}

    
