
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { Participant, InitiativeTrackerPanelProps as InitiativeTrackerPanelPropsType, Token } from '@/types';
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, MoreVertical, UploadCloud, HelpCircle, Zap, Heart, Shield as ShieldIcon, ArrowUpCircle, ArrowDownCircle, Edit3, ImagePlus, SlidersVertical, Plus, Minus } from 'lucide-react';

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

interface InitiativeTrackerPanelProps extends InitiativeTrackerPanelPropsType {}

export default function InitiativeTrackerPanel({
  participantsProp = [],
  tokens,
  currentParticipantIndex,
  roundCounter, 
  onRemoveParticipant,
  onRenameParticipant,
  onChangeParticipantTokenImage,
  onFocusToken,
  onMoveParticipantUp,
  onMoveParticipantDown,
  onUpdateParticipantStats, // Kept for future, but actual update call happens in BattleBoardPage
  onOpenEditStatsDialogForParticipant, // New prop
}: InitiativeTrackerPanelProps) {
  const participants = participantsProp;
  const { toast } = useToast();

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
    if (participantToRename && newNameInput.trim() && onRenameParticipant) {
      onRenameParticipant(participantToRename.id, newNameInput.trim());
    }
    setIsRenameDialogOpen(false);
    setParticipantToRename(null);
  };

  const handleChangeTokenClick = (participant: Participant) => {
    setParticipantToChangeTokenFor(participant);
    setUncroppedTokenImageSrc(null);
    setIsChangeTokenDialogOpen(true);
  };

  const handleTokenImageUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
            title: "Upload Error",
            description: "Token image file size exceeds 2MB.",
            variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setUncroppedTokenImageSrc(reader.result as string);
        setIsTokenCropDialogOpen(true);
        if (event.target) event.target.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTokenCropConfirm = (croppedDataUrl: string) => {
    if (participantToChangeTokenFor && onChangeParticipantTokenImage) {
      onChangeParticipantTokenImage(participantToChangeTokenFor.id, croppedDataUrl);
    }
    setIsTokenCropDialogOpen(false);
    setUncroppedTokenImageSrc(null);
    setIsChangeTokenDialogOpen(false);
    setParticipantToChangeTokenFor(null);
  };

  const handleTokenCropCancel = () => {
    setIsTokenCropDialogOpen(false);
    setUncroppedTokenImageSrc(null);
  };

  const handleEditStatsClick = (participant: Participant) => {
    if (onOpenEditStatsDialogForParticipant) {
        onOpenEditStatsDialogForParticipant(participant);
    }
  };

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="flex flex-col flex-grow overflow-hidden min-w-0">
        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1 py-2">No participants in turn order.</p>
        ) : (
          <div className="flex-grow w-full overflow-x-hidden min-w-0">
            <ScrollArea className="h-full w-full" viewportClassName="w-full h-full min-w-0 overflow-x-hidden">
              <ul className="space-y-2 pr-1 min-w-0 overflow-x-hidden">
                {participants.map((p, index) => {
                  const itemIsActive = index === currentParticipantIndex;
                  const token = tokens.find(t => t.id === p.tokenId);
                  const IconComponent = token?.icon;
                  const canFocus = !!p.tokenId && !!onFocusToken;

                  return (
                    <li
                      key={p.id}
                      className={cn(
                        "flex flex-col p-2.5 w-full max-w-full min-w-0 rounded-md overflow-hidden",
                        itemIsActive ? "border-2 border-accent text-accent-foreground shadow-md" : "border border-sidebar-border hover:bg-muted/50",
                        canFocus && "cursor-pointer"
                      )}
                      onClick={() => {
                        if (canFocus && p.tokenId && onFocusToken) {
                          onFocusToken(p.tokenId);
                        }
                      }}
                    >
                      <div className="flex items-center w-full min-w-0 overflow-hidden">
                         <div className="shrink-0 mr-2"> {/* Icon Container */}
                          {token ? (
                            token.customImageUrl ? (
                              <div className="w-6 h-6 rounded-full overflow-hidden border border-sidebar-border">
                                <img src={token.customImageUrl} alt={p.name} className="w-full h-full object-cover" />
                              </div>
                            ) : IconComponent ? (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center border border-sidebar-border"
                                style={{ backgroundColor: token.color }}
                              >
                                <IconComponent className="h-4 w-4 text-primary-foreground" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center border border-sidebar-border">
                                 <HelpCircle className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center border border-sidebar-border">
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="w-0 flex-1 min-w-0 overflow-hidden">
                          <span className="block truncate text-base font-semibold" title={p.name}>
                            {p.name}
                          </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="ml-1 group/deleteButton h-7 w-7 shrink-0 hover:bg-sidebar-accent"
                            aria-label={`Remove ${p.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onRemoveParticipant) onRemoveParticipant(p.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground group-hover/deleteButton:text-primary-foreground" />
                          </Button>
                      </div>

                      <div className="flex items-center justify-between w-full mt-1.5">
                        <div className="flex items-center space-x-3 text-xs text-muted-foreground flex-1 min-w-0 overflow-hidden mr-1">
                          <div className="flex items-center" title={`Initiative: ${p.initiative}`}>
                            <Zap className="h-3.5 w-3.5 mr-0.5 text-yellow-500" />
                            <span>{p.initiative}</span>
                          </div>
                          {p.hp !== undefined && (
                            <div className="flex items-center" title={`HP: ${p.hp}`}>
                              <Heart className="h-3.5 w-3.5 mr-0.5 text-destructive" />
                              <span>{p.hp}</span>
                            </div>
                          )}
                          {p.ac !== undefined && (
                            <div className="flex items-center" title={`AC: ${p.ac}`}>
                              <ShieldIcon className="h-3.5 w-3.5 mr-0.5 text-[hsl(var(--app-blue-bg))]" />
                             <span>{p.ac}</span>
                            </div>
                          )}
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-md text-xs whitespace-nowrap",
                            p.type === 'player' ? 'bg-[hsl(var(--player-green-bg))] text-[hsl(var(--player-green-foreground))]' :
                            p.type === 'enemy' ? 'bg-destructive text-destructive-foreground' :
                            p.type === 'ally' ? 'bg-[hsl(var(--app-blue-bg))] text-[hsl(var(--app-blue-foreground))]' :
                            'bg-gray-500 text-white'
                          )}>
                            {p.type.charAt(0).toUpperCase() + p.type.slice(1)}
                          </span>
                        </div>

                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="group/optionsButton h-7 w-7 shrink-0 hover:bg-sidebar-accent"
                              aria-label={`Options for ${p.name}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4 text-muted-foreground group-hover/optionsButton:text-primary-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-1" side="bottom" align="end">
                            {onMoveParticipantUp && (
                              <Button
                                variant="ghost"
                                className="w-full justify-start h-8 px-2 text-sm flex items-center"
                                onClick={() => onMoveParticipantUp(p.id)}
                                disabled={index === 0}
                              >
                                <ArrowUpCircle className="mr-2 h-3.5 w-3.5" /> Move Up
                              </Button>
                            )}
                            {onMoveParticipantDown && (
                               <Button
                                variant="ghost"
                                className="w-full justify-start h-8 px-2 text-sm flex items-center"
                                onClick={() => onMoveParticipantDown(p.id)}
                                disabled={index === participants.length - 1}
                              >
                                <ArrowDownCircle className="mr-2 h-3.5 w-3.5" /> Move Down
                              </Button>
                            )}
                            <Button variant="ghost" className="w-full justify-start h-8 px-2 text-sm flex items-center" onClick={() => handleRenameClick(p)}>
                              <Edit3 className="mr-2 h-3.5 w-3.5" /> Rename
                            </Button>
                            <Button variant="ghost" className="w-full justify-start h-8 px-2 text-sm flex items-center" onClick={() => handleChangeTokenClick(p)}>
                              <ImagePlus className="mr-2 h-3.5 w-3.5" /> Update Image
                            </Button>
                            {onOpenEditStatsDialogForParticipant && (
                              <Button variant="ghost" className="w-full justify-start h-8 px-2 text-sm flex items-center" onClick={() => handleEditStatsClick(p)}>
                                <SlidersVertical className="mr-2 h-3.5 w-3.5" /> Edit Stats
                              </Button>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </div>
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
