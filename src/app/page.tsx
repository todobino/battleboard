
import fs from 'fs';
import path from 'path';
import BattleBoardPage from '@/components/pages/battle-board-page';
import type { DefaultBattleMap } from '@/types';

// Helper function to format map names from filenames
const formatMapName = (filename: string): string => {
  return filename
    .split('.')[0] // Remove extension
    .replace(/-/g, ' ') // Replace hyphens with spaces
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize each word
};

export default async function Home() {
  let defaultBattlemaps: DefaultBattleMap[] = [];
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];

  try {
    const mapsDirectory = path.join(process.cwd(), 'public', 'default-maps');
    const filenames = fs.readdirSync(mapsDirectory);

    defaultBattlemaps = filenames
      .filter(filename => imageExtensions.some(ext => filename.toLowerCase().endsWith(ext)))
      .map(filename => ({
        name: formatMapName(filename),
        url: `/default-maps/${filename}`, // Path relative to /public
        hint: formatMapName(filename).toLowerCase().split(' ').slice(0, 2).join(' '), // Generate a simple hint
      }));
  } catch (error) {
    console.error("Failed to read default maps directory. Ensure 'public/default-maps' exists and contains images.", error);
    // Fallback to a minimal set or an empty array if dynamic loading fails
    // You can provide a few hardcoded fallbacks here if desired, e.g.:
    // defaultBattlemaps = [
    //   { name: 'Bridge', url: '/default-maps/bridge.png', hint: 'bridge map' },
    //   { name: 'Glade', url: '/default-maps/glade.png', hint: 'glade clearing' },
    // ];
  }

  return <BattleBoardPage defaultBattlemaps={defaultBattlemaps} />;
}
