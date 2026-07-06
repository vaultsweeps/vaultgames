'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'night' | 'light'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    // Load initial theme from localStorage — default stays 'dark'
    const savedTheme = localStorage.getItem('vaultsweeps_theme') as Theme
    if (savedTheme === 'night' || savedTheme === 'dark' || savedTheme === 'light') {
      setThemeState(savedTheme)
    }
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('vaultsweeps_theme', newTheme)
  }

  useEffect(() => {
    const html = document.documentElement

    // Remove all theme classes first
    html.classList.remove('dark', 'theme-night')

    if (theme === 'dark') {
      html.classList.add('dark')
    } else if (theme === 'night') {
      html.classList.add('dark', 'theme-night')
    }
    // 'light' = no .dark class → :root variables (light mode) take effect
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
