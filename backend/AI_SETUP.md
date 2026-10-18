# Chạy thử DOCTIS AI ở local

## Lựa chọn production mới

Ngày 18/10/2026, chủ dự án đã đồng ý đưa bản đã duyệt lên Vercel và chọn
**Gemini cloud cho AI trên website**. Xem [VERCEL_DEPLOY.md](../VERCEL_DEPLOY.md)
để cấu hình khóa trong project API `doctis`; không gửi khóa qua chat. Các mục
Ollama bên dưới mô tả bản local, vẫn giữ nguyên và không chuyển sang cloud.
Tra cứu thuần dữ liệu đã lưu không phụ thuộc khóa model. Chưa có khóa hợp lệ
thì chưa thể xác minh hội thoại Gemini thật trên production.

`POST /api/ai/analyze` giữ nguyên xác thực. Backend đọc dữ liệu y tế đã lưu
của chính tài khoản trong JWT, gồm hồ sơ liên quan và tối đa 7 lần đo gần nhất.
Không gửi tên, email, CCCD, địa chỉ, ảnh hoặc thông tin liên hệ vào prompt.

## Cấu hình local đã chọn

Người dùng chọn AI hoàn toàn local. Trong `backend/.env` hiện có:

```dotenv
AI_PROVIDER=ollama
OLLAMA_MODEL=qwen3:4b-instruct-2507-q4_K_M
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_NUM_CTX=4096
```

Chế độ `AI_PROVIDER=ollama` không gọi Gemini ngay cả khi máy có một khóa Gemini.
Model được cài vào Ollama; suy luận không gửi hồ sơ đến nhà cung cấp AI cloud.
Cơ sở dữ liệu Atlas hiện có của ứng dụng được giữ nguyên. Toàn bộ lần sinh và
một lần sửa câu trả lời (nếu cần) dùng chung giới hạn 120 giây; frontend đợi tối
đa 150 giây. `OLLAMA_NUM_CTX` tùy chọn, mặc định 8192, chỉ nhận 2048–16384.

## Hội thoại và dữ liệu đã lưu — cập nhật 18/10/2026

- `aiConversation.js` chọn ngữ cảnh theo câu hỏi hiện tại: chào hỏi, giải thích
  chung, triệu chứng hiện tại, hoặc dữ liệu đã lưu. Đây là bước chọn dữ liệu,
  không phải bộ câu trả lời y tế theo từ khóa.
- Chào hỏi không đọc DB, không gửi số đo/lịch sử y tế. Đổi chủ đề không tự kéo
  chỉ số cũ vào. Triệu chứng hiện tại không được gán số đo lịch sử. Câu hỏi tiếp
  về bản ghi dựa trên chủ đề trong lời **người dùng**, không lấy số trong lời AI
  cũ làm bằng chứng. Người khác không dùng hồ sơ của tài khoản đang đăng nhập.
- Hỏi thuần giá trị/ngày/hồ sơ được hiển thị trực tiếp qua
  `aiSavedFactsReply.js`, sau khi đọc dữ liệu xác thực như cũ;
  `provider=records`. Chỉ số, đơn vị và giờ Việt Nam được định dạng từ dữ liệu
  thật, không nhờ model suy đoán. Gần nhất/cao nhất/thấp nhất được phân biệt;
  nêu rõ cửa sổ tối đa 7 bản ghi, không nhận là toàn bộ lịch sử. Giá trị thiếu
  vẫn thiếu; huyết áp không ghép hai thành phần từ hai lần đo.
- Câu hỏi giải thích/lời khuyên hoặc nhiều ý vẫn đi qua model Ollama. Lượt hỏi
  thô giữ nguyên ở cuối request; hồ sơ liên quan là dữ liệu trong system context.
  Các ghi chú kiến thức trong `aiHealthKnowledge.js` hỗ trợ trả lời theo chủ đề
  (NIDDK, AHA, MedlinePlus, FDA); không gọi mạng để lấy kiến thức lúc trò chuyện.
  Tên thuốc trong câu hỏi tiếp nối chỉ được suy ra từ chủ đề người dùng đã nêu,
  không suy ra từ một đơn thuốc do AI đoán.
- `aiReplyChecks.js` kiểm tra hẹp những lỗi đã tái hiện: mâu thuẫn dị ứng,
  120/80 bị gọi là huyết áp thấp, giờ dùng metformin trái nguồn, tự tăng muối,
  đo đường niệu hằng ngày ngoài câu hỏi, và chữ Trung bị xen vào. Cho model
  tạo lại tối đa một lần trong cùng deadline. Nếu vẫn vi phạm, trả lỗi
  `AI_REPLY_NOT_RELIABLE`; không dựng câu trả lời thành công giả. Các kiểm tra
  này **không phải bộ thẩm định y khoa đầy đủ**. Khi người dùng báo huyết áp
  thấp nhưng chưa cung cấp số vừa đo, ứng dụng bổ sung câu hỏi làm rõ nếu model
  chưa hỏi, không tự điền số hoặc đưa chẩn đoán.
