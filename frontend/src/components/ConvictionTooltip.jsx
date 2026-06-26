import { pulseToTextColor, fmt, fmtPrice, fmtVolume } from '../utils/colors.js'

export default function ConvictionTooltip({ bar, x, y, visible, isMobile }) {
  if (!visible || !bar) return null

  const pulse = bar.pulse
  const color = pulseToTextColor(pulse)

  // On mobile: anchor to top of screen, full width. On desktop: follow cursor.
  const mobileStyle = {
    position: 'fixed',
    top: 60,
    left: 8,
    right: 8,
    width: 'auto',
    transform: 'none',
    zIndex: 1000,
  }

  const desktopStyle = {
    position: 'fixed',
    zIndex: 1000,
    left: x + 12,
    top: y - 10,
    width: 230,
    transform: x > window.innerWidth - 280 ? 'translateX(-110%)' : 'none',
  }

  return (
    <div style={{ ...styles.tooltip, ...(isMobile ? mobileStyle : desktopStyle) }}>
      <div style={styles.header}>
        <span style={styles.date}>{bar.date}</span>
        <span style={{ ...styles.conviction, color }}>{bar.conviction}</span>
      </div>

      <div style={styles.grid}>
        <Row label="Open"   value={fmtPrice(bar.open)} />
        <Row label="High"   value={fmtPrice(bar.high)} />
        <Row label="Low"    value={fmtPrice(bar.low)} />
        <Row label="Close"  value={fmtPrice(bar.close)} />
        <Row label="Volume" value={fmtVolume(bar.volume)} />
      </div>

      <div style={styles.divider} />

      <div style={styles.scores}>
        <ScoreRow label="Pulse"   value={bar.pulse}         color={color} />
        <ScoreRow label="Fib MA"  value={bar.fib_score}     color={pulseToTextColor(bar.fib_score)} />
        <ScoreRow label="Candle"  value={bar.candle_score}  color={pulseToTextColor(bar.candle_score)} />
        <ScoreRow label="Wyckoff" value={bar.wyckoff_score} color={pulseToTextColor(bar.wyckoff_score)} />
      </div>

      <div style={styles.phase}>
        <span style={styles.phaseLabel}>Phase:</span>
        <span style={{ color: pulseToTextColor(bar.wyckoff_score) }}>{bar.wyckoff_phase}</span>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowValue}>{value}</span>
    </div>
  )
}

function ScoreRow({ label, value, color }) {
  const pct = Math.round(Math.abs(value) * 100)
  const dir = value >= 0 ? '+' : ''
  return (
    <div style={styles.scoreRow}>
      <span style={styles.scoreLabel}>{label}</span>
      <div style={styles.scoreBar}>
        <div style={{
          ...styles.scoreFill,
          width: `${pct}%`,
          background: color,
          marginLeft: value < 0 ? 'auto' : undefined,
        }} />
      </div>
      <span style={{ ...styles.scoreValue, color }}>{dir}{fmt(value, 3)}</span>
    </div>
  )
}

const styles = {
  tooltip: {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '12px 14px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    pointerEvents: 'none',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: { color: '#8b949e', fontSize: 11, fontFamily: 'monospace' },
  conviction: { fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2px 8px',
    marginBottom: 8,
  },
  row: { display: 'flex', justifyContent: 'space-between', fontSize: 12 },
  rowLabel: { color: '#8b949e' },
  rowValue: { color: '#e6edf3', fontFamily: 'monospace' },
  divider: { borderTop: '1px solid #30363d', margin: '8px 0' },
  scores: { display: 'flex', flexDirection: 'column', gap: 4 },
  scoreRow: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 },
  scoreLabel: { color: '#8b949e', width: 46, flexShrink: 0 },
  scoreBar: {
    flex: 1,
    height: 4,
    background: '#21262d',
    borderRadius: 2,
    overflow: 'hidden',
    display: 'flex',
  },
  scoreFill: {
    height: '100%',
    borderRadius: 2,
    opacity: 0.85,
    minWidth: 2,
    transition: 'width 0.1s',
  },
  scoreValue: {
    width: 44,
    textAlign: 'right',
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  phase: {
    display: 'flex',
    gap: 6,
    fontSize: 11,
    marginTop: 8,
    paddingTop: 6,
    borderTop: '1px solid #30363d',
  },
  phaseLabel: { color: '#8b949e' },
}
