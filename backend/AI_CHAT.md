# Lịch sử AI và tệp đính kèm

## Cấu hình

Giữ cấu hình Gemini hiện có trên project **doctis (API)**:

- `AI_PROVIDER=gemini`
- `GEMINI_MODEL`: model Gemini đã cấu hình và có quyền truy cập.
- `GEMINI_API_KEY`: khóa server, không có trong bundle frontend.
- **Biến mới tùy chọn:** `AI_MESSAGES_PER_HOUR=20`. Nếu không đặt, mặc định 20 lượt/tài khoản trong cửa sổ trượt 60 phút. Giá trị hợp lệ 1–1000.

Không cần Blob/Cloudinary hoặc khóa lưu trữ mới. Tệp đầy đủ được lưu bằng Buffer trong collection `AIAttachment` của MongoDB, tách khỏi tin nhắn để tránh giới hạn document. Cần theo dõi dung lượng Atlas khi lượng người dùng/tệp tăng.

Local giữ cấu hình Ollama hiện có cho chat văn bản. Model local hiện tại không hỗ trợ đọc tệp; API trả `AI_ATTACHMENTS_UNSUPPORTED`, giữ lượt gửi thất bại rõ ràng. Không tự bỏ qua tệp hoặc dựng câu trả lời thay model.

## API có JWT

| Phương thức | Đường dẫn dưới `/api` | Công dụng |
|---|---|---|
| GET/POST | `/ai/conversations` | Danh sách có phân trang / tạo hội thoại |
| GET/PATCH/DELETE | `/ai/conversations/:conversationId` | Chi tiết / đổi tên / xóa kèm tin nhắn và tệp |
| GET/POST | `/ai/conversations/:conversationId/messages` | Tin nhắn cũ có phân trang / gửi câu hỏi |
| GET | `/ai/attachments/:attachmentId/content` | Tải tệp riêng tư qua JWT |

POST tin nhắn nhận `{message, requestId, attachments:[{name,mimeType,data}]}`; `data` là base64 thuần. Danh tính và lịch sử đều do server xác định; không nhận `userId`, dữ liệu hồ sơ hay lịch sử làm nguồn đáng tin từ client.

- 1.200 ký tự, tối đa 4 tệp, tổng dữ liệu gốc tối đa 2 MiB/lượt. Base64 + JSON được frontend kiểm tra dưới 4 MiB, phù hợp giới hạn Vercel.
- Ảnh JPG/PNG/WebP được client chuyển JPEG, cạnh dài tối đa 1600px, chất lượng 0,8; PDF/TXT/CSV không nén. HEIC cần chuyển JPG.
- Server xác minh base64, số byte và chữ ký/MIME tệp; tên tệp được làm sạch. URL file không public, không chứa token.
- File gửi Gemini bằng `inline_data`; TXT/CSV có nhãn dữ liệu không tin cậy và giới hạn 12.000 ký tự/tệp. Lịch sử tối đa 20 tin; file trong ngữ cảnh tối đa 6 MiB. File cũ bị bỏ do dung lượng được đánh dấu rõ.
- `requestId` ngăn gọi model trùng khi retry. Có khóa mỗi hội thoại và xử lý lượt pending bị gián đoạn sau 180 giây.
- Quota dùng MongoDB, dùng chung cả endpoint mới và `/ai/analyze` cũ; không dựa bộ nhớ riêng từng Vercel instance.

System prompt nằm trong `services/aiService.js`. Nội dung tải lên chỉ là dữ liệu, không ghi tự động vào hồ sơ/Health, không được phép thay chỉ dẫn hệ thống.

Tài liệu payload: [Gemini generateContent](https://ai.google.dev/api/generate-content), [phương thức gửi tệp](https://ai.google.dev/gemini-api/docs/generate-content/file-input-methods).
