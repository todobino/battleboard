
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { Participant } from '@/types';
import React from 'react'; // Removed useState, useEffect
import { Button } from '@/components/ui/button';
// Input, Label, PlusCircle, Plus, Minus imports removed
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2 } from 'lucide-react'; // PlusCircle removed
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
// Dialog related imports removed
// useToast import removed
import { cn } from '@/lib/utils';


interface InitiativeTrackerPanelProps {
  participantsProp?: Participant[];
  currentParticipantIndex: number;
  roundCounter: number;
  // isAutoAdvanceOn: boolean; // Kept for now, though UI is not present
  // setIsAutoAdvanceOn: Dispatch<SetStateAction<boolean>>; // Kept for now
  onRemoveParticipant: (id: string) => void;
  // onResetInitiative: () => void; // Button was removed previously
}

export default function InitiativeTrackerPanel({
  participantsProp = [], // Default directly in destructuring
  currentParticipantIndex,
  roundCounter,
  // isAutoAdvanceOn, // Kept for now
  // setIsAutoAdvanceOn, // Kept for now
  onRemoveParticipant,
  // onResetInitiative, // Button was removed previously
}: InitiativeTrackerPanelProps) {
  const participants = participantsProp; // Use the prop directly or its default

  return (
    <div className="flex flex-col h-full">
      <div className="pb-3 mb-3 border-b border-sidebar-border"> {/* Header section */}
        <div className="text-lg flex justify-between items-center text-foreground">
          <span className="font-semibold">Turn Order</span>
          <span className="text-sm font-normal text-muted-foreground">Round: {roundCounter}</span>
        </div>
      </div>

      <div className="flex flex-col flex-grow overflow-hidden"> {/* Added overflow-hidden */}
        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1 py-2">No participants in turn order.</p>
        ) : (
          <ScrollArea className="flex-grow"> 
            <ul className="space-y-2 pr-1"> {/* Added pr-1 to avoid scrollbar overlap */}
              {participants.map((p, index) => {
                const itemIsActive = index === currentParticipantIndex;
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-md transition-colors",
                      itemIsActive ? "border-2 border-accent text-accent-foreground shadow-md" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex-grow flex flex-col mr-2 overflow-hidden"> {/* Added overflow-hidden */}
                      <div className="flex items-baseline">
                        <span className="font-semibold mr-2 text-lg">{p.initiative}</span>
                        <span className="text-base font-semibold truncate" title={p.name}>{p.name}</span>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        {p.hp !== undefined && <span className="mr-2 whitespace-nowrap">(HP: {p.hp})</span>}
                        {p.ac !== undefined && <span className="mr-2 whitespace-nowrap">(AC: {p.ac})</span>}
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-md text-white whitespace-nowrap", // Changed rounded-full to rounded-md
                          p.type === 'player' ? 'bg-green-500' : 
                          p.type === 'enemy' ? 'bg-red-500' :    
                          'bg-blue-500' 
                        )}>
                          {p.type.charAt(0).toUpperCase() + p.type.slice(1)}
                        </span>
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="group h-7 w-7 shrink-0 hover:bg-destructive"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {p.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. Are you sure you want to remove this participant?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onRemoveParticipant(p.id)}>Remove</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </div>
      {/* "Add Combatant" DialogTrigger and Dialog moved to BattleBoardPage */}
    </div>
  );
}
