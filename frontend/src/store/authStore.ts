import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import Cookies from 'js-cookie'
import { User, AuthState } from '@/types'
import { authApi } from '@/lib/api'

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (data: object) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  fetchBalance: () => Promise<void>
  setUser: (user: User) => void
  setToken: (token: string) => void
  setBalance: (balance: number) => void
  setBonusBalance: (bonusBalance: number) => void
  // Auth modal global trigger
  authModalOpen: boolean
  authModalView: 'login' | 'register'
  openAuthModal: (view?: 'login' | 'register') => void
  closeAuthModal: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      balance: 0,
      bonusBalance: 0,
      isLoading: false,
      isAuthenticated: false,
      authModalOpen: false,
      authModalView: 'login' as 'login' | 'register',

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await authApi.login({ email, password })
          const { user, token } = response.data.data
          // Clear any stale fallback cookie from a previous session first, so the probe below can only
          // succeed via the fresh HttpOnly cookie the backend just set on this response — not by
          // accidentally reusing an old fallback token still sitting in the browser.
          Cookies.remove('vaultsweeps_token')
          try {
            await authApi.getMe()
            set({ user, token: null, isAuthenticated: true, isLoading: false })
          } catch {
            // Cookie didn't land (Safari/ITP or similar blocking the cross-origin cookie) — fall back to
            // exactly the pre-migration mechanism for this session only, so the user can still log in.
            Cookies.set('vaultsweeps_token', token, { expires: 7, secure: true, sameSite: 'strict' })
            set({ user, token, isAuthenticated: true, isLoading: false })
          }
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      register: async (data: object) => {
        set({ isLoading: true })
        try {
          const response = await authApi.register(data)
          set({ isLoading: false })
          return response.data
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        // Revoke the session server-side first — whichever credential this browser is actually using (the
        // HttpOnly cookie sent automatically, or the fallback header) is what the backend needs to identify
        // and revoke the session; a token copied before logout must not stay valid for its full lifetime.
        // Never block the user on it.
        const serverLogout = Promise.race([
          authApi.logout().catch(() => {}),
          new Promise(resolve => setTimeout(resolve, 1500)),
        ])
        set({ user: null, token: null, isAuthenticated: false })
        serverLogout.finally(() => {
          Cookies.remove('vaultsweeps_token')
          if (typeof window !== 'undefined') window.location.href = '/'
        })
      },

      // Always attempts the call — the browser attaches the HttpOnly session cookie automatically
      // (withCredentials) for most users, and api.ts's interceptor attaches the fallback header for the rest.
      // There is no client-visible way to know in advance which of the two applies, so this IS the check.
      fetchMe: async () => {
        try {
          const response = await authApi.getMe()
          set({ user: response.data.data, isAuthenticated: true })
        } catch {
          Cookies.remove('vaultsweeps_token')
          set({ user: null, token: null, isAuthenticated: false, balance: 0, bonusBalance: 0 })
        }
      },

      fetchBalance: async () => {
        if (!get().isAuthenticated) return
        try {
          const response = await authApi.getBalance()
          const data = response.data?.data
          if (data?.balance !== undefined) {
            set({ balance: data.balance, bonusBalance: data.bonusBalance ?? 0 })
          }
        } catch {}
      },

      setUser: (user: User) => set({ user }),
      setToken: (token: string) => set({ token }),
      setBalance: (balance: number) => set({ balance }),
      setBonusBalance: (bonusBalance: number) => set({ bonusBalance }),
      openAuthModal: (view: 'login' | 'register' = 'login') => set({ authModalOpen: true, authModalView: view }),
      closeAuthModal: () => set({ authModalOpen: false }),
    }),
    {
      name: 'vaultsweeps-auth',
      // The token itself is intentionally excluded from persisted storage —
      // it already lives in the `vaultsweeps_token` cookie (which is what
      // api.ts actually reads on every request), so persisting a second copy
      // to localStorage only doubles the JWT's exposure surface without
      // being read back by anything.
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated, balance: state.balance, bonusBalance: state.bonusBalance })
    }
  )
)
