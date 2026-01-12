

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "../components/app-sidebar"
import { Outlet } from "react-router"
import { ModeToggle } from "../components/ModeTogle"
import MainHeader from "../components/ProfileSection"
import NotificationBell from "../components/NotificationBell"

export default function DashboardPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Top bar: title + controls */}
        <div className="flex items-center justify-between mt-8 px-4 pt-4 pb-2 lg:px-6">
          <h1>JJU Club Reading</h1>
          {/* leftside */}
          <div className="flex items-center gap-4  mr-12">
            <NotificationBell />
            <ModeToggle />
            <MainHeader />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4  pt-0">
          <div className="" />
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
