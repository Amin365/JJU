

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
import { LayoutGrid, LogOutIcon, User2Icon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { setClear } from "../app/AuthSlice";
import api from "@/app/api/apislice";

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
    <div className="flex items-center">
      {token ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="cursor-pointer h-8 w-8">
              <AvatarImage
                src={
                  "https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                }
                alt={user?.name}
              />
              <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 p-2">
            <DropdownMenuLabel>
              <div>
                <h1 className="text-gray-900 font-semibold text-sm">{user?.name}</h1>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {user?.role === "admin" && (
              <DropdownMenuItem asChild>
                <Link to="/dashboard" className="flex items-center gap-2 py-1.5 text-sm">
                  <LayoutGrid className="size-4 text-green-600" />
                  Dashboard
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center gap-2 py-1.5 text-sm">
                <User2Icon className="size-4 text-gray-600" />
                Profile
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem className="text-red-600" asChild>
              <button className="flex items-center gap-2 py-1.5 w-full text-sm" onClick={handlelogout}>
                <LogOutIcon className="size-4" />
                Log out
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Link to="/register" className="px-3 py-1.5 bg-rose-600 text-white rounded-md text-sm">
          Sign Up
        </Link>
      )}
    </div>
  );
};

export default MainHeader;
