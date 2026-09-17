import { describe, expect, it } from "vitest";
import {
  BUBBLE_SIZE,
  POINTER_GAP,
  bubbleBorderRadius,
  bubbleBounds,
  clampBubble,
  placeOpenWidget,
  snapBubble,
  type Point,
  type Viewport,
} from "../../widget-src/layout";

describe("widget bubble layout", () => {
  const viewport = { width: 390, height: 844 };

  it("keeps the bubble on screen and snaps at or within one rem of each edge", () => {
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
      x: 0,
      y: bounds.y,
    });
    expect(snapBubble({ x: 20, y: 20 }, viewport)).toEqual({ x: 20, y: 20 });
  });

  it("uses the host site's rem size for edge snapping", () => {
    expect(snapBubble({ x: 19, y: 21 }, viewport, 20)).toEqual({ x: 0, y: 21 });
  });

  it("squares only the corners touching a viewport edge", () => {
    const bounds = bubbleBounds(viewport);
    expect(bubbleBorderRadius({ x: 0, y: 300 }, viewport)).toBe("0 24px 24px 0");
    expect(bubbleBorderRadius({ x: bounds.x, y: 300 }, viewport)).toBe("24px 0 0 24px");
    expect(bubbleBorderRadius({ x: 0, y: 0 }, viewport)).toBe("0 0 24px 0");
    expect(bubbleBorderRadius({ x: 100, y: 300 }, viewport)).toBe("24px 24px 24px 24px");
  });

  it("uses a three rem bubble at a nondefault host font size", () => {
    const larger = { width: 390, height: 844, bubbleSize: 60 };
    expect(bubbleBounds(larger)).toEqual({ x: 330, y: 784 });
    expect(bubbleBorderRadius({ x: 0, y: 300 }, larger)).toBe("0 30px 30px 0");
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
      const { frame, bubble, pointer } = placeOpenWidget(position, viewport);
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

      if (pointer === "top") {
        expect(bubble.x).toBe(frame.x + 8);
        expect(bubble.y + BUBBLE_SIZE + POINTER_GAP).toBe(frame.y);
      } else {
        expect(bubble.x + BUBBLE_SIZE + POINTER_GAP).toBe(frame.x);
        expect(bubble.y).toBe(frame.y + 8);
      }
    }
  });

  it("places the chat head above the panel's upper-left corner on a phone", () => {
    const viewport = { width: 390, height: 844 };
    const bounds = bubbleBounds(viewport);
    const resting = { x: bounds.x, y: bounds.y };
    const { frame, bubble, pointer } = placeOpenWidget(resting, viewport);
    expect(frame.width).toBe(366);
    expect(frame.height).toBe(680);
    expect(pointer).toBe("top");
    expect(bubble.x).toBe(frame.x + 8);
    expect(bubble.y).toBe(frame.y - BUBBLE_SIZE - POINTER_GAP);
    expect(bubble).not.toEqual(resting);
  });

  it("places the chat head left of the upper-left corner in landscape", () => {
    const viewport = { width: 844, height: 390 };
    const { frame, bubble, pointer } = placeOpenWidget({ x: 380, y: 160 }, viewport);
    expect(frame.width).toBe(420);
    expect(frame.height).toBe(366);
    expect(pointer).toBe("left");
    expect(bubble.x + BUBBLE_SIZE + POINTER_GAP).toBe(frame.x);
  });

  it("keeps the panel usable on a short screen", () => {
    const { frame } = placeOpenWidget({ x: 132, y: 132 }, { width: 320, height: 320 });
    expect(frame.width).toBe(296);
    expect(frame.height).toBe(236);
  });
});
