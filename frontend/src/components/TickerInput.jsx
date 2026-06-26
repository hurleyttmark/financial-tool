/**
 * TickerInput.jsx — Ticker search bar.
 * Disabled while a request is in flight to prevent double-fire.
 */
import { useState } from 'react'

export default function TickerInput({ onSubmit, disabled }) {
  const [value, setValue] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const sym = value.trim().toUpperCase()
    if (sym && !disabled) onSubmit(sym)
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value.toUpperCase())}
        placeholder="Enter ticker symbol…"
        disabled={disabled}
        maxLength={10}
        spellCheck={false}
        autoComplete="off"
        autoFocus
        style={{
          ...styles.input,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        style={{
          ...styles.button,
          opacity: disabled || !value.trim() ? 0.5 : 1,
          cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {disabled ? 'Loading…' : 'Analyze'}
      </button>
    </form>
  )
}

const styles = {
  form: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  input: {
    background: '#21262d',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#e6edf3',
    fontSize: '16px',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontWeight: 600,
    letterSpacing: '0.08em',
    padding: '8px 14px',
    outline: 'none',
    width: '160px',
    transition: 'border-color 0.15s',
  },
  button: {
    background: '#238636',
    border: '1px solid #2ea043',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    padding: '8px 18px',
    transition: 'background 0.15s',
    whiteSpace: 'nowrap',
  },
}
