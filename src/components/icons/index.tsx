import React from 'react';
import { UserRound, ShieldAlert, Circle, Mountain, Trees, Waves, HelpCircle, CircleUserRound, Box } from 'lucide-react';

export const PlayerIcon = CircleUserRound; // Changed from UserRound
export const EnemyIcon = ShieldAlert;
export const ItemIcon = Box; // Changed from Circle
export const TerrainIcon = Mountain; // Default terrain icon
export const GenericTokenIcon = HelpCircle;

// Example of a simple custom SVG icon if needed
export const ColoredCircleIcon = ({ className, color = 'currentColor' }: { className?: string, color?: string }) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="50" cy="50" r="45" fill={color} />
  </svg>
);
