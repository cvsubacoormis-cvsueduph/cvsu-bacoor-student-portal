"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useIsMobile } from "@/hooks/use-mobile"

type SidebarContextType = {
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  collapsed: boolean
  toggleCollapsed: () => void
  isMobile: boolean
}

const SidebarContext = createContext<SidebarContextType | null>(null)

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) throw new Error("useSidebar must be used within SidebarProvider")
  return context
}

const STORAGE_KEY = "sidebar-collapsed"

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) setCollapsed(stored === "true")
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed))
  }, [collapsed])

  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  const toggleCollapsed = useCallback(() => setCollapsed((prev) => !prev), [])

  return (
    <SidebarContext.Provider
      value={{ mobileOpen, setMobileOpen, collapsed, toggleCollapsed, isMobile }}
    >
      {children}
    </SidebarContext.Provider>
  )
}
