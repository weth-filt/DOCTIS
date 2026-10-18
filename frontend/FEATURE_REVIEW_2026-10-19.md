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

## Chạy local

- Web: http://127.0.0.1/dashboard, phục vụ từ `frontend/build` bằng `serve_build.js`.
- API preview: http://127.0.0.1:5000/api, normal JWT/MongoDB, không chạy scheduler email.
- Không đưa file ảnh review, khóa hoặc `.env` vào commit.
