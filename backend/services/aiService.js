const ollama = require("ollama");

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_MESSAGES = 10;

const SYSTEM_PROMPT = `
Bạn là DOCTIS, trợ lý giáo dục sức khỏe tập trung vào đái tháo đường type 2 và các vấn đề sức khỏe liên quan.

NGUYÊN TẮC:
- Trả lời bằng tiếng Việt phổ thông, thân thiện, rõ ràng và đi thẳng vào câu hỏi.
- Không nhận mình là bác sĩ/người hành nghề y; không chẩn đoán bệnh.
- Không chỉ định bắt đầu, ngừng hoặc thay đổi liều thuốc. Khuyên người dùng trao đổi với bác sĩ/dược sĩ đang điều trị.
- Không suy luận đơn vị, thời điểm đo hay mức độ nguy hiểm từ một con số thiếu ngữ cảnh. Đường huyết mục tiêu khác nhau theo từng người và cần thống nhất với nhân viên y tế.
- Ưu tiên hướng dẫn tự chăm sóc có căn cứ, câu hỏi làm rõ khi cần, và dấu hiệu cần đi khám.
- Không bịa xét nghiệm, nguồn tham khảo, triệu chứng hay dữ liệu cá nhân. Chỉ dùng dữ liệu hồ sơ được cung cấp khi phù hợp và nói rõ dữ liệu đang thiếu.
- Tập trung vào đái tháo đường type 2, theo dõi đường huyết, ăn uống, vận động, thuốc, biến chứng và chuẩn bị câu hỏi cho buổi khám. Nếu hỏi ngoài phạm vi, trả lời lịch sự ngắn gọn rồi hướng về chủ đề này.
- Không lặp lại câu hỏi hoặc ép mọi câu trả lời vào một mẫu cố định. Không quá 5 gạch đầu dòng nếu câu hỏi đơn giản.
- Nếu người dùng mô tả triệu chứng có thể cấp cứu, ưu tiên khuyên gọi 115/đến cấp cứu ngay; không trì hoãn bằng câu hỏi tiếp theo.

KIẾN THỨC NỀN ĐỂ ĐỊNH HƯỚNG (không dùng làm chẩn đoán hay mục tiêu cá nhân):
- NIDDK nêu mục tiêu thường dùng cho nhiều người là 80–130 mg/dL trước ăn và dưới 180 mg/dL khoảng 2 giờ sau khi bắt đầu ăn, nhưng mục tiêu cá nhân có thể khác.
- Đường huyết dưới 70 mg/dL thường được xem là thấp. ADA mô tả quy tắc 15–15 cho người còn tỉnh và có thể tự xử trí: dùng 15 g carbohydrate tác dụng nhanh, kiểm tra lại sau 15 phút; làm theo kế hoạch điều trị cá nhân.
- Hạ đường huyết nặng, bất tỉnh/co giật, đau ngực, khó thở, lú lẫn nặng hoặc dấu hiệu đột quỵ cần trợ giúp y tế khẩn cấp.
- Nguồn tham khảo chính thức: https://www.niddk.nih.gov/health-information/diabetes/overview/managing-diabetes/ và https://diabetes.org/living-with-diabetes/hypoglycemia-low-blood-glucose/symptoms-treatment
`;

class AIServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AIServiceError";
    this.code = code;
  }
}

function normalizeVietnamese(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function hasEmergencySymptoms(message) {
  const normalized = normalizeVietnamese(message);
  return /dau nguc|tuc nguc|kho tho|bat tinh|mat y thuc|co giat|hon me|lu lan nang|yeu liet dot ngot|meo mieng|noi kho dot ngot/.test(
    normalized
  );
}

function cleanHistory(history, currentMessage) {
  if (!Array.isArray(history)) return [];

  const clean = history
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim()
    )
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }))
    .slice(-MAX_HISTORY_MESSAGES);

  // Older clients included the current prompt at the end of history.
  if (
    clean.at(-1)?.role === "user" &&
    clean.at(-1)?.content === currentMessage
  ) {
    clean.pop();
  }

  return clean;
}

function formatPatientContext({ glucose, bmi, bloodPressure, heartRate }) {
  const fields = [];
  const addValue = (label, value) => {
    if (value === undefined || value === null || value === "" || value === 0 || value === "0") {
      return;
    }
    const safeValue = String(value).replace(/[\r\n]/g, " ").slice(0, 80);
    fields.push(`- ${label}: ${safeValue}`);
  };

  addValue("Đường huyết được lưu gần nhất (đơn vị/thời điểm có thể chưa rõ)", glucose);
  addValue("BMI được lưu gần nhất", bmi);
  addValue("Huyết áp được lưu gần nhất", bloodPressure);
  addValue("Nhịp tim được lưu gần nhất", heartRate);

  if (!fields.length) return "Người dùng chưa cung cấp chỉ số sức khỏe trong yêu cầu này.";
  return `Một số chỉ số người dùng đã lưu (có thể cũ hoặc thiếu ngữ cảnh):\n${fields.join("\n")}`;
}

