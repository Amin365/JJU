


import * as React from "react"
import {
  AudioWaveform,
  Award,
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
  Target,
  Trophy,
  UserPlus2,
  ListOrdered,
  BookMarked,
  ClipboardList,
  Bell,
  Settings,
  Megaphone,
  BarChart3,
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
      icon: ClipboardList,
   
    },
    {
      title: "Reservations",
      url: "/dashboard/reservations",
      icon: BookMarked,
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
      title: "Moderator Workspace ",
      url: "/dashboard/moderator-workspace",
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
    {
      title: "Challenges",
      url: "/dashboard/challenges",
      icon: Trophy,
   
    },
    {
      title: "Achievements",
      url: "/dashboard/achievements",
      icon: Award,
   
    },
    {
      title: "Goals",
      url: "/dashboard/goals",
      icon: Target,
   
    },
    {
      title: "Leaderboard ",
      url: "/dashboard/leaderboard",
      icon: ListOrdered,
    },
    {
      title: "Notifications",
      url: "/dashboard/notifications",
      icon: Bell,
    },
    {
      title: "Notification Settings",
      url: "/dashboard/notification-settings",
      icon: Settings,
    },
    {
      title: "Announcements",
      url: "/dashboard/announcements",
      icon: Megaphone,
    },

    {
         title: "Reporting Center",
      url: "/dashboard/reporting",
      icon: BarChart3,
    }
  
   
  
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

  // Route arrays for role-based filtering
  const memberAllowedRoutes = [
    "/dashboard/issues/request",
    "/dashboard/reservations",
    "/dashboard/report",
    "/dashboard/report-recap",
    "/dashboard/challenges",
    "/dashboard/achievements",
    "/dashboard/goals",
    "/dashboard/leaderboard",
    "/dashboard/notifications",
    "/dashboard/notification-settings",
  ];

  const moderatorAllowedRoutes = [
    "/dashboard/activity",
    "/dashboard/members",
    "/dashboard/issues",
    "/dashboard/issues/request",
    "/dashboard/reservations",
    "/dashboard/challenges",
    "/dashboard/achievements",
    "/dashboard/goals",
    "/dashboard/leaderboard",
    "/dashboard/moderator-workspace",
    "/dashboard/notifications",
    "/dashboard/notification-settings",
  ];

  // Announcements is admin-only
  const adminOnlyRoutes = ["/dashboard/announcements"];

  const filteredNav = React.useMemo(() => {
    if (roleName === "members") {
      const allowed = new Set(memberAllowedRoutes);
      return data.navMain.filter((item) => allowed.has(item.url));
    }
    if (roleName === "moderator") {
      const allowed = new Set(moderatorAllowedRoutes);
      return data.navMain.filter((item) => allowed.has(item.url));
    }
    // Admin/SuperAdmin gets all routes
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
