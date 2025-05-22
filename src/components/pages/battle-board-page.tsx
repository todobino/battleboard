
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { GridCellData, Token, Participant, ActiveTool, Measurement } from '@/types';
import BattleGrid from '@/components/battle-grid/battle-grid';
import InitiativeTrackerPanel from '@/components/controls/initiative-tracker-panel';
import FloatingToolbar from '@/components/floating-toolbar';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LandPlot, ListOrdered } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Accordion } from '@/components/ui/accordion';


const GRID_ROWS = 20;
const GRID_COLS = 20;

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

  // Effect to keep currentParticipantIndex valid
  useEffect(() => {
    if (participants.length === 0) {
      if (currentParticipantIndex !== -1) setCurrentParticipantIndex(-1);
    } else {
      if (currentParticipantIndex < 0 || currentParticipantIndex >= participants.length) {
        setCurrentParticipantIndex(0);
      }
    }
  }, [participants, currentParticipantIndex]);


  const handleCellClick = useCallback((x: number, y: number) => {
    // Cell click logic is primarily handled within BattleGrid
  }, []);

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
    setRoundCounter(1);
    // Optionally reset currentParticipantIndex, or leave as is for next combat
    // setCurrentParticipantIndex(-1); 
    toast({ title: "Combat Ended."});
  };

  const handleAdvanceTurn = () => {
    if (participants.length === 0) {
      toast({ title: "Cannot Advance Turn", description: "No participants in combat."});
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
      // If this is the first participant and combat hasn't started, make them active.
      if (newList.length === 1 && !isCombatActive) {
        setCurrentParticipantIndex(0);
      } else if (isCombatActive) {
         // Re-evaluate current index if active participant's position changed or new participant inserted before
         const activeParticipantId = prev[currentParticipantIndex]?.id;
         if (activeParticipantId) {
            const newIdx = newList.findIndex(p => p.id === activeParticipantId);
            if (newIdx !== -1 && newIdx !== currentParticipantIndex) {
                setCurrentParticipantIndex(newIdx);
            } else if (newIdx === -1) { // Active was somehow removed, should not happen here
                 setCurrentParticipantIndex(0);
            }
         } else if (currentParticipantIndex === -1 && newList.length > 0) {
            setCurrentParticipantIndex(0); // If combat active but no one was current (e.g. all removed then one added)
         }
      }
      return newList;
    });
    toast({ title: "Participant Added", description: `${newParticipant.name} added.` });
  };

  const handleRemoveParticipantFromList = (id: string) => {
    setParticipants(prev => {
      const participantToRemove = prev.find(p => p.id === id);
      if (!participantToRemove) return prev;

      const filteredList = prev.filter(p => p.id !== id);

      if (filteredList.length === 0) {
        setCurrentParticipantIndex(-1);
        if (isCombatActive) setRoundCounter(1); // Reset round if combat was active and list becomes empty
      } else {
        // If the removed participant was the one whose turn it was, or if current index is now invalid
        const oldActiveParticipantId = prev[currentParticipantIndex]?.id;

        if (id === oldActiveParticipantId || currentParticipantIndex >= filteredList.length) {
          // If the active participant was removed, try to advance to the "next" one in the new list
          // or reset to 0 if it was the last one or the removed caused index to be out of bounds.
          // The useEffect for currentParticipantIndex will also help sanitize this.
          setCurrentParticipantIndex(currentParticipantIndex % filteredList.length); 
        } else {
          // If a non-active participant was removed, the current active participant might shift index.
          // Find the ID of the participant who *was* active before removal.
          const newIndexOfPreviouslyActive = filteredList.findIndex(p => p.id === oldActiveParticipantId);
          if (newIndexOfPreviouslyActive !== -1) {
              setCurrentParticipantIndex(newIndexOfPreviouslyActive);
          } else {
               // Fallback if no previously active found (e.g. list was [A, B], B active, A removed, B is still at index 0)
               // This case might be covered by the previous 'if' or the useEffect.
          }
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


  // Auto-advance (currently commented out in InitiativeTrackerPanel)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAutoAdvanceOn && isCombatActive && participants.length > 0 && currentParticipantIndex !== -1) {
      timer = setTimeout(() => {
        handleAdvanceTurn();
      }, 5000); 
    }
    return () => clearTimeout(timer);
  }, [isAutoAdvanceOn, isCombatActive, currentParticipantIndex, participants, handleAdvanceTurn]);


  return (
    <div className="flex h-screen">
      <div className="flex-1 relative">
          <BattleGrid
            gridCells={gridCells}
            setGridCells={setGridCells}
            tokens={tokens}
            setTokens={setTokens}
            showGridLines={showGridLines}
            zoomLevel={1} 
            backgroundImageUrl={backgroundImageUrl}
            activeTool={activeTool}
            selectedColor={selectedColor}
            selectedTokenTemplate={selectedTokenTemplate}
            onCellClick={handleCellClick}
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
          />
      </div>

      <SidebarProvider defaultOpen={true}>
        <Sidebar variant="sidebar" collapsible="icon" className="border-l" side="right">
          <SidebarHeader className="p-2 flex items-center justify-between border-b border-sidebar-border">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <ListOrdered className="h-6 w-6 text-sidebar-primary" />
              <h2 className="text-lg font-semibold text-sidebar-primary">Turn Order</h2>
            </div>
            <ListOrdered className="h-6 w-6 text-sidebar-primary hidden group-data-[collapsible=icon]:block" />
            <SidebarTrigger className="md:hidden group-data-[collapsible=icon]:hidden" />
          </SidebarHeader>
          <SidebarContent>
            <Accordion type="single" collapsible defaultValue="turn-tracker" className="w-full">
              <InitiativeTrackerPanel
                participants={participants}
                currentParticipantIndex={currentParticipantIndex}
                roundCounter={roundCounter}
                isAutoAdvanceOn={isAutoAdvanceOn} // Prop still passed, UI for it is commented out in panel
                setIsAutoAdvanceOn={setIsAutoAdvanceOn} // Prop still passed
                onAddParticipant={handleAddParticipantToList}
                onRemoveParticipant={handleRemoveParticipantFromList}
                onResetInitiative={handleResetInitiativeAndCombat}
              />
            </Accordion>
          </SidebarContent>
          <SidebarFooter className="p-2 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
            {!isCombatActive ? (
              <Button onClick={handleStartCombat} className="w-full">
                Start Combat
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleAdvanceTurn} className="flex-1">
                  Next Turn
                </Button>
                <Button onClick={handleEndCombat} variant="destructive" className="flex-1">
                  End Combat
                </Button>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}
