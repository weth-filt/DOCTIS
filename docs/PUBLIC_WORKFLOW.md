# DOCTIS — tiếp nhận public tại Đà Nẵng

Ngày cập nhật: 19/10/2026. Đợt này chỉ sửa mã và chạy local; chưa push, deploy hoặc nạp dữ liệu production. Trang đăng nhập và thiết kế đã có được giữ nguyên.

## 1. Vai trò và trạng thái

| Tác nhân | Hoạt động |
| --- | --- |
| Bệnh nhân (`user`) | Đăng ký địa chỉ phục vụ, bổ sung/sửa địa chỉ, xem bệnh viện/bác sĩ, đọc thông báo, hủy lịch của mình. |
| Bệnh viện | Tiếp nhận thực tế và quyết định bác sĩ phụ trách; chưa có tài khoản quản trị bệnh viện riêng. |
| Admin (`admin`) | Quản lý danh mục đã xác minh, chọn bệnh viện phù hợp, ghi nhận kết quả tiếp nhận và quyết định phân công của bệnh viện, quản lý bệnh viện của bác sĩ. |
| Bác sĩ (`doctor`) | Theo dõi bệnh nhân đang được giao, nhắn tin, lập kế hoạch/đơn thuốc/lịch hẹn và hủy lịch mình phụ trách. |

Luồng: **Chờ cập nhật bệnh viện → Đã chọn bệnh viện → Bệnh viện đã tiếp nhận → Đã ghi nhận bác sĩ** (`waiting_hospital`, `hospital_selected`, `accepted`, `assigned`). Chọn bệnh viện không tạo lịch hẹn và không tự phân công bác sĩ.

### Đăng ký địa chỉ phục vụ

- Điều kiện: danh mục phường có bản ghi active/verified thuộc Đà Nẵng.
- Đầu vào: các trường đăng ký cũ, địa chỉ chi tiết, `wardId`, thành phố Đà Nẵng và requestId chống gửi lặp.
- Luồng chính: kiểm tra frontend/backend → băm mật khẩu → transaction tạo User, SupportRequest và thông báo admin → trả thành công.
- Gửi lại cùng requestId chỉ được replay khi đúng thông tin nhận diện, địa chỉ và mật khẩu; không dùng requestId để đọc tài khoản khác. Unique indexes và transaction chống tạo trùng khi gửi đồng thời.
- Ngoại lệ: thiếu/sai phường, ngoài thành phố, thiếu địa chỉ, trùng định danh, danh mục chưa cấu hình hoặc transaction không được hỗ trợ → lỗi rõ ràng, không xác nhận tài khoản/hồ sơ dở dang.
- Không tự phân công bác sĩ. Không sửa mật khẩu/tài khoản cũ.

### Quản lý danh mục đã xác minh

- Điều kiện: admin đang đăng nhập. Nhập tên, địa chỉ, phường, liên hệ, trạng thái tiếp nhận, URL nguồn HTTPS và xác nhận đã đối chiếu.
- Thêm/sửa/ngừng hoạt động phường và bệnh viện tại **Danh mục phục vụ**. Sửa dùng revision để phát hiện thao tác đồng thời; “xóa” danh mục là ngừng hoạt động, không xóa bản ghi.
- Bệnh viện đang có hồ sơ/phân công phải được xử lý liên quan trước khi ngừng hoạt động/ngừng xác minh. Đổi bệnh viện của bác sĩ đang có bệnh nhân cũng bị chặn.
- Danh mục bệnh viện đã được nhập theo nguồn được cung cấp; cơ sở chưa đối chiếu hoặc chưa bật tiếp nhận vẫn hiển thị cho admin kèm điều kiện cần bổ sung. Không tự xác minh, bật tiếp nhận hoặc tạo bác sĩ. Chưa xếp hạng khoảng cách; admin đối chiếu địa chỉ/đường đi để chọn phù hợp.

### Chọn bệnh viện, ghi nhận tiếp nhận và phân công

