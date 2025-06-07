
'use client';

import type { Token } from '@/types';
import React from 'react';

interface BattleGridDefsProps {
  tokens: Token[];
  ghostToken: Token | null;
  cellSize: number;
}

export default function BattleGridDefs({ tokens, ghostToken, cellSize }: BattleGridDefsProps) {
  return (
    <defs>
      {tokens.map(token => {
        const tokenActualSize = (token.size || 1);
        return token.customImageUrl ? (
          <clipPath key={`clip-${token.id}`} id={`clip-${token.id}`}>
            <circle
              cx={tokenActualSize * cellSize / 2}
              cy={tokenActualSize * cellSize / 2}
              r={tokenActualSize * cellSize / 2 * 0.95}
            />
          </clipPath>
        ) : null;
      })}
      {ghostToken && ghostToken.customImageUrl && (
        <clipPath key={`clip-ghost-${ghostToken.id}`} id={`clip-ghost-${ghostToken.id}`}>
          <circle
            cx={(ghostToken.size || 1) * cellSize / 2}
            cy={(ghostToken.size || 1) * cellSize / 2}
            r={(ghostToken.size || 1) * cellSize / 2 * 0.95}
          />
        </clipPath>
      )}
      <marker id="arrowhead" markerWidth="12" markerHeight="8.4" refX="11.5" refY="4.2" orient="auto">
        <polygon points="0 0, 12 4.2, 0 8.4" fill="hsl(var(--accent))" />
      </marker>
      <filter id="blurryTextDropShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="1" dy="1" stdDeviation="0.75" floodColor="#000000" floodOpacity="0.6" />
      </filter>
    </defs>
  );
}
