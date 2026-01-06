


import * as React from "react"
import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
  Users2,
  LayoutGrid,
  FileChartColumn

  
} from "lucide-react"


import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NavMain } from "./nav-main"
import { NavUser } from "./nav-user"
import { useSelector } from "react-redux"
import { selectPermissions } from "@/app/CommonnSlice"


// This is sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },

  navMain: [
    {
      title:"Dashbaord",
      url:"/dashboard",
      icon:LayoutGrid,
       isActive: true,


    },
    {
      title:"Users",
      url:'/dashboard/users',
      icon:Users2

    },
    {
      title: "Books",
      url: "/dashboard/books",
      icon: BookOpen,
     
    
    },
    {
      title: "Members",
      url: "/dashboard/members",
      icon: Users2,
      
    
    },
    {
      title: "Issue Books ",
      url: "/dashboard/issues",
      icon: BookOpen,
   
    },
    {
      title: " Request Issue  ",
      url: "/dashboard/issues/request",
      icon: BookOpen,
   
    },
    {
      title: "Reports ",
      url: "/dashboard/report",
      icon: FileChartColumn,
   
    },
    {
      title: "Settings",
      url: "/test",
      icon: Settings2,
     
    },
  ],

}

export function AppSidebar({ ...props }) {
  const permissions = useSelector(selectPermissions);
  const filteredNav = data.navMain;
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {/* <TeamSwitcher teams={data.teams} /> */}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={filteredNav} />
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
