import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  clamp,
  createDefaultSelection,
  type Handle,
  type Point,
  redrawSelection,
  type Selection,
  transformSelection,
} from './selection'

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  selectionRef: RefObject<Selection>
  running: boolean
  fullFrame: boolean
}
type Gesture = {
  pointerId: number
  start: Point
  rect: Selection
  handle: Handle | 'draw'
}
const handles = [
  { id: 'nw', x: 0, y: 0, label: '左上', cursor: 'nwse-resize' },
  { id: 'n', x: 50, y: 0, label: '上', cursor: 'ns-resize' },
  { id: 'ne', x: 100, y: 0, label: '右上', cursor: 'nesw-resize' },
  { id: 'e', x: 100, y: 50, label: '右', cursor: 'ew-resize' },
  { id: 'se', x: 100, y: 100, label: '右下', cursor: 'nwse-resize' },
  { id: 's', x: 50, y: 100, label: '下', cursor: 'ns-resize' },
  { id: 'sw', x: 0, y: 100, label: '左下', cursor: 'nesw-resize' },
  { id: 'w', x: 0, y: 50, label: '左', cursor: 'ew-resize' },
] as const

export function SelectionOverlay({
  videoRef,
  canvasRef,
  selectionRef,
  running,
  fullFrame,
}: Props) {
  const areaRef = useRef<HTMLDivElement>(null)
  const rectangleRef = useRef<HTMLDivElement>(null)
  const fullFrameRef = useRef(fullFrame)
  const gestureRef = useRef<Gesture | null>(null)
  const frameRef = useRef(0)
  const [bounds, setBounds] = useState({ left: 0, top: 0, width: 0, height: 0 })

  const paint = useCallback(() => {
    const rect = selectionRef.current
    const rectangle = rectangleRef.current
    const canvas = canvasRef.current
    if (canvas) {
      canvas.style.clipPath = fullFrameRef.current
        ? 'inset(0)'
        : `inset(${rect.top * 100}% ${(1 - rect.right) * 100}% ${(1 - rect.bottom) * 100}% ${rect.left * 100}%)`
    }
    if (!rectangle) return
    rectangle.style.left = `${rect.left * 100}%`
    rectangle.style.top = `${rect.top * 100}%`
    rectangle.style.width = `${(rect.right - rect.left) * 100}%`
    rectangle.style.height = `${(rect.bottom - rect.top) * 100}%`
  }, [canvasRef, selectionRef])

  const reset = useCallback(() => {
    gestureRef.current = null
    cancelAnimationFrame(frameRef.current)
    selectionRef.current = createDefaultSelection()
    paint()
  }, [paint, selectionRef])

  useEffect(() => {
    fullFrameRef.current = fullFrame
    gestureRef.current = null
    cancelAnimationFrame(frameRef.current)
    paint()
  }, [fullFrame, paint])

  useEffect(() => {
    if (running) reset()
  }, [running, reset])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const measure = () => {
      const { width, height } = video.getBoundingClientRect()
      const ratio = video.videoWidth / video.videoHeight
      if (!ratio || !width || !height) return
      const fittedWidth = Math.min(width, height * ratio)
      const fittedHeight = fittedWidth / ratio
      const next = {
        left: (width - fittedWidth) / 2,
        top: (height - fittedHeight) / 2,
        width: fittedWidth,
        height: fittedHeight,
      }
      setBounds(next)
      const canvas = canvasRef.current
      if (canvas) {
        canvas.style.left = `${next.left}px`
        canvas.style.top = `${next.top}px`
        canvas.style.width = `${next.width}px`
        canvas.style.height = `${next.height}px`
      }
    }
    const observer = new ResizeObserver(measure)
    observer.observe(video)
    video.addEventListener('loadedmetadata', measure)
    video.addEventListener('resize', measure)
    measure()
    return () => {
      observer.disconnect()
      video.removeEventListener('loadedmetadata', measure)
      video.removeEventListener('resize', measure)
      cancelAnimationFrame(frameRef.current)
    }
  }, [videoRef, canvasRef])

  const point = (event: PointerEvent): Point => {
    const area = areaRef.current?.getBoundingClientRect()
    return area
      ? {
          x: clamp((event.clientX - area.left) / area.width),
          y: clamp((event.clientY - area.top) / area.height),
        }
      : { x: 0, y: 0 }
  }

  const begin = (
    event: PointerEvent<HTMLButtonElement>,
    handle: Handle | 'draw',
  ) => {
    if (!event.isPrimary || event.button !== 0 || gestureRef.current) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    gestureRef.current = {
      pointerId: event.pointerId,
      start: point(event),
      rect: selectionRef.current,
      handle,
    }
  }

  const update = (event: PointerEvent) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const end = point(event)
    selectionRef.current =
      gesture.handle === 'draw'
        ? redrawSelection(
            gesture.start,
            end,
            gesture.rect,
            Math.min(24 / bounds.width, 0.1),
            Math.min(24 / bounds.height, 0.1),
          )
        : transformSelection(
            gesture.rect,
            gesture.handle,
            end.x - gesture.start.x,
            end.y - gesture.start.y,
            Math.min(24 / bounds.width, 0.1),
            Math.min(24 / bounds.height, 0.1),
          )
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(paint)
  }

  const endGesture = (event: PointerEvent) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    cancelAnimationFrame(frameRef.current)
    paint()
  }

  const finish = (event: PointerEvent) => {
    update(event)
    endGesture(event)
  }

  const keyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    handle: Handle | 'draw',
  ) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      reset()
      return
    }
    if (handle === 'draw' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      reset()
      return
    }
    const rect = selectionRef.current
    const directions: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }
    const direction = directions[event.key]
    if (handle === 'draw' || !direction) return
    event.preventDefault()
    const step = event.shiftKey ? 10 : 1
    selectionRef.current = transformSelection(
      rect,
      handle,
      (direction.x * step) / bounds.width,
      (direction.y * step) / bounds.height,
      Math.min(24 / bounds.width, 0.1),
      Math.min(24 / bounds.height, 0.1),
    )
    paint()
  }

  const events = (handle: Handle | 'draw') => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) =>
      begin(event, handle),
    onPointerMove: update,
    onPointerUp: finish,
    onPointerCancel: endGesture,
    onLostPointerCapture: endGesture,
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) =>
      keyboard(event, handle),
  })

  return (
    <div
      ref={areaRef}
      className="absolute touch-none select-none"
      style={{ ...bounds, display: running && !fullFrame ? 'block' : 'none' }}
    >
      <button
        type="button"
        aria-label="ドラッグして範囲を選択"
        className="absolute inset-0 h-full w-full cursor-crosshair touch-none focus-visible:outline-2 focus-visible:outline-white"
        {...events('draw')}
      />
      <div
        ref={rectangleRef}
        className="absolute border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
      >
        <button
          type="button"
          aria-label="選択範囲を移動"
          className="absolute inset-0 h-full w-full cursor-move touch-none focus-visible:outline-2 focus-visible:outline-white"
          {...events('move')}
        />
        {handles.map((handle) => (
          <button
            key={handle.id}
            type="button"
            aria-label={`選択範囲の${handle.label}を調整`}
            {...events(handle.id)}
            className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-white"
            style={{
              left: `${handle.x}%`,
              top: `${handle.y}%`,
              cursor: handle.cursor,
            }}
          >
            <span className="h-2.5 w-2.5 rounded-sm border border-zinc-500 bg-white shadow-sm" />
          </button>
        ))}
      </div>
    </div>
  )
}