- **Điều phối chăm sóc → Bác sĩ & bệnh viện**: chọn phường của bệnh viện, chọn cơ sở và bố trí tài khoản bác sĩ vào cơ sở đó. Có bộ lọc bác sĩ theo phường đăng ký; nơi ở không tự quyết định bệnh viện làm việc. Chỉ cập nhật `hospitalId`, giữ các thông tin khác của bác sĩ; chặn chuyển đơn vị khi còn phân công đang hoạt động.
- **Chờ điều phối** chỉ hiển thị hồ sơ chưa có bác sĩ. **Đã phân công** giữ người đã có bác sĩ và các quan hệ cũ cần đối chiếu. Tài khoản chuyển sang vai trò bác sĩ được loại khỏi danh sách bệnh nhân. Trạng thái khác nhau của hồ sơ cũ được hiển thị, không tự tạo xác nhận tiếp nhận.
- Điều kiện: admin; bệnh nhân có hồ sơ tiếp nhận và địa chỉ hợp lệ. Tìm/lọc theo phường, trạng thái hoặc tên/liên hệ; có tải thêm danh sách.
- Chọn bệnh viện active/verified/đang tiếp nhận, nhập lý do → lưu lịch sử, người thực hiện và thời gian → thông báo bệnh nhân.
- Khi có xác nhận thực tế từ bệnh viện, admin bấm **Ghi nhận tiếp nhận**. Chỉ sau đó mới ghi nhận bác sĩ do bệnh viện quyết định.
- Chỉ bác sĩ có role doctor và thuộc đúng bệnh viện mới được chọn. CAS revision, transaction và unique active assignment đảm bảo một bác sĩ đang phụ trách cho mỗi bệnh nhân.
- Đổi bác sĩ kết thúc bản ghi cũ và giữ lịch sử. Đổi bệnh viện kết thúc phân công cũ, đồng bộ `User.doctorId`, quay lại bước bệnh viện đã chọn và thu quyền bác sĩ cũ ở yêu cầu tiếp theo. Không tự xóa lịch hẹn, tin nhắn, kế hoạch hay đơn thuốc.
- Địa chỉ cũ thiếu phường: bệnh nhân bổ sung tại **Bệnh viện và bác sĩ phụ trách**, không đăng ký lại. Phân công cũ được giữ cho đến một thay đổi điều phối rõ ràng; không tự đoán bệnh viện. Lưu địa chỉ cập nhật cả User và snapshot hồ sơ tiếp nhận trong transaction.
- API PUT profile chỉ cập nhật hồ sơ lâm sàng/cá nhân; thay đổi địa chỉ phải qua PATCH care-team/address, tránh bỏ qua danh mục và lịch sử.
- Bản nháp hồ sơ và bản nháp địa chỉ được giữ khi chuyển mục. Refresh thông tin điều phối không ghi đè địa chỉ đang nhập.

### Nhận thông báo

- Admin nhận thông báo đăng ký/địa chỉ mới, bệnh nhân nhận thay đổi bệnh viện/bác sĩ, bên còn lại nhận thông báo hủy lịch.
- Thông báo được lưu MongoDB, không mất khi đăng xuất. Read state của thông báo phát cho admin được lưu riêng từng admin.
- Frontend dùng **polling**, mặc định 10 giây khi trang hiện, backoff tối đa 120 giây khi lỗi; bỏ polling khi ẩn trang và dọn timer/abort khi rời. Không phải WebSocket.
- Mở thông báo admin đi đúng hồ sơ tiếp nhận; thông báo lịch bệnh nhân mở đúng tháng và chi tiết lịch. API chỉ cho đọc/đánh dấu thông báo của đúng người/vai trò.

### Hủy lịch hẹn

- Đầu vào: lịch pending/approved của người thao tác, lý do 3–1.000 ký tự và xác nhận modal.
- Bệnh nhân hủy lịch của mình; bác sĩ phải là người phụ trách lịch và còn quyền theo dõi bệnh nhân. Không cho hủy lịch completed hoặc lịch người khác.
- Đóng modal không ghi dữ liệu. Khi gửi, khóa nút; lỗi giữ lý do; thành công chỉ khi API trả bản ghi cancelled.
- Lưu `cancelReason`, `cancelledBy`, `cancelledByRole`, `cancelledAt`, giữ lịch trong lịch sử. Gửi lại/đồng thời không tạo notification trùng.
- Không gửi nhắc lịch cancelled/completed; tắt các Reminder có appointmentId tương ứng. Nếu email đang gửi theo lease, trả 409 thay vì xác nhận hủy đồng thời. Không suy đoán liên kết reminder cũ qua tiêu đề.

## 2. Các lỗi tương thích được xử lý

