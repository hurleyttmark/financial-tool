/**
 * StatusBar.jsx — Shows streaming status, errors, and retry button.
 * Never a blank screen on failure.
 */
export default function StatusBar({ state, onRetry }) {
  const { status, statusMessage, errorMessage, symbol, barCount, source } = state

  if (status === 'idle') return null

  if (status === 'error') {
    return (
      <div style={styles.error}>
        <span style={styles.errorIcon}>⚠</span>
        <span style={styles.errorText}>{errorMessage}</span>
        {symbol && (
          <button onClick={() => onRetry(symbol)} style={styles.retryBtn}>
            Retry
          </button>
        )}
      </div>
    )
  }

  if (status === 'complete') {
    return (
      <div style={styles.success}>
        <span style={styles.dot} />
        <span>
          {symbol} · {barCount} bars · source: {source}
        </span>
      </div>
    )
  }

  // connecting | streaming
  return (
    <div style={styles.loading}>
      <span style={styles.spinner}>⟳</span>
      <span>{statusMessage || 'Loading…'}</span>
    </div>
  )
}

const styles = {
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(248,81,73,0.12)',
    border: '1px solid rgba(248,81,73,0.4)',
    borderRadius: '6px',
    padding: '10px 16px',
    color: '#f85149',
    fontSize: '13px',
  },
  errorIcon: { fontSize: '16px', flexShrink: 0 },
  errorText: { flex: 1, lineHeight: 1.4 },
  retryBtn: {
    background: 'rgba(248,81,73,0.2)',
    border: '1px solid rgba(248,81,73,0.5)',
    borderRadius: '4px',
    color: '#f85149',
    fontSize: '12px',
    fontWeight: 600,
    padding: '4px 12px',
    flexShrink: 0,
  },
  success: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#8b949e',
    fontSize: '12px',
    padding: '4px 0',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#3fb950',
    display: 'inline-block',
    flexShrink: 0,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#58a6ff',
    fontSize: '13px',
    padding: '4px 0',
  },
  spinner: {
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
    fontSize: '16px',
  },
}
