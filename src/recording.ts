import type { Selection } from './selection'

export const recordingMimeTypes = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=vp8',
  'video/webm;codecs=vp9',
  'video/webm',
]

export function createSupportedRecorder<T>(
  isSupported: (type: string) => boolean,
  create: (type: string) => T,
) {
  for (const type of recordingMimeTypes) {
    if (!isSupported(type)) continue
    try {
      return { recorder: create(type), mimeType: type }
    } catch {
      // Some browsers advertise a format but reject recorder construction.
    }
  }
  throw new Error('No usable recording format')
}

export function createVideoFile(
  chunks: Blob[],
  type: string,
  date = new Date(),
) {
  const container = type.split(';')[0].trim().toLowerCase()
  if (container !== 'video/mp4' && container !== 'video/webm') {
    throw new Error('Unsupported recording format')
  }
  const extension = container === 'video/mp4' ? 'mp4' : 'webm'
  const stamp = date.toISOString().replace(/[:.]/g, '-')
  return new File(chunks, `time-camera-${stamp}.${extension}`, {
    type: container,
  })
}

export function composeRecordingFrame(
  context: CanvasRenderingContext2D,
  original: HTMLCanvasElement,
  motion: HTMLCanvasElement,
  selection: Selection | null,
) {
  const { width, height } = context.canvas
  const scale = Math.min(width / original.width, height / original.height)
  const fittedWidth = original.width * scale
  const fittedHeight = original.height * scale
  const left = (width - fittedWidth) / 2
  const top = (height - fittedHeight) / 2
  context.fillStyle = '#000'
  context.fillRect(0, 0, width, height)
  if (!selection) {
    context.drawImage(motion, left, top, fittedWidth, fittedHeight)
    return
  }
  context.drawImage(original, left, top, fittedWidth, fittedHeight)
  context.save()
  context.beginPath()
  context.rect(
    left + selection.left * fittedWidth,
    top + selection.top * fittedHeight,
    (selection.right - selection.left) * fittedWidth,
    (selection.bottom - selection.top) * fittedHeight,
  )
  context.clip()
  context.drawImage(motion, left, top, fittedWidth, fittedHeight)
  context.restore()
}
