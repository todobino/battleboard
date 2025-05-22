
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool } from '@/types';
import { Accordion } from '@/components/ui/accordion';
// GridSettingsPanel import removed
import { ScrollArea } from '@/components/ui/scroll-area';

interface ControlsSidebarProps {
  // Props for GridSettingsPanel removed
  activeTool: ActiveTool;
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
}

export default function ControlsSidebar({
  // Props for GridSettingsPanel removed from destructuring
  activeTool, setActiveTool,
}: ControlsSidebarProps) {
  return (
    <ScrollArea className="h-full p-4">
      <Accordion type="multiple" defaultValue={[]} className="w-full">
        {/* GridSettingsPanel instance removed */}
      </Accordion>
      {/* You can add other general control panels here if needed */}
       <div className="p-4 text-center text-sm text-muted-foreground">
        All grid and map settings are now available via the floating toolbar on the map.
      </div>
    </ScrollArea>
  );
}
