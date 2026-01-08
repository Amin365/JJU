import express from "express"
import mongoose from "mongoose"
import { createMember, getMembers,getMemberById,updateMember ,deleteMember,archiveMember,restoreMember,getMemberByCode,getMembersList} from "../controller/members.js"
import { sendMemberEmail } from "../controller/EmailController.js"
import { protect } from "../middleware/auth.js"


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

// static/specific routes MUST come before dynamic :id
MemberRouter.get("/members/list", getMembersList);
MemberRouter.get("/members/by-code/:code", getMemberByCode);

// archive / restore and other item-specific actions
MemberRouter.post('/members/:id/send-email',sendMemberEmail)
MemberRouter.post("/members/:id/archive", archiveMember)
MemberRouter.post("/members/:id/restore", restoreMember)

// generic item routes last
MemberRouter.route("/members/:id")
  .get(getMemberById)
  .put(updateMember)
  .delete(deleteMember)
export default MemberRouter