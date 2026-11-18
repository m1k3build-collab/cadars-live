import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { demoBundles, getDemoState, subscribeDemo } from './lib/demo.ts'
import { friendlyMessage, londonParts } from './lib/format.ts'
import {
  fetchCoverage,
  fetchDirectory,
  fetchEvents,
  fetchMembers,
  fetchOnAir,
  fetchRepeaters,
  fetchYearNets,
} from './lib/live.ts'
import { supabase } from './lib/supabase.ts'
import { useApp } from './state.tsx'
import type { ClubEvent, CoverageReport, DirectoryEntry, Member, NetBundle, OnAirRow, Repeater } from './types.ts'

export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return
    const main = document.getElementById('content')
    main?.classList.add('locked')
    return () => {
      main?.classList.remove('locked')
    }
  }, [locked])
}

export function useOnAir() {
  const { demo } = useApp()
  const demoState = useSyncExternalStore(subscribeDemo, getDemoState, getDemoState)
  const [rows, setRows] = useState<OnAirRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('CONNECTING')

  const reload = useCallback(async () => {
    try {
      setRows(await fetchOnAir())
      setError(null)
    } catch (err) {
      setError(friendlyMessage(err))
    }
  }, [])

  useEffect(() => {
    if (demo) return
    let stop = false
    void reload()
    const channel = supabase
      .channel('cadars-on-air')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'on_air' }, () => {
        if (!stop) void reload()
      })
      .subscribe((next) => {
        if (!stop) setStatus(next)
      })
    const poll = window.setInterval(() => {
      if (!document.hidden) void reload()
    }, 45000)
    const onVis = () => {
      if (!document.hidden) void reload()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stop = true
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onVis)
      void supabase.removeChannel(channel)
    }
  }, [demo, reload])

  if (demo) return { rows: demoState.onAir, error: null, loading: false, status: 'DEMO', reload: async () => {} }
  return { rows, error, loading: rows === null && !error, status, reload }
}

export function useNets() {
  const { demo } = useApp()
  const demoState = useSyncExternalStore(subscribeDemo, getDemoState, getDemoState)
  const [nets, setNets] = useState<NetBundle[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('CONNECTING')

  const reload = useCallback(async () => {
    try {
      const year = Number(londonParts().year)
      setNets(await fetchYearNets(year))
      setError(null)
    } catch (err) {
      setError(friendlyMessage(err))
    }
  }, [])

  useEffect(() => {
    if (demo) return
    let stop = false
    void reload()
    const channel = supabase
      .channel('cadars-checkins')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, () => {
        if (!stop) void reload()
      })
      .subscribe((next) => {
        if (!stop) setStatus(next)
      })
    const poll = window.setInterval(() => {
      if (!document.hidden) void reload()
    }, 45000)
    const onVis = () => {
      if (!document.hidden) void reload()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stop = true
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onVis)
      void supabase.removeChannel(channel)
    }
  }, [demo, reload])

  if (demo) return { nets: demoBundles(demoState), error: null, loading: false, status: 'DEMO', reload: async () => {} }
  return { nets, error, loading: nets === null && !error, status, reload }
}

export function useRepeaters() {
  const { demo } = useApp()
  const demoState = useSyncExternalStore(subscribeDemo, getDemoState, getDemoState)
  const [rows, setRows] = useState<Repeater[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try {
      setRows(await fetchRepeaters())
      setError(null)
    } catch (err) {
      setError(friendlyMessage(err))
    }
  }, [])
  useEffect(() => {
    if (demo) return
    void reload()
  }, [demo, reload])
  if (demo) return { rows: demoState.repeaters, error: null, loading: false, reload }
  return { rows, error, loading: rows === null && !error, reload }
}

export function useEvents() {
  const { demo } = useApp()
  const demoState = useSyncExternalStore(subscribeDemo, getDemoState, getDemoState)
  const [rows, setRows] = useState<ClubEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try {
      setRows(await fetchEvents())
      setError(null)
    } catch (err) {
      setError(friendlyMessage(err))
    }
  }, [])
  useEffect(() => {
    if (demo) return
    void reload()
  }, [demo, reload])
  if (demo) return { rows: demoState.events, error: null, loading: false, reload }
  return { rows, error, loading: rows === null && !error, reload }
}

export function useCoverage() {
  const { demo } = useApp()
  const demoState = useSyncExternalStore(subscribeDemo, getDemoState, getDemoState)
  const [rows, setRows] = useState<CoverageReport[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try {
      setRows(await fetchCoverage())
      setError(null)
    } catch (err) {
      setError(friendlyMessage(err))
    }
  }, [])
  useEffect(() => {
    if (demo) return
    void reload()
  }, [demo, reload])
  if (demo) return { rows: demoState.coverage, error: null, loading: false, reload }
  return { rows, error, loading: rows === null && !error, reload }
}

export function useMembers() {
  const { demo } = useApp()
  const demoState = useSyncExternalStore(subscribeDemo, getDemoState, getDemoState)
  const [rows, setRows] = useState<Member[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try {
      setRows(await fetchMembers())
      setError(null)
    } catch (err) {
      setError(friendlyMessage(err))
    }
  }, [])
  useEffect(() => {
    if (demo) return
    void reload()
  }, [demo, reload])
  if (demo) return { rows: demoState.members, error: null, loading: false, reload }
  return { rows, error, loading: rows === null && !error, reload }
}

export function useDirectory() {
  const { demo } = useApp()
  const demoState = useSyncExternalStore(subscribeDemo, getDemoState, getDemoState)
  const [rows, setRows] = useState<DirectoryEntry[] | null>(null)
  useEffect(() => {
    if (demo) return
    let cancel = false
    fetchDirectory()
      .then((data) => {
        if (!cancel) setRows(data)
      })
      .catch(() => {
        if (!cancel) setRows([])
      })
    return () => {
      cancel = true
    }
  }, [demo])
  const source = demo ? demoState.directory : rows
  return useMemo(() => {
    const map = new Map<string, DirectoryEntry>()
    for (const entry of source ?? []) map.set(entry.callsign.toUpperCase(), entry)
    return map
  }, [source])
}
