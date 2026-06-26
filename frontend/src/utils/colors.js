/**
 * utils.js — Color mapping and formatting helpers.
 */

/**
 * Map pulse value [−1, +1] to an RGBA color.
 * Negative → red spectrum, positive → green spectrum, near-zero → gray.
 */
export function pulseToColor(pulse, alpha = 1.0) {
  const p = Math.max(-1, Math.min(1, pulse))
  if (p > 0) {
    // Green gradient: 0 → muted, 1 → bright green
    const g = Math.round(80 + p * 90)
    const r = Math.round(38 - p * 20)
    const b = Math.round(74 - p * 30)
    return `rgba(${r},${g},${b},${alpha})`
  } else {
    // Red gradient: 0 → muted, -1 → bright red
    const abs = Math.abs(p)
    const r = Math.round(150 + abs * 100)
    const g = Math.round(50 - abs * 40)
    const b = Math.round(50 - abs * 20)
    return `rgba(${r},${g},${b},${alpha})`
  }
}

/**
 * Map pulse to a CSS color string for UI labels.
 */
export function pulseToTextColor(pulse) {
  if (pulse > 0.2) return '#3fb950'
  if (pulse < -0.2) return '#f85149'
  return '#8b949e'
}

/**
 * Format a number to fixed decimal places.
 */
export function fmt(n, decimals = 4) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toFixed(decimals)
}

/**
 * Format a large volume number compactly.
 */
export function fmtVolume(v) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(Math.round(v))
}

/**
 * Format a price.
 */
export function fmtPrice(p) {
  if (p == null || isNaN(p)) return '—'
  return `$${Number(p).toFixed(2)}`
}

/**
 * Wyckoff phase → background color (subtle).
 */
export function wyckoffBgColor(phase) {
  switch (phase) {
    case 'Mark-Up':      return 'rgba(63,185,80,0.12)'
    case 'Accumulation': return 'rgba(63,185,80,0.05)'
    case 'Distribution': return 'rgba(248,81,73,0.05)'
    case 'Mark-Down':    return 'rgba(248,81,73,0.12)'
    default:             return 'rgba(139,148,158,0.04)'
  }
}

/**
 * Clamp a value between min and max.
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}
