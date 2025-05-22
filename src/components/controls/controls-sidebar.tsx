'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, Participant, Token, TokenTemplate, Measurement } from '@/types';
import { Accordion } from '@/components/ui/accordion';
import GridSettingsPanel from './grid-settings-panel';
import InitiativeTrackerPanel from './initiative-tracker-panel';
import ColorToolPanel from './color-tool-panel';
import MeasurementToolPanel from './measurement-tool-panel';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ControlsSidebarProps {
  showGridLines: boolean;
  setShowGridLines: Dispatch<SetStateAction<boolean>>;
  zoomLevel: number;
  setZoomLevel: Dispatch<SetStateAction<number>>;
  backgroundImageUrl: string | null;
  setBackgroundImageUrl: Dispatch<SetStateAction<string | null>>;
  
  participants: Participant[];
  setParticipants: Dispatch<SetStateAction<Participant[]>>;
  currentParticipantIndex: number;
  setCurrentParticipantIndex: Dispatch<SetStateAction<number>>;
  roundCounter: number;
  setRoundCounter: Dispatch<SetStateAction<number>>;
  isAutoAdvanceOn: boolean;
  setIsAutoAdvanceOn: Dispatch<SetStateAction<boolean>>;
  
  activeTool: ActiveTool;
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  selectedColor: string;
  setSelectedColor: Dispatch<SetStateAction<string>>;
  selectedTokenTemplate: Omit<Token, 'id' | 'x' | 'y'> | null;
  setSelectedTokenTemplate: Dispatch<SetStateAction<Omit<Token, 'id' | 'x' | 'y'> | null>>;
  
  measurement: Measurement;
  setMeasurement: Dispatch<SetStateAction<Measurement>>;
}

export default function ControlsSidebar({
  showGridLines, setShowGridLines,
  zoomLevel, setZoomLevel,
  backgroundImageUrl, setBackgroundImageUrl,
  participants, setParticipants,
  currentParticipantIndex, setCurrentParticipantIndex,
  roundCounter, setRoundCounter,
  isAutoAdvanceOn, setIsAutoAdvanceOn,
  activeTool, setActiveTool,
  selectedColor, setSelectedColor,
  selectedTokenTemplate, setSelectedTokenTemplate,
  measurement, setMeasurement,
}: ControlsSidebarProps) {
  return (
    <ScrollArea className="h-full p-4">
      <Accordion type="multiple" defaultValue={['grid-settings', 'initiative-tracker', 'color-tool', 'measurement-tool']} className="w-full">
        <GridSettingsPanel
          showGridLines={showGridLines}
          setShowGridLines={setShowGridLines}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          backgroundImageUrl={backgroundImageUrl}
          setBackgroundImageUrl={setBackgroundImageUrl}
          setActiveTool={setActiveTool}
        />
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
        <ColorToolPanel
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          setSelectedTokenTemplate={setSelectedTokenTemplate}
        />
        <MeasurementToolPanel
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          measurement={measurement}
          setMeasurement={setMeasurement}
        />
      </Accordion>
    </ScrollArea>
  );
}
