const { chatAI } = require("../services/aiService");

exports.analyze = async (req, res) => {
  try {
    const result = await chatAI(req.body);
    return res.json(result);
  } catch (err) {
    if (err.code) {
      const status =
        err.code === "AI_EMPTY_MESSAGE" || err.code === "AI_MESSAGE_TOO_LONG"
          ? 400
          : err.code === "AI_NOT_CONFIGURED"
          ? 503
          : 502;

      return res.status(status).json({ code: err.code, msg: err.message });
    }

    console.error("AI controller error:", err.message);
    return res.status(502).json({
      code: "AI_UNAVAILABLE",
      msg: "Trợ lý AI đang gặp sự cố. Vui lòng thử lại sau.",
    });
  }
};
