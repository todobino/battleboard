'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { GridCellData, Token, Participant, ActiveTool, Measurement, TokenTemplate } from '@/types';
import BattleGrid from '@/components/battle-grid/battle-grid';
import ControlsSidebar from '@/components/controls/controls-sidebar';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Swords, Settings } from 'lucide-react'; // Changed PanelLeftOpen to Swords
import { useToast } from '@/hooks/use-toast';

const GRID_ROWS = 20;
const GRID_COLS = 20;

const initialGridCells = (): GridCellData[][] =>
  Array.from({ length: GRID_ROWS }, (_, y) =>
    Array.from({ length: GRID_COLS }, (_, x) => ({
      id: `${y}-${x}`,
      color: undefined, // Initially transparent or default background
    }))
  );

export default function BattleBoardPage() {
  const [gridCells, setGridCells] = useState<GridCellData[][]>(initialGridCells());
  const [tokens, setTokens] = useState<Token[]>([]);
  const [showGridLines, setShowGridLines] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1); // Zoom is now primarily handled by SVG viewBox in BattleGrid
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentParticipantIndex, setCurrentParticipantIndex] = useState<number>(-1);
  const [roundCounter, setRoundCounter] = useState<number>(1);
  const [isAutoAdvanceOn, setIsAutoAdvanceOn] = useState<boolean>(false); // Auto-advance feature

  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [selectedColor, setSelectedColor] = useState<string>('#FF0000'); // Default to red
  const [selectedTokenTemplate, setSelectedTokenTemplate] = useState<Omit<Token, 'id' | 'x' | 'y'> | null>(null);
  
  const [measurement, setMeasurement] = useState<Measurement>({type: null});

  const { toast } = useToast();

  const handleCellClick = useCallback((x: number, y: number) => {
    // This logic has been moved into BattleGrid for direct SVG interaction
    // Kept here as a reference if higher-level state manipulation is needed
    console.log(`Cell clicked: ${x}, ${y}, Active Tool: ${activeTool}`);
  }, [activeTool, selectedColor, selectedTokenTemplate, setGridCells, setTokens]);

  const handleTokenMove = useCallback((tokenId: string, newX: number, newY: number) => {
    setTokens(prevTokens =>
      prevTokens.map(token =>
        token.id === tokenId ? { ...token, x: newX, y: newY } : token
      )
    );
    toast({ title: "Token Moved", description: `Token updated to position (${newX}, ${newY}).` });
  }, [toast]);


  // Auto-advance initiative (example, needs more robust implementation)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAutoAdvanceOn && participants.length > 0 && currentParticipantIndex !== -1) {
      timer = setTimeout(() => {
        let nextIndex = currentParticipantIndex + 1;
        if (nextIndex >= participants.length) {
          nextIndex = 0;
          setRoundCounter(prev => prev + 1);
        }
        setCurrentParticipantIndex(nextIndex);
      }, 5000); // Auto-advance every 5 seconds
    }
    return () => clearTimeout(timer);
  }, [isAutoAdvanceOn, currentParticipantIndex, participants, setRoundCounter]);


  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar variant="sidebar" collapsible="icon" className="border-r">
        <SidebarHeader className="p-2 flex items-center justify-between">
           <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <Swords className="h-6 w-6 text-sidebar-primary" /> {/* Changed icon here */}
            <h2 className="text-lg font-semibold text-sidebar-primary">Battle Board</h2>
          </div>
          <SidebarTrigger className="md:hidden group-data-[collapsible=icon]:hidden" />
        </SidebarHeader>
        <SidebarContent>
          <ControlsSidebar
            showGridLines={showGridLines} setShowGridLines={setShowGridLines}
            zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} // setZoomLevel is less relevant now
            backgroundImageUrl={backgroundImageUrl} setBackgroundImageUrl={setBackgroundImageUrl}
            participants={participants} setParticipants={setParticipants}
            currentParticipantIndex={currentParticipantIndex} setCurrentParticipantIndex={setCurrentParticipantIndex}
            roundCounter={roundCounter} setRoundCounter={setRoundCounter}
            isAutoAdvanceOn={isAutoAdvanceOn} setIsAutoAdvanceOn={setIsAutoAdvanceOn}
            activeTool={activeTool} setActiveTool={setActiveTool}
            selectedColor={selectedColor} setSelectedColor={setSelectedColor}
            selectedTokenTemplate={selectedTokenTemplate} setSelectedTokenTemplate={setSelectedTokenTemplate}
            measurement={measurement} setMeasurement={setMeasurement}
          />
        </SidebarContent>
        <SidebarFooter className="p-2 group-data-[collapsible=icon]:hidden">
          <Button variant="ghost" className="w-full justify-start">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
         <header className="p-2 border-b md:hidden flex items-center justify-between">
            <h2 className="text-lg font-semibold">Battle Board</h2>
            <SidebarTrigger/>
        </header>
        <main className="flex-1 overflow-auto"> {/* Main content area */}
          <BattleGrid
            gridCells={gridCells}
            setGridCells={setGridCells}
            tokens={tokens}
            setTokens={setTokens}
            showGridLines={showGridLines}
            zoomLevel={zoomLevel} // Passed but SVG viewBox controls zoom
            backgroundImageUrl={backgroundImageUrl}
            activeTool={activeTool}
            selectedColor={selectedColor}
            selectedTokenTemplate={selectedTokenTemplate}
            onCellClick={handleCellClick}
            onTokenMove={handleTokenMove}
            measurement={measurement}
            setMeasurement={setMeasurement}
          />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