- Role lấy lại từ MongoDB mỗi JWT request, không tin role cũ trong token. Thu quyền doctor kết thúc phân công trong transaction và có hiệu lực ngay yêu cầu tiếp theo.
- Phân công theo hồ sơ mới cần khớp SupportRequest, trạng thái tiếp nhận, bệnh viện và doctor membership. Các API chat/hồ sơ/sức khỏe/lời khuyên/đơn thuốc/kế hoạch dùng kiểm tra quyền server.
- `assignedDoctor` của admin và `chronicDiseases` bác sĩ đã khớp ở mã hiện tại; giữ hợp đồng đó.
- Forgot gửi đủ email/OTP/password/confirmPassword, dùng OTP crypto + HMAC, 5 phút, 5 lần sai, 60 giây gửi lại. Luồng reset token cũ chuyển về Forgot. Không trả thành công khi SMTP chưa cấu hình hoặc từ chối.
- Kế hoạch bác sĩ nháp/chốt tách với kế hoạch gợi ý của bệnh nhân; tiến độ được lưu server. HTTP test xác nhận bệnh nhân không thấy bản nháp bác sĩ, thấy bản chốt và vẫn giữ lịch sử sau đổi bệnh viện.
- Reminder theo ngày không tự đổi thành daily, thống nhất Asia/Ho_Chi_Minh, chỉ đánh dấu sent khi mail thực sự trả thành công. Chi tiết: [AUTH_APPOINTMENTS_REMINDERS.md](../backend/AUTH_APPOINTMENTS_REMINDERS.md).

### Phân biệt cảnh báo và mô hình dự đoán

Nguồn quy tắc cảnh báo duy nhất là `backend/config/monitoringRules.json`; hai bản frontend/Python được sinh bởi `node scripts/sync-monitoring-rules.cjs`, kiểm tra bằng `--check`. Thứ tự ưu tiên, nhãn và các toán tử `>`/`>=` giữ nguyên từ phiên bản trước:

| Cảnh báo | Điều kiện bất kỳ |
| --- | --- |
| Nguy hiểm | glucose >180 hoặc <70; BMI ≥30; nhịp tim >120 hoặc <50; tâm thu >160; tâm trương >100 |
| Cao | glucose >126; BMI ≥25; nhịp tim >100; tâm thu >140; tâm trương >90 |
| Ổn định/chưa có dữ liệu | Các giá trị hữu hạn còn lại/không có giá trị |

Đây là quy tắc theo dõi kế thừa, không phải kết quả chẩn đoán hoặc đánh giá lâm sàng mới. `diabetesRisk.js` cũ có ngưỡng screening khác (126/100); hiện không được gọi cho cảnh báo theo dõi, không nhập hai loại này làm một.

`Health.risk` là cảnh báo quy tắc, có riskSource/ruleVersion. `Health.prediction` là nhãn mô hình Python với predictionSource/status riêng. Python không ghi đè cảnh báo huyết áp/nhịp tim. Thiếu glucose không còn bị thay bằng 0 hoặc gọi model với dữ kiện bịa; lưu insufficient_data. Model lỗi vẫn lưu số đo và cảnh báo, prediction unavailable. Model weights và dữ liệu huấn luyện không được sửa/huấn luyện lại. Các khuyến nghị Python kế thừa chưa được thẩm định chuyên môn trong đợt này.

## 3. API chính

| API | Quyền/ý nghĩa |
| --- | --- |
| GET /api/public/wards | Public, chỉ danh mục active/verified Đà Nẵng; không có thông tin người dân |
| POST /api/auth/register | Đăng ký và tạo hồ sơ tiếp nhận nguyên tử |
| GET/POST /api/admin/catalog/wards, hospitals | Admin liệt kê/thêm; PATCH/DELETE /:id sửa/ngừng hoạt động có revision |
| GET /api/admin/intakes, /:id | Admin danh sách/chi tiết; mặc định `queue=open`, `queue=assigned` xem đã phân công, `queue=all` xem toàn bộ |
| POST /api/admin/intakes/:id/hospital, accept, assign, unassign | Admin lưu từng bước có revision |
| GET /api/care-team; PATCH /address | Bệnh nhân đọc/sửa địa chỉ của mình |
| GET /api/notifications; PATCH /:id/read | Đọc và đánh dấu đúng notification của tài khoản |
| PUT /api/appointments/cancel/:id | Chủ lịch hủy, idempotent |
| POST /api/internal/scheduler/reminders | Trigger nhắc, yêu cầu Bearer CRON_SECRET riêng ≥32 ký tự |

