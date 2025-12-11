

import React from "react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NavLink } from "react-router"
import { Book as BookIcon } from "lucide-react"

export function NavMain({ items = [] }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
        <BookIcon className="h-4 w-4 text-slate-500 dark:text-gray-300" />
        <span>JJU Reading Club</span>
      </SidebarGroupLabel>

      <SidebarMenu className="mt-4 space-y-1 text-sm">
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild tooltip={item.title}>
              <NavLink
                to={item.url}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                    "text-sm font-medium truncate",
                    isActive
                      ? "bg-slate-100 text-slate-900 dark:bg-gray-800 dark:text-white"
                      : "text-slate-700 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-800",
                  ].join(" ")
                }
              >
                {item.icon ? (
                  <item.icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <BookIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{item.title}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export default NavMain