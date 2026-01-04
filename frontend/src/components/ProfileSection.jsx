

import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { LayoutGrid } from "react-icons/rx";
 import { LayoutGrid,LogOutIcon,User2Icon} from "lucide-react";
// import { User2Icon } from "react-icons/fa";
// import { LogOutIcon } from "react-icons/md";
// import { Building2, Users } from "lucide-react";
// import { setClear } from "../lib/Reduxs/authSlice";
import { useQuery } from "@tanstack/react-query";
import { setClear } from "../app/AuthSlice";

const MainHeader = () => {
  const { token, user } = useSelector((state) => state.auth);
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const handlelogout = () => {
    dispatch(setClear())
    navigate('/login')
  }

  const { data } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await api.get("/auth/me");
      return res.data;

    },


    enabled: !!token, // Only run this query if token exists
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });

  return (
    <header className="px-4">
      <div className="max-w-7xl mx-auto px-8 md:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">


          {/* Right Section */}
          <div className="flex items-center space-x-12">
            {token ? (
              <DropdownMenu className="">
                <DropdownMenuTrigger asChild>
                  <Avatar className="cursor-pointer">
                    <AvatarImage
                    src={"https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"}
                      alt={user?.name}
                    />
                    <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="w-64 mr-2 px-4 space-y-2 py-6">
                  {/* Profile Info */}
                  <DropdownMenuLabel>
                    <div className="mb-2">
                      <h1 className="text-gray-900 font-semibold">{user?.name}</h1>
                      <p className="text-sm text-gray-500">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  {/* Menu Links - Added padding for spacing */}
                  <div className="flex flex-col space-y-2">
                    <DropdownMenuItem asChild>
                      {user?.role === "admin" && (
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard" className="flex items-center gap-3 py-2">
                            <LayoutGrid className="text-green-600" />
                            Dashboard
                          </Link>
                        </DropdownMenuItem>
                      )}

                    </DropdownMenuItem>
                

                 
                 
                    <DropdownMenuItem asChild>
                      <Link
                        to="/profile"
                        className="flex items-center gap-3 py-2"
                      >
                        <User2Icon className="text-gray-600" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                  </div>

                  <DropdownMenuSeparator />

                  {/* Logout */}
                  <DropdownMenuItem className="text-red-600" asChild >
                    <button className="flex items-center gap-3 py-2 w-full" onClick={handlelogout}>
                      <LogOutIcon />
                      Log out
                    </button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/register"
                className="px-4 py-2 bg-rose-600 text-white rounded-md"
              >
                Sign Up
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default MainHeader;
