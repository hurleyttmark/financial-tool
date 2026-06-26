import { useAnalysis } from './hooks/useAnalysis.js'
import TickerInput from './components/TickerInput.jsx'
import StatusBar from './components/StatusBar.jsx'
import PulseChart from './components/PulseChart.jsx'
import { useState, useEffect } from 'react'

export default function App() {
  const { state, analyze, retry } = useAnalysis()
  const isLoading = state.status === 'connecting' || state.status === 'streaming'
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={{
          ...styles.headerInner,
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? 10 : 24,
        }}>
          <div style={styles.brand}>
            <span style={styles.brandIcon}>◈</span>
            <div style={styles.brandText}>
              <span style={styles.brandName}>Pulse Analyzer</span>
              {!isMobile && (
                <span style={styles.brandSub}>Fibonacci MA · Candlestick · Wyckoff</span>
              )}
            </div>
          </div>
          <TickerInput onSubmit={analyze} disabled={isLoading} isMobile={isMobile} />
        </div>
      </header>

      <div style={{
        ...styles.statusRow,
        padding: isMobile ? '8px 12px 0' : '8px 24px 0',
      }}>
        <StatusBar state={state} onRetry={retry} />
      </div>

      <main style={{
        ...styles.main,
        padding: isMobile ? '12px 8px 24px' : '16px 24px 32px',
      }}>
        {state.status === 'idle' && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>◈</div>
            <div style={styles.emptyTitle}>Enter a ticker symbol to begin</div>
            <div style={styles.emptyHint}>
              Fetches 300 daily bars · Fused pulse: Fibonacci MA + Candlestick + Wyckoff
            </div>
          </div>
        )}

        {state.status === 'error' && state.bars.length === 0 && (
          <div style={styles.errorCard}>
            <div style={styles.errorCardIcon}>⚠</div>
            <div style={styles.errorCardText}>{state.errorMessage}</div>
          </div>
        )}

        {(state.status === 'streaming' || state.status === 'complete') &&
          state.bars.length > 0 && (
            <PulseChart bars={state.bars} isMobile={isMobile} />
          )}

        {state.status === 'connecting' && (
          <div style={styles.spinnerCard}>
            <div style={styles.spinnerRing} />
            <div style={styles.spinnerText}>Connecting…</div>
          </div>
        )}

        {state.status === 'streaming' && state.bars.length === 0 && (
          <div style={styles.spinnerCard}>
            <div style={styles.spinnerRing} />
            <div style={styles.spinnerText}>{state.statusMessage || 'Fetching data…'}</div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes ring-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

const styles = {
  app: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0d1117',
  },
  header: {
    background: '#161b22',
    borderBottom: '1px solid #30363d',
    padding: '12px 16px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerInner: {
    display: 'flex',
    justifyContent: 'space-between',
    maxWidth: 1400,
    margin: '0 auto',
    width: '100%',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  brandText: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    fontSize: 20,
    color: '#58a6ff',
  },
  brandName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#e6edf3',
    letterSpacing: '0.02em',
  },
  brandSub: {
    fontSize: 11,
    color: '#8b949e',
    letterSpacing: '0.04em',
  },
  statusRow: {
    maxWidth: 1400,
    margin: '0 auto',
    width: '100%',
  },
  main: {
    flex: 1,
    maxWidth: 1400,
    margin: '0 auto',
    width: '100%',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    gap: 12,
    padding: '0 24px',
  },
  emptyIcon: {
    fontSize: 40,
    color: '#30363d',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    color: '#e6edf3',
    fontWeight: 600,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    color: '#8b949e',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  errorCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    gap: 16,
    background: 'rgba(248,81,73,0.06)',
    border: '1px solid rgba(248,81,73,0.25)',
    borderRadius: 8,
    padding: 24,
  },
  errorCardIcon: { fontSize: 32, color: '#f85149' },
  errorCardText: {
    fontSize: 14,
    color: '#f85149',
    textAlign: 'center',
    maxWidth: 480,
    lineHeight: 1.6,
  },
  spinnerCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 250,
    gap: 16,
  },
  spinnerRing: {
    width: 36,
    height: 36,
    border: '3px solid #30363d',
    borderTop: '3px solid #58a6ff',
    borderRadius: '50%',
    animation: 'ring-spin 0.8s linear infinite',
  },
  spinnerText: { color: '#8b949e', fontSize: 13 },
}
