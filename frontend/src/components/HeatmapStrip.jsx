import { pulseToColor, fmt } from '../utils/colors.js'

export default function HeatmapStrip({ bars, visibleStart, visibleEnd, isMobile }) {
  if (!bars || bars.length === 0) return null

  const start = Math.max(0, visibleStart ?? 0)
  const end = Math.min(bars.length - 1, visibleEnd ?? bars.length - 1)
  const visible = bars.slice(start, end + 1)
  if (visible.length === 0) return null

  // Fewer cells on mobile so labels don't overflow
  const CELLS = isMobile ? 5 : 8
  const bucketSize = Math.ceil(visible.length / CELLS)
  const buckets = []

  for (let i = 0; i < CELLS; i++) {
    const slice = visible.slice(i * bucketSize, (i + 1) * bucketSize)
    if (slice.length === 0) break
    const avg = slice.reduce((sum, b) => sum + b.pulse, 0) / slice.length
    const firstDate = slice[0].date
    const lastDate = slice[slice.length - 1].date
    buckets.push({ avg, firstDate, lastDate, count: slice.length })
  }

  return (
    <div style={styles.container}>
      <span style={styles.label}>Pulse Heatmap</span>
      <div style={styles.strip}>
        {buckets.map((b, i) => (
          <div
            key={i}
            title={`${b.firstDate} – ${b.lastDate}\nAvg pulse: ${fmt(b.avg, 3)}`}
            style={{
              ...styles.cell,
              background: pulseToColor(b.avg, 0.85),
              flex: b.count,
            }}
          >
            {!isMobile && (
              <span style={styles.cellText}>{fmt(b.avg, 2)}</span>
            )}
          </div>
        ))}
      </div>
      <div style={styles.axis}>
        <span style={{ color: '#f85149' }}>−1</span>
        <span style={{ color: '#8b949e' }}>0</span>
        <span style={{ color: '#3fb950' }}>+1</span>
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: {
    fontSize: 10,
    color: '#8b949e',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  strip: {
    display: 'flex',
    height: 22,
    borderRadius: 4,
    overflow: 'hidden',
    border: '1px solid #30363d',
    gap: 1,
    background: '#21262d',
  },
  cell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
    minWidth: 0,
  },
  cellText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'monospace',
    userSelect: 'none',
  },
  axis: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    padding: '0 2px',
  },
}
