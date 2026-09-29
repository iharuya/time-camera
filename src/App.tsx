import { type PointerEvent, useRef, useState } from 'react'
import { SelectionOverlay } from './SelectionOverlay'
import { createDefaultSelection } from './selection'
import { useCanvasRecorder } from './useCanvasRecorder'
import { useMotionCamera } from './useMotionCamera'
import { VideoPreview } from './VideoPreview'

function isOutsideDialog(event: PointerEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false
  const { left, right, top, bottom } =
    event.currentTarget.getBoundingClientRect()
  return (
    event.clientX < left ||
    event.clientX > right ||
    event.clientY < top ||
    event.clientY > bottom
  )
}

export default function App() {
  const [threshold, setThreshold] = useState(24)
  const [fullFrame, setFullFrame] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const backdropPointerRef = useRef(false)
  const selectionRef = useRef(createDefaultSelection())
  const {
    videoRef,
    canvasRef,
    originalFrameRef,
    frameListenerRef,
    status,
    error,
    start,
    stop,
  } = useMotionCamera(threshold)
  const recording = useCanvasRecorder({
    cameraRunning: status === 'running',
    fullFrame,
    originalFrameRef,
    canvasRef,
    frameListenerRef,
    selectionRef,
  })
  const message = recording.error || error

  const startCamera = async () => {
    dialogRef.current?.close()
    await start()
  }

  return (
    <main
      className={`fixed inset-0 text-zinc-900 ${status === 'running' ? 'bg-black' : 'bg-white'}`}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        aria-hidden="true"
        tabIndex={-1}
        className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${status === 'running' ? '' : 'opacity-0'}`}
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="pointer-events-none absolute [clip-path:inset(50%)]"
        role="img"
        aria-label="カメラ映像と選択範囲の動き"
      />
      <SelectionOverlay
        videoRef={videoRef}
        canvasRef={canvasRef}
        selectionRef={selectionRef}
        running={status === 'running'}
        fullFrame={fullFrame}
      />

      {status !== 'running' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={startCamera}
            disabled={status === 'starting'}
            aria-busy={status === 'starting'}
            className="pointer-events-auto rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white enabled:hover:bg-zinc-700 disabled:cursor-wait focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-500"
          >
            カメラを開始
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
        aria-controls="camera-settings"
        className="absolute right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm font-medium shadow-sm hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-500"
      >
        設定
      </button>

      {(status === 'running' || recording.status !== 'idle') && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-2">
          {recording.status === 'recording' && (
            <span
              role="status"
              className="rounded-full bg-white px-3 py-1 text-xs tabular-nums text-red-600"
            >
              {Math.floor(recording.seconds / 60)}:
              {String(recording.seconds % 60).padStart(2, '0')} / 1:00
            </span>
          )}
          <button
            type="button"
            onClick={
              recording.status === 'idle' ? recording.start : recording.stop
            }
            disabled={recording.status === 'finishing'}
            aria-label={
              recording.status === 'recording' ? '録画を停止' : '録画を開始'
            }
            aria-busy={recording.status === 'finishing'}
            className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/80 shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-500 disabled:opacity-50"
          >
            <span
              className={
                recording.status === 'recording'
                  ? 'h-6 w-6 rounded-sm bg-red-600'
                  : 'h-11 w-11 rounded-full bg-red-600'
              }
            />
          </button>
        </div>
      )}

      {recording.file && (
        <VideoPreview file={recording.file} onClose={recording.discard} />
      )}

      {message && (
        <p
          role="alert"
          className="absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))] mx-auto max-w-md rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-sm"
        >
          {message}
        </p>
      )}

      <dialog
        id="camera-settings"
        ref={dialogRef}
        aria-labelledby="settings-title"
        onPointerDown={(event) => {
          backdropPointerRef.current =
            event.isPrimary && event.button === 0 && isOutsideDialog(event)
        }}
        onPointerUp={(event) => {
          if (backdropPointerRef.current && isOutsideDialog(event)) {
            event.currentTarget.close()
          }
          backdropPointerRef.current = false
        }}
        onPointerCancel={() => {
          backdropPointerRef.current = false
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-xl backdrop:bg-black/30"
      >
        <div className="mb-8 flex items-center justify-between gap-4">
          <h2 id="settings-title" className="text-base font-semibold">
            設定
          </h2>
          <form method="dialog">
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-zinc-500"
            >
              閉じる
            </button>
          </form>
        </div>

        <div className="mb-8 space-y-4">
          <label htmlFor="threshold" className="flex justify-between text-sm">
            <span>閾値</span>
            <span className="tabular-nums text-zinc-500">{threshold}</span>
          </label>
          <input
            id="threshold"
            type="range"
            min="0"
            max="255"
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
            className="block w-full accent-zinc-900"
            aria-describedby="threshold-description"
          />
          <p id="threshold-description" className="text-xs text-zinc-500">
            直前のフレームとの色の差が、この値を超えた部分だけ表示します。
          </p>
        </div>

        <label className="mb-6 flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm">
          <span>全画面に適用</span>
          <input
            type="checkbox"
            checked={fullFrame}
            onChange={(event) => setFullFrame(event.target.checked)}
            className="h-5 w-5 accent-zinc-900"
          />
        </label>

        <button
          type="button"
          onClick={status === 'idle' ? startCamera : stop}
          className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-500"
        >
          {status === 'idle'
            ? 'カメラを開始'
            : status === 'starting'
              ? 'キャンセル'
              : 'カメラを停止'}
        </button>
      </dialog>
    </main>
  )
}
