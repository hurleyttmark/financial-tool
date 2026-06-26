/**
 * ReplayScrubber.jsx — Drag scrubber with large hit area + Play/Pause button.
 */
import { useRef, useCallback, useEffect, useState } from 'react'
import { clamp } from '../utils/colors.js'

export default function ReplayScrubber({ totalBars, currentIndex, onScrub, disabled }) {
  const trackRef = useRef(null)
  const dragging = useRef(false)
  const playRef = useRef(null)
  const [playing, setPlaying] = useState(false)

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
    setPlaying(false)
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

  // Play animation
  useEffect(() => {
    if (!playing) {
      if (playRef.current) clearInterval(playRef.current)
      return
    }
    // If at end, restart from beginning
    if (currentIndex >= totalBars - 1) onScrub(0)
    playRef.current = setInterval(() => {
      onScrub(prev => {
        if (prev >= totalBars - 1) {
          setPlaying(false)
          clearInterval(playRef.current)
          return prev
        }
        return prev + 1
      })
    }, 60)
    return () => clearInterval(playRef.current)
  }, [playing, totalBars])

  const togglePlay = useCallback(() => {
    if (disabled) return
    setPlaying(p => !p)
  }, [disabled])

  const pct = totalBars > 1 ? (currentIndex / (totalBars - 1)) * 100 : 100

  return (
    <div style={styles.wrapper}>
      <span style={styles.label}>Replay</span>

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        disabled={disabled}
        style={{
          ...styles.playBtn,
          opacity: disabled ? 0.4 : 1,
        }}
        title={playing ? 'Pause' : 'Play replay'}
      >
        {playing ? '⏸' : '▶'}
      </button>

      {/* Large hit-area track */}
      <div style={styles.trackWrapper}>
        <div
          ref={trackRef}
          style={{
            ...styles.track,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.4 : 1,
          }}
          onMouseDown={handleMouseDown}
        >
          <div style={{ ...styles.fill, width: `${pct}%` }} />
          <div style={{ ...styles.thumb, left: `${pct}%` }} />
        </div>
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
  playBtn: {
    background: '#21262d',
    border: '1px solid #30363d',
    borderRadius: '50%',
    color: '#58a6ff',
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    flexShrink: 0,
    cursor: 'pointer',
    padding: 0,
  },
  trackWrapper: {
    flex: 1,
    padding: '10px 0',  // large vertical hit area
    cursor: 'pointer',
  },
  track: {
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
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#58a6ff',
    border: '2px solid #0d1117',
    boxShadow: '0 0 0 2px #58a6ff',
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
