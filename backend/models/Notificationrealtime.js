const notificationSchema =
new mongoose.Schema({

  userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User"
  },

  title:String,

  content:String,

  read:{
    type:Boolean,
    default:false
  }

});