
'use client';

import type { TokenType, DrawnShape, TextObjectType, Participant } from '@/types';
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Edit3, Trash2, ImageIcon, Users, SlidersVertical, Plus, Minus, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dist2 } from '@/lib/geometry-utils';

const FEET_PER_SQUARE = 5; // Define if not available globally

interface RightClickMenuProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  popoverState: {
    type: 'token' | 'shape' | 'text';
    item: TokenType | DrawnShape | TextObjectType;
    x: number; // clientX for positioning
    y: number; // clientY for positioning
  } | null;
  triggerRef: React.RefObject<HTMLButtonElement>;
  tokens: TokenType[]; // Needed for current token size
  drawnShapes: DrawnShape[]; // Needed for current shape opacity/lock
  participants: Participant[]; // To check if token is linked
  cellSize: number; // For shape radius calculation

  // Token Actions
  onOpenAddCombatantDialogForToken?: (token: TokenType) => void;
  onEditTokenName: (tokenId: string, currentName: string) => void;
  onOpenEditStatsDialogForToken?: (tokenId: string) => void;
  onTokenImageChangeRequest?: (tokenId: string) => void;
  onChangeTokenSize?: (tokenId: string, newSize: number) => void;
  onTokenDelete?: (tokenId: string) => void;

  // Text Object Actions
  onEditTextObject: (textObj: TextObjectType) => void;
  onDeleteTextObject: (textObjId: string) => void;

  // Shape Actions
  onToggleShapeLock?: (shapeId: string) => void;
  onSetShapeOpacity?: (shapeId: string, opacity: number) => void;
  onShapeRadiusChange?: (shapeId: string, newRadiusInFeet: string) => void;
  onEditShapeLabel?: (shape: DrawnShape) => void;
  onDeleteShape?: (shapeId: string) => void;
}

