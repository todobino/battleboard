
'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, Grid2x2, MousePointerSquareDashed, Palette, Sword, Users } from 'lucide-react'; // Changed Fingerprint to Zap

interface WelcomeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const FeatureSection: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
  imageUrl: string;
  imageHint: string;
  imageAlt: string;
}> = ({ icon: Icon, title, description, imageUrl, imageHint, imageAlt }) => (
  <div className="mb-6 p-3 border border-border rounded-lg shadow-sm bg-card">
    <div className="flex items-center mb-2">
      <Icon className="h-6 w-6 mr-3 text-primary" />
      <h3 className="text-lg font-semibold text-primary-foreground">{title}</h3>
    </div>
    <div className="flex flex-col md:flex-row gap-4 items-center">
      <div className="md:w-2/3">
        <p className="text-sm text-muted-foreground mb-2">{description}</p>
      </div>
      <div className="md:w-1/3 flex justify-center">
        <Image
          src={imageUrl}
          alt={imageAlt}
          width={200}
          height={100}
          className="rounded-md object-cover shadow-md"
          data-ai-hint={imageHint}
        />
      </div>
    </div>
  </div>
);

export default function WelcomeDialog({ isOpen, onClose }: WelcomeDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent data-welcome={true} className="sm:max-w-[650px] p-0 max-h-[90vh] flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader data-welcome-header={true} className="p-6 pb-4 border-b border-border">
          <DialogTitle data-welcome-title={true} className="text-2xl font-bold flex items-center">
            <Sword className="h-7 w-7 mr-3 text-primary" /> Welcome to the Battle Board!
          </DialogTitle>
          <DialogDescription data-welcome-description={true} className="text-sm">
            Your digital tabletop awaits! Here’s a quick guide to get you started on your epic adventures.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea data-welcome-scroll-area={true} className="flex-grow overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            <FeatureSection
              icon={MousePointerSquareDashed}
              title="Navigate Your World"
              description="Pan across the map by clicking and dragging with the Select tool (or middle mouse button). Zoom in and out using your mouse wheel or the +/- buttons on the bottom right."
              imageUrl="https://placehold.co/300x150.png"
              imageHint="map grid scroll"
              imageAlt="Grid navigation placeholder"
            />
            <FeatureSection
              icon={Grid2x2}
              title="Customize Your Map"
              description="Use the 'Map Tool' in the top toolbar to upload custom backgrounds, select from default maps, or toggle grid lines. Adjust background zoom for the perfect fit."
              imageUrl="https://placehold.co/300x150.png"
              imageHint="map settings background"
              imageAlt="Map customization placeholder"
            />
            <FeatureSection
              icon={Users}
              title="Manage Tokens"
              description="Add player, enemy, or ally tokens using the 'Tokens Tool'. Click on a token to rename, change its image, or delete it. Drag tokens to move them around the grid."
              imageUrl="https://placehold.co/300x150.png"
              imageHint="boardgame miniatures tokens"
              imageAlt="Token management placeholder"
            />
            <FeatureSection
              icon={Palette}
              title="Draw & Annotate"
              description="Use the 'Brush Tool' to color cells, the 'Shape Tool' to draw lines, circles, and squares, and the 'Type Tool' to add text bubbles. The 'Eraser' cleans up your creations."
              imageUrl="https://placehold.co/300x150.png"
              imageHint="drawing tools palette"
              imageAlt="Drawing tools placeholder"
            />
             <FeatureSection
              icon={Zap} // Icon changed here
              title="Track Initiative"
              description="The right sidebar is your Initiative Tracker. Add combatants, set their initiative, HP, and AC. Start combat to cycle through turns and manage rounds."
              imageUrl="https://placehold.co/300x150.png"
              imageHint="fantasy combat characters"
              imageAlt="Initiative tracker placeholder"
            />
          </div>
        </ScrollArea>

        <DialogFooter data-welcome-footer={true} className="p-6 pt-4 border-t border-border">
          <Button
            onClick={onClose}
            size="lg"
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Start Your Adventure!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