API phân công cũ vẫn có route tương thích nhưng không được bỏ qua tiếp nhận/bệnh viện. Những API khác được giữ nguyên.

Mobile đã được cập nhật đăng ký theo cùng catalog/address/requestId và ngừng gửi địa chỉ qua PUT profile cũ để không hỏng khi API bắt buộc phường. Màn hình điều phối/danh mục/thông báo mới triển khai ở web; mobile hướng dẫn sửa địa chỉ trên web, chưa có màn hình care-team native mới. Expo web export và kiểm tra logic đăng ký đạt; chưa chạy iOS/Android thật.

## 4. Danh mục và cập nhật dữ liệu an toàn

### Phường đã đối chiếu nguồn chính thức

`backend/data/danang-wards.verified.json` chuẩn bị 23 phường theo [Nghị quyết 1659/NQ-UBTVQH15 trên Cổng Chính phủ](https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-quyet-so-1659-nq-ubtvqh15-sap-xep-cac-dvhc-cap-xa-cua-thanh-pho-da-nang-nam-2025-119250616202714604.htm), đối chiếu ngày 19/10/2026. Chỉ phục vụ phạm vi **phường** trong prompt, chưa bao gồm xã/đặc khu. Mã DN-* là mã nội bộ ứng dụng, không phải mã hành chính quốc gia.

```powershell
# Offline, không mở kết nối DB, không ghi:
node backend/scripts/importVerifiedWards.js
# Sau khi chọn đúng DB và được phép nạp, tự đặt CATALOG_MONGO_URI trong terminal:
node backend/scripts/importVerifiedWards.js --apply
```

`--apply` bắt buộc có `CATALOG_MONGO_URI` được truyền rõ; không tự đọc .env. Chỉ upsert mã còn thiếu, không ghi đè bản đã quản lý, không xóa dữ liệu. Đã chạy hai lần trên DB preview local riêng để kiểm tra idempotency; chưa chạy với Atlas.

### Audit dữ liệu cũ

```powershell
# Tự đặt DOCTIS_MIGRATION_MONGO_URI cho DB muốn kiểm tra; không in URI.
node backend/scripts/audit-coordination-migration.js --dry-run
```

Script này dùng MongoClient đọc số lượng quan hệ chưa xác minh, phân công trùng/stale và tài khoản thiếu phường; không init model, không tạo index, không sửa bản ghi hoặc tự gán bệnh viện/bác sĩ. Không tự chạy với production. Luồng ghi bình thường có chuẩn bị các unique indexes trước transaction; đó là DDL thật khi bật mã mới, cần audit dữ liệu/index trước phát hành. Không dùng drop/reset hoặc syncIndexes xóa index.

## 5. Mở preview riêng để xem giao diện

Bản review dùng `http://127.0.0.1:5001`, DB local `doctis_public_preview` trên replica set `doctis-local-review`, cổng Mongo 27028. Server preview không đọc/ghi Atlas; không nạp bệnh viện hoặc hồ sơ giả. Tài khoản cũ trên Atlas không tự có trong DB review này. Một tài khoản admin đã được chủ dự án yêu cầu sao chép sang local để dùng lại thông tin đăng nhập.

```powershell
# MongoDB replica set local 27028 phải đang chạy.
node backend/scripts/startPublicPreview.js
```

Preview đọc build tại `.local-public-check/frontend-build`, không đọc backend/.env; khóa JWT local nằm trong thư mục ignored. SMTP và scheduler bị tắt, AI chọn Ollama local, không gửi dữ liệu sang cloud.

Nếu đã có admin trên Atlas, có thể sao chép riêng tài khoản đó vào preview khi được chủ dự án cho phép. Cấu hình nguồn lấy từ `backend/.env.maintenance.local`; đích cố định DB local 27028. Công cụ chỉ đọc Atlas, giữ bcrypt hash, không lấy dữ liệu sức khỏe/OTP/reset token, không in khóa hoặc hash và không ghi đè khi trùng tài khoản local:

