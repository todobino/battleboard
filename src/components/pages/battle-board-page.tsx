
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { GridCellData, Token, Participant, ActiveTool, Measurement } from '@/types';
import BattleGrid from '@/components/battle-grid/battle-grid';
import InitiativeTrackerPanel from '@/components/controls/initiative-tracker-panel';
import FloatingToolbar from '@/components/floating-toolbar';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LandPlot, ListOrdered, Swords, Map as MapIcon, PersonStanding, Paintbrush, MousePointerSquareDashed } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// Accordion import removed as it's no longer directly used here for the right sidebar's main content.


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
    toast({ title: "Combat Ended."});
  };

  const handleAdvanceTurn = () => {
    if (participants.length === 0 || currentParticipantIndex === -1) {
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
      if (prev[currentParticipantIndex]?.id) {
        const newActiveIndex = newList.findIndex(p => p.id === prev[currentParticipantIndex].id);
        if (newActiveIndex !== -1) setCurrentParticipantIndex(newActiveIndex);
      } else if (newList.length > 0 && currentParticipantIndex === -1 && isCombatActive) {
        setCurrentParticipantIndex(0);
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
      } else {
        const oldActiveParticipantId = prev[currentParticipantIndex]?.id;
        if (id === oldActiveParticipantId) {
          // If active was removed, advance to the next in line (or loop around)
          // The % operator handles wrap-around correctly.
          // If currentParticipantIndex was already 0, this will keep it 0.
          setCurrentParticipantIndex(currentParticipantIndex % filteredList.length);
        } else {
          // If a non-active participant was removed, update currentParticipantIndex if necessary
          const newActiveIndex = filteredList.findIndex(p => p.id === oldActiveParticipantId);
          if (newActiveIndex !== -1) {
            setCurrentParticipantIndex(newActiveIndex);
          } else {
            // This case implies the currentParticipantIndex might now be out of bounds
            // The useEffect for currentParticipantIndex will sanitize this.
            if (currentParticipantIndex >= filteredList.length) {
              setCurrentParticipantIndex(0); // Fallback to start of list
            }
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
          <SidebarContent className="p-4">
            <InitiativeTrackerPanel
              participants={participants}
              currentParticipantIndex={currentParticipantIndex}
              roundCounter={roundCounter}
              isAutoAdvanceOn={isAutoAdvanceOn}
              setIsAutoAdvanceOn={setIsAutoAdvanceOn}
              onAddParticipant={handleAddParticipantToList}
              onRemoveParticipant={handleRemoveParticipantFromList}
              onResetInitiative={handleResetInitiativeAndCombat}
            />
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
