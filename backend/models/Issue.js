import mongoose from "mongoose";

const IssueSchema = new mongoose.Schema({
    book:{type:mongoose.Schema.Types.ObjectId,ref:'Books',required:true},
    member:{type:mongoose.Schema.Types.ObjectId,ref:'Members',required:true},
    issueDate:{type:Date,required:true},
    returnDate:{type:Date,required:true}
    
})



const Issue=mongoose.model('Issue',IssueSchema);

export default Issue;