
'use client';

import type { Token, ActiveTool, Point } from '@/types';
import type { LucideProps } from 'lucide-react';
import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

const GHOST_TOKEN_OPACITY = 0.4;

interface TokensLayerProps {
  tokens: Token[];
  cellSize: number;
  draggingToken: Token | null;
  draggedTokenVisualPosition: Point | null; // Snapped visual SVG position
  ghostToken: Token | null;
  movementMeasureLine: { startSvgCenter: Point; currentSvgCenter: Point; distanceText: string } | null;
  editingTokenId: string | null;
  editingText: string;
  setEditingText: (text: string) => void;
  handleSaveTokenName: () => void;
  handleEditInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  activeTurnTokenId: string | null;
  selectedTokenId: string | null;
  hoveredTokenId: string | null;
  setHoveredTokenId: (id: string | null) => void;
  showAllLabels: boolean;
  activeTool: ActiveTool;
  onTokenLabelClick: (event: React.MouseEvent, token: Token) => void;
  rightClickPopoverStateActive: boolean; // To disable cursor changes if popover is open
}

export default function TokensLayer({
  tokens,
  cellSize,
  draggingToken,
  draggedTokenVisualPosition,
  ghostToken,
  movementMeasureLine,
  editingTokenId,
  editingText,
  setEditingText,
  handleSaveTokenName,
  handleEditInputKeyDown,
  activeTurnTokenId,
  selectedTokenId,
  hoveredTokenId,
  setHoveredTokenId,
  showAllLabels,
  activeTool,
  onTokenLabelClick,
  rightClickPopoverStateActive,
}: TokensLayerProps) {
  const foreignObjectInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editingTokenId && foreignObjectInputRef.current) {
      const timerId = setTimeout(() => {
        foreignObjectInputRef.current?.focus();
        foreignObjectInputRef.current?.select();
      }, 0);
      return () => clearTimeout(timerId);
    }
  }, [editingTokenId]);


  const renderTokenContent = (token: Token, isGhost: boolean = false) => {
    const IconComponent = token.icon as React.FC<LucideProps & { x?: number; y?: number; width?: string | number; height?: string | number; color?: string }>;
    const tokenActualSize = token.size || 1;
    const iconDisplaySize = tokenActualSize * cellSize * 0.8;
    const iconOffset = (tokenActualSize * cellSize - iconDisplaySize) / 2;
    const imageDisplaySize = tokenActualSize * cellSize * 0.95;
    const imageOffset = (tokenActualSize * cellSize - imageDisplaySize) / 2;
    let backgroundFill = token.color;

    if (!token.customImageUrl) {
      switch (token.type) {
        case 'player': backgroundFill = 'hsl(var(--player-green-bg))'; break;
        case 'enemy': backgroundFill = 'hsl(var(--destructive))'; break;
        case 'ally': backgroundFill = 'hsl(var(--app-blue-bg))'; break;
        case 'item': backgroundFill = token.color || 'hsl(270, 40%, 30%)'; break;
        case 'terrain': backgroundFill = token.color || 'hsl(var(--muted))'; break;
        case 'generic': backgroundFill = token.color || 'hsl(var(--accent))'; break;
        default: backgroundFill = token.color || 'black';
      }
    }
    
    const clipPathId = isGhost ? `clip-ghost-${token.id}` : `clip-${token.id}`;

    return (
      <>
        <circle
          cx={tokenActualSize * cellSize / 2}
          cy={tokenActualSize * cellSize / 2}
          r={tokenActualSize * cellSize / 2}
          fill={backgroundFill}
          stroke={isGhost ? 'hsl(var(--primary-foreground))' : (selectedTokenId === token.id || activeTurnTokenId === token.id ? 'hsl(var(--ring))' : 
                    hoveredTokenId === token.id && activeTool === 'select' && !editingTokenId && !rightClickPopoverStateActive ? 'hsl(var(--accent))' : 'hsl(var(--primary-foreground))')}
          strokeWidth={isGhost ? 1 : (selectedTokenId === token.id || activeTurnTokenId === token.id ? 2 : 1)}
        />
        {token.customImageUrl ? (
          <>
            <image
              href={token.customImageUrl}
              x={imageOffset}
              y={imageOffset}
              width={imageDisplaySize}
              height={imageDisplaySize}
              clipPath={`url(#${clipPathId})`}
              className={cn(!isGhost && !editingTokenId && activeTool === 'select' ? "pointer-events-auto" : "pointer-events-none")}
            />
            <circle
              cx={tokenActualSize * cellSize / 2}
              cy={tokenActualSize * cellSize / 2}
              r={tokenActualSize * cellSize / 2 * 0.95}
              fill="none"
              strokeWidth="1.5"
              stroke={'hsl(var(--primary-foreground))'}
              className="pointer-events-none"
            />
          </>
        ) : IconComponent ? (
          <IconComponent
            x={iconOffset}
            y={iconOffset}
            width={iconDisplaySize}
            height={iconDisplaySize}
            color={'hsl(var(--primary-foreground))'}
            strokeWidth={1.5}
            className={cn(!isGhost && !editingTokenId && activeTool === 'select' ? "pointer-events-auto" : "pointer-events-none")}
          />
        ) : null}
      </>
    );
  };

  return (
    <g>
      {/* Ghost Token */}
      {ghostToken && (
        <g
          transform={`translate(${ghostToken.x * cellSize}, ${ghostToken.y * cellSize})`}
          opacity={GHOST_TOKEN_OPACITY}
          className="pointer-events-none"
        >
          {renderTokenContent(ghostToken, true)}
        </g>
      )}

      {/* Actual Tokens */}
      {tokens.map(token => {
        const tokenActualSize = token.size || 1;
        const isCurrentlyEditingThisToken = editingTokenId === token.id;
        const isTokenLabelVisible = showAllLabels || selectedTokenId === token.id;
        const fixedInputWidth = cellSize * 4;
        const fixedInputHeight = 20;

        let currentTransform: string;
        if (draggingToken && token.id === draggingToken.id && draggedTokenVisualPosition) {
          currentTransform = `translate(${draggedTokenVisualPosition.x}, ${draggedTokenVisualPosition.y})`;
        } else {
          currentTransform = `translate(${token.x * cellSize}, ${token.y * cellSize})`;
        }

        return (
          <g
            key={token.id}
            transform={currentTransform}
            onMouseEnter={() => setHoveredTokenId(token.id)}
            onMouseLeave={() => setHoveredTokenId(null)}
            className={cn(
              'origin-center',
              activeTool === 'select' && !isCurrentlyEditingThisToken && !draggingToken && !rightClickPopoverStateActive && 'cursor-pointer',
              activeTool === 'select' && draggingToken?.id === token.id && !isCurrentlyEditingThisToken && 'cursor-grabbing',
              isCurrentlyEditingThisToken && 'cursor-text',
              'drop-shadow-md'
            )}
          >
            {renderTokenContent(token)}

            {token.instanceName && !isCurrentlyEditingThisToken && isTokenLabelVisible && (
              <text
                x={tokenActualSize * cellSize / 2}
                y={tokenActualSize * cellSize + 10}
                textAnchor="middle"
                dominantBaseline="hanging"
                fontSize="10"
                fontFamily="sans-serif"
                fontWeight="bold"
                fill="hsl(var(--foreground))"
                stroke="black"
                strokeWidth="1.25px"
                paintOrder="stroke"
                filter="url(#blurryTextDropShadow)"
                className={cn(
                  activeTool === 'select' && !rightClickPopoverStateActive ? "cursor-text" : "cursor-default",
                  "select-none"
                )}
                onClick={(e) => { if (!rightClickPopoverStateActive) onTokenLabelClick(e, token); }}
              >
                {token.instanceName}
              </text>
            )}
            {isCurrentlyEditingThisToken && (
              <foreignObject
                x={(tokenActualSize * cellSize / 2) - (fixedInputWidth / 2)}
                y={tokenActualSize * cellSize + 2}
                width={fixedInputWidth}
                height={fixedInputHeight}
              >
                <input
                  ref={foreignObjectInputRef}
                  type="text"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onBlur={handleSaveTokenName}
                  onKeyDown={handleEditInputKeyDown}
                  style={{
                    background: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '3px',
                    fontSize: '10px',
                    padding: '2px 4px',
                    width: '100%',
                    textAlign: 'center',
                    outline: 'none',
                  }}
                  onWheelCapture={(e) => e.stopPropagation()}
                />
              </foreignObject>
            )}
          </g>
        );
      })}

       {/* Movement Measure Line - should be on top of tokens */}
       {movementMeasureLine && draggingToken && ghostToken && ['player', 'enemy', 'ally'].includes(ghostToken.type) && (
          <g stroke="hsl(var(--accent))" strokeWidth="2" fill="none" className="pointer-events-none">
            <line
              x1={movementMeasureLine.startSvgCenter.x}
              y1={movementMeasureLine.startSvgCenter.y}
              x2={movementMeasureLine.currentSvgCenter.x}
              y2={movementMeasureLine.currentSvgCenter.y}
              strokeDasharray="3 3"
            />
            <text
              x={movementMeasureLine.currentSvgCenter.x + 8}
              y={movementMeasureLine.currentSvgCenter.y + 8}
              fill="hsl(var(--accent))"
              fontSize="14"
              paintOrder="stroke"
              stroke="hsl(var(--background))"
              strokeWidth="2.5px"
              className="select-none font-semibold"
            >
              {movementMeasureLine.distanceText}
            </text>
          </g>
        )}
    </g>
  );
}