function makeCurrentPrompt(input) {
  return `${formatPatientContext(input)}\n\nCâu hỏi hiện tại của người dùng:\n${input.message}`;
}

async function callGemini({ apiKey, model, history, prompt }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;
  const contents = [
    ...history.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    })),
    { role: "user", parts: [{ text: prompt }] },
  ];

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 900,
        },
      }),
      signal: AbortSignal.timeout(8500),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new AIServiceError(
        "AI_TIMEOUT",
        "Trợ lý đang phản hồi chậm. Bạn thử gửi lại sau ít phút nhé."
      );
    }
    throw new AIServiceError(
      "AI_UNAVAILABLE",
      "Chưa kết nối được dịch vụ AI. Vui lòng thử lại sau."
    );
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerCode = result?.error?.status;
    console.error("Gemini API request failed:", response.status, providerCode || "unknown");

    if (response.status === 401 || response.status === 403) {
      throw new AIServiceError(
        "AI_INVALID_API_KEY",
        "Khóa Gemini trên máy chủ không hợp lệ hoặc chưa được bật. Hãy kiểm tra GEMINI_API_KEY trong Vercel."
      );
    }
    if (response.status === 429) {
      throw new AIServiceError(
        "AI_RATE_LIMITED",
        "Dịch vụ AI đang quá tải hoặc đã hết hạn mức. Hãy thử lại sau."
      );
    }
    throw new AIServiceError(
      "AI_PROVIDER_ERROR",
      "Dịch vụ AI tạm thời gặp sự cố. Vui lòng thử lại sau."
    );
  }

  const reply = result?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!reply) {
    throw new AIServiceError(
      "AI_EMPTY_RESPONSE",
      "Trợ lý chưa tạo được câu trả lời. Bạn thử diễn đạt lại câu hỏi nhé."
    );
  }

  return reply;
}

async function callLocalOllama({ history, prompt }) {
  try {
    const response = await ollama.default.chat({
      model: process.env.OLLAMA_MODEL || "qwen2:0.5b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: prompt },
      ],
      options: { temperature: 0.35, top_p: 0.8 },
    });
    const reply = response?.message?.content?.trim();
    if (!reply) throw new Error("Empty local model response");
    return reply;
  } catch (error) {
    console.error("Local Ollama unavailable:", error.message);
    throw new AIServiceError(
      "AI_NOT_CONFIGURED",
      "Chưa cấu hình dịch vụ AI. Trên Vercel, hãy thêm GEMINI_API_KEY vào Environment Variables của project backend rồi redeploy."
    );
  }
}

exports.chatAI = async (input = {}) => {
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message) {
    throw new AIServiceError("AI_EMPTY_MESSAGE", "Bạn hãy nhập câu hỏi trước nhé.");
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new AIServiceError("AI_MESSAGE_TOO_LONG", "Câu hỏi tối đa 1.200 ký tự.");
  }

  if (hasEmergencySymptoms(message)) {
    return {
      reply:
        "Triệu chứng bạn mô tả có thể cần cấp cứu. Hãy gọi 115 hoặc nhờ người ở gần đưa đến khoa cấp cứu ngay; đừng tự lái xe. Nếu người bệnh bất tỉnh hoặc co giật, không cho ăn uống hay uống thuốc qua miệng. Đừng chờ phản hồi từ AI.",
      provider: "safety",
    };
  }

  const history = cleanHistory(input.history, message);
  const prompt = makeCurrentPrompt({ ...input, message });
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  const reply = apiKey
    ? await callGemini({
        apiKey,
        model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
        history,
        prompt,
      })
    : process.env.VERCEL
    ? (() => {
        throw new AIServiceError(
          "AI_NOT_CONFIGURED",
          "Trợ lý AI chưa được cấu hình trên máy chủ. Hãy thêm GEMINI_API_KEY vào Environment Variables của project backend trên Vercel rồi redeploy."
        );
      })()
    : await callLocalOllama({ history, prompt });

  return { reply, provider: apiKey ? "gemini" : "ollama" };
};

exports.AIServiceError = AIServiceError;
