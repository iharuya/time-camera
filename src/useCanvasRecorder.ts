import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import {
  composeRecordingFrame,
  createSupportedRecorder,
  createVideoFile,
} from './recording'
import type { Selection } from './selection'
import type { CameraFrameListener } from './useMotionCamera'

const maxSeconds = 60
const maxBytes = 64 * 1024 * 1024
type RecorderStatus = 'idle' | 'recording' | 'finishing'
type Session = {
  recorder: MediaRecorder
  stream: MediaStream
  context: CanvasRenderingContext2D
  chunks: Blob[]
  bytes: number
  startedAt: number
  timer: ReturnType<typeof setInterval> | null
  failed: boolean
}
type Options = {
  cameraRunning: boolean
  fullFrame: boolean
  originalFrameRef: RefObject<HTMLCanvasElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  frameListenerRef: RefObject<CameraFrameListener | null>
  selectionRef: RefObject<Selection>
}

export function useCanvasRecorder({
  cameraRunning,
  fullFrame,
  originalFrameRef,
  canvasRef,
  frameListenerRef,
  selectionRef,
}: Options) {
  const sessionRef = useRef<Session | null>(null)
  const mountedRef = useRef(false)
  const fullFrameRef = useRef(fullFrame)
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [seconds, setSeconds] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fullFrameRef.current = fullFrame
  }, [fullFrame])

  const stop = useCallback(() => {
    const session = sessionRef.current
    if (!session || session.recorder.state === 'inactive') return
    if (session.timer) clearInterval(session.timer)
    if (mountedRef.current) setStatus('finishing')
    session.recorder.stop()
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const listener: CameraFrameListener = (original, motion) => {
      const session = sessionRef.current
      if (session?.recorder.state !== 'recording') return
      try {
        composeRecordingFrame(
          session.context,
          original,
          motion,
          fullFrameRef.current ? null : selectionRef.current,
        )
      } catch {
        session.failed = true
        setError('録画を続けられませんでした。もう一度お試しください。')
        stop()
      }
    }
    frameListenerRef.current = listener
    const onVisibility = () => {
      if (document.hidden) stop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', stop)
    return () => {
      mountedRef.current = false
      if (frameListenerRef.current === listener) frameListenerRef.current = null
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', stop)
      stop()
      const session = sessionRef.current
      if (session) {
        session.failed = true
        if (session.timer) clearInterval(session.timer)
        for (const track of session.stream.getTracks()) track.stop()
      }
    }
  }, [frameListenerRef, selectionRef, stop])

  useEffect(() => {
    if (!cameraRunning) stop()
  }, [cameraRunning, stop])

  const start = () => {
    if (sessionRef.current || !cameraRunning) return
    setError('')
    const original = originalFrameRef.current
    const motion = canvasRef.current
    if (!original || !motion) {
      setError('映像の準備ができていません。少し待ってからお試しください。')
      return
    }
    if (
      typeof MediaRecorder === 'undefined' ||
      typeof HTMLCanvasElement.prototype.captureStream !== 'function'
    ) {
      setError('このブラウザは動画の録画に対応していません。')
      return
    }

    let stream: MediaStream | null = null
    try {
      const recording = document.createElement('canvas')
      recording.width = original.width
      recording.height = original.height
      const context = recording.getContext('2d')
      if (!context) throw new Error('Canvas is unavailable')
      composeRecordingFrame(
        context,
        original,
        motion,
        fullFrameRef.current ? null : selectionRef.current,
      )
      const recordingStream = recording.captureStream(30)
      stream = recordingStream
      const { recorder, mimeType } = createSupportedRecorder(
        (type) => MediaRecorder.isTypeSupported(type),
        (type) =>
          new MediaRecorder(recordingStream, {
            mimeType: type,
            videoBitsPerSecond: 2_500_000,
          }),
      )
      const session: Session = {
        recorder,
        stream,
        context,
        chunks: [],
        bytes: 0,
        startedAt: performance.now(),
        timer: null,
        failed: false,
      }
      sessionRef.current = session

      recorder.ondataavailable = (event) => {
        if (!event.data.size) return
        session.chunks.push(event.data)
        session.bytes += event.data.size
        if (session.bytes >= maxBytes) stop()
      }
      recorder.onerror = () => {
        session.failed = true
        if (mountedRef.current)
          setError('録画に失敗しました。もう一度お試しください。')
        stop()
      }
      recorder.onstop = () => {
        if (session.timer) clearInterval(session.timer)
        for (const track of session.stream.getTracks()) track.stop()
        if (sessionRef.current !== session) return
        sessionRef.current = null
        if (!mountedRef.current) return
        setStatus('idle')
        if (session.failed) return
        try {
          if (!session.chunks.length) throw new Error('Empty recording')
          setFile(
            createVideoFile(session.chunks, recorder.mimeType || mimeType),
          )
        } catch {
          setError('録画した動画を作成できませんでした。')
        }
      }

      recorder.start(1000)
      setFile(null)
      setSeconds(0)
      setStatus('recording')
      session.timer = setInterval(() => {
        const elapsed = Math.floor(
          (performance.now() - session.startedAt) / 1000,
        )
        setSeconds(Math.min(elapsed, maxSeconds))
        if (elapsed >= maxSeconds) stop()
      }, 250)
    } catch {
      if (stream) for (const track of stream.getTracks()) track.stop()
      sessionRef.current = null
      setStatus('idle')
      setError(
        '録画を開始できません。この端末では対応形式が利用できない可能性があります。',
      )
    }
  }

  return {
    status,
    seconds,
    file,
    error,
    start,
    stop,
    discard: () => setFile(null),
  }
}
