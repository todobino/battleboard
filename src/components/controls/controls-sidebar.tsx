
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, Token, Measurement } from '@/types';
import { Accordion } from '@/components/ui/accordion';
import GridSettingsPanel from './grid-settings-panel';
// Removed ColorToolPanel import
import MeasurementToolPanel from './measurement-tool-panel';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ControlsSidebarProps {
  backgroundImageUrl: string | null;
  setBackgroundImageUrl: Dispatch<SetStateAction<string | null>>;
  
  activeTool: ActiveTool;
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  // Removed selectedColor, setSelectedColor, selectedTokenTemplate, setSelectedTokenTemplate props
  
  measurement: Measurement;
  setMeasurement: Dispatch<SetStateAction<Measurement>>;
}

export default function ControlsSidebar({
  backgroundImageUrl, setBackgroundImageUrl,
  activeTool, setActiveTool,
  // Removed selectedColor, setSelectedColor, selectedTokenTemplate, setSelectedTokenTemplate from destructuring
  measurement, setMeasurement,
}: ControlsSidebarProps) {
  return (
    <ScrollArea className="h-full p-4">
      <Accordion type="multiple" defaultValue={['grid-settings', 'measurement-tool']} className="w-full">
        <GridSettingsPanel
          backgroundImageUrl={backgroundImageUrl}
          setBackgroundImageUrl={setBackgroundImageUrl}
          setActiveTool={setActiveTool}
        />
        {/* Removed ColorToolPanel instance */}
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
