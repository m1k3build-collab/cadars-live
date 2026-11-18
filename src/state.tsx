import type { Session } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DEMO_OPERATOR, resetDemo } from './lib/demo.ts'
import { fetchMember, saveMember } from './lib/live.ts'
import { supabase } from './lib/supabase.ts'
import type { Member, Tab } from './types.ts'
import { errorCode, friendlyMessage } from './lib/format.ts'

type Theme = 'light' | 'dark'
type Operator = { callsign: string; displayName: string | null }
type InstallPrompt = Event & { prompt: () => Promise<void> }

type AppContextValue = {
  tab: Tab
  setTab: (tab: Tab) => void
  theme: Theme
  toggleTheme: () => void
  demo: boolean
  setDemo: (on: boolean) => void
  now: number
  session: Session | null
  authReady: boolean
  member: Member | null
  memberLoading: boolean
  operator: Operator | null
  toast: (message: string) => void
  toasts: { id: string; message: string }[]
  authOpen: boolean
  authReason: string
  openAuth: (reason?: string) => void
  closeAuth: () => void
  profileOpen: boolean
  openProfile: () => void
  closeProfile: () => void
  saveProfile: (callsign: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  installPrompt: InstallPrompt | null
  promptInstall: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

function readTab(): Tab {
  const hash = window.location.hash.replace('#', '')
  if (hash === 'net' || hash === 'repeaters' || hash === 'club' || hash === 'air') return hash
  return 'air'
}

function readTheme(): Theme {
  const saved = localStorage.getItem('cadars-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const TITLES: Record<Tab, string> = {
  air: "Who's on the air",
  net: 'Monday net',
  repeaters: 'Repeaters',
  club: 'Club night',
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>(readTab)
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [demo, setDemoFlag] = useState(() => localStorage.getItem('cadars-demo') === '1')
  const [now, setNow] = useState(() => Date.now())
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [member, setMember] = useState<Member | null>(null)
  const [memberLoading, setMemberLoading] = useState(false)
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([])
  const [authOpen, setAuthOpen] = useState(false)
  const [authReason, setAuthReason] = useState('Sign in with your email. We will send you a code.')
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileDismissed, setProfileDismissed] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const booted = useRef(false)
  const timers = useRef<number[]>([])

  const toast = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((list) => [...list.slice(-2), { id, message }])
    const timer = window.setTimeout(() => {
      setToasts((list) => list.filter((item) => item.id !== id))
    }, 3800)
    timers.current.push(timer)
  }, [])

  useEffect(() => {
    const saved = timers.current
    return () => saved.forEach((timer) => window.clearTimeout(timer))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.getElementById('theme-color')?.setAttribute('content', theme === 'dark' ? '#1c1712' : '#f3ecdf')
  }, [theme])

  useEffect(() => {
    document.title = `${TITLES[tab]} · CADARS Live`
  }, [tab])

  useEffect(() => {
    const onHash = () => setTabState(readTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    let timer = 0
    const tick = () => setNow(Date.now())
    const start = () => {
      tick()
      timer = window.setInterval(tick, 1000)
    }
    const stop = () => window.clearInterval(timer)
    const onVis = () => (document.hidden ? stop() : start())
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setAuthReady(true)
      if (event === 'SIGNED_IN') {
        setAuthOpen(false)
        const url = new URL(window.location.href)
        if (url.searchParams.has('code') || url.searchParams.has('error')) {
          toast('You are signed in.')
          url.search = ''
          window.history.replaceState({}, '', `${url.pathname}${url.hash}`)
        }
      }
      if (event === 'SIGNED_OUT') {
        setMember(null)
        if (booted.current) toast('Signed out.')
      }
      booted.current = true
    })
    return () => data.subscription.unsubscribe()
  }, [toast])

  const userId = session?.user.id ?? null
  useEffect(() => {
    if (!userId) {
      setMember(null)
      setMemberLoading(false)
      return
    }
    let cancel = false
    setMemberLoading(true)
    fetchMember(userId)
      .then((row) => {
        if (!cancel) setMember(row)
      })
      .catch(() => {
        if (!cancel) setMember(null)
      })
      .finally(() => {
        if (!cancel) setMemberLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [userId])

  useEffect(() => {
    if (!demo && session && !memberLoading && !member && !profileDismissed) setProfileOpen(true)
  }, [demo, session, memberLoading, member, profileDismissed])

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const setTab = useCallback((next: Tab) => {
    const hash = `#${next}`
    if (window.location.hash !== hash) window.location.hash = next
    setTabState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      localStorage.setItem('cadars-theme', next)
      return next
    })
  }, [])

  const setDemo = useCallback(
    (on: boolean) => {
      if (on) resetDemo()
      setDemoFlag(on)
      localStorage.setItem('cadars-demo', on ? '1' : '0')
      toast(on ? 'Demo mode is on. The sample evening is ready.' : 'Demo mode is off. This is the live club list.')
    },
    [toast],
  )

  const openAuth = useCallback((reason?: string) => {
    setProfileOpen(false)
    setAuthReason(reason ?? 'Sign in with your email. We will send you a code.')
    setAuthOpen(true)
  }, [])

  const closeAuth = useCallback(() => setAuthOpen(false), [])
  const openProfile = useCallback(() => {
    setAuthOpen(false)
    setProfileDismissed(false)
    setProfileOpen(true)
  }, [])
  const closeProfile = useCallback(() => {
    setProfileOpen(false)
    setProfileDismissed(true)
  }, [])

  const saveProfile = useCallback(
    async (callsign: string, displayName: string) => {
      if (!session) throw new Error('Sign in first.')
      try {
        const saved = await saveMember(session.user.id, callsign, displayName, Boolean(member))
        setMember(saved)
        setProfileOpen(false)
        toast('Your callsign is saved.')
      } catch (error) {
        if (errorCode(error) === '23505' && /user_id/i.test(JSON.stringify(error))) {
          const again = await fetchMember(session.user.id)
          setMember(again)
          setProfileOpen(false)
          return
        }
        throw error
      }
    },
    [member, session, toast],
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) toast(friendlyMessage(error))
  }, [toast])

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    setInstallPrompt(null)
  }, [installPrompt])

  const operator = demo
    ? DEMO_OPERATOR
    : member
      ? { callsign: member.callsign, displayName: member.display_name }
      : null

  const value = useMemo<AppContextValue>(
    () => ({
      tab,
      setTab,
      theme,
      toggleTheme,
      demo,
      setDemo,
      now,
      session,
      authReady,
      member,
      memberLoading,
      operator,
      toast,
      toasts,
      authOpen,
      authReason,
      openAuth,
      closeAuth,
      profileOpen,
      openProfile,
      closeProfile,
      saveProfile,
      signOut,
      installPrompt,
      promptInstall,
    }),
    [
      tab,
      setTab,
      theme,
      toggleTheme,
      demo,
      setDemo,
      now,
      session,
      authReady,
      member,
      memberLoading,
      operator,
      toast,
      toasts,
      authOpen,
      authReason,
      openAuth,
      closeAuth,
      profileOpen,
      openProfile,
      closeProfile,
      saveProfile,
      signOut,
      installPrompt,
      promptInstall,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppProvider')
  return value
}
