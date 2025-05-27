
import React from 'react';
import { UserRound, Swords, Box, Mountain, HelpCircle, Shield } from 'lucide-react'; // Changed CircleUserRound to UserRound

export const PlayerIcon = UserRound; // Updated to UserRound
export const EnemyIcon = Swords;
export const AllyIcon = Shield;
export const ItemIcon = Box;
export const TerrainIcon = Mountain;
export const GenericTokenIcon = HelpCircle;

// Example of a simple custom SVG icon if needed
export const ColoredCircleIcon = ({ className, color = 'currentColor' }: { className?: string, color?: string }) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="50" cy="50" r="45" fill={color} />
  </svg>
);
