import { useState } from 'react'

export default function TickerInput({ onSubmit, disabled, isMobile }) {
  const [value, setValue] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const sym = value.trim().toUpperCase()
    if (sym && !disabled) onSubmit(sym)
  }

  return (
    <form onSubmit={handleSubmit} style={{
      ...styles.form,
      width: isMobile ? '100%' : 'auto',
    }}>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value.toUpperCase())}
        placeholder="Enter ticker symbol…"
        disabled={disabled}
        maxLength={10}
        spellCheck={false}
        autoComplete="off"
        style={{
          ...styles.input,
          flex: isMobile ? 1 : 'none',
          width: isMobile ? 'auto' : '160px',
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
          // Prevent iOS zoom on focus (font-size must be >= 16px)
          fontSize: '16px',
        }}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        style={{
          ...styles.button,
          opacity: disabled || !value.trim() ? 0.5 : 1,
          cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
          flexShrink: 0,
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
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontWeight: 600,
    letterSpacing: '0.08em',
    padding: '10px 14px',
    outline: 'none',
    minWidth: 0,
    transition: 'border-color 0.15s',
    WebkitAppearance: 'none',
  },
  button: {
    background: '#238636',
    border: '1px solid #2ea043',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    padding: '10px 18px',
    transition: 'background 0.15s',
    whiteSpace: 'nowrap',
    WebkitAppearance: 'none',
  },
}
