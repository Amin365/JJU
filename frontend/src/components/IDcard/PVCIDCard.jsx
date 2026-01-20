import React, { useRef, useState } from "react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { Button } from "@/components/ui/button"
import { IDCardFront } from "./IDCardFront"
import { IDCardBack } from "./IDCardBack"
import api from "@/app/api/apislice"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useSelector } from "react-redux"

export default function PVCIDCard() {
    const{user}=useSelector((state)=>state.auth)

  const cardRef = useRef(null)
  const [activeTab, setActiveTab] = useState("front")
  const { memberId } = useParams()
  const { data: member, isLoading, isError } = useQuery({
    queryKey: ["member", memberId],
    queryFn: async () => {
      const res = await api.get(`/members/${memberId}`)
      return res.data.data
    },
    enabled: !!memberId,
  })
console.log("Member Data:", member)
  if (isLoading) return <p>Loading card...</p>
  if (isError) return <p>Failed to load member</p>
  if (!member) return <p>No member data</p>

  const fullName = `${member.first_name} ${member.middle_name} ${member.last_name}`

  // IMAGE DOWNLOAD
  const downloadImage = async () => {
    const canvas = await html2canvas(cardRef.current, {
      scale: 3,
      backgroundColor: "#ffffff",
    })
    const link = document.createElement("a")
    link.download = "id-card.png"
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  // PDF DOWNLOAD (PVC SIZE)
  const downloadPDF = async () => {
    const canvas = await html2canvas(cardRef.current, {
      scale: 3,
      backgroundColor: "#ffffff",
    })

    const imgData = canvas.toDataURL("image/png")
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [85.6, 53.98],
    })

    pdf.addImage(imgData, "PNG", 0, 0, 85.6, 53.98)
    pdf.save("id-card.pdf")
  }

  return (
    <div className="flex flex-col  items-center gap-6 w-full max-w-xl mx-auto">

      {/* TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="front">Front Side</TabsTrigger>
          <TabsTrigger value="back">Back Side</TabsTrigger>
        </TabsList>

        {/* FRONT SIDE */}
        <TabsContent value="front">
          <div
            ref={cardRef}
            className="flex justify-center p-6 bg-gray-100 rounded-lg"
             style={{ backgroundColor: "#ffffff" }}
          >
            <div className="scale-[0.75] origin-top-left">
              <IDCardFront
                employeeName={fullName}
                // jobTitle={`Year ${member.study_year} Student`}
                department={member.department}
                employeeId={member.code}
                photoUrl={user.profile_picture|| member.Profile_picture || ""}
                validFrom={member.join_date?.split("T")[0]}
                validUntil="2027-01-01"
                erpCode={member.student_id}
                accessLevel={member.status}
              />
            </div>
          </div>
        </TabsContent>

        {/* BACK SIDE */}
        <TabsContent value="back">
          <div
            ref={cardRef}
            className="flex justify-center p-6  rounded-lg"
          >
            <div className="scale-[0.75] origin-top-left">
              <IDCardBack
                companyAddress={member.region}
                supportEmail={member.email}
                supportPhone={member.phone}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ACTION BUTTONS */}
      <div className="flex gap-4">
        <Button onClick={downloadImage}>Download Image</Button>
        <Button variant="outline" onClick={downloadPDF}>
          Download PDF (PVC)
        </Button>
      </div>
    </div>
  )
}