```powershell
node backend/scripts/copyAdminToLocalPreview.js --email <email-admin>
node backend/scripts/copyAdminToLocalPreview.js --email <email-admin> --apply
```

Đăng nhập lại tại `http://127.0.0.1:5001/` bằng email/mật khẩu của tài khoản vừa sao chép. Chỉ dùng bản local đã lưu; thay đổi mật khẩu Atlas sau đó không tự đồng bộ vào preview.

Nếu muốn dùng tài khoản local riêng, đăng ký tại `/register`, sau đó cấp quyền CHỈ cho DB review này:

```powershell
node backend/scripts/promoteLocalPreviewAdmin.js <email-cua-ban> --apply
```

Script không tạo tài khoản/mật khẩu mới và cố định URI local; đăng nhập lại rồi mở `/admin` → Danh mục phục vụ → nhập bệnh viện đã xác minh → gắn bệnh viện cho bác sĩ. Dùng một tài khoản bệnh nhân khác để thử tiếp nhận; không đổi quyền admin thành patient để dùng chung hai vai trò.

Build riêng (không ghi đè frontend/build cũ):

```powershell
cd frontend
$env:BUILD_PATH='../.local-public-check/frontend-build'
$env:REACT_APP_API_URL='http://127.0.0.1:5001/api'
npm.cmd run build
```

Nếu Mongo 27028 đã tắt, chạy mongod với dbpath `.local-public-check/mongo`, bind 127.0.0.1, port 27028 và replSet `doctis-local-review`. Bộ thử local này đã được khởi tạo; không chạy lại lệnh tạo replica set trên Atlas.

## 6. Bằng chứng kiểm tra và giới hạn

- Có unit test, React DOM test với API mock kiểm soát, và HTTP thật + MongoDB replica set local với fixture riêng; dọn đúng ID kiểm thử, không drop DB. Các fixture không được dùng làm danh mục public.
- Kiểm tra thực: đăng ký và replay/rollback/validation; catalog CRUD/CAS; ba bước tiếp nhận; cạnh tranh phân công; quyền doctor cũ/ngoài phân công; thông báo lưu/read-state; đăng nhập bcrypt/JWT legacy; hủy đồng thời một notification; health/profile ownership; thiếu glucose; cảnh báo khác nhãn mô hình; chat hai chiều; kế hoạch nháp/chốt; đơn thuốc xác nhận và lịch sử.
- SMTP được thay bằng stub trong test; ML service dùng HTTP stub để kiểm hợp đồng, Python chỉ kiểm bộ quy tắc không cần load model. Không khẳng định đã gửi email thật hoặc đánh giá chất lượng mô hình/AI cloud.
- Chưa kiểm tra trực quan desktop/điện thoại: công cụ trả inventory `apps:[], browsers:[]`. Chưa có ảnh/video mới của bản public workflow. React DOM tests không thay thế kiểm tra hình ảnh/chuyển động thật.
- Production đã có 23 phường và 25 cơ sở y tế (5 đã đối chiếu, 20 bản chờ đối chiếu). Admin cần kiểm tra nguồn, bật tiếp nhận và gắn tài khoản bác sĩ vào đúng bệnh viện. SMTP thật và lịch gọi scheduler vẫn cần cấu hình nếu muốn gửi nhắc trên Vercel.
- Preview mô tả ở mục 5 chỉ dùng local. Web/API/mobile đã được phát hành trên Vercel; các kiểm thử local không chứng minh mọi tương tác production đã được kiểm tra trực quan.

### Chạy kiểm thử

```powershell
node --test backend/tests/*.test.js
$env:DOCTIS_MONGO_TEST='1'
$env:DOCTIS_RUN_COORDINATION_DB_TESTS='1'
$env:DOCTIS_PUBLIC_HTTP_TEST='1'
node --test backend/tests/authAppointments.mongo.test.js backend/tests/coordination.mongo.test.js backend/tests/publicHealthProfile.mongo.test.js
cd frontend
$env:CI='true'
npm.cmd test -- --watchAll=false --runInBand
```

Các test Mongo opt-in cố định DB local khác nhau trên 27028, không lấy MONGO_URI từ môi trường. Test Python rule cần PYTHON_EXE trỏ tới Python có sẵn; không cần Flask/sklearn cho test này. Ghi chú UI và giới hạn xác minh nằm trong [UI_REVIEW.md](../frontend/UI_REVIEW.md).
