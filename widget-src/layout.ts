export const BUBBLE_SIZE = 56;
export const EDGE_SNAP_DISTANCE = 16;

const FRAME_MARGIN = 12;
const FRAME_MAX_WIDTH = 420;
const FRAME_MAX_HEIGHT = 680;
const TAB_OVERLAP = 8;
const TAB_EXTENSION = BUBBLE_SIZE - TAB_OVERLAP;

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface FrameLayout extends Point {
  width: number;
  height: number;
}

export interface WidgetLayout {
  frame: FrameLayout;
  bubble: Point;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function frameMargin(viewport: Viewport): number {
  return Math.min(FRAME_MARGIN, viewport.width / 4, viewport.height / 4);
}

function nearestTabAnchor(value: number, start: number, span: number): number {
  const travel = Math.max(0, span - BUBBLE_SIZE);
  const anchors = [start, start + travel / 2, start + travel];
  return anchors.reduce((nearest, candidate) =>
    Math.abs(candidate - value) < Math.abs(nearest - value) ? candidate : nearest,
  );
}

export function bubbleBounds(viewport: Viewport): Point {
  return {
    x: Math.max(0, viewport.width - BUBBLE_SIZE),
    y: Math.max(0, viewport.height - BUBBLE_SIZE),
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

  if (next.x < distance) next.x = 0;
  else if (bounds.x - next.x < distance) next.x = bounds.x;

  if (next.y < distance) next.y = 0;
  else if (bounds.y - next.y < distance) next.y = bounds.y;

  return next;
}

export function placeOpenWidget(resting: Point, viewport: Viewport): WidgetLayout {
  const margin = frameMargin(viewport);
  const verticalWidth = Math.min(FRAME_MAX_WIDTH, Math.max(0, viewport.width - 2 * margin));
  const verticalHeight = Math.min(
    FRAME_MAX_HEIGHT,
    Math.max(0, viewport.height - 2 * margin - TAB_EXTENSION),
  );
  const horizontalWidth = Math.min(
    FRAME_MAX_WIDTH,
    Math.max(0, viewport.width - 2 * margin - TAB_EXTENSION),
  );
  const horizontalHeight = Math.min(FRAME_MAX_HEIGHT, Math.max(0, viewport.height - 2 * margin));

  const verticalX = clamp(
    resting.x + BUBBLE_SIZE - verticalWidth,
    margin,
    viewport.width - margin - verticalWidth,
  );
  const verticalTabX = nearestTabAnchor(resting.x, verticalX, verticalWidth);
  const aboveY = clamp(
    resting.y - verticalHeight + TAB_OVERLAP,
    margin,
    viewport.height - margin - verticalHeight - TAB_EXTENSION,
  );
  const belowY = clamp(
    resting.y + TAB_EXTENSION,
    margin + TAB_EXTENSION,
    viewport.height - margin - verticalHeight,
  );

  const horizontalY = clamp(
    resting.y + BUBBLE_SIZE - horizontalHeight,
    margin,
    viewport.height - margin - horizontalHeight,
  );
  const horizontalTabY = nearestTabAnchor(resting.y, horizontalY, horizontalHeight);
  const leftX = clamp(
    resting.x - horizontalWidth + TAB_OVERLAP,
    margin,
    viewport.width - margin - horizontalWidth - TAB_EXTENSION,
  );
  const rightX = clamp(
    resting.x + TAB_EXTENSION,
    margin + TAB_EXTENSION,
    viewport.width - margin - horizontalWidth,
  );

  const candidates: WidgetLayout[] = [
    {
      frame: { x: verticalX, y: aboveY, width: verticalWidth, height: verticalHeight },
      bubble: { x: verticalTabX, y: aboveY + verticalHeight - TAB_OVERLAP },
    },
    {
      frame: { x: verticalX, y: belowY, width: verticalWidth, height: verticalHeight },
      bubble: { x: verticalTabX, y: belowY - TAB_EXTENSION },
    },
    {
      frame: { x: leftX, y: horizontalY, width: horizontalWidth, height: horizontalHeight },
      bubble: { x: leftX + horizontalWidth - TAB_OVERLAP, y: horizontalTabY },
    },
    {
      frame: { x: rightX, y: horizontalY, width: horizontalWidth, height: horizontalHeight },
      bubble: { x: rightX - TAB_EXTENSION, y: horizontalTabY },
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
