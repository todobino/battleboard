
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { Participant } from '@/types';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, Plus, Minus } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';


interface InitiativeTrackerPanelProps {
  participantsProp?: Participant[];
  currentParticipantIndex: number;
  roundCounter: number;
  isAutoAdvanceOn: boolean;
  setIsAutoAdvanceOn: Dispatch<SetStateAction<boolean>>;
  onAddParticipant: (participantData: Omit<Participant, 'id'>) => void;
  onRemoveParticipant: (id: string) => void;
  onResetInitiative: () => void;
}

export default function InitiativeTrackerPanel({
  participantsProp,
  currentParticipantIndex,
  roundCounter,
  isAutoAdvanceOn,
  setIsAutoAdvanceOn,
  onAddParticipant,
  onRemoveParticipant,
  onResetInitiative,
}: InitiativeTrackerPanelProps) {
  const participants = participantsProp || [];
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantInitiative, setNewParticipantInitiative] = useState('10');
  const [isEditingInitiative, setIsEditingInitiative] = useState(false);
  const [newParticipantHp, setNewParticipantHp] = useState('10');
  const [isEditingHp, setIsEditingHp] = useState(false);
  const [newParticipantAc, setNewParticipantAc] = useState('10');
  const [isEditingAc, setIsEditingAc] = useState(false);
  const [newParticipantType, setNewParticipantType] = useState<'player' | 'enemy' | 'ally'>('player');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleAddFormSubmit = (e: React.FormEvent) => {
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

    const hpString = newParticipantHp.trim();
    const acString = newParticipantAc.trim();

    const hpValue = hpString === '' ? undefined : parseInt(hpString, 10);
    const acValue = acString === '' ? undefined : parseInt(acString, 10);
    
    if (hpString !== '' && isNaN(hpValue as number)) {
      toast({ title: "Error", description: "HP must be a number or empty.", variant: "destructive" });
      return;
    }
    if (acString !== '' && isNaN(acValue as number)) {
      toast({ title: "Error", description: "AC must be a number or empty.", variant: "destructive" });
      return;
    }


    const newParticipantData: Omit<Participant, 'id'> = {
      name: newParticipantName.trim(),
      initiative: initiativeValue,
      type: newParticipantType,
      hp: hpValue,
      ac: acValue,
    };

    onAddParticipant(newParticipantData);

    setNewParticipantName('');
    setNewParticipantInitiative('10'); 
    setIsEditingInitiative(false); 
    setNewParticipantHp('10');
    setIsEditingHp(false);
    setNewParticipantAc('10');
    setIsEditingAc(false);
    setNewParticipantType('player'); 
    setDialogOpen(false);
  };

  const renderNumericInput = (
    value: string,
    setValue: Dispatch<SetStateAction<string>>,
    isEditing: boolean,
    setIsEditing: Dispatch<SetStateAction<boolean>>,
    label: string,
    idPrefix: string,
    optional: boolean = false
  ) => (
    <div className="flex-1 space-y-1">
      <Label htmlFor={`${idPrefix}-display`}>{label}</Label>
      {isEditing ? (
        <Input
          id={`${idPrefix}-input`}
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            if (optional && value.trim() === '') {
              // Keep it empty if optional and user cleared it
            } else {
              const num = parseInt(value, 10);
              if (isNaN(num)) {
                setValue('10'); 
              }
            }
            setIsEditing(false);
          }}
          autoFocus
          className="w-full text-center"
        />
      ) : (
        <div className="flex items-center gap-1 mt-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => {
              const currentValue = parseInt(value, 10) || 0;
              setValue(String(Math.max(0, currentValue - 1)));
            }}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            id={`${idPrefix}-display`}
            onClick={() => setIsEditing(true)}
            className="h-8 px-2 text-base w-full justify-center"
          >
            {value || (optional ? 'N/A' : '10')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => {
              const currentValue = parseInt(value, 10) || 0;
              setValue(String(currentValue + 1));
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );


  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-lg flex justify-between items-center">
            <span>Turn Order</span>
            <span className="text-sm font-normal text-muted-foreground">Round: {roundCounter}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No participants in turn order.</p>
          ) : (
            <ScrollArea className="h-48">
              <ul className="space-y-2">
                {participants.map((p, index) => {
                  const itemIsActive = index === currentParticipantIndex;
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-md transition-colors",
                        itemIsActive ? "bg-accent text-accent-foreground shadow-md" : "hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center flex-wrap">
                        <span className="font-semibold mr-2">{p.initiative}</span>
                        <span className="mr-2">{p.name}</span>
                        {p.hp !== undefined && <span className="mr-1 text-xs text-muted-foreground">(HP: {p.hp})</span>}
                        {p.ac !== undefined && <span className="mr-2 text-xs text-muted-foreground">(AC: {p.ac})</span>}
                         <span className={cn(
                          "ml-auto text-xs px-1.5 py-0.5 rounded-full text-white",
                           p.type === 'player' ? 'bg-blue-500' :
                           p.type === 'enemy' ? 'bg-red-500' :
                           'bg-green-500' // Ally
                        )}>
                          {p.type}
                        </span>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 ml-2 shrink-0">
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Combatant
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Combatant</DialogTitle>
            <DialogDescription>
              Enter the details for the new combatant to add to the turn order.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddFormSubmit} className="space-y-4 pt-4">
            <div>
              <Label htmlFor="participant-name-dialog">Name</Label>
              <Input id="participant-name-dialog" value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} placeholder="e.g., Gorok the Barbarian" />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              {renderNumericInput(newParticipantInitiative, setNewParticipantInitiative, isEditingInitiative, setIsEditingInitiative, "Initiative*", "participant-initiative-dialog")}
              {renderNumericInput(newParticipantHp, setNewParticipantHp, isEditingHp, setIsEditingHp, "HP", "participant-hp-dialog", true)}
              {renderNumericInput(newParticipantAc, setNewParticipantAc, isEditingAc, setIsEditingAc, "AC", "participant-ac-dialog", true)}
            </div>

            <div>
              <Label>Type</Label>
              <div className="flex space-x-2 mt-1">
                <Button
                  type="button"
                  variant={newParticipantType === 'player' ? 'default' : 'outline'}
                  onClick={() => setNewParticipantType('player')}
                  className="flex-1"
                >
                  Player
                </Button>
                <Button
                  type="button"
                  variant={newParticipantType === 'enemy' ? 'default' : 'outline'}
                  onClick={() => setNewParticipantType('enemy')}
                  className="flex-1"
                >
                  Enemy
                </Button>
                <Button
                  type="button"
                  variant={newParticipantType === 'ally' ? 'default' : 'outline'}
                  onClick={() => setNewParticipantType('ally')}
                  className="flex-1"
                >
                  Ally
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">
                Add to Turn Order
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

