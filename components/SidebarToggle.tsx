"use client"

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useSidebar } from "@/components/SidebarProvider"
import { Button } from "@/components/ui/button"

export default function SidebarToggle() {
  const { setMobileOpen, collapsed, toggleCollapsed, isMobile } = useSidebar()

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:flex"
        onClick={toggleCollapsed}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-5 w-5" />
        ) : (
          <PanelLeftClose className="h-5 w-5" />
        )}
        <span className="sr-only">Toggle sidebar</span>
      </Button>
    </>
  )
}
