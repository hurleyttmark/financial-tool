/**
 * App.jsx — Root component.
 *
 * State shape (owned by useAnalysis hook):
 *   status: 'idle' | 'connecting' | 'streaming' | 'complete' | 'error'
 *   symbol: string | null
 *   bars: PulseBar[]           — accumulates as WebSocket streams
 *   statusMessage: string
 *   errorMessage: string
 *   barCount: number
 *   source: string
 *
 * Data path:
 *   User types ticker → analyze(sym) → WebSocket /ws/analyze/{sym}
 *     → status messages → bar chunks accumulate in state → complete
 *   Stale state cleared before new connection opens (no overlap).
 *   All async boundaries have loading AND error states.
 */
import { useAnalysis } from './hooks/useAnalysis.js'
import TickerInput from './components/TickerInput.jsx'
import StatusBar from './components/StatusBar.jsx'
import PulseChart from './components/PulseChart.jsx'

export default function App() {
  const { state, analyze, retry } = useAnalysis()
  const isLoading = state.status === 'connecting' || state.status === 'streaming'

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.brand}>
            <span style={styles.brandIcon}>◈</span>
            <span style={styles.brandName}>Pulse Analyzer</span>
            <span style={styles.brandSub}>Fibonacci MA · Candlestick · Wyckoff</span>
          </div>
          <TickerInput onSubmit={analyze} disabled={isLoading} />
        </div>
      </header>

      {/* Status */}
      <div style={styles.statusRow}>
        <StatusBar state={state} onRetry={retry} />
      </div>

      {/* Main content */}
      <main style={styles.main}>
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

        {/* Chart renders incrementally as bars stream in */}
        {(state.status === 'streaming' || state.status === 'complete') &&
          state.bars.length > 0 && (
            <PulseChart bars={state.bars} />
          )}

        {/* Spinner overlay during connecting (no bars yet) */}
        {state.status === 'connecting' && (
          <div style={styles.spinnerCard}>
            <div style={styles.spinnerRing} />
            <div style={styles.spinnerText}>Connecting…</div>
          </div>
        )}

        {/* Spinner while streaming but no bars have arrived yet */}
        {state.status === 'streaming' && state.bars.length === 0 && (
          <div style={styles.spinnerCard}>
            <div style={styles.spinnerRing} />
            <div style={styles.spinnerText}>{state.statusMessage || 'Fetching data…'}</div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
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
    padding: '14px 24px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1400,
    margin: '0 auto',
    width: '100%',
    gap: 24,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    fontSize: 22,
    color: '#58a6ff',
  },
  brandName: {
    fontSize: 16,
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
    padding: '8px 24px 0',
    maxWidth: 1400,
    margin: '0 auto',
    width: '100%',
  },
  main: {
    flex: 1,
    padding: '16px 24px 32px',
    maxWidth: 1400,
    margin: '0 auto',
    width: '100%',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
    gap: 12,
    color: '#8b949e',
  },
  emptyIcon: {
    fontSize: 48,
    color: '#30363d',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#e6edf3',
    fontWeight: 600,
  },
  emptyHint: {
    fontSize: 13,
    color: '#8b949e',
    textAlign: 'center',
  },
  errorCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    gap: 16,
    background: 'rgba(248,81,73,0.06)',
    border: '1px solid rgba(248,81,73,0.25)',
    borderRadius: 8,
    padding: 32,
  },
  errorCardIcon: {
    fontSize: 36,
    color: '#f85149',
  },
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
    minHeight: 300,
    gap: 16,
  },
  spinnerRing: {
    width: 40,
    height: 40,
    border: '3px solid #30363d',
    borderTop: '3px solid #58a6ff',
    borderRadius: '50%',
    animation: 'ring-spin 0.8s linear infinite',
  },
  spinnerText: {
    color: '#8b949e',
    fontSize: 13,
  },
}
