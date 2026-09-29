import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clamp,
  createDefaultSelection,
  drawSelection,
  type Handle,
  redrawSelection,
  transformSelection,
} from '../src/selection.ts'

const rect = { left: 0.2, top: 0.3, right: 0.6, bottom: 0.8 }
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-10)

test('selection can be drawn in either direction', () => {
  assert.deepEqual(drawSelection({ x: 0.6, y: 0.8 }, { x: 0.2, y: 0.3 }), rect)
  assert.deepEqual(drawSelection({ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.8 }), rect)
})

test('reset creates an independent centered rectangle', () => {
  const first = createDefaultSelection()
  first.left = 0
  assert.deepEqual(createDefaultSelection(), {
    left: 0.25,
    top: 0.25,
    right: 0.75,
    bottom: 0.75,
  })
})

test('a tap or tiny drag preserves the existing rectangle', () => {
  const start = { x: 0.1, y: 0.1 }
  assert.equal(redrawSelection(start, start, rect, 0.05, 0.05), rect)
  assert.equal(
    redrawSelection(start, { x: 0.11, y: 0.8 }, rect, 0.05, 0.05),
    rect,
  )
})

test('a valid redraw replaces the rectangle without mutating it', () => {
  const next = redrawSelection(
    { x: 0.8, y: 0.9 },
    { x: 0.1, y: 0.2 },
    rect,
    0.05,
    0.05,
  )
  assert.deepEqual(next, { left: 0.1, top: 0.2, right: 0.8, bottom: 0.9 })
  assert.deepEqual(rect, { left: 0.2, top: 0.3, right: 0.6, bottom: 0.8 })
})

test('points are clamped to the image, not its letterbox margins', () => {
  assert.equal(clamp(-0.5), 0)
  assert.equal(clamp(1.5), 1)
})

test('moving preserves size and stays inside the image', () => {
  const moved = transformSelection(rect, 'move', 10, -10, 0.05, 0.05)
  close(moved.right, 1)
  close(moved.top, 0)
  close(moved.right - moved.left, rect.right - rect.left)
  close(moved.bottom - moved.top, rect.bottom - rect.top)
})

test('each edge and corner resizes only the expected edges', () => {
  const handles: Handle[] = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']
  for (const handle of handles) {
    const resized = transformSelection(rect, handle, 0.02, 0.03, 0.05, 0.05)
    close(resized.left, rect.left + (handle.includes('w') ? 0.02 : 0))
    close(resized.right, rect.right + (handle.includes('e') ? 0.02 : 0))
    close(resized.top, rect.top + (handle.includes('n') ? 0.03 : 0))
    close(resized.bottom, rect.bottom + (handle.includes('s') ? 0.03 : 0))
  }
})

test('resize cannot invert the rectangle or exceed the image', () => {
  const minimum = transformSelection(rect, 'nw', 10, 10, 0.05, 0.05)
  close(minimum.right - minimum.left, 0.05)
  close(minimum.bottom - minimum.top, 0.05)
  const maximum = transformSelection(rect, 'se', 10, 10, 0.05, 0.05)
  assert.equal(maximum.right, 1)
  assert.equal(maximum.bottom, 1)
})

test('moving the selection does not mutate its original geometry', () => {
  transformSelection(rect, 'se', 0.2, -0.1, 0.05, 0.05)
  assert.deepEqual(rect, { left: 0.2, top: 0.3, right: 0.6, bottom: 0.8 })
})
