/**
 * ReplayScrubber.jsx — Drag scrubber that controls which historical bars are visible.
 * Emits onScrub(index) as user drags, which drives chart re-render.
 */
import { useRef, useCallback, useEffect } from 'react'
import { clamp } from '../utils/colors.js'

export default function ReplayScrubber({ totalBars, currentIndex, onScrub, disabled }) {
  const trackRef = useRef(null)
  const dragging = useRef(false)

  const computeIndex = useCallback((clientX) => {
    const track = trackRef.current
    if (!track || totalBars <= 1) return 0
    const rect = track.getBoundingClientRect()
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
    return Math.round(ratio * (totalBars - 1))
  }, [totalBars])

  const handleMouseDown = useCallback((e) => {
    if (disabled) return
    dragging.current = true
    onScrub(computeIndex(e.clientX))
    e.preventDefault()
  }, [disabled, computeIndex, onScrub])

  const handleMouseMove = useCallback((e) => {
    if (!dragging.current) return
    onScrub(computeIndex(e.clientX))
  }, [computeIndex, onScrub])

  const handleMouseUp = useCallback(() => {
    dragging.current = false
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // Touch support
  const handleTouchStart = useCallback((e) => {
    if (disabled) return
    dragging.current = true
    onScrub(computeIndex(e.touches[0].clientX))
  }, [disabled, computeIndex, onScrub])

  const handleTouchMove = useCallback((e) => {
    if (!dragging.current) return
    onScrub(computeIndex(e.touches[0].clientX))
  }, [computeIndex, onScrub])

  const handleTouchEnd = useCallback(() => {
    dragging.current = false
  }, [])

  const pct = totalBars > 1 ? (currentIndex / (totalBars - 1)) * 100 : 0

  return (
    <div style={styles.wrapper}>
      <span style={styles.label}>Replay</span>
      <div
        ref={trackRef}
        style={{
          ...styles.track,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div style={{ ...styles.fill, width: `${pct}%` }} />
        <div style={{ ...styles.thumb, left: `${pct}%` }} />
      </div>
      <span style={styles.index}>
        {totalBars > 0 ? `${currentIndex + 1} / ${totalBars}` : '—'}
      </span>
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontSize: 11,
    color: '#8b949e',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  track: {
    flex: 1,
    height: 6,
    background: '#21262d',
    borderRadius: 3,
    position: 'relative',
    border: '1px solid #30363d',
    userSelect: 'none',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    background: '#58a6ff',
    borderRadius: 3,
    transition: 'width 0.05s',
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: '#58a6ff',
    border: '2px solid #0d1117',
    boxShadow: '0 0 0 1px #58a6ff',
    transition: 'left 0.05s',
    zIndex: 1,
  },
  index: {
    fontSize: 11,
    color: '#8b949e',
    fontFamily: 'monospace',
    flexShrink: 0,
    minWidth: 54,
    textAlign: 'right',
  },
}
