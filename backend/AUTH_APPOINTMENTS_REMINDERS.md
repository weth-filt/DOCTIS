# Xác thực, hủy lịch và nhắc hoạt động

## Kiểm tra quyền theo yêu cầu hiện tại

Middleware JWT xác minh chữ ký và đọc `User.role` từ MongoDB cho mỗi yêu cầu. Thu quyền doctor có hiệu lực ở yêu cầu tiếp theo với token cũ; không đổi mật khẩu hoặc vô hiệu hóa toàn bộ token hiện có. Khi không đọc được quyền hiện tại, API trả 503 thay vì tin vai trò cũ trong JWT.

`assignmentAccess` kiểm tra bác sĩ hiện còn vai trò doctor, bệnh nhân hiện còn vai trò user và phân công active. Phân công theo luồng điều phối còn phải khớp bệnh viện active/verified, hồ sơ đã tiếp nhận ở trạng thái assigned và bác sĩ hiện thuộc bệnh viện đó. `acceptingPatients` chỉ giới hạn tiếp nhận mới, không tự cắt theo dõi đang có. Phân công cũ chưa gắn hồ sơ điều phối vẫn đọc được cho đến khi admin thực hiện thay đổi rõ ràng.

## Khôi phục mật khẩu bằng OTP

Luồng được hỗ trợ là `/auth/forgot` → `/auth/verify` → `/auth/reset`. Trang `/reset/:token` đã chuyển về `/forgot`; không xác thực bằng token reset cũ.

- Gửi email và mã OTP ở bước xác minh; gửi đủ `{email,otp,password,confirmPassword}` ở bước đổi mật khẩu.
- Mã 6 chữ số dùng `crypto.randomInt`, lưu HMAC trong collection `PasswordResetChallenge`, có hạn 5 phút, giới hạn 5 lần sai và chờ 60 giây giữa hai yêu cầu mã mới. Mỗi mã chỉ đổi mật khẩu một lần bằng cập nhật có điều kiện.
- Cấu hình một trong hai bộ biến môi trường: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (cùng `SMTP_PORT`, `SMTP_SECURE`, `MAIL_FROM` nếu cần), hoặc Gmail `EMAIL_USER`, `EMAIL_PASS`. Không đặt thông tin này trong frontend.
- Thiếu cấu hình hoặc SMTP từ chối người nhận trả lỗi; không hiển thị đã gửi. Mã chưa được gửi thành công được gỡ khỏi challenge. Không ghi OTP, mật khẩu, token hoặc cấu hình SMTP vào log.
- TTL chỉ dọn bản ghi; API vẫn kiểm tra ngày hết hạn trực tiếp, không phụ thuộc tốc độ dọn TTL. User cũ vẫn đăng nhập bình thường; chỉ sau một lần reset được xác minh thì mật khẩu mới thay mật khẩu cũ.

## Hủy lịch hẹn

`PUT /api/appointments/cancel/:id` nhận `{reason}` từ 3–1.000 ký tự. Bệnh nhân chỉ hủy lịch thuộc mình; bác sĩ cần vừa là doctorId của lịch vừa còn phân công bệnh nhân hợp lệ. Admin không hủy thay trong luồng này.

Chỉ pending/approved được chuyển cancelled. API lưu `cancelReason`, `cancelledBy`, `cancelledByRole`, `cancelledAt`; không xóa lịch hoặc tác động đơn thuốc/hồ sơ/phân công. Lịch completed bị từ chối. Gửi lại hoặc gửi đồng thời vẫn giữ metadata lần hủy đầu, trả `alreadyCancelled` và dùng một notification event key `appointment:<id>:cancelled` cho bên còn lại.

Nhắc lịch thủ công và tác vụ hủy dùng điều kiện trạng thái cùng lease. Nếu đang gửi email, hủy trả 409 để người dùng thử lại sau khi tác vụ hoàn tất. Lịch cancelled/completed không gửi nhắc. Các `Reminder` đã gắn `appointmentId` bị tắt khi hủy; không suy đoán liên kết lịch chỉ từ nội dung hoặc tiêu đề lời nhắc cũ.

`CancelAppointmentDialog` dùng chung cho bệnh nhân và bác sĩ: đóng hộp không ghi dữ liệu; khóa gửi lặp; lỗi giữ lý do; chỉ báo thành công sau khi nhận bản ghi cancelled từ API.

## Chạy nhắc theo ngày và múi giờ

Lời nhắc có `scheduleDate` được coi là once. Lời nhắc cá nhân không có ngày có thể daily; lời nhắc CARE_PLAN/DOCTOR_CARE_PLAN thiếu ngày bị từ chối khi tạo mới và bị bỏ qua khi chạy dữ liệu cũ, tránh tự biến hoạt động một ngày thành nhắc hằng ngày. Cần người dùng chỉnh ngày cho những bản ghi cũ này.

Runner `runReminderTick()` trong `services/cronService.js` dùng giờ/ngày Asia/Ho_Chi_Minh cho cả hai phép kiểm tra. Lease MongoDB hạn chế tick đồng thời; chỉ cập nhật lastSentDate khi hàm gửi thực sự trả true. Lỗi hoặc thiếu email không đánh dấu đã gửi. Nhắc một ngày tắt sau gửi thành công. EmailService không nuốt lỗi SMTP.

`startCron()` chỉ chạy khi `backend/server.js` hoạt động liên tục. Vercel serverless không tự chạy node-cron; endpoint scheduler được bảo vệ và cấu hình lịch gọi ngoài cần được thiết lập riêng. Không tuyên bố lịch nhắc public tự hoạt động khi chưa cấu hình và kiểm tra trigger.

## Kiểm tra local đã thực hiện

19 kiểm thử unit cô lập xác thực/OTP/phân công/lịch/runner và 7 kiểm thử giao diện Forgot/modal dùng API giả kiểm soát, không gửi email.

Kiểm thử tích hợp thật được bật có chủ đích:

```powershell
$env:DOCTIS_MONGO_TEST='1'
node --experimental-test-isolation=none --test backend/tests/authAppointments.mongo.test.js
```

File này cố định kết nối replica set local tại `127.0.0.1:27028`, DB riêng `doctis_auth_appointments_test`; không đọc .env hoặc kết nối Atlas. Tạo các tài khoản fixture riêng, gọi HTTP login/doctor/cancel thật, kiểm tra lưu OTP và một notification khi hai lượt hủy đồng thời; dọn đúng ID fixture sau chạy. Không gửi email thật, không đổi tài khoản có sẵn, không drop/reset database. SMTP thực và giao diện trình duyệt thật chưa được xác minh trong các kiểm thử này.
