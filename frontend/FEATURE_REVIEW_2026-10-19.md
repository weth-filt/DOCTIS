# DOCTIS — sửa theo prompt ngày 19/10/2026

## 3. Đơn thuốc đã chốt

- Sửa grid minimum và `min-width` để lịch tuần cuộn trong khung, không kéo rộng trang. Khối rỗng có nội dung xuống dòng, căn giữa; mobile xếp dọc.
- Tách `PrescriptionPanel`, bổ sung nội dung thuốc/liều/giờ/ghi chú thực tế đã có trong đơn; tên dài xuống dòng.
- Hai kiểm thử component đạt; CRA build thành công.
- Chưa kiểm tra trực quan 360/768/1280px hoặc sáng/tối/đơn giản: công cụ không có browser kết nối, mở iab trả `Browser is not available: iab`.

## 2. Kế hoạch chăm sóc

- Tải kế hoạch AI hiện hành từ MongoDB, không tự tạo lại từ state. Tiến độ lưu qua PATCH có revision, cập nhật trước trên giao diện và hoàn tác khi lỗi.
- Tạo lại cần xác nhận. Bản cũ được lưu lịch sử; có ngày bắt đầu/kết thúc và snapshot đầu vào lấy từ server.
- Dùng hồ sơ đã lưu cho tạo lịch, không dùng bản nháp trong form. `basedOn` phát hiện đầu vào đã thay đổi từ thiết bị khác trước khi lưu.
- Chỉ gợi ý khi chỉ số thay đổi hoặc chu kỳ kết thúc; không tự ghi đè. Bản legacy không được bịa ngày, không tự dịch email reminder sang tuần hiện tại.
- Giữ API/bản chốt của bác sĩ. Thay kế hoạch dùng cập nhật có điều kiện và phục hồi bù; chưa phải transaction nhiều document.
- Kiểm thử backend persistence: 18 đạt. Kiểm thử frontend hook, chuẩn hóa ngày và tích hợp Dashboard đạt. CRA build thành công.
- Chưa xác minh đăng xuất/đăng nhập, toggle tiến độ và tạo lại bằng trình duyệt thật trong phiên này.

## 1. Lịch sử chat và tệp

- Tách `components/studio/AIWorkspace.jsx`, giữ component khi đổi chức năng để không mất bản nháp. Mặc định lần đầu mở là chat mới, lịch sử MongoDB bên trái; mobile dùng drawer.
- Nhóm theo ngày Việt Nam, phân trang hội thoại/tin nhắn, mở tiếp, đổi tên, xác nhận xóa, preview/tải file qua JWT. Xóa hội thoại xóa cả tin nhắn và tệp.
- Nén ảnh, chọn tối đa 4 file, tổng 2 MiB; PNG/JPG/WebP, PDF, TXT, CSV; camera dùng file input chuẩn. Có viewer, bỏ file và lỗi rõ ràng. HEIC không hỗ trợ trực tiếp.
- Nút/form/drawer/modal và tin nhắn có trạng thái, chuyển động ngắn; tôn trọng reduced motion và giao diện đơn giản. Không còn input border lồng trong composer dù CSS clinical cũ dùng `!important`.
- Chống gửi trùng tức thời và giữ `requestId` khi retry. Server lấy lịch sử theo JWT, không nhận dữ liệu hồ sơ từ client.
- Backend AI + care persistence: **144 kiểm thử đạt**. Provider trong unit test được thay bằng fixture, không phải kiểm chứng chất lượng Gemini thực tế.
- Frontend: **152 kiểm thử / 30 suite đạt**. ESLint các file trình bày/hook mới và Dashboard đạt với `--max-warnings=0`.

## Kiểm tra HTTP local với MongoDB thật

- Đăng nhập bình thường; tải kế hoạch 7 ngày legacy hiện có. Đánh dấu một mục chưa xong, đăng nhập lại, đọc lại thấy đã xong; hoàn trả mục về trạng thái chưa xong ban đầu.
- Tạo hội thoại kiểm tra, đổi tên, đăng nhập lại, thấy lịch sử và mở lại được. Hỏi số liệu đã lưu rồi hỏi tiếp ngày; 4 tin hoàn tất được lưu đúng hội thoại (`provider=records`, không gọi cloud).
- Gửi PNG 1px chỉ kiểm tra đường truyền, không phải tài liệu y tế. Model local từ chối đọc ảnh rõ ràng; file vẫn lưu và tải lại chính xác qua JWT, thiếu JWT nhận 401.
- Xóa đúng hội thoại kiểm tra đã tạo; chi tiết và tệp liên quan đều trả 404. Không xóa dữ liệu cũ hoặc gửi nhắc email.
- Chưa gọi Gemini thật cho ảnh/PDF trong lượt sửa này vì local dùng Ollama, không có khóa cloud local. Biến Production của Vercel giữ nguyên; mã mới chưa được đưa lên Vercel.
- Chưa xác minh camera điện thoại, responsive/màu sắc/animation bằng trình duyệt thật hoặc tạo lại kế hoạch qua UI. Không có ảnh/video sau sửa do browser tool không kết nối.

## Mở bản đã build

- Web: http://127.0.0.1/dashboard, phục vụ từ `frontend/build` bằng `serve_build.js`.
- API preview: http://127.0.0.1:5000/api, normal JWT/MongoDB, không chạy scheduler email.
- Không đưa file ảnh review, khóa hoặc `.env` vào commit.
