require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

mongoose.connect(process.env.MONGO_URI);

async function createDoctor() {

  try {

    const exist =
      await User.findOne({
        email:"doctor@smarthealth.vn"
      });

    if(exist){

      console.log("Doctor already exists");

      process.exit();
    }

    const hash =
      await bcrypt.hash("123456",10);

    await User.create({

      cccd:"201234567890",

      username:"Doctor Minh",

      email:"doctor@smarthealth.vn",

      password:hash,

      role:"doctor",

      isVerified:true

    });

    console.log("Doctor created");

    process.exit();

  }

  catch(err){

    console.log(err);

    process.exit();

  }

}

createDoctor();