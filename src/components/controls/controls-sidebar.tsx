
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, Token, Measurement } from '@/types';
import { Accordion } from '@/components/ui/accordion';
import GridSettingsPanel from './grid-settings-panel';
// Removed MeasurementToolPanel import
import { ScrollArea } from '@/components/ui/scroll-area';

interface ControlsSidebarProps {
  backgroundImageUrl: string | null;
  setBackgroundImageUrl: Dispatch<SetStateAction<string | null>>;
  showGridLines: boolean;
  setShowGridLines: Dispatch<SetStateAction<boolean>>;
  activeTool: ActiveTool;
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  // Removed measurement, setMeasurement props
}

export default function ControlsSidebar({
  backgroundImageUrl, setBackgroundImageUrl,
  showGridLines, setShowGridLines,
  activeTool, setActiveTool,
  // Removed measurement, setMeasurement from destructuring
}: ControlsSidebarProps) {
  return (
    <ScrollArea className="h-full p-4">
      <Accordion type="multiple" defaultValue={['grid-settings']} className="w-full">
        <GridSettingsPanel
          backgroundImageUrl={backgroundImageUrl}
          setBackgroundImageUrl={setBackgroundImageUrl}
          setActiveTool={setActiveTool}
          showGridLines={showGridLines}
          setShowGridLines={setShowGridLines}
        />
        {/* Removed MeasurementToolPanel instance */}
      </Accordion>
    </ScrollArea>
  );
}
