
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

const extensionStyle = {
  mp4: 'ext-pill mp4',
  webm: 'ext-pill webm',
  m4a: 'ext-pill m4a',
  mhtml: 'ext-pill mhtml',
}

const isValidYoutubeLink = (value) =>
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(value)

function App() {
  const [url, setUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState(null)
  const [formats, setFormats] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [shake, setShake] = useState(false)

  const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined || bytes === '') return 'Unknown'
    if (typeof bytes === 'string') {
      const unitMatch = bytes.match(/^\s*([0-9.]+)\s*(B|KB|MB|GB|TB)\s*$/i)
      if (unitMatch) {
        const size = parseFloat(unitMatch[1])
        const unit = unitMatch[2].toUpperCase()
        if (unit === 'B') return `${size.toFixed(1)} B`
        if (unit === 'KB') return `${size.toFixed(1)} KB`
        return `${(unit === 'MB' ? size : size * (unit === 'GB' ? 1024 : 1024 * 1024)).toFixed(1)} MB`
      }
      const numeric = Number(bytes.replace(/[^0-9.]/g, ''))
      if (!Number.isNaN(numeric)) return formatBytes(numeric)
      return bytes
    }

    const value = Number(bytes)
    if (Number.isNaN(value)) return 'Unknown'
    if (value < 1024) return `${value} B`
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }

  const scanVideo = async (event) => {
    event.preventDefault()
    if (!isValidYoutubeLink(url)) {
      setStatus({ type: 'error', message: 'Paste a valid YouTube URL to continue.' })
      setShake(true)
      window.setTimeout(() => setShake(false), 520)
      return
    }

    setLoading(true)
    setStatus({ type: 'info', message: 'Scanning the URL for available formats…' })
    setVideoInfo(null)
    setFormats([])

    try {
      const response = await fetch(`${API_BASE}/api/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to scan the URL.')
      }

      setVideoInfo({
        title: result.title,
        uploader: result.uploader,
        duration: result.duration,
        thumbnail: result.thumbnail,
        views: result.view_count,
      })
      setFormats(result.formats || [])
      setStatus({ type: 'success', message: 'Scan complete — choose your preferred download format.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Unable to fetch video data.' })
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (formatId) => {
    const downloadUrl = `${API_BASE}/api/download?url=${encodeURIComponent(url)}&format_id=${encodeURIComponent(
      formatId,
    )}`
    window.open(downloadUrl, '_blank', 'noreferrer')
    setStatus({ type: 'success', message: `Downloading format ${formatId}…` })
  }

  return (
    <div className="app-shell">
      <div className="canvas-overlay" aria-hidden="true" />
      <main className="page-shell">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="hero-card"
        >
          <div className="hero-copy">
            <span className="eyebrow">Video Downloader</span>
            <h1 className="hero-title">Paste any YouTube URL to fetch available formats</h1>
            <p className="hero-subtitle">
              Scan links instantly and choose the best format for your creator workflow.
            </p>
          </div>

          <motion.form
            onSubmit={scanVideo}
            animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="hero-form glass-card"
          >
            <label htmlFor="video-url" className="sr-only">
              YouTube URL
            </label>
            <div className="input-group">
              <input
                id="video-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="url-input"
                autoComplete="off"
              />
              <button type="submit" className="scan-button" disabled={loading}>
                {loading ? (
                  <span className="loading-pill">
                    <span className="dot" />
                    Scanning
                  </span>
                ) : (
                  'Scan URL'
                )}
              </button>
            </div>
            <p className="hint-text">Fast preview of available download resolutions and formats.</p>
          </motion.form>
        </motion.section>

        <AnimatePresence mode="wait">
          {videoInfo && (
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="preview-card glass-card"
            >
              <div className="preview-thumb">
                <img src={videoInfo.thumbnail} alt={videoInfo.title} className="preview-image" />
              </div>
              <div className="preview-copy">
                <p className="preview-label">Preview</p>
                <h2>{videoInfo.title}</h2>
                <div className="preview-meta">
                  <span className="channel-pill">{videoInfo.uploader || 'Unknown channel'}</span>
                  <span className="meta-badge">{videoInfo.duration || 'Unknown duration'}</span>
                  {videoInfo.views ? <span className="meta-badge">{videoInfo.views.toLocaleString()} views</span> : null}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {formats.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="formats-panel"
            >
              <div className="formats-header">
                <span className="section-tag">Available Formats</span>
                <p className="section-copy">
                  Choose the best quality, codec and file size for your workflow.
                </p>
              </div>

              <div className="format-list">
                {formats.map((format, index) => {
                  const isAudio = format.vcodec === 'none' || format.resolution === 'audio only'
                  return (
                    <motion.div
                      key={format.format_id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: index * 0.08 }}
                      className="format-row"
                    >
                      <div>
                        <p className="format-id">{format.format_id}</p>
                        <span className={extensionStyle[format.ext] || extensionStyle.mhtml}>
                          .{format.ext}
                        </span>
                      </div>

                      <div className="format-detail">
                        {isAudio ? (
                          <span className="audio-label">🎵 Audio Only</span>
                        ) : (
                          <span>{format.resolution || 'Unknown'}</span>
                        )}
                      </div>

                      <div className="format-size">{formatBytes(format.filesize ?? format.filesize_approx)}</div>
                      <button
                        type="button"
                        onClick={() => handleDownload(format.format_id)}
                        className="download-pill"
                      >
                        Download
                      </button>
                    </motion.div>
                  )
                })}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status.message && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className={`status-banner ${status.type === 'error' ? 'status-error' : 'status-success'}`}
            >
              {status.message}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default App
