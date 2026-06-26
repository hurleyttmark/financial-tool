/**
 * PulseChart.jsx — Mobile responsive. Canvas heights and padding adapt to isMobile prop.
 */
import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import ConvictionTooltip from './ConvictionTooltip.jsx'
import HeatmapStrip from './HeatmapStrip.jsx'
import ReplayScrubber from './ReplayScrubber.jsx'
import { pulseToColor, wyckoffBgColor } from '../utils/colors.js'

const PADDING_DESKTOP = { top: 16, right: 16, bottom: 24, left: 64 }
const PADDING_MOBILE  = { top: 10, right: 8,  bottom: 20, left: 44 }

const THRESHOLD_COLORS = {
  strongBull: 'rgba(63,185,80,0.5)',
  bull: 'rgba(63,185,80,0.25)',
  bear: 'rgba(248,81,73,0.25)',
  strongBear: 'rgba(248,81,73,0.5)',
}

function priceToY(price, minP, maxP, height, pad) {
  if (maxP === minP) return height / 2
  return pad.top + ((maxP - price) / (maxP - minP)) * (height - pad.top - pad.bottom)
}

function pulseToY(pulse, height, pad) {
  const inner = height - pad.top - pad.bottom
  return pad.top + ((1 - pulse) / 2) * inner
}

function drawCandlesticks(ctx, bars, width, height, pad) {
  if (!bars.length) return
  const prices = bars.flatMap(b => [b.high, b.low])
  const minP = Math.min(...prices) * 0.998
  const maxP = Math.max(...prices) * 1.002
  const inner = width - pad.left - pad.right
  const barW = Math.max(1.5, inner / bars.length)
  const candleW = Math.max(1, barW * 0.6)

  ctx.clearRect(0, 0, width, height)

  bars.forEach((bar, i) => {
    const x = pad.left + i * barW
    ctx.fillStyle = wyckoffBgColor(bar.wyckoff_phase)
    ctx.fillRect(x, pad.top, barW, height - pad.top - pad.bottom)
  })

  ctx.strokeStyle = '#21262d'
  ctx.lineWidth = 1
  const steps = 4
  for (let i = 0; i <= steps; i++) {
    const y = priceToY(minP + (maxP - minP) * (i / steps), minP, maxP, height, pad)
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(width - pad.right, y)
    ctx.stroke()
    const price = minP + (maxP - minP) * (i / steps)
    ctx.fillStyle = '#8b949e'
    ctx.font = `${pad.left > 50 ? 10 : 8}px monospace`
    ctx.textAlign = 'right'
    ctx.fillText(price.toFixed(2), pad.left - 3, y + 3)
  }

  bars.forEach((bar, i) => {
    const x = pad.left + i * barW + barW / 2
    const xLeft = x - candleW / 2
    const bullish = bar.close >= bar.open
    const color = bullish ? '#26a69a' : '#ef5350'
    const yHigh = priceToY(bar.high, minP, maxP, height, pad)
    const yLow = priceToY(bar.low, minP, maxP, height, pad)
    const yOpen = priceToY(bar.open, minP, maxP, height, pad)
    const yClose = priceToY(bar.close, minP, maxP, height, pad)

    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, yHigh)
    ctx.lineTo(x, yLow)
    ctx.stroke()

    const bodyTop = Math.min(yOpen, yClose)
    const bodyH = Math.max(1, Math.abs(yClose - yOpen))
    ctx.fillStyle = color
    ctx.fillRect(xLeft, bodyTop, candleW, bodyH)
    ctx.fillStyle = pulseToColor(bar.pulse, 0.25)
    ctx.fillRect(xLeft, bodyTop, candleW, bodyH)
  })

  const step = Math.max(1, Math.floor(bars.length / 6))
  ctx.fillStyle = '#8b949e'
  ctx.font = `${pad.left > 50 ? 9 : 8}px monospace`
  ctx.textAlign = 'center'
  for (let i = 0; i < bars.length; i += step) {
    const x = pad.left + i * barW + barW / 2
    ctx.fillText(bars[i].date.slice(5), x, height - 3)
  }
}

function drawOscillator(ctx, bars, width, height, pad) {
  if (!bars.length) return
  ctx.clearRect(0, 0, width, height)
  const inner = width - pad.left - pad.right
  const barW = inner / bars.length

  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, width, height)

  const thresholds = [
    { v: 0.6,  color: THRESHOLD_COLORS.strongBull, label: '+0.6' },
    { v: 0.2,  color: THRESHOLD_COLORS.bull,       label: '+0.2' },
    { v: 0,    color: '#30363d',                   label: '0' },
    { v: -0.2, color: THRESHOLD_COLORS.bear,       label: '−0.2' },
    { v: -0.6, color: THRESHOLD_COLORS.strongBear, label: '−0.6' },
  ]

  thresholds.forEach(({ v, color, label }) => {
    const y = pulseToY(v, height, pad)
    ctx.strokeStyle = color
    ctx.lineWidth = v === 0 ? 1.5 : 1
    ctx.setLineDash(v === 0 ? [] : [4, 3])
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(width - pad.right, y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#8b949e'
    ctx.font = `${pad.left > 50 ? 9 : 8}px monospace`
    ctx.textAlign = 'right'
    ctx.fillText(label, pad.left - 3, y + 3)
  })

  const zeroY = pulseToY(0, height, pad)
  bars.forEach((bar, i) => {
    const x = pad.left + i * barW
    const y = pulseToY(bar.pulse, height, pad)
    const barHeight = Math.abs(y - zeroY)
    const top = Math.min(y, zeroY)
    ctx.fillStyle = pulseToColor(bar.pulse, 0.7)
    ctx.fillRect(x, top, Math.max(barW - 0.5, 1), Math.max(barHeight, 1))
  })

  ctx.strokeStyle = '#58a6ff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  bars.forEach((bar, i) => {
    const x = pad.left + i * barW + barW / 2
    const y = pulseToY(bar.pulse, height, pad)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()

  ctx.fillStyle = '#8b949e'
  ctx.font = '10px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('PULSE', pad.left + 4, 14)
}

