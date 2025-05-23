import React from 'react';
import { CircleUserRound, Swords, Box, Mountain, HelpCircle } from 'lucide-react'; // Changed ShieldAlert to Swords

export const PlayerIcon = CircleUserRound;
export const EnemyIcon = Swords; // Changed from ShieldAlert
export const ItemIcon = Box;
export const TerrainIcon = Mountain;
export const GenericTokenIcon = HelpCircle;

// Example of a simple custom SVG icon if needed
export const ColoredCircleIcon = ({ className, color = 'currentColor' }: { className?: string, color?: string }) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="50" cy="50" r="45" fill={color} />
  </svg>
);
