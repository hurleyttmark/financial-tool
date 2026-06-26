/**
 * PulseChart.jsx — Main chart rendering all visual components.
 *
 * Layout (top→bottom):
 *   1. Wyckoff background band label row
 *   2. Candlestick pane (canvas)
 *   3. Oscillator lane (canvas) with pulse line + colored fill + ±0.2/±0.6 thresholds
 *   4. Heatmap strip
 *   5. Replay scrubber
 *
 * The replay scrubber controls `replayIndex`: bars[0..replayIndex] are visible.
 * Hovering the candlestick pane shows a ConvictionTooltip for the bar under cursor.
 *
 * Canvas rendering uses 2D API directly (no external chart library dependency at runtime).
 */
import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import ConvictionTooltip from './ConvictionTooltip.jsx'
import HeatmapStrip from './HeatmapStrip.jsx'
import ReplayScrubber from './ReplayScrubber.jsx'
import { pulseToColor, wyckoffBgColor } from '../utils/colors.js'

const CANDLESTICK_HEIGHT = 320
const OSCILLATOR_HEIGHT = 120
const PADDING = { top: 16, right: 16, bottom: 24, left: 64 }
const THRESHOLD_COLORS = {
  strongBull: 'rgba(63,185,80,0.5)',
  bull: 'rgba(63,185,80,0.25)',
  bear: 'rgba(248,81,73,0.25)',
  strongBear: 'rgba(248,81,73,0.5)',
}

function priceToY(price, minP, maxP, height) {
  if (maxP === minP) return height / 2
  return PADDING.top + ((maxP - price) / (maxP - minP)) * (height - PADDING.top - PADDING.bottom)
}

function pulseToY(pulse, height) {
  // pulse in [-1,1] → y in [PADDING.top, height-PADDING.bottom]
  const inner = height - PADDING.top - PADDING.bottom
  return PADDING.top + ((1 - pulse) / 2) * inner
}

function drawCandlesticks(ctx, bars, width, height) {
  if (!bars.length) return

  const prices = bars.flatMap(b => [b.high, b.low])
  const minP = Math.min(...prices) * 0.998
  const maxP = Math.max(...prices) * 1.002
  const inner = width - PADDING.left - PADDING.right
  const barW = Math.max(2, inner / bars.length)
  const candleW = Math.max(1, barW * 0.6)

  ctx.clearRect(0, 0, width, height)

  // Wyckoff background bands (subtle)
  bars.forEach((bar, i) => {
    const x = PADDING.left + i * barW
    ctx.fillStyle = wyckoffBgColor(bar.wyckoff_phase)
    ctx.fillRect(x, PADDING.top, barW, height - PADDING.top - PADDING.bottom)
  })

  // Grid lines
  ctx.strokeStyle = '#21262d'
  ctx.lineWidth = 1
  const steps = 5
  for (let i = 0; i <= steps; i++) {
    const y = priceToY(minP + (maxP - minP) * (i / steps), minP, maxP, height)
    ctx.beginPath()
    ctx.moveTo(PADDING.left, y)
    ctx.lineTo(width - PADDING.right, y)
    ctx.stroke()
    // Price label
    const price = minP + (maxP - minP) * (i / steps)
    ctx.fillStyle = '#8b949e'
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(price.toFixed(2), PADDING.left - 4, y + 3)
  }

  // Candles
  bars.forEach((bar, i) => {
    const x = PADDING.left + i * barW + barW / 2
    const xLeft = x - candleW / 2
    const bullish = bar.close >= bar.open
    const color = bullish ? '#26a69a' : '#ef5350'

    const yHigh = priceToY(bar.high, minP, maxP, height)
    const yLow = priceToY(bar.low, minP, maxP, height)
    const yOpen = priceToY(bar.open, minP, maxP, height)
    const yClose = priceToY(bar.close, minP, maxP, height)

    // Wick
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, yHigh)
    ctx.lineTo(x, yLow)
    ctx.stroke()

    // Body
    const bodyTop = Math.min(yOpen, yClose)
    const bodyH = Math.max(1, Math.abs(yClose - yOpen))
    ctx.fillStyle = bullish ? color : color
    ctx.fillRect(xLeft, bodyTop, candleW, bodyH)

    // Pulse tint overlay on body
    ctx.fillStyle = pulseToColor(bar.pulse, 0.25)
    ctx.fillRect(xLeft, bodyTop, candleW, bodyH)
  })

  // Date axis — show ~8 labels
  const step = Math.max(1, Math.floor(bars.length / 8))
  ctx.fillStyle = '#8b949e'
  ctx.font = '9px monospace'
  ctx.textAlign = 'center'
  for (let i = 0; i < bars.length; i += step) {
    const x = PADDING.left + i * barW + barW / 2
    const label = bars[i].date.slice(5) // MM-DD
    ctx.fillText(label, x, height - 4)
  }

  return { minP, maxP, barW }
}

