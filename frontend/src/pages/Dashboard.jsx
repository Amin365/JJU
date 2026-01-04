

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

export default function DashboardPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* mode Toggle */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 lg:px-6">
          <h1>JJU Club Reading</h1>
          {/* leftside */}
          <div className="flex items-center">
            <div className="ml-12">
              <ModeToggle />
            </div>
            <div className="mr-6">
              <MainHeader />
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="" />
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
