import { describe, expect, it } from "vitest";
import {
  BUBBLE_SIZE,
  bubbleBounds,
  clampBubble,
  placeOpenWidget,
  snapBubble,
  type Point,
  type Viewport,
} from "../../widget-src/layout";

describe("widget bubble layout", () => {
  const viewport = { width: 390, height: 844 };

  it("keeps the bubble on screen and snaps within one rem of each edge", () => {
    const bounds = bubbleBounds(viewport);
    expect(clampBubble({ x: -40, y: 900 }, viewport)).toEqual({ x: 0, y: bounds.y });
    expect(snapBubble({ x: 15, y: bounds.y - 15 }, viewport)).toEqual({
      x: 0,
      y: bounds.y,
    });
    expect(snapBubble({ x: bounds.x - 15, y: 15 }, viewport)).toEqual({
      x: bounds.x,
      y: 0,
    });
    expect(snapBubble({ x: 16, y: bounds.y - 16 }, viewport)).toEqual({
      x: 16,
      y: bounds.y - 16,
    });
    expect(snapBubble({ x: 20, y: 20 }, viewport)).toEqual({ x: 20, y: 20 });
  });

  it("uses the host site's rem size for edge snapping", () => {
    expect(snapBubble({ x: 19, y: 20 }, viewport, 20)).toEqual({ x: 0, y: 20 });
  });
});

describe("widget chat panel layout", () => {
  const devices: Viewport[] = [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];

  it.each(devices)("fits within a $width by $height viewport at every bubble edge", (viewport) => {
    const bounds = bubbleBounds(viewport);
    const fractions = [0, 0.25, 0.5, 0.75, 1];
    const positions: Point[] = fractions.flatMap((x) =>
      fractions.map((y) => ({ x: bounds.x * x, y: bounds.y * y })),
    );

    for (const position of positions) {
      const { frame, bubble } = placeOpenWidget(position, viewport);
      expect(frame.x).toBeGreaterThanOrEqual(0);
      expect(frame.y).toBeGreaterThanOrEqual(0);
      expect(frame.width).toBeGreaterThan(0);
      expect(frame.height).toBeGreaterThan(0);
      expect(frame.x + frame.width).toBeLessThanOrEqual(viewport.width);
      expect(frame.y + frame.height).toBeLessThanOrEqual(viewport.height);
      expect(bubble.x).toBeGreaterThanOrEqual(0);
      expect(bubble.y).toBeGreaterThanOrEqual(0);
      expect(bubble.x + BUBBLE_SIZE).toBeLessThanOrEqual(viewport.width);
      expect(bubble.y + BUBBLE_SIZE).toBeLessThanOrEqual(viewport.height);

      const overlapWidth = Math.max(
        0,
        Math.min(frame.x + frame.width, bubble.x + BUBBLE_SIZE) - Math.max(frame.x, bubble.x),
      );
      const overlapHeight = Math.max(
        0,
        Math.min(frame.y + frame.height, bubble.y + BUBBLE_SIZE) - Math.max(frame.y, bubble.y),
      );
      expect(overlapWidth * overlapHeight).toBe(BUBBLE_SIZE * 8);
    }
  });

  it("opens above a bubble at the bottom of a phone screen", () => {
    const viewport = { width: 390, height: 844 };
    const bounds = bubbleBounds(viewport);
    const resting = { x: bounds.x, y: bounds.y };
    const { frame, bubble } = placeOpenWidget(resting, viewport);
    expect(frame.width).toBe(366);
    expect(frame.height).toBe(680);
    expect(bubble.y).toBe(frame.y + frame.height - 8);
    expect(bubble).not.toEqual(resting);
  });

  it("uses the side of a centered bubble in landscape", () => {
    const viewport = { width: 844, height: 390 };
    const { frame, bubble } = placeOpenWidget({ x: 380, y: 160 }, viewport);
    expect(frame.width).toBe(420);
    expect(frame.height).toBe(366);
    expect(bubble.x === frame.x + frame.width - 8 || bubble.x + BUBBLE_SIZE === frame.x + 8).toBe(
      true,
    );
  });

  it("keeps the panel usable on a short screen", () => {
    const { frame } = placeOpenWidget({ x: 132, y: 132 }, { width: 320, height: 320 });
    expect(frame.width).toBe(296);
    expect(frame.height).toBe(248);
  });
});