function drawOscillator(ctx, bars, width, height) {
  if (!bars.length) return

  ctx.clearRect(0, 0, width, height)

  const inner = width - PADDING.left - PADDING.right
  const barW = inner / bars.length

  // Background
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, width, height)

  // Threshold lines
  const thresholds = [
    { v: 0.6,  color: THRESHOLD_COLORS.strongBull, label: '+0.6' },
    { v: 0.2,  color: THRESHOLD_COLORS.bull,       label: '+0.2' },
    { v: 0,    color: '#30363d',                   label: '0' },
    { v: -0.2, color: THRESHOLD_COLORS.bear,       label: '−0.2' },
    { v: -0.6, color: THRESHOLD_COLORS.strongBear, label: '−0.6' },
  ]

  thresholds.forEach(({ v, color, label }) => {
    const y = pulseToY(v, height)
    ctx.strokeStyle = color
    ctx.lineWidth = v === 0 ? 1.5 : 1
    ctx.setLineDash(v === 0 ? [] : [4, 3])
    ctx.beginPath()
    ctx.moveTo(PADDING.left, y)
    ctx.lineTo(width - PADDING.right, y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#8b949e'
    ctx.font = '9px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(label, PADDING.left - 4, y + 3)
  })

  // Filled area under/over zero
  const zeroY = pulseToY(0, height)

  bars.forEach((bar, i) => {
    const x = PADDING.left + i * barW
    const y = pulseToY(bar.pulse, height)
    const barHeight = Math.abs(y - zeroY)
    const top = Math.min(y, zeroY)

    ctx.fillStyle = pulseToColor(bar.pulse, 0.7)
    ctx.fillRect(x, top, Math.max(barW - 0.5, 1), Math.max(barHeight, 1))
  })

  // Pulse line
  ctx.strokeStyle = '#58a6ff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  bars.forEach((bar, i) => {
    const x = PADDING.left + i * barW + barW / 2
    const y = pulseToY(bar.pulse, height)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()

  // Axis title
  ctx.fillStyle = '#8b949e'
  ctx.font = '10px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('PULSE', PADDING.left + 4, 14)
}

export default function PulseChart({ bars }) {
  const candleRef = useRef(null)
  const oscRef = useRef(null)
  const containerRef = useRef(null)

  const [replayIndex, setReplayIndex] = useState(0)
  const [tooltip, setTooltip] = useState({ visible: false, bar: null, x: 0, y: 0 })
  const [dims, setDims] = useState({ width: 900 })

  // Sync replayIndex to full bars length when data arrives
  useEffect(() => {
    if (bars.length > 0) setReplayIndex(bars.length - 1)
  }, [bars.length])

  // Observe container width
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      setDims({ width: Math.max(400, w) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Visible bars driven by replay scrubber
  const visibleBars = useMemo(
    () => bars.slice(0, replayIndex + 1),
    [bars, replayIndex]
  )

  // Draw candlestick chart
  useEffect(() => {
    const canvas = candleRef.current
    if (!canvas || !visibleBars.length) return
    canvas.width = dims.width
    canvas.height = CANDLESTICK_HEIGHT
    const ctx = canvas.getContext('2d')
    drawCandlesticks(ctx, visibleBars, dims.width, CANDLESTICK_HEIGHT)
  }, [visibleBars, dims.width])

  // Draw oscillator
  useEffect(() => {
    const canvas = oscRef.current
    if (!canvas || !visibleBars.length) return
    canvas.width = dims.width
    canvas.height = OSCILLATOR_HEIGHT
    const ctx = canvas.getContext('2d')
    drawOscillator(ctx, visibleBars, dims.width, OSCILLATOR_HEIGHT)
  }, [visibleBars, dims.width])

  // Compute bar index from mouse X
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
  }, [visibleBars, dims.width])

  const handleMouseMove = useCallback((e) => {
    const bar = getBarAtX(e.clientX)
    if (bar) {
      setTooltip({ visible: true, bar, x: e.clientX, y: e.clientY })
    } else {
      setTooltip(prev => ({ ...prev, visible: false }))
    }
  }, [getBarAtX])

  const handleMouseLeave = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false }))
  }, [])

  if (!bars.length) return null

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Candlestick pane */}
      <div style={styles.paneLabel}>
        <span style={styles.paneLabelText}>Candlestick · Wyckoff Band</span>
      </div>
      <div style={{ position: 'relative' }}>
        <canvas
          ref={candleRef}
          style={styles.canvas}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        <ConvictionTooltip
          bar={tooltip.bar}
          x={tooltip.x}
          y={tooltip.y}
          visible={tooltip.visible}
        />
      </div>

      {/* Oscillator lane */}
      <canvas ref={oscRef} style={{ ...styles.canvas, marginTop: 1 }} />

      {/* Heatmap strip */}
      <div style={styles.controls}>
        <HeatmapStrip bars={visibleBars} visibleStart={0} visibleEnd={visibleBars.length - 1} />

        {/* Replay scrubber */}
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
    padding: '6px 16px',
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
    padding: '12px 16px',
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
