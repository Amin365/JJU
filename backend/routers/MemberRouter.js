import express from "express"
import mongoose from "mongoose"
import { createMember, getMembers,getMemberById,updateMember,bulkCreateMembers ,deleteMember,archiveMember,restoreMember,getMemberByCode,getMembersList} from "../controller/members.js"
import { sendMemberEmail } from "../controller/EmailController.js"
import { protect } from "../middleware/auth.js"
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from '../utility/cloudinary.js'

   
    const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Books", // folder in cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "gif"],
    public_id: (req, file) => Date.now() + "-" + file.originalname.split(".")[0],
  },
});

const upload = multer({ storage });

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
  .post(upload.single("profile_picture"), createMember)

// static/specific routes MUST come before dynamic :id
// Protect the members list so we can return scoped lists for moderators
MemberRouter.get("/members/list", protect, getMembersList);
MemberRouter.get("/members/by-code/:code", getMemberByCode);

// archive / restore and other item-specific actions
MemberRouter.post('/members/:id/send-email',sendMemberEmail)
MemberRouter.post("/members/:id/archive", archiveMember)
MemberRouter.post("/members/:id/restore", restoreMember)
MemberRouter.post("/members/bulk", protect, bulkCreateMembers);
// generic item routes last
MemberRouter.route("/members/:id")
  .get(getMemberById)
  .put(upload.single("profile_picture"), updateMember)
  .delete(deleteMember)
export default MemberRouter