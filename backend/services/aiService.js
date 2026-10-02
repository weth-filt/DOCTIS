const ollama = require("ollama");

exports.chatAI = async ({
  glucose,
  bmi,
  bloodPressure,
  heartRate,
  message,
  history = [],
}) => {

  try {

    // ================= RISK LEVEL =================

    let risk = "🟢 An toàn";

    if (glucose >= 180) {
      risk = "🔴 Nguy hiểm";
    }
    else if (glucose >= 140) {
      risk = "🟡 Trung bình";
    }

    // ================= SYSTEM PROMPT =================

    const systemPrompt = `
Bạn là AI Health Assistant chuyên về bệnh tiểu đường và sức khỏe.

QUY TẮC:
- Chỉ trả lời bằng tiếng Việt
- Không dùng tiếng Anh
- Không dùng tiếng Trung
- Không giải thích từ vựng
- Không lặp lại câu hỏi
- Không lan man
- Không bịa chuyện
- Trả lời như bác sĩ thật
- Dễ hiểu với người bình thường
- Luôn tập trung vào sức khỏe bệnh nhân

FORMAT TRẢ LỜI:

⚠️ Đánh giá:
(đánh giá ngắn gọn)

📌 Phân tích:
(phân tích nguyên nhân)

🥗 Lời khuyên:
(gợi ý ăn uống/tập luyện)

🏥 Khuyến nghị:
(khi nào nên đi khám)

Nếu chỉ số nguy hiểm:
- phải cảnh báo rõ ràng

Nếu bệnh nhân hỏi ngoài chủ đề sức khỏe:
- lịch sự đưa về chủ đề sức khỏe
`;

    // ================= USER PROMPT =================

    const userPrompt = `
THÔNG TIN BỆNH NHÂN:

- Glucose: ${glucose}
- BMI: ${bmi}
- Huyết áp: ${bloodPressure}
- Nhịp tim: ${heartRate}
- Mức độ rủi ro: ${risk}

CÂU HỎI:
${message}
`;

    // ================= CHAT HISTORY =================

    const messages = [

      {
        role: "system",
        content: systemPrompt,
      },

      ...history,

      {
        role: "user",
        content: userPrompt,
      }

    ];

    // ================= OLLAMA =================

    const response = await ollama.default.chat({

      model: "qwen2:0.5b",

      messages,

      options: {
        temperature: 0.4,
        top_p: 0.8,
      }

    });

    return {

      reply: response.message.content,

      risk,

    };

  }

  catch (err) {

    console.log("OLLAMA ERROR =", err);

    return {

      reply:
        "AI hiện đang bận. Vui lòng thử lại sau.",

      risk: "⚪ Không xác định"

    };

  }

};