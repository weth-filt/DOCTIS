const mongoose = require("mongoose");

const adviceSchema = new mongoose.Schema(
  {
    patientId:{
      type:mongoose.Schema.Types.ObjectId,
      ref:"User"
    },

    doctorId:{
      type:mongoose.Schema.Types.ObjectId,
      ref:"User"
    },

    title:String,

    message:String
  },
  {
    timestamps:true,
    collection:"advice"
  }
);

module.exports =
mongoose.model("Advice", adviceSchema);