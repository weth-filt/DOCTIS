require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");

async function seedAdmin() {

  try {

    await mongoose.connect(process.env.MONGO_URI);

    const exist = await User.findOne({
      email: "admin@gmail.com"
    });

    if (exist) {

      console.log("Admin đã tồn tại");
      process.exit();

    }

    const hash =
      await bcrypt.hash("admin123", 10);

    await User.create({

      cccd: "000000000001",

      username: "Super Admin",

      email: "admin@gmail.com",

      password: hash,

      role: "admin"

    });

    console.log("Tạo admin thành công");

    process.exit();

  }

  catch(err){

    console.log(err);

    process.exit();

  }

}

seedAdmin();