- Cấp cứu được ưu tiên như cũ, nhưng câu phủ định/giả định/giáo dục không bị
  biến thành báo cấp cứu hiện tại. Phần này chỉ nhận diện một số dấu hiệu rõ,
  không thay thế đánh giá chuyên môn.
- Nút **Cuộc trò chuyện mới** chỉ bỏ lịch sử AI của phiên giao diện; giữ bản
  nháp, hồ sơ, form sức khỏe, chat bác sĩ và phiên đăng nhập. Nút bị khóa trong
  lúc chờ phản hồi để tránh reset/gửi trùng.

Đã so sánh `qwen2.5:3b`, `qwen3:4b-instruct-2507-q4_K_M` và `qwen3.5:2b` trên
máy local. Chọn Qwen3 4B với context 4096 sau khi điều chỉnh prompt và các bước
đối chiếu: các lượt thử có diễn đạt hội thoại rõ hơn model 3B cũ, nhưng chậm hơn
(nhiều lượt khoảng 15–35 giây, có lượt lâu hơn). Đây là lựa chọn thực nghiệm trên
máy 8GB RAM, không phải chứng nhận chất lượng y khoa. Qwen3.5 2B không được chọn.
Các model nhỏ này vẫn có lỗi về giải thích thuốc, khẩu phần hoặc cách dùng từ;
kiểm tra hẹp không phát hiện hết. Không sử dụng kết quả này làm chẩn đoán hoặc
điều chỉnh điều trị tự động. Không tự đổi provider sang cloud khi gặp lỗi.

Local preview dùng `node backend/scripts/start-ai-preview.js`: app/xác thực bình
thường, bind 127.0.0.1 và không chạy lịch gửi email khi kiểm tra. Production vẫn
dùng `backend/server.js` như trước. Khởi động lại backend sau thay đổi môi trường.

## Kết nối Gemini (tùy chọn, không dùng trong lần chạy này)

Thêm hoặc cập nhật trong **backend/.env** hiện có, giữ các cấu hình khác:

```dotenv
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-3.6-flash
AI_PROVIDER=gemini
```

Không dán khóa vào chat, source frontend hoặc Git. File `backend/.env` đã được
gitignore. Khởi động lại backend sau khi thay đổi môi trường; frontend không cần
biết khóa. Không có khóa/hạn mức hợp lệ thì chưa thể xác minh câu trả lời Gemini thật.

## Dùng Ollama hoàn toàn local

Khi không cấu hình Gemini, đặt rõ `OLLAMA_MODEL` thành một model đã cài đặt và
đã đánh giá chất lượng tiếng Việt phù hợp. Backend không còn tự chọn
`qwen2:0.5b` khi thiếu khóa. Khả năng trả lời của model local cần kiểm tra thực tế;
việc API trả HTTP 200 không chứng minh chất lượng tư vấn y tế.

```dotenv
OLLAMA_MODEL=your-installed-model
OLLAMA_HOST=http://127.0.0.1:11434
```

Khi không đặt `AI_PROVIDER`, có khóa Gemini thì backend ưu tiên Gemini. Nếu đặt
`AI_PROVIDER` thì luôn tuân theo provider đã chọn. Không tự đổi provider khi có
lỗi. Không dùng Ollama localhost trên Vercel.

## Kiểm tra

```powershell
node --experimental-test-isolation=none --test backend/tests/aiService.test.js backend/tests/aiPatientContext.test.js backend/tests/aiController.test.js backend/tests/aiConversation.test.js backend/tests/aiSavedFactsReply.test.js backend/tests/aiReplyChecks.test.js
```

Các bài này dùng fixture và provider giả lập **chỉ trong test**, không gọi cloud,
không đọc/ghi dữ liệu bệnh nhân. Chạy ứng dụng thật vẫn dùng API và dữ liệu thật.
Sau khi cấu hình provider, thử hỏi tiếp trong cùng hội thoại và hỏi về bản ghi
đã lưu; cần kiểm tra cả ngày đo, trường thiếu và phản hồi khi provider có lỗi.

Kiểm tra model Ollama thật với fixture riêng, không đọc/ghi hồ sơ bệnh nhân:

```powershell
node backend/scripts/ai-conversation-smoke.js
```

Script trên dùng câu trả lời trước thật của model làm lịch sử cho lượt hỏi tiếp,
có dữ kiện cũ cố ý sai để kiểm tra việc ưu tiên dữ liệu máy chủ mới. Đọc cả nội
dung, không chỉ kết quả đối sánh từ khóa: model vẫn có thể đưa lời khuyên sai
dù bài smoke đạt.

`check-ai-endpoint.js` là bài kiểm tra API local qua đăng nhập bình thường, nhận
tài khoản JSON qua stdin. Không hard-code tài khoản vào file hoặc commit; không
in mật khẩu, JWT, nội dung hồ sơ hay câu trả lời chứa số liệu thật ra log. Bài
kiểm tra chỉ đọc hồ sơ/lịch sử và gửi câu hỏi AI, không lưu/chỉnh dữ liệu.
