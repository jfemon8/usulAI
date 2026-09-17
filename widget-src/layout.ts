export const BUBBLE_SIZE = 48;
export const EDGE_SNAP_DISTANCE = 16;

const FRAME_MARGIN = 12;
const FRAME_MAX_WIDTH = 420;
const FRAME_MAX_HEIGHT = 680;
export const POINTER_GAP = 12;
const HEAD_INSET = 8;

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  width: number;
  height: number;
  bubbleSize?: number;
}

export interface FrameLayout extends Point {
  width: number;
  height: number;
}

export interface WidgetLayout {
  frame: FrameLayout;
  bubble: Point;
  pointer: "top" | "left";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function frameMargin(viewport: Viewport): number {
  return Math.min(FRAME_MARGIN, viewport.width / 4, viewport.height / 4);
}

export function bubbleBounds(viewport: Viewport): Point {
  const bubbleSize = viewport.bubbleSize ?? BUBBLE_SIZE;
  return {
    x: Math.max(0, viewport.width - bubbleSize),
    y: Math.max(0, viewport.height - bubbleSize),
  };
}

export function clampBubble(position: Point, viewport: Viewport): Point {
  const bounds = bubbleBounds(viewport);
  return { x: clamp(position.x, 0, bounds.x), y: clamp(position.y, 0, bounds.y) };
}

export function snapBubble(
  position: Point,
  viewport: Viewport,
  distance = EDGE_SNAP_DISTANCE,
): Point {
  const bounds = bubbleBounds(viewport);
  const next = clampBubble(position, viewport);

  if (next.x <= distance) next.x = 0;
  else if (bounds.x - next.x <= distance) next.x = bounds.x;

  if (next.y <= distance) next.y = 0;
  else if (bounds.y - next.y <= distance) next.y = bounds.y;

  return next;
}

export function bubbleBorderRadius(position: Point, viewport: Viewport): string {
  const bounds = bubbleBounds(viewport);
  const left = position.x === 0;
  const right = position.x === bounds.x;
  const top = position.y === 0;
  const bottom = position.y === bounds.y;
  const round = `${(viewport.bubbleSize ?? BUBBLE_SIZE) / 2}px`;
  const corner = (attached: boolean) => (attached ? "0" : round);

  return [
    corner(top || left),
    corner(top || right),
    corner(bottom || right),
    corner(bottom || left),
  ].join(" ");
}

export function placeOpenWidget(resting: Point, viewport: Viewport): WidgetLayout {
  const margin = frameMargin(viewport);
  const headSpace = (viewport.bubbleSize ?? BUBBLE_SIZE) + POINTER_GAP;
  const topWidth = Math.min(FRAME_MAX_WIDTH, Math.max(0, viewport.width - 2 * margin));
  const topHeight = Math.min(
    FRAME_MAX_HEIGHT,
    Math.max(0, viewport.height - 2 * margin - headSpace),
  );
  const leftWidth = Math.min(FRAME_MAX_WIDTH, Math.max(0, viewport.width - 2 * margin - headSpace));
  const leftHeight = Math.min(FRAME_MAX_HEIGHT, Math.max(0, viewport.height - 2 * margin));

  const topX = clamp(resting.x, margin, viewport.width - margin - topWidth);
  const topY = clamp(
    resting.y + headSpace,
    margin + headSpace,
    viewport.height - margin - topHeight,
  );
  const leftX = clamp(
    resting.x + headSpace,
    margin + headSpace,
    viewport.width - margin - leftWidth,
  );
  const leftY = clamp(resting.y, margin, viewport.height - margin - leftHeight);

  const candidates: WidgetLayout[] = [
    {
      frame: { x: topX, y: topY, width: topWidth, height: topHeight },
      bubble: { x: topX + HEAD_INSET, y: topY - headSpace },
      pointer: "top",
    },
    {
      frame: { x: leftX, y: leftY, width: leftWidth, height: leftHeight },
      bubble: { x: leftX - headSpace, y: leftY + HEAD_INSET },
      pointer: "left",
    },
  ];

  const area = (layout: WidgetLayout) => layout.frame.width * layout.frame.height;
  const distance = (layout: WidgetLayout) =>
    (layout.bubble.x - resting.x) ** 2 + (layout.bubble.y - resting.y) ** 2;

  return candidates.reduce((best, candidate) => {
    if (area(candidate) > area(best)) return candidate;
    if (area(candidate) === area(best) && distance(candidate) < distance(best)) return candidate;
    return best;
  });
}
