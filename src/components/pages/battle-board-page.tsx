
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { GridCellData, Token, Participant, ActiveTool, Measurement } from '@/types';
import BattleGrid from '@/components/battle-grid/battle-grid';
import ControlsSidebar from '@/components/controls/controls-sidebar';
import InitiativeTrackerPanel from '@/components/controls/initiative-tracker-panel';
import FloatingToolbar from '@/components/floating-toolbar';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { LandPlot, Settings, ListOrdered } from 'lucide-react';
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

  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [selectedColor, setSelectedColor] = useState<string>('#FF0000');
  const [selectedTokenTemplate, setSelectedTokenTemplate] = useState<Omit<Token, 'id' | 'x' | 'y'> | null>(null);
  
  const [measurement, setMeasurement] = useState<Measurement>({type: null});

  const { toast } = useToast();

  const handleCellClick = useCallback((x: number, y: number) => {
    // console.log(`Cell clicked: ${x}, ${y}, Active Tool: ${activeTool}`);
    // Cell click logic is now primarily handled within BattleGrid based on activeTool
  }, []);

  const handleTokenMove = useCallback((tokenId: string, newX: number, newY: number) => {
    setTokens(prevTokens =>
      prevTokens.map(token =>
        token.id === tokenId ? { ...token, x: newX, y: newY } : token
      )
    );
    toast({ title: "Token Moved", description: `Token updated to position (${newX}, ${newY}).` });
  }, [toast]);

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
      }, 5000); 
    }
    return () => clearTimeout(timer);
  }, [isAutoAdvanceOn, currentParticipantIndex, participants, setRoundCounter]);


  return (
    <div className="flex h-screen">
      {/* Left Sidebar for General Controls */}
      <SidebarProvider defaultOpen={true}>
        <Sidebar variant="sidebar" collapsible="icon" className="border-r" side="left">
          {/* SidebarHeader removed as per previous request */}
          <SidebarContent>
            <ControlsSidebar
              backgroundImageUrl={backgroundImageUrl} setBackgroundImageUrl={setBackgroundImageUrl}
              activeTool={activeTool} setActiveTool={setActiveTool}
              showGridLines={showGridLines} setShowGridLines={setShowGridLines}
              // measurement and setMeasurement props removed
            />
          </SidebarContent>
          <SidebarFooter className="p-2 group-data-[collapsible=icon]:hidden border-t border-sidebar-border">
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="mr-2 h-4 w-4" /> Settings
            </Button>
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>

      {/* Main Content Area */}
      <SidebarInset className="flex-1 flex flex-col relative">
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
          />
      </SidebarInset>

      {/* Right Sidebar for Initiative Tracker */}
      <SidebarProvider defaultOpen={true}>
        <Sidebar variant="sidebar" collapsible="icon" className="border-l" side="right">
        <SidebarHeader className="p-2 flex items-center justify-between border-b border-sidebar-border">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <ListOrdered className="h-6 w-6 text-sidebar-primary" />
              <h2 className="text-lg font-semibold text-sidebar-primary">Initiative</h2>
            </div>
            <ListOrdered className="h-6 w-6 text-sidebar-primary hidden group-data-[collapsible=icon]:block" />
            <SidebarTrigger className="md:hidden group-data-[collapsible=icon]:hidden" />
          </SidebarHeader>
          <SidebarContent>
            <Accordion type="single" collapsible defaultValue="initiative-tracker" className="w-full">
              <InitiativeTrackerPanel
                participants={participants}
                setParticipants={setParticipants}
                currentParticipantIndex={currentParticipantIndex}
                setCurrentParticipantIndex={setCurrentParticipantIndex}
                roundCounter={roundCounter}
                setRoundCounter={setRoundCounter}
                isAutoAdvanceOn={isAutoAdvanceOn}
                setIsAutoAdvanceOn={setIsAutoAdvanceOn}
              />
            </Accordion>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}
