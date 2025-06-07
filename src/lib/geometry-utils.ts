
import type { Point } from '@/types';

/**
 * Calculates the square of the Euclidean distance between two points.
 * Avoids sqrt for performance-sensitive comparisons.
 * @param v The first point.
 * @param w The second point.
 * @returns The squared distance between v and w.
 */
export function dist2(v: Point, w: Point): number {
  return (v.x - w.x)**2 + (v.y - w.y)**2;
}

/**
 * Calculates the square of the distance from a point p to a line segment vw.
 * @param p The point.
 * @param v The start point of the line segment.
 * @param w The end point of the line segment.
 * @returns The squared distance from p to the segment vw.
 */
export function distToSegmentSquared(p: Point, v: Point, w: Point): number {
  const l2 = dist2(v, w);
  if (l2 === 0) return dist2(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

/**
 * Calculates the distance from a point (px, py) to a line segment (x1,y1)-(x2,y2).
 * @param px X-coordinate of the point.
 * @param py Y-coordinate of the point.
 * @param x1 X-coordinate of the segment's start point.
 * @param y1 Y-coordinate of the segment's start point.
 * @param x2 X-coordinate of the segment's end point.
 * @param y2 Y-coordinate of the segment's end point.
 * @returns The distance from the point to the line segment.
 */
export function distanceToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(distToSegmentSquared({ x: px, y: py }, { x: x1, y: y1 }, { x: x2, y: y2 }));
}

/**
 * Checks if a point is inside or on the circumference of a circle.
 * @param point The point to check.
 * @param circleCenter The center of the circle.
 * @param radius The radius of the circle.
 * @returns True if the point is in the circle, false otherwise.
 */
export function isPointInCircle(point: Point, circleCenter: Point, radius: number): boolean {
  return dist2(point, circleCenter) <= radius**2;
}

/**
 * Checks if a point is inside or on the boundary of a rectangle.
 * @param point The point to check.
 * @param rectX The x-coordinate of the rectangle's top-left corner.
 * @param rectY The y-coordinate of the rectangle's top-left corner.
 * @param rectWidth The width of the rectangle.
 * @param rectHeight The height of the rectangle.
 * @returns True if the point is in the rectangle, false otherwise.
 */
export function isPointInRectangle(point: Point, rectX: number, rectY: number, rectWidth: number, rectHeight: number): boolean {
  return point.x >= rectX && point.x <= rectX + rectWidth && point.y >= rectY && point.y <= rectY + rectHeight;
}

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

/**
 * Measures text dimensions using a temporary span.
 * @param text The text to measure.
 * @param fontSize The font size in pixels.
 * @returns The width and height of the text.
 */
export function measureText(text: string, fontSize: number): { width: number; height: number } {
    if (typeof document === 'undefined') return { width: 0, height: 0}; // Guard for SSR or non-browser environments
    const tempSpan = document.createElement('span');
    document.body.appendChild(tempSpan);
    // Ensure font style matches how it's rendered in SVG for accuracy
    tempSpan.style.fontFamily = 'sans-serif'; // Or a more specific font if used
    tempSpan.style.fontSize = `${fontSize}px`;
    tempSpan.style.fontWeight = 'normal'; // Or 'bold' if text is bolded
    tempSpan.style.whiteSpace = 'nowrap';
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.textContent = text || " "; // Ensure textContent is not empty for measurement
    const width = tempSpan.offsetWidth;
    const height = tempSpan.offsetHeight;
    document.body.removeChild(tempSpan);
    return { width, height };
  }
