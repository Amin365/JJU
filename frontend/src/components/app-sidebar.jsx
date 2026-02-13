


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
  FileChartColumn,
  User,
  ActivityIcon,
  StickyNote,
  UserPlus2

  
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
import { useQuery } from "@tanstack/react-query"
import api from "@/app/api/apislice"


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
      title: " Request Books  ",
      url: "/dashboard/issues/request",
      icon: BookOpen,
   
    },
    {
      title: "Reading Reports ",
      url: "/dashboard/report",
      icon: FileChartColumn,
   
    },
    {
      title: "Daily Activity ",
      url: "/dashboard/activity",
      icon: ActivityIcon,
   
    },
    {
      title: "Reading Recap ",
      url: "/dashboard/report-recap",
      icon: ActivityIcon,
    
    },
    {
      title: "Moderators ",
      url: "/dashboard/moderators",
      icon: User,
   
    },
    {
      title: "Blogs ",
      url: "/dashboard/blogs",
      icon: StickyNote,
   
    },
    {
      title: "Join Requests ",
      url: "/dashboard/join-clubs",
      icon: UserPlus2,
   
    },
  
  ],

}

export function AppSidebar({ ...props }) {
  const { user, token } = useSelector((state) => state.auth);

if(!token){
  return null;
}

  // Fetch fresh profile to ensure populated role (object with role name)
  const { data: profileData } = useQuery({
    queryKey: ["sidebar-profile", token],
    queryFn: async () => {
      const res = await api.get("/auth/me");
      return res.data;
    },
    enabled: !!token,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const roleName = React.useMemo(() => {
    const roleSource = profileData?.user?.role || user?.role;
    if (!roleSource) return "";
    if (typeof roleSource === "object") return (roleSource.role || roleSource.name || roleSource.title || "").toLowerCase();
    return String(roleSource).toLowerCase();
  }, [profileData, user]);

  const filteredNav = React.useMemo(() => {
    if (roleName === "members") {
      // Members: only Request Books and Reading Reports
      const allowed = new Set(["/dashboard/issues/request", "/dashboard/report","/dashboard/report-recap"]);
      return data.navMain.filter((item) => allowed.has(item.url));
    }
    if( roleName === "moderator") {
      // Moderators: only Reading Reports and Daily Activity
      const allowed = new Set(["/dashboard/activity","/dashboard/members","/dashboard/issues"]);
      return data.navMain.filter((item) => allowed.has(item.url));
    }
    return data.navMain;
  }, [roleName]);

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
