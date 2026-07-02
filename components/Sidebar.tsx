"use client"

import Image from "next/image"
import { useSidebar } from "@/components/SidebarProvider"
import { cn } from "@/lib/utils"
import Menu from "@/components/Menu"

export default function Sidebar({ role }: { role: string }) {
  const { collapsed } = useSidebar()

  return (
    <aside
      className={cn(
        "h-screen flex flex-col border-r bg-background transition-all duration-300 flex-shrink-0",
        collapsed ? "w-16 items-center" : "w-56",
        "p-4"
      )}
    >
      <div className={cn("flex-shrink-0", collapsed && "flex justify-center")}>
        <Image
          src="/logos.png"
          alt="logo"
          width={collapsed ? 40 : 200}
          height={collapsed ? 40 : 200}
          className="transition-all duration-300"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        <Menu role={role} />
      </div>
    </aside>
  )
}
