const { chatAI } = require("../services/aiService");
const { loadPatientContext, isValidPatientId } = require("../services/aiPatientContext");

exports.analyze = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ code: "AI_UNAUTHORIZED", msg: "Vui lòng đăng nhập để sử dụng trợ lý AI." });
  }
  if (!isValidPatientId(userId)) {
    return res.status(400).json({ code: "AI_INVALID_USER", msg: "Không xác định được tài khoản hợp lệ." });
  }
  try {
    const result = await chatAI({
      message: req.body?.message,
      history: req.body?.history,
      // Resolve only after validation and the emergency fast path in aiService.
      // No user ID, health value, or context supplied by the client is trusted.
      loadPatientContext: () => loadPatientContext(userId),
    });
    return res.json(result);
  } catch (err) {
    if (err.code) {
      const status =
        err.code === "AI_EMPTY_MESSAGE" || err.code === "AI_MESSAGE_TOO_LONG"
          ? 400
          : err.code === "AI_NOT_CONFIGURED" || err.code === "AI_CONTEXT_UNAVAILABLE"
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
