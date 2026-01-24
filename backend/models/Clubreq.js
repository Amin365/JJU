
import mongoose from "mongoose"

const  ClubreqSchema = new mongoose.Schema({
    FullName:{type:String,required:true,trim:true},
    email:{type:String,required:true,trim:true},
    phone:{type:String,required:true},
    status:{type:String,enum:["Pending","Approved","Rejected"],default:"Pending"},

}

,{timestamps:true}

)

export default mongoose.model("Clubreq",ClubreqSchema);

