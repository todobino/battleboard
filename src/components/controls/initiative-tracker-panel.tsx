
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { Participant, InitiativeTrackerPanelProps as InitiativeTrackerPanelPropsType } from '@/types';
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, MoreVertical, UploadCloud } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger, // Added AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import ImageCropDialog from '@/components/image-crop-dialog';
import { useToast } from '@/hooks/use-toast';

// Using the imported type for props
interface InitiativeTrackerPanelProps extends InitiativeTrackerPanelPropsType {}

export default function InitiativeTrackerPanel({
  participantsProp = [],
  currentParticipantIndex,
  roundCounter,
  onRemoveParticipant,
  onRenameParticipant,
  onChangeParticipantTokenImage,
}: InitiativeTrackerPanelProps) {
  const participants = participantsProp;

  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [participantToRename, setParticipantToRename] = useState<Participant | null>(null);
  const [newNameInput, setNewNameInput] = useState('');

  const [isChangeTokenDialogOpen, setIsChangeTokenDialogOpen] = useState(false);
  const [participantToChangeTokenFor, setParticipantToChangeTokenFor] = useState<Participant | null>(null);
  const [uncroppedTokenImageSrc, setUncroppedTokenImageSrc] = useState<string | null>(null);
  const [isTokenCropDialogOpen, setIsTokenCropDialogOpen] = useState(false);
  const tokenFileInputRef = useRef<HTMLInputElement>(null);


  const handleRenameClick = (participant: Participant) => {
    setParticipantToRename(participant);
    setNewNameInput(participant.name);
    setIsRenameDialogOpen(true);
  };

  const handleSaveRename = () => {
    if (participantToRename && newNameInput.trim()) {
      onRenameParticipant(participantToRename.id, newNameInput.trim());
    }
    setIsRenameDialogOpen(false);
    setParticipantToRename(null);
  };

  const handleChangeTokenClick = (participant: Participant) => {
    setParticipantToChangeTokenFor(participant);
    setUncroppedTokenImageSrc(null); // Reset previous image
    setIsChangeTokenDialogOpen(true);
  };

  const handleTokenImageUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        // Toast removed
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setUncroppedTokenImageSrc(reader.result as string);
        setIsTokenCropDialogOpen(true);
        if (event.target) event.target.value = ''; // Reset file input
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTokenCropConfirm = (croppedDataUrl: string) => {
    if (participantToChangeTokenFor) {
      onChangeParticipantTokenImage(participantToChangeTokenFor.id, croppedDataUrl);
      // Toast removed
    }
    setIsTokenCropDialogOpen(false);
    setUncroppedTokenImageSrc(null);
    setIsChangeTokenDialogOpen(false); // Close the parent dialog as well
    setParticipantToChangeTokenFor(null);
  };

  const handleTokenCropCancel = () => {
    setIsTokenCropDialogOpen(false);
    setUncroppedTokenImageSrc(null);
    // Keep the change token dialog open if user just cancels crop
  };


  return (
    <div className="flex flex-col h-full">
      <div className="pb-3 mb-3 border-b border-sidebar-border">
        <div className="text-lg flex justify-between items-center text-foreground">
          <span className="font-semibold">Turn Order</span>
          <span className="text-sm font-normal text-muted-foreground">Round: {roundCounter}</span>
        </div>
      </div>

      <div className="flex flex-col flex-grow overflow-hidden">
        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1 py-2">No participants in turn order.</p>
        ) : (
          <ScrollArea className="flex-grow">
            <ul className="space-y-2 pr-1">
              {participants.map((p, index) => {
                const itemIsActive = index === currentParticipantIndex;
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "flex flex-col p-2.5 rounded-md transition-colors",
                      itemIsActive ? "border-2 border-accent text-accent-foreground shadow-md" : "hover:bg-muted/50"
                    )}
                  >
                    {/* Top Row: Initiative, Name, Trash Icon */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center flex-grow min-w-0">
                        <span className="font-semibold mr-3 text-lg">{p.initiative}</span>
                        <span className="text-base font-semibold truncate" title={p.name}>{p.name}</span>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="group h-7 w-7 shrink-0 hover:bg-destructive"
                            aria-label={`Remove ${p.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-muted-foreground" />
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
                    </div>

                    {/* Bottom Row: Stats, Badge, Three Dots Icon */}
                    <div className="flex items-center justify-between w-full mt-1.5">
                      <div className="flex items-center text-xs text-muted-foreground">
                        {p.hp !== undefined && <span className="mr-2 whitespace-nowrap">(HP: {p.hp})</span>}
                        {p.ac !== undefined && <span className="mr-2 whitespace-nowrap">(AC: {p.ac})</span>}
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-md text-white whitespace-nowrap",
                          p.type === 'player' ? 'bg-green-500' :
                          p.type === 'enemy' ? 'bg-red-500' :
                          p.type === 'ally' ? 'bg-blue-500' : 
                          'bg-gray-500' 
                        )}>
                          {p.type.charAt(0).toUpperCase() + p.type.slice(1)}
                        </span>
                      </div>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="group h-7 w-7 shrink-0 hover:bg-sidebar-accent"
                            aria-label={`Options for ${p.name}`}
                          >
                            <MoreVertical className="h-4 w-4 text-muted-foreground group-hover:text-primary-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1" side="bottom" align="end">
                          <Button variant="ghost" className="w-full justify-start h-8 px-2 text-sm" onClick={() => handleRenameClick(p)}>
                            Rename
                          </Button>
                          <Button variant="ghost" className="w-full justify-start h-8 px-2 text-sm" onClick={() => handleChangeTokenClick(p)}>
                            Change Token
                          </Button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </div>

      {participantToRename && (
        <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename {participantToRename.name}</DialogTitle>
              <DialogDescription>
                Enter a new name for this combatant.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="rename-participant-input" className="sr-only">
                New Name
              </Label>
              <Input
                id="rename-participant-input"
                value={newNameInput}
                onChange={(e) => setNewNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveRename();
                  }
                }}
                placeholder="Enter new name"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="button" onClick={handleSaveRename} disabled={!newNameInput.trim()}>Save Name</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {participantToChangeTokenFor && (
        <Dialog open={isChangeTokenDialogOpen} onOpenChange={(isOpen) => {
          setIsChangeTokenDialogOpen(isOpen);
          if (!isOpen) setParticipantToChangeTokenFor(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Token for {participantToChangeTokenFor.name}</DialogTitle>
              <DialogDescription>
                Upload a new image to use as the token for this combatant.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => tokenFileInputRef.current?.click()}
              >
                <UploadCloud className="mr-2 h-4 w-4" /> Upload New Image
              </Button>
              <Input
                ref={tokenFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleTokenImageUploadChange}
                className="hidden"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {uncroppedTokenImageSrc && (
        <ImageCropDialog
          isOpen={isTokenCropDialogOpen}
          onOpenChange={setIsTokenCropDialogOpen}
          imageSrc={uncroppedTokenImageSrc}
          onCropConfirm={handleTokenCropConfirm}
          onCropCancel={handleTokenCropCancel}
        />
      )}
    </div>
  );
}

