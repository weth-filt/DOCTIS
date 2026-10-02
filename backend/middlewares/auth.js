const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const authorization =
      req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        msg: "Không có token đăng nhập",
      });
    }

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        msg: "Token không đúng định dạng",
      });
    }

    const token =
      authorization.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        msg: "Không có token",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error(
        "JWT_SECRET chưa được cấu hình"
      );

      return res.status(500).json({
        msg:
          "Server chưa cấu hình JWT_SECRET",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (err) {
    console.error(
      "AUTH ERROR =",
      err.message
    );

    return res.status(401).json({
      msg:
        "Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
    });
  }
};