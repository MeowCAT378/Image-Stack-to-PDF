import { jsPDF } from 'jspdf'
import { useEffect, useState } from 'react'

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

const getNumericBaseName = (fileName) => {
  const baseName = fileName.replace(/\.[^/.]+$/, '').trim()
  if (!/^\d+$/.test(baseName)) {
    return null
  }
  return Number(baseName)
}

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6v14H5V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
)

function App() {
  const [images, setImages] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    return () => {
      images.forEach((item) => URL.revokeObjectURL(item.url))
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [images, previewUrl])

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

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = 210
    const pageHeight = 297
    const margin = 10
    const maxWidth = pageWidth - margin * 2
    const maxHeight = pageHeight - margin * 2

    for (let i = 0; i < images.length; i += 1) {
      const { dataUrl, width, height } = await imageToJpegDataUrl(images[i].url)
      const ratio = width / height

      let renderWidth = maxWidth
      let renderHeight = renderWidth / ratio

      if (renderHeight > maxHeight) {
        renderHeight = maxHeight
        renderWidth = renderHeight * ratio
      }

      const x = (pageWidth - renderWidth) / 2
      const y = (pageHeight - renderHeight) / 2

      if (i > 0) {
        pdf.addPage()
      }

      pdf.addImage(dataUrl, 'JPEG', x, y, renderWidth, renderHeight, undefined, 'FAST')
    }

    return pdf.output('blob')
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
    if (!previewUrl) {
      setError('กรุณากด Preview PDF ก่อนดาวน์โหลด')
      return
    }

    const link = document.createElement('a')
    link.href = previewUrl
    link.download = `images-${Date.now()}.pdf`
    link.click()
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
            <p className="mt-3 max-w-2xl text-emerald-800/80">
              ลำดับไฟล์จะยึดตามที่คุณเลือกตอนอัปโหลด แต่ถ้าชื่อไฟล์ในชุดที่เลือกเป็นตัวเลขล้วนทั้งหมด ระบบจะเรียงจากน้อยไปมากให้อัตโนมัติ
            </p>
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
                className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm shadow-emerald-100/40 sm:flex-row sm:items-center"
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
                  <button
                    type="button"
                    onClick={() => removeImage(item.id)}
                    className="grid h-9 w-9 place-content-center rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                    disabled={isGenerating}
                    aria-label="ลบ"
                    title="ลบ"
                  >
                    <TrashIcon />
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
            disabled={!previewUrl || isGenerating}
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
