export type Point = { x: number; y: number }
export type Selection = {
  left: number
  top: number
  right: number
  bottom: number
}
export type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

export function createDefaultSelection(): Selection {
  return { left: 0.25, top: 0.25, right: 0.75, bottom: 0.75 }
}

export function redrawSelection(
  start: Point,
  end: Point,
  previous: Selection,
  minWidth: number,
  minHeight: number,
): Selection {
  const next = drawSelection(start, end)
  return next.right - next.left >= minWidth &&
    next.bottom - next.top >= minHeight
    ? next
    : previous
}

export const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value))

export function drawSelection(start: Point, end: Point): Selection {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
  }
}

export function transformSelection(
  rect: Selection,
  handle: Handle,
  dx: number,
  dy: number,
  minWidth: number,
  minHeight: number,
): Selection {
  if (handle === 'move') {
    const x = clamp(dx, -rect.left, 1 - rect.right)
    const y = clamp(dy, -rect.top, 1 - rect.bottom)
    return {
      left: rect.left + x,
      right: rect.right + x,
      top: rect.top + y,
      bottom: rect.bottom + y,
    }
  }
  return {
    left: handle.includes('w')
      ? clamp(rect.left + dx, 0, rect.right - minWidth)
      : rect.left,
    right: handle.includes('e')
      ? clamp(rect.right + dx, rect.left + minWidth, 1)
      : rect.right,
    top: handle.includes('n')
      ? clamp(rect.top + dy, 0, rect.bottom - minHeight)
      : rect.top,
    bottom: handle.includes('s')
      ? clamp(rect.bottom + dy, rect.top + minHeight, 1)
      : rect.bottom,
  }
}
