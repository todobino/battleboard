import type { Point } from '@/types';

/**
 * Calculates the Euclidean distance between two points.
 * @param p1 The first point.
 * @param p2 The second point.
 * @returns The distance between p1 and p2.
 */
export function calculateDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the radius if p1 is center and p2 is on circumference.
 * This is identical to calculateDistance.
 * @param center The center point of the circle.
 * @param edgePoint A point on the circumference of the circle.
 * @returns The radius of the circle.
 */
export function calculateRadius(center: Point, edgePoint: Point): number {
  return calculateDistance(center, edgePoint);
}

/**
 * Snaps a screen coordinate to the nearest grid intersection or cell center.
 * @param screenPos The screen coordinate.
 * @param cellSize The size of each grid cell in screen units.
 * @param snapToCenter If true, snaps to cell center, otherwise to grid lines (intersections).
 * @returns The snapped grid coordinate.
 */
export function snapToGrid(screenPos: Point, cellSize: number, snapToCenter: boolean = false): Point {
  if (snapToCenter) {
    return {
      x: Math.floor(screenPos.x / cellSize) * cellSize + cellSize / 2,
      y: Math.floor(screenPos.y / cellSize) * cellSize + cellSize / 2,
    };
  }
  return {
    x: Math.round(screenPos.x / cellSize) * cellSize,
    y: Math.round(screenPos.y / cellSize) * cellSize,
  };
}

/**
 * Converts screen coordinates to grid cell indices.
 * @param screenPos The screen coordinate.
 * @param cellSize The size of each grid cell in screen units.
 * @returns The grid cell indices {x, y}.
 */
export function screenToGridCoords(screenPos: Point, cellSize: number): Point {
  return {
    x: Math.floor(screenPos.x / cellSize),
    y: Math.floor(screenPos.y / cellSize),
  };
}
