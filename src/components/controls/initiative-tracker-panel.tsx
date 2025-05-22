'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { Participant } from '@/types';
import React, { useState } from 'react';
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
  isAutoAdvanceOn: boolean; // Placeholder for auto-advance feature
  setIsAutoAdvanceOn: Dispatch<SetStateAction<boolean>>; // Placeholder
}

export default function InitiativeTrackerPanel({
  participants, setParticipants,
  currentParticipantIndex, setCurrentParticipantIndex,
  roundCounter, setRoundCounter,
  isAutoAdvanceOn, setIsAutoAdvanceOn
}: InitiativeTrackerPanelProps) {
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantInitiative, setNewParticipantInitiative] = useState('');
  const [newParticipantType, setNewParticipantType] = useState<'player' | 'enemy'>('player');
  const { toast } = useToast();

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

    const newParticipant: Participant = {
      id: `participant-${Date.now()}`,
      name: newParticipantName.trim(),
      initiative: initiativeValue,
      type: newParticipantType,
      isActive: participants.length === 0, // First participant is active
    };
    
    const updatedParticipants = [...participants, newParticipant]
      .sort((a, b) => b.initiative - a.initiative); // Sort by initiative desc
    
    setParticipants(updatedParticipants);
    if(participants.length === 0) setCurrentParticipantIndex(0);

    setNewParticipantName('');
    setNewParticipantInitiative('');
    toast({ title: "Participant Added", description: `${newParticipant.name} added to initiative.` });
  };

  const handleRemoveParticipant = (id: string) => {
    setParticipants(prev => {
      const filtered = prev.filter(p => p.id !== id);
      // Adjust currentParticipantIndex if needed
      if (filtered.length > 0 && currentParticipantIndex >= filtered.length) {
        setCurrentParticipantIndex(0);
      } else if (filtered.length === 0) {
        setCurrentParticipantIndex(-1);
        setRoundCounter(1);
      }
      return filtered;
    });
    toast({ title: "Participant Removed" });
  };

  const handleNextTurn = () => {
    if (participants.length === 0) return;
    
    let nextIndex = currentParticipantIndex + 1;
    if (nextIndex >= participants.length) {
      nextIndex = 0;
      setRoundCounter(prev => prev + 1);
      toast({ title: `Round ${roundCounter + 1} Starting!` });
    }
    setCurrentParticipantIndex(nextIndex);
    setParticipants(prev => prev.map((p, index) => ({...p, isActive: index === nextIndex})));
  };

  const handleResetInitiative = () => {
    setParticipants([]);
    setCurrentParticipantIndex(-1);
    setRoundCounter(1);
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
                        index === currentParticipantIndex ? "bg-accent text-accent-foreground shadow-md" : "hover:bg-muted/50"
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
        
        {/* Placeholder for Auto-Advance toggle */}
        {/* <div className="flex items-center justify-between mt-4">
          <Label htmlFor="toggle-auto-advance">Auto-Advance Turn</Label>
          <Switch
            id="toggle-auto-advance"
            checked={isAutoAdvanceOn}
            onCheckedChange={setIsAutoAdvanceOn}
            disabled // Feature not fully implemented
          />
        </div> */}
      </AccordionContent>
    </AccordionItem>
  );
}
