const mongoose = require("mongoose");

const appointmentSchema =
new mongoose.Schema({

  patientId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User",
    required:true
  },

  doctorId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User",
    required:true
  },

  appointmentDate:{
    type:Date,
    required:true
  },

  note:{
    type:String,
    default:""
  },

  type:{
    type:String,
    enum:[
      "Tái khám",
      "Khám tổng quát",
      "Theo dõi tim mạch",
      "Khẩn cấp"
    ],
    default:"Tái khám"
  },

  status:{
    type:String,
    enum:[
      "pending",
      "approved",
      "completed",
      "cancelled"
    ],
    default:"pending"
  },

  cancelReason:{
    type:String,
    default:""
  },

  createdAt:{
    type:Date,
    default:Date.now
  }

});

module.exports =
mongoose.model(
  "Appointment",
  appointmentSchema
);