import assert from 'node:assert/strict'
import test from 'node:test'
import {
  composeRecordingFrame,
  createSupportedRecorder,
  createVideoFile,
} from '../src/recording.ts'

test('MP4 H.264 is preferred when available', () => {
  const result = createSupportedRecorder(
    () => true,
    (type) => ({ type }),
  )
  assert.equal(result.mimeType, 'video/mp4;codecs=avc1.42E01E')
})

test('WebM is used when MP4 is unsupported', () => {
  const result = createSupportedRecorder(
    (type) => type.startsWith('video/webm'),
    (type) => ({ type }),
  )
  assert.equal(result.mimeType, 'video/webm;codecs=vp8')
})

test('constructor failures fall back to another supported format', () => {
  const result = createSupportedRecorder(
    () => true,
    (type) => {
      if (type.startsWith('video/mp4')) throw new Error('Unsupported')
      return { type }
    },
  )
  assert.equal(result.mimeType, 'video/webm;codecs=vp8')
  assert.throws(() =>
    createSupportedRecorder(
      () => false,
      () => null,
    ),
  )
})

test('actual format determines the extension and canonical sharing MIME type', async () => {
  const date = new Date('2026-01-01T12:00:00Z')
  const chunks = [new Blob(['first']), new Blob(['second'])]
  const mp4 = createVideoFile(chunks, 'video/mp4;codecs=avc1.42E01E', date)
  assert.equal(mp4.name, 'time-camera-2026-01-01T12-00-00-000Z.mp4')
  assert.equal(mp4.type, 'video/mp4')
  assert.equal(await mp4.text(), 'firstsecond')
  const webm = createVideoFile(chunks, 'video/webm;codecs=vp8', date)
  assert.equal(webm.type, 'video/webm')
  assert.ok(webm.name.endsWith('.webm'))
  assert.throws(() => createVideoFile(chunks, 'video/unknown'))
})

function frameContext() {
  const calls: unknown[][] = []
  const original = { width: 640, height: 480 } as HTMLCanvasElement
  const motion = { width: 640, height: 480 } as HTMLCanvasElement
  const context = {
    canvas: { width: 640, height: 480 },
    fillStyle: '',
    fillRect: (...args: unknown[]) => calls.push(['fill', ...args]),
    drawImage: (...args: unknown[]) => calls.push(['draw', ...args]),
    save: () => calls.push(['save']),
    beginPath: () => calls.push(['begin']),
    rect: (...args: unknown[]) => calls.push(['rect', ...args]),
    clip: () => calls.push(['clip']),
    restore: () => calls.push(['restore']),
  } as unknown as CanvasRenderingContext2D
  return { calls, original, motion, context }
}

test('regional recording contains only the original and clipped motion pixels', () => {
  const { calls, original, motion, context } = frameContext()
  composeRecordingFrame(context, original, motion, {
    left: 0.25,
    top: 0.25,
    right: 0.75,
    bottom: 0.75,
  })
  assert.deepEqual(calls, [
    ['fill', 0, 0, 640, 480],
    ['draw', original, 0, 0, 640, 480],
    ['save'],
    ['begin'],
    ['rect', 160, 120, 320, 240],
    ['clip'],
    ['draw', motion, 0, 0, 640, 480],
    ['restore'],
  ])
})

test('full-frame recording contains only the motion canvas', () => {
  const { calls, original, motion, context } = frameContext()
  composeRecordingFrame(context, original, motion, null)
  assert.deepEqual(calls, [
    ['fill', 0, 0, 640, 480],
    ['draw', motion, 0, 0, 640, 480],
  ])
})

test('rotation preserves aspect ratio and keeps recording dimensions fixed', () => {
  const { calls, original, motion, context } = frameContext()
  original.width = motion.width = 480
  original.height = motion.height = 640
  composeRecordingFrame(context, original, motion, {
    left: 0.25,
    top: 0.25,
    right: 0.75,
    bottom: 0.75,
  })
  assert.deepEqual(context.canvas, { width: 640, height: 480 })
  assert.deepEqual(calls[1], ['draw', original, 140, 0, 360, 480])
  assert.deepEqual(calls[4], ['rect', 230, 120, 180, 240])
})
