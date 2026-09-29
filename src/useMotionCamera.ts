import { useCallback, useEffect, useRef, useState } from 'react'
import { renderMotion } from './motion'

export type CameraFrameListener = (
  original: HTMLCanvasElement,
  motion: HTMLCanvasElement,
) => void

type CameraStatus = 'idle' | 'starting' | 'running'

function cameraError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'カメラへのアクセスが拒否されました。ブラウザと端末のカメラ許可を確認してください。'
    }
    if (error.name === 'NotFoundError')
      return '利用できるカメラが見つかりません。'
    if (error.name === 'NotReadableError') {
      return 'カメラを開始できません。他のアプリがカメラを使用していないか確認してください。'
    }
  }
  return '映像を処理できませんでした。カメラを再起動してください。'
}

export function useMotionCamera(threshold: number) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const originalFrameRef = useRef<HTMLCanvasElement | null>(null)
  const frameListenerRef = useRef<CameraFrameListener | null>(null)
  const thresholdRef = useRef(threshold)
  const sessionRef = useRef(0)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    thresholdRef.current = threshold
  }, [threshold])

  const release = useCallback(() => {
    sessionRef.current += 1
    originalFrameRef.current = null
    cleanupRef.current?.()
    cleanupRef.current = null
  }, [])

  const stop = useCallback(() => {
    release()
    setStatus('idle')
  }, [release])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', stop)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', stop)
      release()
    }
  }, [release, stop])

  const start = async () => {
    release()
    const session = sessionRef.current
    setError('')

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(
        'カメラにはHTTPSと対応ブラウザが必要です。最新のiOS・ChromeでHTTPSのURLを開いてください。',
      )
      setStatus('idle')
      return
    }

    setStatus('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
        },
      })
      if (session !== sessionRef.current) {
        for (const track of stream.getTracks()) track.stop()
        return
      }

      const video = videoRef.current
      const canvas = canvasRef.current
      let animationId = 0
      let videoFrameId: number | null = null
      cleanupRef.current = () => {
        cancelAnimationFrame(animationId)
        if (videoFrameId !== null) video?.cancelVideoFrameCallback(videoFrameId)
        for (const track of stream.getTracks()) track.stop()
        if (video) {
          video.pause()
          video.srcObject = null
        }
        if (canvas)
          canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      }
      if (!video || !canvas) throw new Error('Camera elements are unavailable')

      for (const track of stream.getVideoTracks()) {
        track.addEventListener(
          'ended',
          () => {
            if (session !== sessionRef.current) return
            stop()
            setError('カメラの接続が終了しました。もう一度開始してください。')
          },
          { once: true },
        )
      }

      video.srcObject = stream
      await video.play()
      if (session !== sessionRef.current) return

      const capture = document.createElement('canvas')
      const captureContext = capture.getContext('2d', {
        willReadFrequently: true,
      })
      const outputContext = canvas.getContext('2d')
      if (!captureContext || !outputContext)
        throw new Error('Canvas is unavailable')

      let previous: Uint8ClampedArray | null = null
      let output: ImageData | null = null
      let lastTime = -1

      const draw = () => {
        const scale = Math.min(
          1,
          640 / Math.max(video.videoWidth, video.videoHeight),
        )
        const width = Math.round(video.videoWidth * scale)
        const height = Math.round(video.videoHeight * scale)
        if (!width || !height) return
        if (capture.width !== width || capture.height !== height || !output) {
          capture.width = canvas.width = width
          capture.height = canvas.height = height
          output = outputContext.createImageData(width, height)
          previous = null
        }
        captureContext.drawImage(video, 0, 0, width, height)
        const current = captureContext.getImageData(0, 0, width, height)
        renderMotion(current.data, previous, output.data, thresholdRef.current)
        outputContext.putImageData(output, 0, 0)
        previous = current.data
        originalFrameRef.current = capture
        frameListenerRef.current?.(capture, canvas)
      }

      const tick = () => {
        if (session !== sessionRef.current) return
        try {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            if (supportsVideoFrames || video.currentTime !== lastTime) {
              draw()
              lastTime = video.currentTime
            }
          }
          schedule()
        } catch (error) {
          stop()
          setError(cameraError(error))
        }
      }
      const supportsVideoFrames =
        typeof video.requestVideoFrameCallback === 'function'
      const schedule = () => {
        if (supportsVideoFrames)
          videoFrameId = video.requestVideoFrameCallback(tick)
        else animationId = requestAnimationFrame(tick)
      }

      setStatus('running')
      schedule()
    } catch (error) {
      if (session !== sessionRef.current) return
      stop()
      setError(cameraError(error))
    }
  }

  return {
    videoRef,
    canvasRef,
    originalFrameRef,
    frameListenerRef,
    status,
    error,
    start,
    stop,
  }
}
