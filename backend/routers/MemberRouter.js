import express from "express"
import mongoose from "mongoose"
import { createMember, getMembers,getMemberById,updateMember ,deleteMember,archiveMember,restoreMember} from "../controller/members.js"
import { sendMemberEmail } from "../controller/EmailController.js"


const MemberRouter = express.Router()


MemberRouter.param("id", (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid member id" })
  }
  next()
})




// collection routes
MemberRouter.route("/members")
  .get(getMembers)
  .post(createMember)

// item routes
MemberRouter.route("/members/:id")
  .get(getMemberById)
  .put(updateMember)
  .delete(deleteMember)

// archive / restore
MemberRouter.post("/members/:id/archive", archiveMember)
MemberRouter.post("/members/:id/restore", restoreMember)
MemberRouter.post('/members/:id/send-email',sendMemberEmail)

export default MemberRouter