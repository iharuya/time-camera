import assert from 'node:assert/strict'
import test from 'node:test'
import { renderMotion } from '../src/motion.ts'

test('first frame is opaque black', () => {
  const output = new Uint8ClampedArray(4)
  renderMotion(new Uint8ClampedArray([200, 100, 50, 255]), null, output, 0)
  assert.deepEqual([...output], [0, 0, 0, 255])
})

test('only changed pixels retain their current color', () => {
  const previous = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255])
  const current = new Uint8ClampedArray([10, 20, 30, 255, 80, 50, 60, 255])
  const output = new Uint8ClampedArray(8)
  renderMotion(current, previous, output, 24)
  assert.deepEqual([...output], [0, 0, 0, 255, 80, 50, 60, 255])
  assert.deepEqual([...current], [10, 20, 30, 255, 80, 50, 60, 255])
})

test('threshold is exclusive and all RGB channels are compared', () => {
  const previous = new Uint8ClampedArray([10, 10, 10, 255, 10, 10, 10, 255])
  const current = new Uint8ClampedArray([10, 34, 10, 255, 10, 10, 35, 255])
  const output = new Uint8ClampedArray(8)
  renderMotion(current, previous, output, 24)
  assert.deepEqual([...output], [0, 0, 0, 255, 10, 10, 35, 255])
})

test('zero threshold shows any RGB change but ignores alpha', () => {
  const output = new Uint8ClampedArray(8)
  renderMotion(
    new Uint8ClampedArray([1, 0, 0, 255, 0, 0, 0, 10]),
    new Uint8ClampedArray(8),
    output,
    0,
  )
  assert.deepEqual([...output], [1, 0, 0, 255, 0, 0, 0, 255])
})
