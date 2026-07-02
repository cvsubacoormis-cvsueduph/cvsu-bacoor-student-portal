"use client"

import Image from "next/image"
import { useSidebar } from "@/components/SidebarProvider"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import Menu from "@/components/Menu"

export default function MobileSidebar({ role }: { role: string }) {
  const { mobileOpen, setMobileOpen } = useSidebar()

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b">
            <Image
              src="/logos.png"
              alt="logo"
              width={150}
              height={150}
              className="mx-auto"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <Menu role={role} forceExpand />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
