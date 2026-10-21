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

adviceSchema.index({ patientId: 1, createdAt: -1 });

module.exports =
mongoose.model("Advice", adviceSchema);
