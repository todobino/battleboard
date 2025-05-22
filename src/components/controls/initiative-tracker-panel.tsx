
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { Participant } from '@/types';
import React, { useState, useEffect } from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListOrdered, Swords, PlusCircle, Trash2, ChevronRight, RotateCcw } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';


interface InitiativeTrackerPanelProps {
  participants: Participant[];
  setParticipants: Dispatch<SetStateAction<Participant[]>>;
  currentParticipantIndex: number;
  setCurrentParticipantIndex: Dispatch<SetStateAction<number>>;
  roundCounter: number;
  setRoundCounter: Dispatch<SetStateAction<number>>;
  isAutoAdvanceOn: boolean; 
  setIsAutoAdvanceOn: Dispatch<SetStateAction<boolean>>; 
}

export default function InitiativeTrackerPanel({
  participants: participantsProp, // Renamed incoming prop
  setParticipants,
  currentParticipantIndex,
  setCurrentParticipantIndex,
  roundCounter,
  setRoundCounter,
  isAutoAdvanceOn,
  setIsAutoAdvanceOn
}: InitiativeTrackerPanelProps) {
  const participants = participantsProp || []; // Ensure local participants is always an array

  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantInitiative, setNewParticipantInitiative] = useState('');
  const [newParticipantType, setNewParticipantType] = useState<'player' | 'enemy'>('player');
  const { toast } = useToast();

  useEffect(() => {
    // This effect ensures the currentParticipantIndex is valid after participants array changes.
    // And also correctly sets the isActive flag on the current participant.
    if (participants.length > 0) {
      let activeIndexIsValid = currentParticipantIndex >= 0 && currentParticipantIndex < participants.length;

      if (!activeIndexIsValid && participants.length > 0) {
        // If current index is invalid but there are participants, reset to 0
        if (typeof setCurrentParticipantIndex === 'function') {
          setCurrentParticipantIndex(0);
        }
        // Update participants to set the first one as active
        if (typeof setParticipants === 'function') {
          setParticipants(prev => {
             const currentParticipants = Array.isArray(prev) ? prev : [];
             return currentParticipants.map((p, idx) => ({ ...p, isActive: idx === 0 }));
          });
        }
      } else if (activeIndexIsValid) {
        // Ensure only the current participant is active
        if (typeof setParticipants === 'function') {
         setParticipants(prev => {
            const currentParticipants = Array.isArray(prev) ? prev : [];
            return currentParticipants.map((p, idx) => ({ ...p, isActive: idx === currentParticipantIndex }));
          });
        }
      }
    } else if (participants.length === 0 && currentParticipantIndex !== -1) {
      // No participants, no active index
      if (typeof setCurrentParticipantIndex === 'function') {
        setCurrentParticipantIndex(-1); 
      }
       // Ensure all participants (if any passed unexpectedly) are marked inactive
      if (typeof setParticipants === 'function' && participants.some(p => p.isActive)) {
        setParticipants(prev => {
          const currentParticipants = Array.isArray(prev) ? prev : [];
          return currentParticipants.map(p => ({ ...p, isActive: false }));
        });
      }
    }
  }, [participantsProp, currentParticipantIndex, setCurrentParticipantIndex, setParticipants]); // participantsProp dependency


  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipantName.trim() || !newParticipantInitiative.trim()) {
      toast({ title: "Error", description: "Name and initiative are required.", variant: "destructive" });
      return;
    }
    const initiativeValue = parseInt(newParticipantInitiative, 10);
    if (isNaN(initiativeValue)) {
      toast({ title: "Error", description: "Initiative must be a number.", variant: "destructive" });
      return;
    }

    const newParticipantData: Participant = {
      id: `participant-${Date.now()}`,
      name: newParticipantName.trim(),
      initiative: initiativeValue,
      type: newParticipantType,
      isActive: false, 
    };
    
    // Get current participants safely
    const currentParticipants = Array.isArray(participantsProp) ? participantsProp : [];
    const newParticipantsList = [...currentParticipants, newParticipantData]
      .sort((a, b) => b.initiative - a.initiative);
    
    if (typeof setParticipants === 'function') {
      setParticipants(newParticipantsList);
    }

    if (newParticipantsList.length === 1 && typeof setCurrentParticipantIndex === 'function') {
      setCurrentParticipantIndex(0); 
    } else if (newParticipantsList.length > 0 && currentParticipantIndex === -1 && typeof setCurrentParticipantIndex === 'function') {
      // If there were no active participants and now there are, set the first one active
      setCurrentParticipantIndex(0);
    }
    // Note: The useEffect will handle setting the `isActive` flag based on `currentParticipantIndex`

    setNewParticipantName('');
    setNewParticipantInitiative('');
    toast({ title: "Participant Added", description: `${newParticipantData.name} added to initiative.` });
  };

  const handleRemoveParticipant = (id: string) => {
    if (typeof setParticipants !== 'function' || typeof setCurrentParticipantIndex !== 'function') return;
    
    const currentParticipants = Array.isArray(participantsProp) ? participantsProp : [];
    const participantToRemove = currentParticipants.find(p => p.id === id);
    if (!participantToRemove) return;

    const filtered = currentParticipants.filter(p => p.id !== id);
    
    if (filtered.length === 0) {
      setCurrentParticipantIndex(-1);
      if(typeof setRoundCounter === 'function') setRoundCounter(1);
    } else {
      // If the removed participant was active, or if the current index is now out of bounds
      if (participantToRemove.isActive || currentParticipantIndex >= filtered.length) {
         // Try to keep the turn order logical by advancing, or reset to 0 if it was the last one.
        let newActiveIndex = currentParticipantIndex;
        if (currentParticipantIndex >= filtered.length) { // If current index is now invalid
            newActiveIndex = 0; // Default to the first participant
        } else if (participantToRemove.isActive) {
            // If the active was removed, typically the next person in current order *before* removal would be up
            // but since the list is re-sorted/filtered, this is tricky.
            // A common D&D rule is the next person in initiative order.
            // For simplicity here, if active is removed, new index 0 becomes active.
            // More complex: find who *would* have been next.
            newActiveIndex = 0; // Or currentParticipantIndex % filtered.length if you want to try to preserve position
        }
        setCurrentParticipantIndex(newActiveIndex);

      } else {
        // If a non-active participant was removed, the current active participant might shift index.
        // Find the ID of the participant who *was* active before removal.
        const previouslyActiveParticipantId = currentParticipants[currentParticipantIndex]?.id;
        if(previouslyActiveParticipantId) {
            const newIndexOfPreviouslyActive = filtered.findIndex(p => p.id === previouslyActiveParticipantId);
            if (newIndexOfPreviouslyActive !== -1) {
                setCurrentParticipantIndex(newIndexOfPreviouslyActive);
            } else {
                 // Should not happen if logic is correct, but as a fallback:
                setCurrentParticipantIndex(0);
            }
        } else {
             setCurrentParticipantIndex(0); // Fallback if no previously active found
        }
      }
    }
    setParticipants(filtered); // Update the participants list
    toast({ title: "Participant Removed" });
  };

  const handleNextTurn = () => {
    const currentParticipants = Array.isArray(participantsProp) ? participantsProp : [];
    if (currentParticipants.length === 0 || typeof setCurrentParticipantIndex !== 'function') return;
    
    let nextIndex = currentParticipantIndex + 1;
    if (nextIndex >= currentParticipants.length) {
      nextIndex = 0;
      if(typeof setRoundCounter === 'function') {
        setRoundCounter(prev => {
          toast({ title: `Round ${prev + 1} Starting!` });
          return prev + 1;
        });
      }
    }
    setCurrentParticipantIndex(nextIndex);
  };

  const handleResetInitiative = () => {
    if(typeof setParticipants === 'function') setParticipants([]);
    if(typeof setCurrentParticipantIndex === 'function') setCurrentParticipantIndex(-1);
    if(typeof setRoundCounter === 'function') setRoundCounter(1);
    toast({ title: "Initiative Reset" });
  };

  return (
    <AccordionItem value="initiative-tracker">
      <AccordionTrigger>
        <ListOrdered className="mr-2 h-5 w-5" /> Initiative Tracker
      </AccordionTrigger>
      <AccordionContent className="space-y-4 p-1">
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-lg flex justify-between items-center">
              <span>Turn Order</span>
              <span className="text-sm font-normal text-muted-foreground">Round: {roundCounter}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No participants in initiative.</p>
            ) : (
              <ScrollArea className="h-48">
                <ul className="space-y-2">
                  {participants.map((p, index) => (
                    <li
                      key={p.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-md transition-colors",
                        p.isActive ? "bg-accent text-accent-foreground shadow-md" : "hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center">
                        <span className="font-semibold mr-2">{p.initiative}</span>
                        <span>{p.name}</span>
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${p.type === 'player' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'}`}>
                          {p.type}
                        </span>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Trash2 className="h-4 w-4 text-destructive" />
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
                            <AlertDialogAction onClick={() => handleRemoveParticipant(p.id)}>Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
            <div className="mt-4 flex gap-2">
              <Button onClick={handleNextTurn} disabled={participants.length === 0} className="flex-1">
                Next Turn <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon" title="Reset Initiative">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Initiative?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all participants and reset the round counter. Are you sure?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetInitiative}>Reset</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleAddParticipant} className="space-y-3">
          <p className="text-sm font-medium">Add Participant</p>
          <div>
            <Label htmlFor="participant-name">Name</Label>
            <Input id="participant-name" value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} placeholder="e.g., Gorok the Barbarian" />
          </div>
          <div>
            <Label htmlFor="participant-initiative">Initiative</Label>
            <Input id="participant-initiative" type="number" value={newParticipantInitiative} onChange={(e) => setNewParticipantInitiative(e.target.value)} placeholder="e.g., 15" />
          </div>
          <div>
            <Label htmlFor="participant-type">Type</Label>
            <select 
              id="participant-type" 
              value={newParticipantType} 
              onChange={(e) => setNewParticipantType(e.target.value as 'player' | 'enemy')}
              className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="player">Player</option>
              <option value="enemy">Enemy</option>
            </select>
          </div>
          <Button type="submit" className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" /> Add to Initiative
          </Button>
        </form>
        
        {/* <div className="flex items-center justify-between mt-4">
          <Label htmlFor="toggle-auto-advance">Auto-Advance Turn</Label>
          <Switch
            id="toggle-auto-advance"
            checked={isAutoAdvanceOn}
            onCheckedChange={setIsAutoAdvanceOn}
            disabled 
          />
        </div> */}
      </AccordionContent>
    </AccordionItem>
  );
}


    