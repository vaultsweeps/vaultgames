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
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      balance: 0,
      isLoading: false,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await authApi.login({ email, password })
          const { user, token } = response.data.data
          Cookies.set('vaultsweeps_token', token, { expires: 7, secure: true, sameSite: 'strict' })
          set({ user, token, isAuthenticated: true, isLoading: false })
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
        Cookies.remove('vaultsweeps_token')
        set({ user: null, token: null, isAuthenticated: false })
        if (typeof window !== 'undefined') window.location.href = '/'
      },

      fetchMe: async () => {
        const token = Cookies.get('vaultsweeps_token')
        if (!token) { set({ isAuthenticated: false }); return }
        try {
          const response = await authApi.getMe()
          set({ user: response.data.data, isAuthenticated: true, token })
        } catch {
          Cookies.remove('vaultsweeps_token')
          set({ user: null, token: null, isAuthenticated: false, balance: 0 })
        }
      },

      fetchBalance: async () => {
        const token = Cookies.get('vaultsweeps_token')
        if (!token) return
        try {
          const response = await authApi.getBalance()
          if (response.data?.data?.balance !== undefined) {
            set({ balance: response.data.data.balance })
          }
        } catch {}
      },

      setUser: (user: User) => set({ user }),
      setToken: (token: string) => set({ token }),
      setBalance: (balance: number) => set({ balance }),
    }),
    {
      name: 'vaultsweeps-auth',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated, balance: state.balance })
    }
  )
)