export default function PulseChart({ bars, isMobile }) {
  const candleRef = useRef(null)
  const oscRef = useRef(null)
  const containerRef = useRef(null)

  const CANDLESTICK_HEIGHT = isMobile ? 200 : 320
  const OSCILLATOR_HEIGHT  = isMobile ? 80  : 120
  const PADDING = isMobile ? PADDING_MOBILE : PADDING_DESKTOP

  const [replayIndex, setReplayIndex] = useState(0)
  const [tooltip, setTooltip] = useState({ visible: false, bar: null, x: 0, y: 0 })
  const [dims, setDims] = useState({ width: 900 })

  useEffect(() => {
    if (bars.length > 0) setReplayIndex(bars.length - 1)
  }, [bars.length])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      setDims({ width: Math.max(280, w) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const visibleBars = useMemo(
    () => bars.slice(0, replayIndex + 1),
    [bars, replayIndex]
  )

  useEffect(() => {
    const canvas = candleRef.current
    if (!canvas || !visibleBars.length) return
    canvas.width = dims.width
    canvas.height = CANDLESTICK_HEIGHT
    const ctx = canvas.getContext('2d')
    drawCandlesticks(ctx, visibleBars, dims.width, CANDLESTICK_HEIGHT, PADDING)
  }, [visibleBars, dims.width, CANDLESTICK_HEIGHT, PADDING])

  useEffect(() => {
    const canvas = oscRef.current
    if (!canvas || !visibleBars.length) return
    canvas.width = dims.width
    canvas.height = OSCILLATOR_HEIGHT
    const ctx = canvas.getContext('2d')
    drawOscillator(ctx, visibleBars, dims.width, OSCILLATOR_HEIGHT, PADDING)
  }, [visibleBars, dims.width, OSCILLATOR_HEIGHT, PADDING])

  const getBarAtX = useCallback((clientX) => {
    const canvas = candleRef.current
    if (!canvas || !visibleBars.length) return null
    const rect = canvas.getBoundingClientRect()
    const relX = clientX - rect.left
    const inner = dims.width - PADDING.left - PADDING.right
    const barW = inner / visibleBars.length
    const idx = Math.floor((relX - PADDING.left) / barW)
    if (idx < 0 || idx >= visibleBars.length) return null
    return visibleBars[idx]
  }, [visibleBars, dims.width, PADDING])

  const handleMouseMove = useCallback((e) => {
    const bar = getBarAtX(e.clientX)
    if (bar) setTooltip({ visible: true, bar, x: e.clientX, y: e.clientY })
    else setTooltip(prev => ({ ...prev, visible: false }))
  }, [getBarAtX])

  const handleMouseLeave = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false }))
  }, [])

  // Touch: tap on canvas shows tooltip
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0]
    const bar = getBarAtX(touch.clientX)
    if (bar) setTooltip({ visible: true, bar, x: touch.clientX, y: touch.clientY })
  }, [getBarAtX])

  const handleTouchEnd = useCallback(() => {
    // Keep tooltip visible for a moment on mobile then dismiss
    setTimeout(() => setTooltip(prev => ({ ...prev, visible: false })), 2500)
  }, [])

  if (!bars.length) return null

  return (
    <div ref={containerRef} style={styles.container}>
      <div style={styles.paneLabel}>
        <span style={styles.paneLabelText}>Candlestick · Wyckoff Band</span>
      </div>
      <div style={{ position: 'relative' }}>
        <canvas
          ref={candleRef}
          style={styles.canvas}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
        <ConvictionTooltip
          bar={tooltip.bar}
          x={tooltip.x}
          y={tooltip.y}
          visible={tooltip.visible}
          isMobile={isMobile}
        />
      </div>

      <canvas ref={oscRef} style={{ ...styles.canvas, marginTop: 1 }} />

      <div style={{
        ...styles.controls,
        padding: isMobile ? '10px 10px' : '12px 16px',
      }}>
        <HeatmapStrip bars={visibleBars} visibleStart={0} visibleEnd={visibleBars.length - 1} isMobile={isMobile} />
        <div style={styles.scrubberRow}>
          <ReplayScrubber
            totalBars={bars.length}
            currentIndex={replayIndex}
            onScrub={setReplayIndex}
            disabled={bars.length === 0}
          />
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    background: '#0d1117',
    borderRadius: 8,
    border: '1px solid #21262d',
    overflow: 'hidden',
  },
  paneLabel: {
    padding: '6px 12px',
    background: '#161b22',
    borderBottom: '1px solid #21262d',
  },
  paneLabelText: {
    fontSize: 11,
    color: '#8b949e',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  canvas: {
    display: 'block',
    width: '100%',
  },
  controls: {
    background: '#161b22',
    borderTop: '1px solid #21262d',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  scrubberRow: {
    display: 'flex',
    alignItems: 'center',
  },
}
