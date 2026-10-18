# Đưa DOCTIS lên Vercel

Vercel sẽ cấp URL dạng `https://ten-du-an.vercel.app`. Vì API cần Express và dữ liệu cần MongoDB, triển khai thành hai Vercel project từ cùng một GitHub repository riêng tư:

- `doctis` (`doctis.vercel.app`): Root Directory `backend`, API Express.
- `doctis-frontend` (`doctis-frontend.vercel.app`): Root Directory `frontend`, web CRA.
- `doctis-mobile`: project Expo/web riêng đang có; giữ cấu hình `mobile/vercel.json`.

`frontend/vercel.json` đặt build/output cho CRA và fallback về `index.html` khi
mở trực tiếp `/dashboard`, `/doctor`, `/admin`. Không đổi root project API sang
`mobile` hoặc dùng cấu hình Expo cho web CRA.

## AI production — lựa chọn đã xác nhận ngày 18/10/2026

Người dùng chọn **Gemini cloud cho website Vercel**; bản local vẫn giữ Ollama
4B trong `backend/.env`. Tại project **doctis → Settings → Environment Variables**,
đặt cho **Production**:

| Biến | Giá trị |
| --- | --- |
| `AI_PROVIDER` | `gemini` |
| `GEMINI_MODEL` | `gemini-3.6-flash` |
| `GEMINI_API_KEY` | Khóa do chủ dự án tự nhập, không gửi vào chat |

Sau khi lưu biến, redeploy project **doctis** để bản chạy nhận cấu hình mới.
Chỉ thêm khóa ở backend; không dùng tiền tố `REACT_APP_`. Giữ nguyên `MONGO_URI`,
`JWT_SECRET`, `ALLOWED_ORIGINS` đang hoạt động. Vercel mặc định chọn Gemini khi
chưa đặt `AI_PROVIDER`; nếu đã có `AI_PROVIDER=ollama`, cần đổi thành `gemini`.
Không tự fallback về Ollama trên Vercel. Hỏi thuần số đo đã lưu dùng dữ liệu xác
thực và không cần khóa model; hội thoại cần khóa hợp lệ và hạn mức nhà cung cấp.

Việc chọn cloud đồng nghĩa câu hỏi và phần ngữ cảnh y tế liên quan được gửi đến
Gemini để suy luận. Backend vẫn chỉ chọn dữ liệu y tế cần thiết, loại tên/email/
CCCD/địa chỉ/ảnh/liên hệ. Kiểm tra câu trả lời cloud thật sau khi đã cấu hình khóa;
kiểm thử local trước đó không chứng minh chất lượng hoặc hạn mức Gemini.

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
