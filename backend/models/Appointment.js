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

  cancelledBy:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null},
  cancelledByRole:{type:String,enum:["user","doctor",""],default:""},
  cancelledAt:{type:Date,default:null},
  operationLock:{type:String,default:null},
  operationLockAt:{type:Date,default:null},
  lastReminderAt:{type:Date,default:null},

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
