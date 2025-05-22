
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, Token, Measurement } from '@/types';
import { Accordion } from '@/components/ui/accordion';
import GridSettingsPanel from './grid-settings-panel';
// Removed InitiativeTrackerPanel import
import ColorToolPanel from './color-tool-panel';
import MeasurementToolPanel from './measurement-tool-panel';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ControlsSidebarProps {
  backgroundImageUrl: string | null;
  setBackgroundImageUrl: Dispatch<SetStateAction<string | null>>;
  
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
  backgroundImageUrl, setBackgroundImageUrl,
  activeTool, setActiveTool,
  selectedColor, setSelectedColor,
  selectedTokenTemplate, setSelectedTokenTemplate,
  measurement, setMeasurement,
}: ControlsSidebarProps) {
  return (
    <ScrollArea className="h-full p-4">
      <Accordion type="multiple" defaultValue={['grid-settings', 'color-tool', 'measurement-tool']} className="w-full">
        <GridSettingsPanel
          backgroundImageUrl={backgroundImageUrl}
          setBackgroundImageUrl={setBackgroundImageUrl}
          setActiveTool={setActiveTool}
        />
        {/* Removed InitiativeTrackerPanel instance */}
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
