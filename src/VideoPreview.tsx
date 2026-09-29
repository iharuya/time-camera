import { useEffect, useRef, useState } from 'react'

type Props = { file: File; onClose: () => void }

export function VideoPreview({ file, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const savingRef = useRef(false)
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    dialogRef.current?.showModal()
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  const download = () => {
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    link.remove()
    setNotice('ダウンロードを開始しました。')
  }

  const save = async () => {
    if (savingRef.current || !url) return
    savingRef.current = true
    setSaving(true)
    setError('')
    setNotice('')
    videoRef.current?.pause()
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        download()
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setError('共有できませんでした。「ダウンロード」をお試しください。')
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="preview-title"
      onClose={onClose}
      onCancel={(event) => {
        if (savingRef.current) event.preventDefault()
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-xl backdrop:bg-black/30"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="preview-title" className="text-base font-semibold">
          撮影した動画
        </h2>
        <form method="dialog">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
          >
            閉じる
          </button>
        </form>
      </div>
      <video
        ref={videoRef}
        src={url || undefined}
        controls
        muted
        playsInline
        aria-label="撮影した動画のプレビュー"
        className="max-h-[60dvh] w-full rounded-lg bg-black"
      />
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm text-zinc-500">
          {notice}
        </p>
      )}
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !url}
          className="flex-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white enabled:hover:bg-zinc-700 disabled:opacity-50"
        >
          共有
        </button>
        <button
          type="button"
          onClick={download}
          disabled={saving || !url}
          className="rounded-xl border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          ダウンロード
        </button>
      </div>
    </dialog>
  )
}
