/**
 * useAnalysis.js
 * Custom hook managing WebSocket connection to /ws/analyze/{symbol}.
 * 
 * State machine:
 *   idle → connecting → streaming → complete | error
 *
 * On each new symbol submission:
 *   1. Close any existing WebSocket
 *   2. Clear prior bar data immediately (no stale-data overlap)
 *   3. Open new WebSocket
 *   4. Accumulate bars as they stream in
 *   5. Mark complete when server sends {type:"complete"}
 *
 * Cleanup: WebSocket closed on component unmount or new symbol.
 */
import { useState, useRef, useCallback, useEffect } from 'react'

const WS_BASE = 'wss://financial-tool-wlz9.onrender.com/ws/analyze'

export function useAnalysis() {
  const [state, setState] = useState({
    status: 'idle',     // idle | connecting | streaming | complete | error
    symbol: null,
    bars: [],
    statusMessage: '',
    errorMessage: '',
    barCount: 0,
    source: '',
  })

  const wsRef = useRef(null)

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      // Remove handlers before closing to avoid spurious error events
      const ws = wsRef.current
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
      wsRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => closeWs()
  }, [closeWs])

  const analyze = useCallback((symbol) => {
    const sym = symbol.trim().toUpperCase()
    if (!sym) return

    // Close prior connection, clear state immediately
    closeWs()
    setState({
      status: 'connecting',
      symbol: sym,
      bars: [],
      statusMessage: 'Connecting…',
      errorMessage: '',
      barCount: 0,
      source: '',
    })

    const ws = new WebSocket(`${WS_BASE}/${encodeURIComponent(sym)}`)
    wsRef.current = ws

    ws.onopen = () => {
      setState(prev => ({
        ...prev,
        status: 'streaming',
        statusMessage: 'Connected — waiting for data…',
      }))
    }

    ws.onmessage = (event) => {
      let msg
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }

      switch (msg.type) {
        case 'status':
          setState(prev => ({ ...prev, statusMessage: msg.message }))
          break

        case 'bars':
          setState(prev => ({
            ...prev,
            status: 'streaming',
            bars: [...prev.bars, ...msg.bars],
            statusMessage: `Loading… ${prev.bars.length + msg.bars.length} bars`,
          }))
          break

        case 'complete':
          setState(prev => ({
            ...prev,
            status: 'complete',
            statusMessage: '',
            barCount: msg.bar_count,
            source: msg.source,
          }))
          break

        case 'error':
          setState(prev => ({
            ...prev,
            status: 'error',
            errorMessage: msg.message,
            statusMessage: '',
          }))
          break

        default:
          break
      }
    }

    ws.onerror = () => {
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: 'WebSocket connection error. Is the backend running on port 8000?',
        statusMessage: '',
      }))
    }

    ws.onclose = (event) => {
      // Only treat as error if we didn't reach complete/error already
      setState(prev => {
        if (prev.status === 'streaming' || prev.status === 'connecting') {
          return {
            ...prev,
            status: 'error',
            errorMessage: `Connection closed unexpectedly (code ${event.code}).`,
            statusMessage: '',
          }
        }
        return prev
      })
    }
  }, [closeWs])

  const retry = useCallback((symbol) => {
    if (symbol) analyze(symbol)
  }, [analyze])

  return { state, analyze, retry }
}