export default function RightClickMenu({
  isOpen,
  onOpenChange,
  popoverState,
  triggerRef,
  tokens,
  drawnShapes,
  participants,
  cellSize,
  onOpenAddCombatantDialogForToken,
  onEditTokenName,
  onOpenEditStatsDialogForToken,
  onTokenImageChangeRequest,
  onChangeTokenSize,
  onTokenDelete,
  onEditTextObject,
  onDeleteTextObject,
  onToggleShapeLock,
  onSetShapeOpacity,
  onShapeRadiusChange,
  onEditShapeLabel,
  onDeleteShape,
}: RightClickMenuProps) {
  const [shapeRadiusInput, setShapeRadiusInput] = useState<string>('');

  useEffect(() => {
    if (popoverState?.type === 'shape') {
      const shape = popoverState.item as DrawnShape;
      if (shape.type === 'circle') {
        const pixelRadius = Math.sqrt(dist2(shape.startPoint, shape.endPoint));
        const radiusInFeet = (pixelRadius / cellSize) * FEET_PER_SQUARE;
        setShapeRadiusInput(String(Math.round(radiusInFeet)));
      } else {
        setShapeRadiusInput('');
      }
    }
  }, [popoverState, cellSize]);

  if (!popoverState) return null;

  const { type, item } = popoverState;

  const handleLocalShapeRadiusChange = (newRadiusString: string) => {
    setShapeRadiusInput(newRadiusString); // Update local state immediately for responsiveness
    if (onShapeRadiusChange && type === 'shape') {
        onShapeRadiusChange((item as DrawnShape).id, newRadiusString);
    }
  };

  const handleLocalShapeRadiusBlur = () => {
    if (type === 'shape') {
        const currentShape = drawnShapes.find(s => s.id === (item as DrawnShape).id);
        if (currentShape && currentShape.type === 'circle') {
            const newRadiusInFeet = parseFloat(shapeRadiusInput);
            if (isNaN(newRadiusInFeet) || newRadiusInFeet < (FEET_PER_SQUARE / 2)) {
                const currentPixelRadius = Math.sqrt(dist2(currentShape.startPoint, currentShape.endPoint));
                const currentRadiusInFeet = (currentPixelRadius / cellSize) * FEET_PER_SQUARE;
                setShapeRadiusInput(String(Math.max(FEET_PER_SQUARE / 2, Math.round(currentRadiusInFeet) )));
                // Optionally call onShapeRadiusChange here again to ensure parent state matches
                if (onShapeRadiusChange) {
                    onShapeRadiusChange(currentShape.id, String(Math.max(FEET_PER_SQUARE / 2, Math.round(currentRadiusInFeet) )));
                }
            }
        }
    }
  };


  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px' }}
          aria-hidden="true"
        />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        className="w-auto p-1"
        key={`popover-${item.id}-${type === 'token' ? (tokens.find(t => t.id === (item as TokenType).id)?.size) : type === 'shape' ? `${(item as DrawnShape).opacity}-${(item as DrawnShape).isLocked}` : ''}`}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {type === 'token' && (() => {
          const currentToken = tokens.find(t => t.id === (item as TokenType).id) || (item as TokenType);
          const tokenSize = currentToken.size || 1;
          const isLinked = participants.some(p => p.tokenId === currentToken.id);
          return (
            <div className="w-48">
              {onOpenAddCombatantDialogForToken && !isLinked && ['player', 'enemy', 'ally', 'generic'].includes(currentToken.type) && (
                <Button
                  variant="ghost" className="w-full justify-start h-8 px-2 text-sm flex items-center"
                  onClick={() => { onOpenAddCombatantDialogForToken(currentToken); onOpenChange(false); }}
                >
                  <Users className="mr-2 h-3.5 w-3.5" /> Add to Turn Order
                </Button>
              )}
              <Button
                variant="ghost" className="w-full justify-start h-8 px-2 text-sm flex items-center"
                onClick={() => { onEditTokenName(currentToken.id, currentToken.instanceName || ''); onOpenChange(false); }}
              >
                <Edit3 className="mr-2 h-3.5 w-3.5" /> Rename
              </Button>
              {onOpenEditStatsDialogForToken && isLinked && (
                <Button
                  variant="ghost" className="w-full justify-start h-8 px-2 text-sm flex items-center"
                  onClick={() => { onOpenEditStatsDialogForToken(currentToken.id); onOpenChange(false); }}
                >
                  <SlidersVertical className="mr-2 h-3.5 w-3.5" /> Edit Stats
                </Button>
              )}
              {onTokenImageChangeRequest && (
                <Button
                  variant="ghost" className="w-full justify-start h-8 px-2 text-sm flex items-center"
                  onClick={() => { onTokenImageChangeRequest(currentToken.id); onOpenChange(false); }}
                >
                  <ImageIcon className="mr-2 h-3.5 w-3.5" /> Change Image
                </Button>
              )}
              {onChangeTokenSize && (
                <div className="p-2 space-y-1 border-t border-b my-1">
                  <Label className="text-xs text-muted-foreground">Token Size</Label>
                  <div className="flex items-center space-x-1 justify-center">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onChangeTokenSize(currentToken.id, tokenSize - 1)} disabled={tokenSize <= 1}> <Minus className="h-3.5 w-3.5" /> </Button>
                    <span className="text-xs font-semibold w-12 text-center tabular-nums">{tokenSize}x{tokenSize}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onChangeTokenSize(currentToken.id, tokenSize + 1)} disabled={tokenSize >= 9}> <Plus className="h-3.5 w-3.5" /> </Button>
                  </div>
                </div>
              )}
              {onTokenDelete && (
                <Button
                  variant="ghost"
                  className={cn("w-full justify-start h-8 px-2 text-sm flex items-center", "text-destructive hover:bg-destructive hover:text-destructive-foreground")}
                  onClick={() => { onTokenDelete(currentToken.id); onOpenChange(false); }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                </Button>
              )}
            </div>
          );
        })()}

        {type === 'text' && (
          <div className="w-48">
            <Button
              variant="ghost" className="w-full justify-start h-8 px-2 text-sm flex items-center"
              onClick={() => { onEditTextObject(item as TextObjectType); onOpenChange(false); }}
            >
              <Edit3 className="mr-2 h-3.5 w-3.5" /> Edit Text
            </Button>
            <Button
              variant="ghost"
              className={cn("w-full justify-start h-8 px-2 text-sm flex items-center", "text-destructive hover:bg-destructive hover:text-destructive-foreground")}
              onClick={() => { onDeleteTextObject((item as TextObjectType).id); onOpenChange(false); }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Text
            </Button>
          </div>
        )}

        {type === 'shape' && (() => {
          const currentShape = drawnShapes.find(s => s.id === (item as DrawnShape).id) || (item as DrawnShape);
          return (
            <div className="w-60 p-2 space-y-2" key={`shape-popover-${currentShape.id}-${currentShape.opacity}-${currentShape.isLocked}`}>
              {currentShape.type === 'line' ? (
                <Button variant="ghost" className={cn("w-full justify-start h-8 px-2 text-sm flex items-center", "text-destructive hover:bg-destructive hover:text-destructive-foreground")}
                  onClick={() => { if(onDeleteShape) onDeleteShape(currentShape.id); onOpenChange(false); }}>
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Shape
                </Button>
              ) : (
                <>
                  {onToggleShapeLock && (
                    <Button variant="ghost" className="w-full justify-start h-8 px-2 text-sm flex items-center" onClick={() => onToggleShapeLock(currentShape.id)}>
                      {currentShape.isLocked ? <Unlock className="mr-2 h-3.5 w-3.5" /> : <Lock className="mr-2 h-3.5 w-3.5" />}
                      {currentShape.isLocked ? 'Unlock Shape' : 'Lock Shape'}
                    </Button>
                  )}
                  {onSetShapeOpacity && (
                    <div className="space-y-1 pt-1">
                      <Label className="text-xs">Shape Opacity</Label>
                      <div className="flex space-x-1">
                        {[1.0, 0.5, 0.1].map(opacityValue => (
                          <Button key={`opacity-${opacityValue}`} variant={((currentShape.opacity ?? 0.5) === opacityValue) ? 'default' : 'outline'} className="flex-1 h-8 text-xs"
                            onClick={() => onSetShapeOpacity(currentShape.id, opacityValue)}>
                            {`${(opacityValue * 100).toFixed(0)}%`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {currentShape.type === 'circle' && onShapeRadiusChange && (
                    <div className="space-y-1 pt-1">
                      <Label htmlFor={`shape-radius-input-${currentShape.id}`} className="text-xs flex items-center">Radius (ft)</Label>
                      <div className="flex items-center space-x-1">
                        <Button variant="outline" size="icon" className="h-8 w-8"
                          onClick={() => {
                            const currentFeet = parseFloat(shapeRadiusInput) || 0;
                            const newFeet = Math.max(FEET_PER_SQUARE / 2, currentFeet - FEET_PER_SQUARE);
                            handleLocalShapeRadiusChange(String(newFeet));
                          }}> <Minus className="h-4 w-4"/> </Button>
                        <Input id={`shape-radius-input-${currentShape.id}`} type="number" value={shapeRadiusInput}
                          onChange={(e) => setShapeRadiusInput(e.target.value)}
                          onBlur={handleLocalShapeRadiusBlur}
                          onKeyDown={(e) => { if (e.key === 'Enter') { handleLocalShapeRadiusChange(shapeRadiusInput); (e.target as HTMLInputElement).blur(); }}}
                          className="h-8 text-sm text-center w-16" min={FEET_PER_SQUARE / 2} step={FEET_PER_SQUARE}
                        />
                        <Button variant="outline" size="icon" className="h-8 w-8"
                           onClick={() => {
                            const currentFeet = parseFloat(shapeRadiusInput) || 0;
                            const newFeet = currentFeet + FEET_PER_SQUARE;
                            handleLocalShapeRadiusChange(String(newFeet));
                          }}> <Plus className="h-4 w-4"/> </Button>
                      </div>
                    </div>
                  )}
                  {onEditShapeLabel && (
                    <Button variant="ghost" className="w-full justify-start h-8 px-2 text-sm flex items-center !mt-3"
                      onClick={() => { onEditShapeLabel(currentShape); onOpenChange(false); }}>
                      <Edit3 className="mr-2 h-3.5 w-3.5" /> {currentShape.label ? 'Edit Label' : 'Add Label'}
                    </Button>
                  )}
                  {onDeleteShape && (
                    <Button variant="ghost" className={cn("w-full justify-start h-8 px-2 text-sm flex items-center mt-1", "text-destructive hover:bg-destructive hover:text-destructive-foreground")}
                      onClick={() => { onDeleteShape(currentShape.id); onOpenChange(false); }}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Shape
                    </Button>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </PopoverContent>
    </Popover>
  );
}
