# Đưa DOCTIS lên Vercel

Vercel sẽ cấp URL dạng `https://ten-du-an.vercel.app`. Vì API cần Express và dữ liệu cần MongoDB, triển khai thành hai Vercel project từ cùng một GitHub repository riêng tư:

- `doctis-api`: thư mục gốc (Root Directory) là `backend`.
- `doctis-web`: thư mục gốc là `frontend`.

GitHub chỉ lưu mã nguồn; không lưu file `.env`, dữ liệu database hay mật khẩu.

## Trước khi bắt đầu

1. Tạo tài khoản Vercel và GitHub bằng email của bạn.
2. Tạo MongoDB Atlas cluster, database user và cho phép kết nối từ Vercel (`0.0.0.0/0` trong Network Access). Dùng mật khẩu database riêng, mạnh; không gửi mật khẩu hoặc URI cho ai.
3. Sao lưu MongoDB đang chạy trên máy. Nếu muốn giữ tài khoản/dữ liệu cũ, cần nhập bản sao lưu vào Atlas trước khi chuyển người dùng sang bản trực tuyến. Chưa cấu hình `MONGO_URI` Atlas thì đăng nhập và lưu dữ liệu trên bản Vercel chưa hoạt động.
4. Tạo GitHub repository ở chế độ **Private**. Thêm thư mục dự án vào repository sau khi kiểm tra `backend/.env` không nằm trong danh sách file được tải lên.

## Triển khai API trước

1. Trong Vercel, chọn **Add New → Project**, import repository.
2. Đặt **Root Directory** thành `backend`.
3. Thêm Environment Variables cho Production (và Preview nếu cần):
   - `MONGO_URI`: connection string của MongoDB Atlas.
   - `JWT_SECRET`: chuỗi bí mật dài, ngẫu nhiên, riêng cho môi trường trực tuyến.
   - `ALLOWED_ORIGINS`: để trống trong lần triển khai đầu; cập nhật thành URL web Vercel ở bước sau.
   - Để bật trợ lý AI trên Vercel, thêm `GEMINI_API_KEY` (lấy trong Google AI Studio) và tùy chọn `GEMINI_MODEL=gemini-3.6-flash`. Chỉ lưu khóa trong Environment Variables của project backend; không đưa khóa vào frontend, GitHub hoặc chat.
   - Các biến email chỉ cần thêm nếu muốn bật tính năng email: `EMAIL_USER`, `EMAIL_PASS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
4. Deploy. Mở `https://<api-project>.vercel.app/api/health` để xem API có phản hồi. Nếu báo chưa cấu hình MongoDB, kiểm tra `MONGO_URI` trong Project Settings → Environment Variables rồi redeploy.

## Triển khai giao diện

1. Tạo project Vercel thứ hai từ cùng repository.
2. Đặt **Root Directory** thành `frontend`. Vercel tự nhận diện Create React App và thư mục build.
3. Thêm biến `REACT_APP_API_URL` với giá trị `https://<api-project>.vercel.app/api` (thay bằng URL API vừa tạo). Biến này được nhúng lúc build, nên thêm hoặc sửa xong cần redeploy.
4. Deploy và mở URL web `https://<web-project>.vercel.app`.
5. Quay lại project API, đặt `ALLOWED_ORIGINS` bằng chính xác URL web (ví dụ `https://doctis-web.vercel.app`), lưu lại và redeploy API.

URL web này là link chia sẻ cho bệnh nhân/bác sĩ. Mọi người dùng link đó để đăng nhập; chỉ tài khoản có role admin được API cho phép dùng chức năng quản trị. Link `/admin` không phải là biện pháp bảo vệ riêng.

## Giới hạn cần biết

- Máy cá nhân có thể tắt sau khi chuyển sang Atlas và Vercel; website/API vẫn được host trực tuyến. Dữ liệu chỉ được lưu trên Atlas sau khi cấu hình connection string Atlas.
- Vercel Function giới hạn request body ở 4.5 MB; cấu hình triển khai giới hạn JSON ở 4 MB. Ảnh/tệp lớn cần chuyển sang object storage/direct upload.
- AI cục bộ qua Ollama chỉ dùng khi chạy backend trên máy phát triển; trên Vercel, trợ lý cần `GEMINI_API_KEY` và phải redeploy backend sau khi thêm khóa. Cron chạy mỗi phút trong tiến trình Node cũng không tự hoạt động như vậy trên Vercel; lịch nhắc email cần cron/worker bên ngoài hoặc cấu hình gói phù hợp.
- Dịch vụ miễn phí có giới hạn tài nguyên và phù hợp demo/đồ án. Với dữ liệu sức khỏe thật, cần kiểm tra kỹ bảo mật, sao lưu, quyền truy cập và quy định áp dụng trước khi mời người dùng thật.
