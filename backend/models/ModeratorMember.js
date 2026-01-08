
import mongoose from "mongoose";

const ModeratorMemberSchema = new mongoose.Schema(
  {
    moderator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // User with Moderator role
    member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true, unique: true }, // One member per moderator
  },
  { timestamps: true }
);

export default mongoose.model("ModeratorMember", ModeratorMemberSchema);