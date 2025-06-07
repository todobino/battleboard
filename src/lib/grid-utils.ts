
import type { Point, Token } from '@/types';

/**
 * Snaps a position to the center of the nearest grid cell.
 * @param pos The position to snap.
 * @param cellSize The size of each grid cell.
 * @returns The snapped position (center of a cell).
 */
export const snapToCellCenter = (pos: Point, cellSize: number): Point => ({
  x: Math.floor(pos.x / cellSize) * cellSize + cellSize / 2,
  y: Math.floor(pos.y / cellSize) * cellSize + cellSize / 2,
});

/**
 * Snaps a position to the nearest grid vertex (intersection of grid lines).
 * @param pos The position to snap.
 * @param cellSize The size of each grid cell.
 * @returns The snapped position (a grid vertex).
 */
export const snapToVertex = (pos: Point, cellSize: number): Point => ({
  x: Math.round(pos.x / cellSize) * cellSize,
  y: Math.round(pos.y / cellSize) * cellSize,
});

/**
 * Checks if a target square (defined by top-left corner and size) is occupied by any token
 * or if it's out of grid bounds.
 * @param targetX The target X grid coordinate (top-left of the area to check).
 * @param targetY The target Y grid coordinate (top-left of the area to check).
 * @param tokenSizeToCheck The size of the token/area to check (in grid units, e.g., 1 for 1x1, 2 for 2x2).
 * @param tokens Array of all tokens currently on the grid.
 * @param numCols Total number of columns in the grid.
 * @param numRows Total number of rows in the grid.
 * @param excludeTokenId Optional ID of a token to exclude from the occupation check (e.g., the token being moved).
 * @returns True if the square is occupied or out of bounds, false otherwise.
 */
export function isSquareOccupied(
  targetX: number,
  targetY: number,
  tokenSizeToCheck: number,
  tokens: Token[],
  numCols: number,
  numRows: number,
  excludeTokenId?: string
): boolean {
  // Check grid boundaries for the entire token area
  if (targetX < 0 || targetX + tokenSizeToCheck > numCols || targetY < 0 || targetY + tokenSizeToCheck > numRows) {
    return true; // Occupied by being out of bounds
  }

  for (const token of tokens) {
    if (token.id === excludeTokenId) continue;

    const existingTokenSize = token.size || 1;
    
    // Check for overlap by comparing the bounding boxes of the two tokens
    if (targetX < token.x + existingTokenSize &&
        targetX + tokenSizeToCheck > token.x &&
        targetY < token.y + existingTokenSize &&
        targetY + tokenSizeToCheck > token.y) {
      return true; // Overlap detected
    }
  }
  return false; // No overlap with any other token and within bounds
}


/**
 * Finds an available square on the grid for placing a token, starting from a preferred location
 * and searching outwards in a spiral pattern if the preferred spot is occupied.
 * @param preferredX The preferred X grid coordinate to place the token.
 * @param preferredY The preferred Y grid coordinate to place the token.
 * @param tokenSizeToPlace The size of the token to place (in grid units).
 * @param tokens Array of all tokens currently on the grid.
 * @param numCols Total number of columns in the grid.
 * @param numRows Total number of rows in the grid.
 * @param excludeTokenId Optional ID of a token to exclude from occupation checks.
 * @returns The coordinates {x, y} of an available square, or null if no square is found.
 */
export function findAvailableSquare(
  preferredX: number,
  preferredY: number,
  tokenSizeToPlace: number,
  tokens: Token[],
  numCols: number,
  numRows: number,
  excludeTokenId?: string
): Point | null {
  // Check preferred square first
  if (!isSquareOccupied(preferredX, preferredY, tokenSizeToPlace, tokens, numCols, numRows, excludeTokenId)) {
    return { x: preferredX, y: preferredY };
  }

  // Spiral search outwards
  // Limit search radius to prevent infinite loops on a full grid.
  const maxSearchRadius = Math.max(numCols, numRows, 20); // Added a practical limit

  for (let radius = 1; radius <= maxSearchRadius; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        // Only check the perimeter of the current radius square
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
          continue;
        }
        const checkX = preferredX + dx;
        const checkY = preferredY + dy;

        // Ensure the check is within reasonable bounds before calling isSquareOccupied
        // Check if the top-left of the token is within bounds, and bottom-right is also within bounds.
        if (checkX < 0 || checkX + tokenSizeToPlace > numCols ||
            checkY < 0 || checkY + tokenSizeToPlace > numRows) {
          continue; // Skip if any part of the token would be out of bounds
        }
        
        if (!isSquareOccupied(checkX, checkY, tokenSizeToPlace, tokens, numCols, numRows, excludeTokenId)) {
          return { x: checkX, y: checkY };
        }
      }
    }
  }
  return null; // No available square found
}
