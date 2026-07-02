"use client"

import { UserButton } from "@clerk/nextjs"
import { useUser } from "@clerk/nextjs"
import SidebarToggle from "@/components/SidebarToggle"

export default function NavBar() {
  const { user } = useUser()

  return (
    <div className="flex items-center gap-3 p-4">
      <SidebarToggle />
      <div className="flex items-center gap-6 justify-end w-full">
        <div className="flex flex-col">
          <span className="text-xs leading-3 font-medium">
            {user?.firstName} {user?.lastName}
          </span>
          <span className="text-[10px] text-gray-500 text-right">
            {user?.publicMetadata.role
              ? (user.publicMetadata.role as string) === "registrar_staff"
                ? "Registrar Staff"
                : (user.publicMetadata.role as string).charAt(0).toUpperCase() +
                  (user.publicMetadata.role as string).slice(1)
              : "No Role"}
          </span>
        </div>
        <UserButton />
      </div>
    </div>
  )
}
