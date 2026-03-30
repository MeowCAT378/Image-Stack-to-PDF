import { jsPDF } from 'jspdf'
import { Icon } from '@iconify/react'
import { useEffect, useRef, useState } from 'react'

const readImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('ไม่สามารถโหลดรูปได้'))
    image.src = url
  })

const imageToJpegDataUrl = async (url) => {
  const image = await readImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('ไม่สามารถสร้างภาพสำหรับ PDF ได้')
  }

  ctx.drawImage(image, 0, 0)
  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
  }
}

const pxToPt = (px) => (px * 72) / 96

const getNumericBaseName = (fileName) => {
  const baseName = fileName.replace(/\.[^/.]+$/, '').trim()
  if (!/^\d+$/.test(baseName)) {
    return null
  }
  return Number(baseName)
}

function App() {
  const [images, setImages] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [draggedId, setDraggedId] = useState(null)
  const imagesRef = useRef(images)
  const previewUrlRef = useRef(previewUrl)

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(() => {
    previewUrlRef.current = previewUrl
  }, [previewUrl])

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((item) => URL.revokeObjectURL(item.url))
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const clearPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl('')
    }
  }

  const handleFilesChange = (event) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) {
      return
    }

    const numberedFiles = files.map((file, index) => ({
      file,
      index,
      number: getNumericBaseName(file.name),
    }))

    const orderedFiles = numberedFiles.every((item) => item.number !== null)
      ? [...numberedFiles]
          .sort((a, b) => a.number - b.number || a.index - b.index)
          .map((item) => item.file)
      : files

    const newItems = orderedFiles.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
    }))

    setImages((prev) => [...prev, ...newItems])
    setError('')
    event.target.value = ''
  }

  const removeImage = (id) => {
    setImages((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target) {
        URL.revokeObjectURL(target.url)
      }
      return prev.filter((item) => item.id !== id)
    })
    clearPreview()
  }

  const moveImage = (fromIndex, toIndex) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= images.length ||
      toIndex >= images.length
    ) {
      return
    }

    setImages((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
    clearPreview()
  }

  const handleDragStart = (id) => setDraggedId(id)

  const handleDrop = (targetId) => {
    if (!draggedId || draggedId === targetId) {
      return
    }

    const fromIndex = images.findIndex((item) => item.id === draggedId)
    const toIndex = images.findIndex((item) => item.id === targetId)
    moveImage(fromIndex, toIndex)
    setDraggedId(null)
  }

  const clearAll = () => {
    images.forEach((item) => URL.revokeObjectURL(item.url))
    setImages([])
    setError('')
    clearPreview()
  }

  const createPdfBlob = async () => {
    if (!images.length) {
      setError('กรุณาอัปโหลดรูปอย่างน้อย 1 รูป')
      return null
    }

    let pdf = null

    for (let i = 0; i < images.length; i += 1) {
      const { dataUrl, width, height } = await imageToJpegDataUrl(images[i].url)
      const pageWidth = pxToPt(width)
      const pageHeight = pxToPt(height)
      const orientation = pageWidth >= pageHeight ? 'l' : 'p'

      if (!pdf) {
        pdf = new jsPDF({
          orientation,
          unit: 'pt',
          format: [pageWidth, pageHeight],
        })
      } else {
        pdf.addPage([pageWidth, pageHeight], orientation)
      }

      pdf.addImage(dataUrl, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST')
    }

    return pdf ? pdf.output('blob') : null
  }

  const handlePreviewPdf = async () => {
    setIsGenerating(true)
    setError('')

    try {
      const pdfBlob = await createPdfBlob()
      if (!pdfBlob) {
        return
      }

      clearPreview()
      setPreviewUrl(URL.createObjectURL(pdfBlob))
    } catch {
      setError('เกิดข้อผิดพลาดระหว่างสร้าง PDF ลองใหม่อีกครั้ง')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadPdf = () => {
    const triggerDownload = (url) => {
      const link = document.createElement('a')
      link.href = url
      link.download = `images-${Date.now()}.pdf`
      link.click()
    }

    const downloadPdf = async () => {
      if (!images.length) {
        setError('กรุณาอัปโหลดรูปอย่างน้อย 1 รูป')
        return
      }

      setError('')

      if (previewUrl) {
        triggerDownload(previewUrl)
        return
      }

      setIsGenerating(true)

      try {
        const pdfBlob = await createPdfBlob()
        if (!pdfBlob) {
          return
        }

        const tempUrl = URL.createObjectURL(pdfBlob)
        triggerDownload(tempUrl)
        setTimeout(() => URL.revokeObjectURL(tempUrl), 1500)
      } catch {
        setError('เกิดข้อผิดพลาดระหว่างสร้าง PDF ลองใหม่อีกครั้ง')
      } finally {
        setIsGenerating(false)
      }
    }

    void downloadPdf()
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-emerald-100 bg-white/80 p-6 shadow-[0_18px_48px_-18px_rgba(16,185,129,0.35)] backdrop-blur sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">
              Image Stack to PDF
            </p>
            <h1 className="font-display mt-2 text-3xl font-bold text-emerald-950 sm:text-4xl">
              รวมรูปหลายไฟล์เป็น PDF เดียว
            </h1>
          </div>

          <div className="flex gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700">
              เพิ่มรูป
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesChange}
              />
            </label>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-xl border border-emerald-200 bg-white px-4 py-2 font-medium text-emerald-800 transition hover:bg-emerald-50"
              disabled={!images.length || isGenerating}
            >
              ล้างทั้งหมด
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {!images.length ? (
          <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 px-6 py-14 text-center text-emerald-700">
            ยังไม่มีรูป กรุณากดปุ่ม "เพิ่มรูป"
          </div>
        ) : (
          <ul className="grid gap-3">
            {images.map((item, index) => (
              <li
                key={item.id}
                draggable={!isGenerating}
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(item.id)}
                className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm shadow-emerald-100/40 transition sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3">
                  <span className="font-display grid h-9 w-9 place-content-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
                    {index + 1}
                  </span>
                  <img
                    src={item.url}
                    alt={item.name}
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-emerald-950">{item.name}</p>
                  <p className="text-xs text-emerald-700/80">
                    {(item.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="grid h-9 w-9 place-content-center rounded-lg border border-emerald-200 text-emerald-700"
                    title="ลากเพื่อเรียงลำดับ"
                    aria-label="ลากเพื่อเรียงลำดับ"
                  >
                    <Icon icon="mdi:drag-vertical" className="h-5 w-5" />
                  </span>
                  <button
                    type="button"
                    onClick={() => removeImage(item.id)}
                    className="grid h-9 w-9 place-content-center rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                    disabled={isGenerating}
                    aria-label="ลบ"
                    title="ลบ"
                  >
                    <Icon icon="mdi:trash-can-outline" className="h-5 w-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handlePreviewPdf}
            disabled={!images.length || isGenerating}
            className="font-display rounded-xl bg-emerald-700 px-5 py-3 text-base font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? 'กำลังสร้าง PDF...' : 'Preview PDF'}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!images.length || isGenerating}
            className="font-display rounded-xl border border-emerald-300 bg-white px-5 py-3 text-base font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ดาวน์โหลด PDF
          </button>
        </div>
      </section>

      {previewUrl ? (
        <section className="fixed inset-0 z-50 grid place-items-center bg-emerald-950/40 p-4">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3">
              <h2 className="font-display text-lg font-semibold text-emerald-950">PDF Preview</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
                >
                  ดาวน์โหลด
                </button>
                <button
                  type="button"
                  onClick={clearPreview}
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
                >
                  ปิด
                </button>
              </div>
            </div>
            <iframe
              title="PDF preview"
              src={previewUrl}
              className="h-full w-full"
            />
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default App
