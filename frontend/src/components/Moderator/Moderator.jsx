import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToastContainer } from "react-toastify";
import { Eye as IconEye } from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router";
import api from "../../app/api/apislice";
import Loader from "../Loader";

export default function ModeratorsPage() {
  const navigate = useNavigate();

  const { data: moderators = [], isLoading: moderatorsLoading } = useQuery({
    queryKey: ["moderators"],
    queryFn: () => api.get("/moderators").then((r) => r.data.data ?? []),
    staleTime: 30_000,
  });

  const currentUser = useSelector((s) => s.auth.user);
  const isSuperAdmin =
    !!currentUser?.role?.role && String(currentUser.role.role).toLowerCase().includes("super");

  const handleViewMembers = (moderator) => {
    navigate(`/dashboard/moderators/${moderator.id}/members`);
  };

  if (moderatorsLoading) return <Loader />;

  const shown = isSuperAdmin
    ? moderators.filter((m) => !(m.role?.role && String(m.role.role).toLowerCase().includes("super")))
    : moderators.filter((m) => String(m.id) === String(currentUser?.id));

  return (
    <div className="p-6">
      <ToastContainer />
      <div className="mb-4 p-4  dark:text-white text-gray-800 rounded">
        <p>Manage your moderators and their assigned members.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((moderator) => (
          <Card key={moderator.id} className="relative shadow-sm hover:shadow-md transition-all mt-4">
            <CardHeader>
              <CardTitle>
                {moderator.first_name} {moderator.last_name} ({moderator.username})
              </CardTitle>
            </CardHeader>

            <CardContent className="text-sm space-y-1">
              <p>
                <strong>Email:</strong> {moderator.email || "N/A"}
              </p>
              <p>
                <strong>Total Members:</strong> {moderator.assignedMembersCount || 0}
              </p>
            </CardContent>

            <div className="flex gap-2 absolute bottom-2 right-2">
              <Button variant="ghost" onClick={() => handleViewMembers(moderator)}>
                <IconEye size={16} />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}