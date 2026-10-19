# Địa chỉ hồ sơ, danh mục bệnh viện và quản trị — 19/10/2026

- Sửa nút “Kết thúc phân công cũ”: không còn kế thừa chiều rộng 34px của nút icon. Nhóm thao tác và badge số có vị trí riêng, hỗ trợ sidebar thu gọn và điện thoại.
- Địa chỉ đăng ký (thành phố, phường, số nhà/đường) hiển thị trong Hồ sơ; sửa và lưu địa chỉ tại cùng mục bằng API `/care-team/address`. Giữ draft qua đổi chức năng. Không lặp địa chỉ nhà/editor trong mục Bệnh viện và bác sĩ phụ trách.
- Điều phối nhóm bệnh viện cùng phường, hiển thị địa chỉ/liên hệ và liên kết xem đường đi. Không tạo khoảng cách hoặc tự khẳng định cơ sở gần nhất. Chặn xác nhận tiếp nhận/phân công khi lựa chọn bệnh viện mới chưa lưu; bác sĩ vẫn phải thuộc bệnh viện đã tiếp nhận.
- Dataset theo nguồn người dùng gồm 24 bệnh viện và 1 phòng khám: 5 cơ sở đối chiếu đủ thông tin với nguồn chính thức, 20 bản chờ đối chiếu. Danh mục hỗ trợ draft thiếu phường hiện hành/số liên hệ; draft không được bật tiếp nhận. Mọi cơ sở nhập mới mặc định chưa bật tiếp nhận.
- Build cuối thành công: preview `main.408f261e.js` / `main.2205fb78.css`. Controller/model đã kiểm tra cú pháp, `git diff --check` đạt. Không thêm hoặc chạy test trong đợt này. Công cụ trình duyệt không có phiên kết nối, chưa kiểm tra trực quan bản mới.
- Kiểm tra chỉ đọc production trước reset: 15 user, 3 doctor, 1 admin. Người dùng đã yêu cầu xóa non-admin cùng dữ liệu liên quan, giữ admin và danh mục. Chưa xóa trong lúc chuẩn bị bản này; cần cấu hình kết nối Atlas qua file maintenance ignored. Công cụ CLI mặc định dry-run, apply yêu cầu fingerprint và transaction.

## Lịch sử sửa kế hoạch chăm sóc và lịch hẹn bác sĩ

- Đổi nội dung hiển thị “đã chốt” thành “đã xác nhận”; kế hoạch nháp là “Đang xem xét”, kế hoạch bệnh nhân đã được xác nhận là “Sẵn sàng thực hiện”. Giữ nguyên các giá trị trạng thái API.
- Bỏ danh sách duyệt lịch trùng ở Tổng quan. Mục Lịch hẹn quản lý tạo, duyệt, hoàn tất, hủy và nhắc email, có tìm kiếm và lọc trạng thái. Thu gọn card và hàng thông tin bác sĩ; điện thoại giữ nút thao tác tối thiểu 44px.
- Nút Hoàn tất trước đây hiện cả cho lịch tương lai. Bản sửa khóa nút đến giờ hẹn, giải thích lý do và phản hồi API ngay trong danh sách; backend vẫn chặn hoàn tất sớm và kiểm tra quyền bác sĩ phụ trách. Gửi lại thao tác đã thành công không tạo báo lỗi sai.
- Thời gian được nhập và hiển thị theo giờ Việt Nam; không lặp giờ. Giữ dữ liệu nhập khi tạo thất bại, cập nhật ngay bản ghi API trả về rồi tải lại danh sách. Không đổi dữ liệu lịch hẹn có sẵn.
- Công cụ trình duyệt trả danh sách kết nối trống trong lượt này: chưa xác minh trực quan bản mới. Không duyệt, hoàn tất, hủy lịch thật hoặc gửi email để kiểm tra. Không chạy thêm bộ test trong đợt sửa này.
- Build cuối thành công: preview `main.408c37eb.js` / `main.1ca37c4f.css`; kiểm tra cú pháp controller và `git diff --check` đạt. Tên JS production sẽ khác vì dùng URL API production.

## Lịch sử review local — luồng public Đà Nẵng

Phần dưới ghi lại review trước khi phát hành bản public `3971d41`; bản đó đã được đưa lên Vercel theo yêu cầu của chủ dự án.

- Đã bổ sung đăng ký theo danh mục phường; admin tiếp nhận/điều phối/danh mục; bệnh viện–bác sĩ; thông báo polling lưu server; bệnh nhân xem/cập nhật địa chỉ; hủy lịch có xác nhận. Giữ thiết kế và đăng nhập cũ.
- Phân công tách ba bước, unique/CAS/transaction; thu quyền doctor áp dụng ngay với JWT cũ. Không có bệnh viện giả, tọa độ giả hoặc xếp hạng “gần nhất”.
- Sửa OTP/reset đầy đủ hợp đồng, lỗi gửi mail, lịch nhắc một ngày/múi giờ; cảnh báo cùng nguồn JSON, giữ nguyên ngưỡng; thiếu glucose không gửi 0 sang mô hình. Kế hoạch bác sĩ/gợi ý bệnh nhân vẫn tách biệt.
- **177/177 test backend đạt**, không skip trong lượt bật đầy đủ, gồm 10 test tích hợp Mongo/HTTP local (8 coordination, 1 auth/cancel, 1 health/profile/scheduler) và kiểm Python rule không load model. **182/182 test frontend đạt, 37 suites**. API trong React DOM tests là mock kiểm soát, không phải browser thật.
- Build preview mới thành công: main.22c81b78.js / main.6beec3dc.css. URL riêng http://127.0.0.1:5001, build ignored; API/DB riêng, SMTP và scheduler tắt. Tài khoản Atlas không có sẵn trong DB review.
- HTTP kiểm tra ngoài sandbox: /register, /dashboard, /admin, /api/health trả 200; /api/public/wards có 23 phường. Người dùng đã xác nhận mở được link trong Chrome sau khi kiểm lại cổng Windows. Chưa nhận ảnh mới; không coi việc mở được link là xác minh bố cục/chuyển động trực quan.
- Import phường local chạy lại: lần đầu insert23; lần sau insert0/preserve23. Chưa nạp Atlas. Bệnh viện để trống để chủ dự án nhập nguồn đã xác minh.
- Mobile đăng ký đã đồng bộ ward/address/requestId và hồ sơ không gửi location qua API cũ; Expo export web và 6 kiểm tra logic đạt. Chưa chạy native iOS/Android. Điều phối mới hiện ở web.
- Chưa xác minh hình ảnh desktop/điện thoại, email SMTP thật hoặc chất lượng ML/AI cloud. Công cụ không có browser kết nối. Cấu hình scheduler Vercel chưa được bật.

Chi tiết chức năng, API, scripts, nguồn danh mục và cách mở admin review: [PUBLIC_WORKFLOW.md](../docs/PUBLIC_WORKFLOW.md).

---

# Bản UI local — cập nhật 18/10/2026

## Phát hành lên Vercel — yêu cầu mới đã được chấp thuận

- Chủ dự án đã duyệt bản local và yêu cầu chuyển toàn bộ mã giao diện/API mới
  lên Vercel. Ràng buộc không push/deploy của các đợt kiểm tra bên dưới đã được
  thay thế bằng yêu cầu phát hành này.
- Web dùng project `doctis-frontend` (root `frontend`), API dùng `doctis`
  (root `backend`). Thêm CRA build/output và SPA fallback trong
  `frontend/vercel.json`; giữ project mobile riêng.
- Người dùng chọn Gemini cloud trên Vercel và sẽ tự cấu hình khóa ở project API.
  Local vẫn dùng Ollama. Backend Vercel mặc định chọn Gemini, không fallback
  Ollama; tra cứu dữ kiện xác thực không cần model. Xem `VERCEL_DEPLOY.md`.
- Không đưa `.env`, ảnh chụp review, database, model weights hoặc thông tin xác
  thực vào bản publish. Các con số kiểm thử bên dưới thuộc đợt local; không coi
  đó là bằng chứng đã thử Gemini thật hoặc mọi chức năng production.

## AI trả lời lạc chủ đề — bản cập nhật hiện tại

### Nguyên nhân đã tái hiện

- Đã gọi model local thật với hội thoại thử tách biệt: lời chào bị trả bằng số
  đường huyết cũ. Prompt cũ đính toàn bộ bản ghi sau câu hỏi, cấm lời chào và
  mang cả câu AI sai trước đó vào lượt hỏi mới. Đó là lỗi luồng hội thoại/context,
  không phải hiệu ứng hiển thị chữ.
- Model nhỏ còn tự suy diễn ngày đo, dị ứng và giải thích thuốc dù HTTP 200.
  Việc một bài đối sánh từ khóa đạt không chứng minh nội dung đúng. Các kết luận
  chất lượng AI trong lịch sử bên dưới cần đọc cùng giới hạn này.

### Thay đổi đã triển khai

- Chào hỏi, kiến thức chung, triệu chứng hiện tại và hỏi dữ liệu đã lưu chọn
  ngữ cảnh khác nhau. Lời chào không đọc hồ sơ hoặc mang số đo cũ vào. Lượt đổi
  chủ đề không tự trả lại báo cáo đường huyết. Câu hỏi nguyên văn ở cuối request.
- Câu hỏi thuần về giá trị/ngày/hồ sơ đọc trực tiếp dữ kiện xác thực từ máy chủ
  (`provider=records`). Tính đúng gần nhất/cực trị trong tối đa 7 bản ghi, giữ giờ
  Việt Nam và cặp huyết áp thực tế; không dùng model để đoán dữ liệu thiếu.
  Câu giải thích/diễn giải/nhiều ý vẫn dùng model hội thoại.
- Câu hỏi tiếp dùng chủ đề do người dùng nêu; không lấy số đo/đơn thuốc do AI
  trước đoán làm bằng chứng. Hỏi cho người thân không lấy hồ sơ của tài khoản
  đang đăng nhập. Triệu chứng hiện tại không bị gán số đo lịch sử.
- Ghi chú theo chủ đề từ NIDDK, AHA, MedlinePlus và FDA hỗ trợ giải thích type 2,
  ăn uống, vận động, thuốc và theo dõi. Prompt được rút gọn để trả lời bằng tiếng
  Việt tự nhiên, không chào lại mỗi lượt, không ép mọi câu hỏi thành báo cáo.
- Có kiểm tra hẹp cho các mâu thuẫn đã tái hiện (dị ứng, huyết áp, giờ dùng thuốc,
  hướng dẫn tự tăng muối, đợi một số phút tự đặt, đo đường niệu ngoài câu hỏi,
  ngôn ngữ bị xen). Cho tạo lại tối đa một lần trong tổng 120 giây; vẫn sai thì
  trả lỗi rõ. Chưa cho số huyết áp vừa đo thì bổ sung câu hỏi làm rõ, không điền
  số thay người dùng. Không dựng câu trả lời thành công giả.
- Thêm **Cuộc trò chuyện mới** ở đầu chat AI. Chỉ reset lịch sử AI, giữ bản nháp,
  dữ liệu nhập sức khỏe, chat bác sĩ và phiên đăng nhập; khóa nút khi chờ trả lời.
- Sau khi so sánh các model local, cấu hình hiện chọn
  `qwen3:4b-instruct-2507-q4_K_M`, context 4096. Có diễn đạt rõ hơn model 3B cũ
  trong các lượt thử, nhưng thường cần khoảng 15–35 giây, có lượt lâu hơn.
  Giữ Ollama local; không tự chuyển sang Gemini/cloud. Atlas/xác thực giữ nguyên.

### Đã kiểm tra và giới hạn

- **99/99 backend tests**, **114/114 frontend tests (24 suites)** đạt; build
  thành công: `main.333132a6.js`, `main.f24f8730.css`. Còn nhắc Browserslist cũ.
  Tests tự động dùng fixture/mock riêng, không ghi vào hồ sơ thật.
- Đã gọi model Ollama thật qua service cho 14 tình huống: chào sau lịch sử sai,
  huyết áp thấp hiện tại và hỏi tiếp, giải thích type 2, bữa tối/dị ứng, đi bộ,
  metformin/hỏi tiếp, gần nhất/cao nhất/ngày đo, thiếu dữ liệu và cấp cứu/phủ định.
  Đã sửa một bộ đối sánh smoke nhận nhầm câu giả định về dị ứng là lời khẳng định;
  không lấy số bài đạt làm chứng nhận y khoa.
- Ở lượt kiểm tra lại bằng bộ kiểm tra chặt hơn, có một lượt gợi ý bữa tối bị
  trả `AI_REPLY_NOT_RELIABLE` sau khi tạo lại; lần gọi mới cùng tình huống đã trả
  lời liên quan. Đây là dấu hiệu model chưa ổn định, không phải bằng chứng mọi
  câu hỏi đã được giải đáp chính xác. Cần tiếp tục đánh giá nội dung chuyên môn.
- Bản build local `/dashboard` và bundle mới trả 200; API health 200 và AI thiếu
  JWT vẫn 401. Lần này kiểm tra model thật với dữ liệu thử tách biệt; không dùng
  thông tin bệnh nhân thật cho các lượt so sánh model.
  API preview cuối đã khởi động lại bằng cấu hình local mới; không chạy scheduler
  gửi email của production.
- **Chưa kiểm tra tương tác chat trực tiếp trong Chrome ở đợt này. Chưa thẩm định
  y khoa toàn diện.** Model local vẫn có thể thêm chi tiết về cơ chế thuốc, khẩu
  phần hoặc cách dùng từ chưa chuẩn; kiểm tra hẹp không phát hiện mọi lỗi. Không
  tuyên bố AI đã trả lời hoàn hảo, hoặc dùng kết quả để tự thay đổi điều trị.
- Không sửa trang đăng nhập, màn chào bệnh nhân, nghiệp vụ lưu dữ liệu hoặc phân
  quyền trong đợt này. Không push/deploy.

### File chính và cách mở

- Backend: `services/aiService.js`, `aiConversation.js`, `aiHealthKnowledge.js`,
  `aiSavedFactsReply.js`, `aiReplyChecks.js`; các tests tương ứng, smoke scripts
  và `backend/AI_SETUP.md`. `.env` local được Git bỏ qua, không in thông tin bí mật.
- Frontend: phần chat trong `pages/Dashboard/Dashboard.jsx`,
  `Dashboard.ai.test.jsx`, nút mới trong `CSS/patient-redesign.css`.
- Mở **http://127.0.0.1/dashboard**, Ctrl+R, chọn **AI phân tích → Cuộc trò chuyện
  mới**. Hỏi “Chào bạn”, rồi thử câu hỏi về ăn uống/thuốc hoặc “Đường huyết đã lưu
  gần nhất của tôi bao nhiêu?”. Có thể hỏi tiếp hoặc chuyển chủ đề trong cùng
  hội thoại. Nút làm mới bỏ các câu sai còn trong phiên cũ.

Các mục dưới đây là lịch sử; model, timeout, bản build và số bài kiểm tra ở các
đợt cũ không mô tả cấu hình hiện tại.

## Màn chào sau đăng nhập bệnh nhân — cập nhật mới nhất

- Nguyên nhân: `StudioExperience` cũ gắn intro vào lúc workspace mount, đặt hẹn giờ 1.400ms; CSS nội dung cũng kết thúc ở opacity 0. Do đó mở link đã phát intro rồi tự mất, không đợi người dùng.
- Đã tách `PatientWelcomeGate` tại route `/dashboard`. Chỉ lần đăng nhập bệnh nhân thành công mới đánh dấu màn chào đang chờ. Màn chào giữ logo/tim/lời chào và tên từ phản hồi đăng nhập thật; chỉ nút **Bỏ qua** mở dashboard. Không mount dashboard hoặc chạy các effect đọc dữ liệu của dashboard phía sau màn chào.
- Tải lại khi chưa bấm Bỏ qua vẫn giữ màn chào. Sau khi bấm, tải lại/đổi chức năng không phát lại; lần đăng nhập mới sẽ hiện lại. Escape và chờ đợi không tự chuyển. Reduced motion/Giao diện đơn giản vẫn giữ màn chào tĩnh và nút thao tác.
- Giữ nguyên JSX/thiết kế trang đăng nhập, endpoint và payload xác thực. Đọc thêm tên/id từ object `user` mà API vốn trả về; bỏ log response đăng nhập/lỗi Axios có thể chứa token hoặc mật khẩu. Bác sĩ/admin giữ đích điều hướng cũ và không vào màn chào bệnh nhân.
- `StudioExperience` chỉ còn cursor/reveal/cuộn hiện có, không tự bật intro. CSS màn chào mới kết thúc ở opacity 1, có bố cục cho điện thoại/chiều cao thấp và nút tối thiểu 44px.
- Local preview: xử lý lỗi stream khi CRA đang thay thư mục build bằng HTTP 503 có Retry-After thay vì làm tiến trình server tắt.
- **112/112 frontend tests, 24/24 suites đạt**. Có kiểm tra thành công/thất bại đăng nhập bằng API mock riêng, đích ba vai trò, màn chào còn sau 60 giây/Escape, dashboard chưa mount trước Skip, session/remount và storage bị giới hạn. Không gọi API ghi dữ liệu thật trong các kiểm tra này.
- Build **Compiled successfully**, exit 0: `main.be85403e.js`, `main.e8f1c6c3.css`; chỉ còn nhắc dữ liệu Browserslist cũ. Local `/dashboard` và bundle mới trả **200**, bundle có màn chào mới và không còn cờ intro tự chạy cũ; API health cũng trả 200. Server local đã mở lại sau build.
- **Chưa kiểm tra trực quan màn chào mới trong trình duyệt thật**; unit test không chứng minh hình học WebGL hoặc motion thực tế. Các ảnh cũ bên dưới không phải ảnh kiểm tra bản cập nhật này. Không push/deploy.
- Cách xem: mở `http://127.0.0.1/`, Ctrl+R, đăng nhập bệnh nhân lại. Màn chào hiện sau đăng nhập; bấm **Bỏ qua** để vào dashboard. Chỉ mở lại link dashboard khi đã bỏ qua sẽ không phát intro.

Các mục bên dưới là lịch sử các đợt sửa trước; mô tả intro tự chạy một lần/phiên trong đợt redesign cũ đã được thay thế bởi luồng trên.

## Sửa DOCTIS AI local — sau báo lỗi lặp lời chào

### Nguyên nhân đã xác định

- `aiService.js` tự chọn `qwen2:0.5b` khi local không có khóa Gemini; cấu hình local thực tế không có khóa/model chỉ định. Ollama trên máy có model này. Không phải `AIResponse`/animation sửa nội dung câu trả lời.
- Request trước chỉ có glucose, BMI, huyết áp, nhịp tim; backend không đọc bệnh nền, dị ứng, tiền sử, thuốc hay ngày đo đã lưu. BMI còn có thể lấy từ form chưa lưu.
- Lời chào UI bị đưa vào lịch sử, phản hồi lỗi bị loại nhưng các câu hỏi gửi thất bại vẫn có thể lặp trong ngữ cảnh khi thử lại.

### Đã sửa và đang chạy

- Người dùng chọn **AI hoàn toàn local**. Đã cài model `qwen2.5:3b` qua Ollama sau khi được cấp phép tải khoảng 1,9GB. `backend/.env` đã đặt `AI_PROVIDER=ollama`, model và host 127.0.0.1; giữ nguyên mọi cấu hình khác. File môi trường được Git bỏ qua, không in khóa hoặc thông tin bí mật.
- Chế độ local rõ ràng không gọi Gemini dù có khóa cloud trên máy; không tự thay bằng model nhỏ khi cấu hình thiếu. Cơ sở dữ liệu Atlas hiện có giữ nguyên; phần suy luận chạy tại Ollama local.
- Backend lấy hồ sơ liên quan và tối đa 7 lần đo mới nhất của đúng ID từ JWT, bỏ qua ID/chỉ số/context giả từ body. Chỉ chọn trường y tế; không thêm tên/email/CCCD/địa chỉ/ảnh/liên hệ vào context. Ngày đo có cả ISO và giờ Việt Nam.
- Prompt local rút gọn, ưu tiên câu hỏi hiện tại, phân biệt số liệu cũ với triệu chứng mới. Hội thoại được giới hạn độ dài; không đưa lời chào/lượt lỗi vào lịch sử, không dùng BMI chưa lưu hoặc số 0 thay dữ liệu thiếu.
- Frontend chặn gửi trùng bằng ref, kiểm tra phản hồi rỗng/sai kiểu, hiển thị lỗi thật, giữ bản nháp khi lỗi. Timeout local 60 giây, frontend 90 giây; không dựng câu trả lời giả.
- API local đã khởi động lại bằng `backend/scripts/start-ai-preview.js`, giữ xác thực, không khởi chạy lịch gửi email khi kiểm tra. Production entry point và route giữ nguyên. Không ghi/chỉnh hồ sơ, chỉ số hoặc phân quyền; không push/deploy.

### Kết quả kiểm tra

- **93/93 frontend tests, 22/22 suites đạt**; **22/22 backend tests đạt**. Backend tests dùng mock DB/provider riêng, không chạm dữ liệu thật.
- Build frontend thành công: `main.3d1b4f09.js`, CSS `main.94ad4022.css`. Không có lỗi ESLint/source map; còn thông báo dữ liệu Browserslist cũ.
- `ai-local-smoke.js` gọi **model Ollama thật** với fixture tách biệt: đọc đúng giá trị/ngày đo, dị ứng và trả lời câu hỏi triệu chứng thay vì lặp lời chào; exit 0. Fixture không được ghi vào DB hoặc dùng trong ứng dụng.
- `check-ai-endpoint.js` dùng tài khoản đã được người dùng cung cấp qua **đăng nhập bình thường**, không tạo JWT giả. GET hồ sơ/lịch sử trả 200; POST AI trả 200, `provider=ollama`, câu trả lời chứa đúng giá trị gần nhất đã lưu. Câu hỏi tiếp về triệu chứng được trả lời riêng, không lặp câu trước. Hai lượt gần nhất khoảng 1,2s và 6,3s; đây là mẫu đo khi model đã tải, không cam kết mọi lượt.
- Request AI thiếu JWT vẫn trả **401**; preflight từ web local tới API `localhost:5000` trả **204**, đúng origin/header. Không in tài khoản, JWT, số đo hay nội dung trả lời dựa trên hồ sơ thật ra log kiểm tra.
- **Chưa kiểm tra tương tác chat trực tiếp bằng trình duyệt sau bản sửa AI**, chưa đánh giá đầy đủ chất lượng lâm sàng trên nhiều ca. Các bài smoke chỉ xác minh hành vi/context và một số dữ kiện, không chứng minh mọi lời khuyên y tế của model đều đúng.

### File của lần sửa AI

- Backend: `services/aiService.js`, `services/aiPatientContext.js`, `controllers/aiController.js`, `tests/aiService.test.js`, `tests/aiPatientContext.test.js`, `tests/aiController.test.js`.
- Frontend: phần gửi AI trong `pages/Dashboard/Dashboard.jsx`, `Dashboard.ai.test.jsx`. Không sửa thiết kế đăng nhập hoặc các CSS trong đợt sửa AI này.
- Local/check: `backend/AI_SETUP.md`, `backend/scripts/start-ai-preview.js`, `ai-local-smoke.js`, `check-ai-endpoint.js`. Thông tin xác thực chỉ nhận qua stdin trong bài endpoint, không lưu trong source.
- Xem lại tại `http://127.0.0.1/dashboard`: tải lại trang, mở AI phân tích, hỏi về chỉ số đã lưu rồi hỏi tiếp. Phiên AI chat cũ không được lưu DB; reload sẽ bắt đầu hội thoại mới.

Các mục dưới đây ghi lại đợt thiết kế trước khi sửa chức năng AI.

## Master prompt 3D redesign — đợt thiết kế giao diện

Người dùng đã chọn **triển khai liên tục, kiểm tra sau từng phần**. Đã đọc toàn bộ `DOCTIS_master_prompt_3D_redesign.md`, khảo sát Git diff và giữ các thay đổi trước đó. Dự án tiếp tục dùng CRA/JavaScript; không chuyển framework. Không push/deploy.

### Những màn hình đã thay đổi trong mã nguồn

| Phần | Triển khai mới | Xác minh trong đợt này |
| --- | --- | --- |
| Nền tảng | Teal/mint có chiều sâu, semantic tokens sáng/tối, tùy chọn thu gọn sidebar và Giao diện đơn giản lưu localStorage; font serif cho headline, giữ UI nhỏ gọn | Unit test lưu tùy chọn và đồng bộ trực tiếp; kiểm tra tĩnh các cặp tương phản chính |
| Trái tim thương hiệu | Một canvas R3F dùng chung, hình học tim pha lê tạo tại chỗ, ECG, vòng quỹ đạo/hạt, đập theo BPM thật, màu theo đánh giá hiện có; bay từ intro sang slot của trang | Test chu kỳ BPM, đổi slot không thay canvas, độ ưu tiên intro, căn lại sau transform, simple/offscreen/hidden và fallback. Chưa kiểm tra GPU thật |
| Intro và điều hướng | Cửa kính mở, lời chào, Bỏ qua/Escape, chỉ một lần/phiên; chuyển cảnh đến 700ms, lưu vị trí cuộn từng mục, chỉ báo menu trượt, thu gọn nhóm, cursor desktop; Lenis chỉ bật cho document dashboard | Tests intro/session/reduced motion, scroll restore, rapid navigation và SVG snapshot |
| Dashboard bệnh nhân | Hero mới, thẻ chỉ số có lớp chiều sâu, heart scene thật, nút/chỉ báo, 2D/3D chart, countdown từ lịch hẹn thật | Tests điều hướng/range/trục và dữ liệu không bị sửa; đã đối chiếu ảnh người dùng chụp phần hero sau sửa font |
| Hồ sơ | Masthead danh tính/ảnh thẻ, lối chuyển nhanh giữa 5 nhóm, xem/chỉnh sửa trên cùng các field, form/card/checkbox/chip đồng nhất, focus ring và phản hồi lưu dựa trên API cũ | Test section navigation, chuyển xem/sửa giữ đúng DOM input và bản nháp; ảnh thật xác nhận một viền ở các field đầu. Đã sửa tiếp chú thích ảnh; chưa có ảnh sau sửa chú thích. Chưa lưu hồ sơ thật |
| Nhập sức khỏe | Nhóm Thể trạng/Sinh hiệu, vòng tiến độ nhập, numeric steppers, đánh giá đang nhập từ chính `getRiskAssessment`, BMI hiện có, hiệu ứng thành công chỉ khi API trả thành công | Test draft, stepper và đổi theme/simple không thay input DOM/focus; không gọi API ghi trong kiểm thử |
| Biểu đồ/lịch sử | Thanh chỉ số và khoảng 7/30/90 ngày, zoom theo bản ghi, sort số, hàng layout animation; biểu đồ 2D vẽ 650ms, chế độ 3D xoay/phóng và bảng số liệu DOM | Tests khoảng thiếu hơn 7 ngày, điểm thiếu, áp lực hai đường, trục thời gian/lần đo, sort/zoom, context-loss fallback. Chưa kiểm tra thao tác GPU trực quan |
| AI | Aurora nhẹ, avatar có lớp sáng, trạng thái đang xử lý, tin mới xuất hiện, gợi ý điền bản nháp; hiện chữ trong tối đa 650ms từ câu trả lời đã nhận đầy đủ, có bỏ qua; nguồn và lưu ý không thay bác sĩ luôn hiện | Test bản nháp, full text cho trình đọc màn hình, bỏ qua, không replay lịch sử, callback theo cuộn; không gọi AI thật |
| Chăm sóc | Gallery ngày nằm ngang, pin/scrub có điều kiện trên desktop, native scroll snap/nút cuộn dự phòng, vòng hoàn thành/tick; giữ chi tiết ngày, nhắc email và đơn bác sĩ | Test điều kiện pin/cleanup spacer, callback cũ `(dayIndex,item.id)` và không mutate dữ liệu; chưa thử ghi tiến độ/nhắc email thật |
| Lịch hẹn | Lịch tháng, chọn ngày/tháng, xem mọi lịch đã lưu, mở chi tiết và countdown | Test dữ liệu/lọc/ghi chú từ fixture; không thêm hành động đặt/xác nhận lịch giả |
| Chat bác sĩ | Đồng bộ theme, bề mặt và composer; giữ hội thoại, attachment, back, viewport và bản nháp | Tests viewport/motion và không mất draft; không gửi tin thật |
| Bác sĩ | Hero/phân vùng ưu tiên mới từ số bệnh nhân/lịch thật, tim trung tính, bảng/thẻ/hồ sơ/drawer/form/editor và chat cùng theme | Parse JSX/CSS và tests dialog/chat. Chưa đăng nhập kiểm tra vai trò trong đợt này |
| Admin | Hero mới, sơ đồ mạng lưới chăm sóc từ số đã phân công/đang chờ thật; sidebar, bảng, bộ lọc, modal/editor cùng theme | Parse JSX/CSS và tests primitives/dialog; chưa kiểm tra vai trò trực quan trong đợt này |

### Giữ nguyên và lựa chọn triển khai

- Không sửa source đăng nhập/đăng ký/quên mật khẩu, API client, xác thực, route hay quy tắc y tế. Những file backend đã modified từ trước vẫn được giữ, không thuộc lần sửa này.
- Không có streaming transport trong API AI hiện tại: chỉ hiện chữ bằng animation sau khi đã nhận đầy đủ câu trả lời; toàn văn có ngay cho trình đọc màn hình, có nút hiện toàn bộ, reduced/simple hiển thị ngay. Không gửi lại yêu cầu. Cuộn theo phần chữ mới chỉ khi người đọc đang ở cuối hội thoại. Không có API đặt lịch bệnh nhân trong màn hình cũ: calendar hiển thị lịch hiện có, không tạo nút đặt/xác nhận giả.
- Giữ số liệu y tế đọc được ngay, không đếm từ 0 qua các giá trị trung gian. Biểu đồ 3D là tùy chọn; dữ liệu/đơn vị/ngày giờ vẫn có trong DOM. Không đặt thêm ngưỡng y tế mới cho đồ họa.
- Gallery chăm sóc chỉ pin/scrub khi con trỏ chính xác, rộng ít nhất 1200px, track thực sự tràn và toàn section vừa dưới header; đoạn cuộn giới hạn 1800px. Mobile, reduced/simple hoặc thẻ quá cao dùng native scroll-snap/nút. Cleanup bỏ pin spacer trước khi unmount.
- Nghiêng tim theo cảm biến chỉ có trên thiết bị hỗ trợ/con trỏ cảm ứng, yêu cầu quyền sau khi bấm nút; không tự bật hoặc lưu quyền vào localStorage. Listener dừng khi ẩn tab, ngoài viewport, đổi slot hoặc bật simple/reduced.
- Xem/chỉnh sửa hồ sơ dùng fieldset trên cùng node/state, không remount hoặc bỏ bản nháp; nút đổi chế độ bị khóa khi đang lưu. Typography workspace tách khỏi quy tắc Poppins cũ; Fraunces cho tiêu đề, Be Vietnam Pro cho UI, có font hệ thống dự phòng; không áp dụng font mới lên đăng nhập.
- 3D lazy-load, không tải GLB/texture/HDR ngoài; canvas dùng DPR tối đa 1.5, dừng vòng render khi tab ẩn/slot ngoài viewport; simple/reduced motion dùng SVG/2D. Có ErrorBoundary và context-loss fallback. Chưa đo FPS/Lighthouse nên không khẳng định đạt 60/30fps.
- Không log payload y tế/cá nhân ở production; không gửi dữ liệu cho dịch vụ đồ họa bên thứ ba. Chỉ thêm dependencies trình bày: Three, Fiber 9, Drei 10, GSAP, Lenis; không cài thêm framework CSS hoặc thay bundler.

### Kết quả kiểm tra

- Kiểm thử cuối sau đối chiếu ảnh bổ sung: **85/85 tests, 21/21 suites đạt**, exit 0 (`CI=true npm.cmd test -- --watchAll=false --runInBand`). Bao gồm ba kiểm thử cascade ảnh thẻ desktop/mobile, callback hiện chữ AI, bản nháp/focus/chế độ xem-sửa và không gọi lại API khi đổi chức năng. API được mock riêng trong unit test; ứng dụng chạy thật không dùng dữ liệu giả hoặc bypass xác thực. Kiểm thử CSS không thay cho kiểm tra hình học trên trình duyệt.
- Build cuối sau sửa viền input/font/sidebar và caption ảnh: **Compiled successfully**, exit 0; `main.3fd622c8.js` (315.75kB gzip), `main.94ad4022.css` (87.96kB), 3D lazy chunk 249.58kB. Không có warning ESLint/source map; chỉ còn nhắc dữ liệu Browserslist cũ của môi trường. Import theo module bỏ dependency source map không sử dụng.
- Đã xác minh HTTP `http://127.0.0.1/dashboard` và bundle local trả **200**. Bundle chứa `patient-3d-studio-20261017`, `HeartSceneProvider`, `AIResponse`, `care-gallery-shell`, `profile-mode-switch`, `studio-control-tilt`: local đang nhận source mới.
- **Chưa thao tác kiểm tra trực tiếp bằng trình duyệt cho bản redesign mới**: công cụ Windows Computer Use bị dừng với thông báo không xác định được URL trình duyệt đủ chắc chắn để thực thi policy. Đã dừng toàn bộ thao tác UI sau thông báo. Kiểm tra ảnh thật do người dùng gửi được ghi riêng bên dưới; không coi ảnh tĩnh là kiểm tra motion.
- **Đã xem ảnh thật người dùng cung cấp** `Screenshot 2026-10-18 002405.png` (1920×1080) tại thư mục OneDrive ảnh chụp màn hình. Ảnh có URL local, hero bố cục mới, tim hiển thị, toolbar/theme/simple và bốn card chỉ số. Tiếng Việt trong vùng ảnh đọc được; chưa xác minh sau khi thay font cuối. Phát hiện font Poppins cũ ghi đè typography mới và đã sửa source. Ảnh chụp trước sửa font/viền cuối, không chứng minh motion, mọi viewport hoặc mọi màn hình.
- Rà soát cascade còn tìm được CSS `!important` cũ ép input Hồ sơ/chat trắng và viền lồng; đã override có phạm vi, giữ một viền trên wrapper, checkbox 20px. Sửa nút mở rộng sidebar tại 901–1120px. Các sửa cuối này cần ảnh cập nhật để xác nhận trực quan.
- **Ảnh bổ sung sau tải lại**: đã đọc `Screenshot 2026-10-18 005054.png` (Hồ sơ, chế độ chỉnh sửa) và `Screenshot 2026-10-18 005130.png` (dashboard), đều 1920×1080, cùng URL local. Font serif mới đã hiển thị, dấu tiếng Việt ở vùng ảnh đầy đủ; input có icon và input thường trong phần đầu Hồ sơ có một viền, không có ô trắng lồng bên trong.
- Ảnh Hồ sơ phát hiện chú thích ảnh thẻ bị ép thành cột hẹp bên phải: selector legacy 3 class ép `display:flex`/row thắng selector mới 2 class, ảnh cũ 104px cộng gap 18px trong cột 132px. Đã sửa `patient-redesign.css`: vùng ảnh là grid một cột, ảnh hàng 1, chú thích full-width hàng 2; desktop 90×128, mobile 66×96; selector phạm vi workspace thắng legacy. Đồng bộ căn masthead và màu chữ theo theme. Không thay JSX, upload handler hay dữ liệu. Chưa có ảnh sau bản sửa caption này.
- Đã xác minh lại local `/dashboard` và bundle trả 200 sau sửa caption; bundle có `grid-auto-flow:row` và caption `grid-row:2; width:100%`. Regression mới `src/components/studio/ProfilePhotoStyles.test.js` tái hiện cascade legacy gây lỗi rồi xác nhận rule mới thắng ở 390/1280px.
- Ảnh ở các mục lịch sử phía dưới là của giao diện trước; không dùng chúng để chứng minh bản 3D mới. Chưa có video mới, kiểm tra bàn phím điện thoại thật, GPU context-loss thật, đủ ba vai trò hoặc nghiệm thu toàn bộ nghiệp vụ ghi dữ liệu.
- Khi mở local: dùng toolbar đầu trang để đổi sáng/tối, bật Giao diện đơn giản hoặc thu gọn sidebar; thử Dashboard → Hồ sơ → Thông tin sức khỏe → Biểu đồ. Biểu đồ có nút 2D/3D. Không cần Expo Go cho bản web.

### File chính của đợt này

- `src/components/3d/`: HeartScene/Provider, HeartWebGL/HeartModel, ChartDepth, ChartDepthCanvas, sceneData và tests.
- `src/components/studio/`: StudioPreferences, StudioControls, StudioExperience, AppointmentCalendar, CareWeekGallery, AISuggestions, AIResponse và tests.
- `src/components/PatientOverview.jsx`, `HealthAnalytics.jsx`, `DashboardChart.jsx`, `WorkspaceMotion.jsx`, `useLiveReducedMotion.js`.
- `src/pages/Dashboard/Dashboard.jsx`, `DoctorDashboard.jsx`, `src/pages/admin/AdminDashboard.jsx`, `src/App.js`; integration test `Dashboard.presentation.test.jsx`.
- `src/CSS/studio-experience.css`, `heart-scene.css`, `patient-redesign.css`, `patient-functions.css`, cùng patient-overview/measurement/role/conversation/workspace styles; `public/index.html` (tải thêm font headline), `package.json` và lockfile.

### Chi tiết chưa nghiệm thu hoặc chưa triển khai nguyên dạng

- Chưa đo Lighthouse/FPS, đối chiếu chuyển cảnh trực tiếp với video, quay video, hoặc kiểm tra trực quan bản cuối trên điện thoại/bác sĩ/admin. Build/unit tests không thay cho các bước này.
- Không thêm dải target range hoặc nhãn nguy cơ mới vào từng chỉ số khi nghiệp vụ chưa cung cấp ngưỡng. Không tạo luồng đặt lịch/xác nhận mới, streaming transport hay kết luận AI mới.
- Giữ chỉ số xuất hiện đầy đủ ngay, không count-up qua số trung gian. Chưa có camera fly-through, ECG chạy quanh quỹ đạo, nhãn giờ chạy trên timeline chăm sóc, hoặc hiệu ứng thẻ bản ghi bay từ form vào dashboard. Intro hiện là cửa kính/mask và một heart canvas bay giữa slot; lưu thành công dùng phản hồi/tick/sóng sáng trên form.
- Các chi tiết này được ghi tách biệt để không coi việc đã triển khai các màn hình chính là đã nghiệm thu mọi hiệu ứng nhỏ trong prompt.

Các mục tiếp theo là lịch sử trước master redesign, không thay cho kết quả kiểm tra ở trên.

## Chuyển cảnh giữa các chức năng — kiểm tra sau lần giảm font

### Nguyên nhân và phạm vi đối chiếu

- Đã đọc Git diff và mã hiện tại. Các CSS thiết kế và `WorkspaceMotion.jsx` vẫn là file untracked, nên Git không có một revision riêng để tách chính xác lần giảm font. Đối chiếu các patch của lần đó cho thấy chỉ đổi `font-size`; không đổi transform, overflow hoặc điều hướng. Giữ nguyên các cỡ chữ nhỏ đã chỉnh.
- Chuyển cảnh giữa chức năng đã có trong hook dùng chung, không chỉ có animation thẻ dashboard. Tuy nhiên Profile/Health còn fade và trượt ở wrapper Framer và CSS, chồng lên animation từng nhóm; lớp chuyển cảnh cũ phụ thuộc chiều cao tài liệu và bị sai lát nhìn khi trang nguồn đang cuộn. Điều này khiến chuyển mục nhẹ, thiếu nhất quán và có thể trông như nhảy trang.
- Giá trị `useReducedMotion` của Framer trong phiên bản cài đặt không cập nhật state của hook đã mount khi đổi media preference trực tiếp. CSS đã phản hồi nhưng phần WAAPI có thể vẫn dùng giá trị cũ.

### Đã sửa trong mã nguồn

- `WorkspaceMotion.jsx`: một chuyển cảnh dùng chung cho mọi mục; trang cũ rời 180ms, nhóm nội dung mới trượt 18px/fade 320ms với độ trễ ngắn 80–220ms, kết thúc tối đa 540ms. Lớp quét nhẹ 460ms. Đây là chuyển cảnh đổi chức năng; đồ họa/thẻ riêng của dashboard vẫn là lớp trình bày khác.
- Snapshot và lớp quét giới hạn theo viewport nội dung, giữ đúng lát cuộn cũ; không che sidebar/header, không nhận focus hoặc chuột. Hủy lớp/animation cũ khi chọn mục tiếp theo. Giữ tham chiếu SVG và giá trị input trên bản sao hiển thị; bỏ qua file input.
- `Dashboard.jsx` và `health-studio.css`: bỏ fade/trượt trùng trên wrapper Profile/Health và các section/field. Không thay form state, handler lưu, API, xác thực hoặc trang đăng nhập. Tự cuộn AI/chat bác sĩ dùng instant khi giảm chuyển động.
- Thêm `useLiveReducedMotion.js`: nghe thay đổi browser/OS qua matchMedia ngay khi workspace đang mở. Khi giảm chuyển động: fade 80ms, không trượt, không stagger, không snapshot/lớp quét; đổi preference không reset cuộn trang.
- Đồng bộ live preference cho `ConversationMotion`, `ConversationViewport`, `PatientOverview`, `HealthAnalytics`, `DashboardCareArtwork`, `HealthStudioMark`, `WorkspacePrimitives`. Animation chat đang chạy được hủy khi bật giảm chuyển động; tắt lại không replay lịch sử.

### Đã kiểm tra thật

- Chrome local tại `http://127.0.0.1/dashboard`, phiên bệnh nhân đang đăng nhập, Responsive 1440px. Đã chạy lại Dashboard → Hồ sơ → Thông tin sức khỏe → Biểu đồ trên mã cuối. DevTools Animations ghi nhận snapshot, transform/fade của các panel và sweep; lần Health → Biểu đồ dài 460ms, không có CSS `studio-screen-in` chồng trên field/profile. Ảnh: `ui-review/function-transition-normal-motion.jpg`.
- Bật mô phỏng `prefers-reduced-motion: reduce` trong DevTools khi trang đang mở: Profile → Health chỉ còn nhóm fade 80ms, không có snapshot/sweep. Đã trả về **Do not emulate CSS prefers-reduced-motion**, thấy chuyển động bình thường hoạt động lại mà không reload. Ảnh: `ui-review/function-transition-reduced-motion.jpg`. Không thay thiết lập trợ năng của Windows.
- Nhập dở chiều cao, sang Biểu đồ rồi quay lại: giá trị vẫn còn; sau kiểm tra đã xóa giá trị thử, không bấm Lưu. Ảnh: `ui-review/function-transition-draft-preserved.jpg`.
- Mở hội thoại bác sĩ hiện có, nhập bản nháp chưa gửi, sang Hồ sơ rồi quay lại: vẫn chọn đúng bác sĩ và giữ nguyên bản nháp. Đã xóa bản nháp thử; không gửi tin, không mở/tải tệp và không ghi dữ liệu.
- `npm.cmd test -- --watchAll=false --runInBand`: **30/30 tests, 9/9 suites đạt**; bao gồm bốn chức năng, draft round-trip, rapid navigation, viewport snapshot, live reduced motion, hủy animation chat và bảo toàn vị trí đọc chat.
- `npm.cmd run build`: thành công, không có warning ESLint. Bundle `main.50d7b254.js`, CSS `main.0d598fd9.css`; chỉ có nhắc dữ liệu Browserslist cũ.

### Giới hạn của lần kiểm tra này

- Không kiểm tra trực quan lại các vai trò bác sĩ/admin, điện thoại vật lý, tin chat mới đến hoặc thao tác lưu thật. Vị trí đọc chat và rapid navigation có test tự động; bản nháp/hội thoại đã kiểm tra trong Chrome.
- Console vẫn có lỗi 404 `/api/care-plans/my` đã tồn tại; không thay backend hoặc che lỗi đó trong lần sửa motion này.
- Không push hoặc deploy. Các mục bên dưới là lịch sử thiết kế/kiểm tra trước lần sửa chuyển cảnh này.

## Dashboard bệnh nhân — mẫu thiết kế mới để đánh giá

### Triển khai mới

- Tách toàn bộ nội dung tổng quan thành `PatientOverview.jsx`; `Dashboard.jsx` chỉ truyền dữ liệu và handler điều hướng hiện có. Không sửa API, xác thực, trang đăng nhập, quy tắc đánh giá hoặc tạo dữ liệu mẫu.
- Thay banner dài và 5 card bằng bố cục giới thiệu hai vùng: lời chào/hành động trên nền thoáng, cụm đồ họa satin bên phải; đánh giá nguy cơ chuyển vào cụm này. Bốn chỉ số nằm trong một dải liên tục, có thời điểm ghi nhận chung.
- Bộ đồ họa SVG mới `DashboardCareArtwork.jsx`: hồ sơ phía sau, trái tim tiền cảnh, lịch nhỏ và khối cross coral, nền quỹ đạo, bóng tiếp xúc. Xuất hiện một lần 480ms, không animate liên tục chữ/số.
- Biểu đồ chính 280px cùng lịch hẹn/kế hoạch ở bên cạnh; tab chỉ số trượt, chọn khoảng và chọn trục thật. Mặc định Theo lần đo và ghi chú rõ khoảng cách không đại diện thời gian. Trục thời gian vẫn ngắt quãng hơn 7 ngày. Tooltip dùng timestamp và giá trị thật.
- Vùng nhận định có cột trợ lý navy và danh sách nội dung hiện có; thư viện kiến thức chuyển sang bố cục biên tập gọn. Không thêm kết luận sức khỏe mới.
- Chuyển cảnh 5 nhóm so le 40ms, kết thúc 530ms, giữ sidebar. Snapshot 140ms và sweep 420ms không chặn thao tác. Sửa ID SVG trong snapshot để giữ gradient/bóng khi trang cũ unmount; hủy animation trước khi đổi đích, hỗ trợ reduced motion.

### Xác minh thực tế

- Trước sửa: bundle local chứa `WorkspaceMotion`, `buildMeasurementPlot`, `studio-profile-page`. Sau sửa: bundle chứa marker `patient-overview-20261017` và `DashboardCareArtwork`. URL `http://127.0.0.1/dashboard`, phiên bệnh nhân người dùng đăng nhập.
- Ảnh trước/sau cùng khung Chrome 1529 × 822, đầu trang, cùng dữ liệu: `ui-review/patient-dashboard-before-desktop.jpg` và `patient-dashboard-after-desktop.jpg`.
- Đã xem bố cục trên Chrome Responsive 390, 768, 1280, 1440px; lưu ảnh tương ứng. Ảnh responsive được chụp trước lần tăng nhẹ cỡ chữ cuối, bố cục không đổi; ảnh desktop sau là bản cuối.
- Tooltip đã kiểm tra trên điểm thật: ngày/giờ, glucose và đơn vị. Đã đổi trục bằng control trình duyệt: chế độ thời gian thể hiện đoạn trống nhiều tháng, không có đường nối dài. Ảnh `patient-dashboard-chart-tooltip.jpg`, `patient-dashboard-chart-time.jpg`.
- Đã chuyển Hồ sơ ↔ Dashboard trong Chrome. Bảng Animations ghi nhận các section overview-intro/metrics/workbench so le và tổng 530ms; ảnh `patient-dashboard-animation-timeline.jpg`. Đây là timeline trình duyệt thật, không phải video.
- 21 tests / 7 suites đạt: lọc dữ liệu dashboard, điều hướng, dữ liệu thiếu/thời gian, chuyển cảnh/rapid navigation/reduced motion, ID SVG snapshot, chat viewport và modal. Rapid navigation và reduced motion hiện được xác minh bằng tests; chưa kiểm tra trực quan đầy đủ.
- Build cuối thành công, không có lỗi/warning ESLint: `main.5892fca7.js`, `main.3bc22365.css`. Chỉ có nhắc cập nhật dữ liệu Browserslist của môi trường.
- Không tạo được video: `sky.launch_app(SnippingTool.exe)` trả `Computer Use app approval timed out`. Không dùng video dựng từ ảnh để thay bằng chứng chuyển cảnh.
- Console vẫn có 404 `/api/care-plans/my` hiện có; trạng thái kế hoạch trống chưa chứng minh backend không có kế hoạch. Không sửa/hide lỗi này trong đợt thiết kế.

### Cách xem và giới hạn

- Mở `http://127.0.0.1/dashboard`. Chọn chỉ số trên dải số hoặc tab trong biểu đồ, đổi khoảng dữ liệu/trục, chuyển Hồ sơ rồi quay lại dashboard.
- Mở `ui-review/dashboard-comparison.html` để so sánh cạnh nhau hoặc từng ảnh tại cùng kích thước.
- Trang so sánh đã chạy trên HTTP local: `http://127.0.0.1:4173/dashboard-comparison.html` (chỉ bind 127.0.0.1), đã xác minh trả 200 và có đúng hai ảnh trước/sau.
- Chưa kiểm tra lưu dữ liệu thật, điện thoại vật lý, mọi trạng thái lịch hẹn có dữ liệu, và chưa có video. Chỉ hoàn thiện mẫu dashboard bệnh nhân trong đợt này; chưa mở rộng thiết kế mới này sang các chức năng khác.
- File chính: `PatientOverview.jsx`, `patient-overview.css`, `DashboardCareArtwork.jsx`, `dashboard-care-artwork.css`, `WorkspaceMotion.jsx`, phần tích hợp trong `Dashboard.jsx`; 3 file kiểm thử dashboard/motion mới. Không push/deploy.

Các mục dưới là lịch sử triển khai trước mẫu dashboard này.

## Thiết kế bổ sung và xác minh admin mới nhất

### Bổ sung form và tương tác modal

- Modal chỉnh sửa bác sĩ đã đồng bộ nền trắng/teal, nhóm danh tính, label 13px, ô nhập 46px một viền và focus ring trên wrapper; bỏ tiền tố Doctor bị lặp.
- Drawer bệnh nhân đồng bộ nhóm thông tin và ghi chú. Thẻ thống kê tổng quan sửa màu icon nhạt khó đọc và cỡ chữ.
- Thêm `useWorkspaceDialog.js`: khóa cuộn nền, focus trong modal, Tab/Shift+Tab quay vòng, Escape đóng, trả focus về trigger. Editor không đóng khi đang lưu. Không thay API hoặc giá trị form.
- Đã mở modal bác sĩ trên Chrome bằng dữ liệu thật và quan sát form sau sửa, Escape đóng được. Không bấm Lưu hoặc thay thông tin. Unit test kiểm tra focus trap và khôi phục cuộn/focus; tổng 11 tests / 4 suites đạt.
- Đã thay prompt lý do phân công bằng modal thiết kế riêng: đồ họa hội thoại, textarea tùy chọn, Hủy/Tiếp tục, hiệu ứng 220ms và focus trap. Hủy trả về null để dừng thao tác như cũ, request/payload giữ nguyên. Chưa kiểm tra trực quan modal lý do hoặc thực hiện ghi phân công.
- Phần modal mới chưa được kiểm tra trực quan ở toàn bộ kích thước mobile. Chưa ghi được video chuyển cảnh hoặc xác minh chuyển động trên thiết bị thật.

- Đã thiết kế nội dung Danh bạ và Phân công: hình hồ sơ/hội thoại có lớp bóng, vùng giới thiệu gọn, bộ lọc có chỉ báo trượt và số lượng từ dữ liệu hiện có. Bộ lọc vai trò bác sĩ đã được bấm và hiển thị đúng ba tài khoản.
- Bảng desktop tăng độ dễ đọc, đồng bộ nút teal/coral. Trên 390px, bảng trở thành thẻ có nhãn, giữ đủ liên hệ, bác sĩ, dropdown và hành động. Đã quan sát trực tiếp thẻ phân công trong Chrome Responsive.
- Phát hiện header admin mobile quá cao, đã sửa thành hàng menu/tiêu đề gọn và kiểm tra lại. Không còn khối tài khoản rỗng chiếm một hàng.
- Thông báo admin dùng component trạng thái thay alert; giữ thông điệp từ API. Không tự tạo thông báo lưu thành công. Chưa thực hiện ghi hồ sơ, đổi quyền hoặc phân công để kiểm tra trực quan thông báo.
- Lịch hẹn và kế hoạch bệnh nhân được bổ sung đồ họa lịch có chiều sâu, thay emoji ở nhóm nhãn kế hoạch bằng icon chung. Phần bổ sung cuối này đã kiểm tra build, chưa xem lại bằng phiên bệnh nhân.
- File mới: `src/components/WorkspacePrimitives.jsx`, `src/CSS/workspace-primitives.css`, `src/components/WorkspacePrimitives.test.jsx`. File sửa thêm: `src/pages/admin/AdminDashboard.jsx`, `src/pages/Dashboard/Dashboard.jsx`, `src/CSS/role-studio.css`.
- 10 tests / 3 suites đạt: dữ liệu biểu đồ, vị trí đọc chat, tab lọc và ngữ nghĩa thông báo lỗi/thành công.
- Ảnh Chrome thật: `ui-review/admin-users-desktop.jpg`, `admin-assignment-desktop.jpg`, `admin-assignment-390.jpg`, `admin-assignment-cards-390.jpg`. Ảnh users desktop chụp trước lần tăng độ tương phản màu nút cuối; ảnh mobile có DevTools.
- Bản chạy thử: `http://127.0.0.1/admin`; bệnh nhân `/dashboard`, bác sĩ `/doctor` theo phiên đăng nhập. Không push hoặc deploy.
- Chưa có bản ghi chuyển động; chưa kiểm tra mọi màn hình ở đủ bốn viewport, thiết bị điện thoại thật, reduced motion trực quan, hoặc các thao tác ghi dữ liệu. Không coi việc build thành công là chứng minh đầy đủ các luồng nghiệp vụ.

Các mục dưới đây là lịch sử triển khai/kiểm tra; giới hạn đã được xác minh thêm ở mục mới nhất được ưu tiên.

## Kiểm tra trực quan bác sĩ sau khi người dùng đăng nhập

- Đã quan sát tổng quan, danh sách bệnh nhân, lịch hẹn, khung chat desktop; dữ liệu lấy từ phiên bác sĩ thật trên `/doctor`.
- Đã mở một hội thoại có lịch sử và tệp đính kèm, xác nhận composer luôn nhìn thấy và tin nhắn có vùng cuộn riêng. Không gửi tin mới hoặc mở/tải tệp.
- Đã mở drawer chi tiết và xem bảng lịch sử, biểu đồ ngắt khoảng thiếu dữ liệu, kế hoạch chăm sóc 7 ngày đã lưu.
- Phát hiện drawer vẫn có màu vàng/kem cũ; đã sửa `role-studio.css` để đồng bộ nền, card, bảng, chữ, avatar và ghi chú. Đã xem lại kết quả trên Chrome.
- Tại 390px, menu drawer mở được; chat hiển thị đầy đủ composer. Phát hiện nút Xem hồ sơ che tên bệnh nhân; đã sửa `conversation-studio.css`, xem lại tên/email không chồng nút. Nút quay lại hiển thị danh sách hội thoại thành công.
- Ảnh thật mới: `ui-review/doctor-overview.jpg`, `doctor-patients.jpg`, `doctor-appointments.jpg`, `doctor-care-plan.jpg`, `doctor-chat-desktop.jpg`, `doctor-chat-390.jpg`, `doctor-chat-list-390.jpg`. Một số ảnh desktop ghi lại trạng thái trước khi đồng bộ bổ sung màu nút; ảnh chat 390 là sau sửa phần che tên.
- Build sau sửa thành công: `main.ddfaf118.js`, `main.581f320e.css`. Không thay backend, API, xác thực hoặc dữ liệu.
- Chưa kiểm tra gửi chat, lưu kế hoạch/đơn thuốc, nhận tin mới từ đầu kia, bàn phím điện thoại thật hoặc toàn bộ viewport bác sĩ. Chưa có bản ghi chuyển động. Đã đề nghị người dùng đăng nhập admin để tiếp tục kiểm tra quản trị.

## Lần kiểm tra và bổ sung mới nhất

### Đã kiểm tra trên Chrome thật

- Xác định lại tab với URL `127.0.0.1/dashboard` và phiên bệnh nhân có sẵn.
- Ba lỗi CSS đã hết trên desktop: tiêu đề Hồ sơ sát icon, menu không có thanh cuộn ngang, control sức khỏe chỉ có một viền.
- Form sức khỏe được quan sát trong Chrome Responsive tại rộng 390, 768, 1280, 1440px. Tương ứng một, hai, ba cột; label và đơn vị hiển thị, không bị chồng lên vùng nhập. Đây là giả lập viewport desktop, chưa phải kiểm tra bàn phím trên điện thoại thật.
- Ở 390px phát hiện hình hero bị cắt, đã sửa tỷ lệ và vị trí rồi xem lại.
- Ảnh trình duyệt thật: `ui-review/health-desktop.jpg`, `health-390.jpg`, `health-768.jpg`, `health-1280.jpg`, `health-1440.jpg`. Ảnh responsive có cả thanh DevTools; không phải ảnh mockup.

### Đã bổ sung trong mã nguồn

- `design-tokens.css`: màu, bề mặt, viền, bóng, radius và thời gian chuyển động dùng chung, giới hạn vào workspace sau đăng nhập.
- `role-studio.css`: khung điều hướng navy 240px, card/bảng/form/modal theo cùng hệ thống cho bác sĩ/admin. Mobile có menu drawer và lớp nền đóng menu.
- Tách các selector clinical legacy của bác sĩ/admin ra khỏi `.role-studio`, tránh chúng áp lại giao diện cũ bằng `!important`.
- `ConversationViewport.jsx`: nút báo số tin mới khi đọc lịch sử; trở về tin cuối; lưu vị trí đọc theo hội thoại khi chuyển chức năng. Hook không gửi request và không sửa message.
- Chat mobile chuyển giữa danh sách và hội thoại với nút quay lại; khung chat bác sĩ giữ vùng cuộn trong timeline. Trạng thái chưa chọn hội thoại có đồ họa SVG.
- Chuyển cảnh chạy lần lượt theo nhóm form/card, không chỉ fade cả trang; hủy chuyển cảnh cũ, hỗ trợ reduced motion ở cả ba vai trò.
- Hồ sơ có hình thẻ y tế riêng; BMI không còn một card thông báo lặp lại kết quả.

### Giới hạn xác minh còn lại

- Trong khi đổi kích thước responsive, một thao tác chọn Chat đã rơi vào nút Đăng xuất. Đã thông báo cho người dùng và đề nghị đăng nhập bác sĩ thủ công; không tự thao tác màn hình xác thực theo skill computer-use.
- Chưa kiểm tra trực quan chat sau đợt bổ sung mới, drawer bác sĩ, admin, lưu form, gửi chat, tình huống có tin đến thật khi đang đọc lịch sử, reduced motion hoặc bàn phím điện thoại thật.
- Console trong phiên cũ có HTTP 404 từ `/api/care-plans/my` và cảnh báo kích thước khởi tạo Recharts. Đã thêm initialDimension/minWidth cho biểu đồ; chưa xác minh lại console của dashboard sau lần build cuối. Không thay API/backend để che lỗi.
- Công cụ chỉ cung cấp ảnh chụp, chưa có bản ghi chuyển động liên tục. Không coi các ảnh tĩnh là bằng chứng tốc độ animation.
- Tám test đạt: sáu test dữ liệu biểu đồ, hai test thông báo tin mới/khôi phục vị trí đọc. `git diff --check` đạt. Build cuối thành công: `main.ddfaf118.js`, `main.af14e7cf.css`. Local `/dashboard` trả HTTP 200.

Không push/deploy. Các mục lịch sử bên dưới mô tả các lần trước; trạng thái xác minh mới nhất là phần này.

## Cập nhật theo video tham chiếu

Đã trích khung hình từ video người dùng cung cấp (59 giây), xem cả contact sheet tổng thể và chuỗi khung hình sát nhau khi chuyển cảnh. Quan sát được vật thể lớn trước chữ, các lớp tiền cảnh/hậu cảnh và màn che đóng–mở cảnh. DOCTIS sử dụng đồ họa SVG y tế nhiều lớp và dải chuyển sắc trong vùng nội dung; không sao chép kiến trúc, đồ ăn hoặc rèm sân khấu. Đây là SVG/CSS tạo chiều sâu, không phải mô hình WebGL.

- Thêm `CareScene.jsx`, `care-scene.css`: hình y tế nhiều lớp ở tổng quan, quản trị và trạng thái chat AI trống.
- Thêm `HealthAnalytics.jsx`, `measurement-studio.css`: bộ chọn đường huyết, huyết áp, BMI, nhịp tim; lọc 7/30/90 ngày hoặc tất cả, tính đến lần đo mới nhất; chọn trục thời gian hoặc thứ tự lần đo có chú thích rõ ràng. Thanh chỉ báo trượt khi chọn chỉ số.
- Bệnh nhân và drawer bác sĩ dùng chung biểu đồ. Tâm thu/tâm trương có hai đường riêng. Khoảng trên 7 ngày được tách thành các đoạn, không chèn phép đo hoặc giá trị 0 giả.
- Thu gọn chiều cao ô nhập sức khỏe, giới hạn form 1040px, thay emoji bằng icon. Giữ nguyên handler lưu và trạng thái API.
- Mở rộng chuyển cảnh nội dung sang bác sĩ/admin. Thu gọn header bác sĩ và thêm trạng thái hover/press/focus dùng chung. Giữ form và state ở component cha.
- Chat AI giới hạn chiều cao theo viewport, vùng tin nhắn cuộn riêng.
- Các file liên quan: ba dashboard JSX; `HealthStudioMark.jsx`, `WorkspaceMotion.jsx`, `DashboardChart.jsx`, `healthChartData.js`, test tương ứng; `health-studio.css`, `role-studio.css` và các file mới nêu trên.

Kiểm tra mới: sáu unit test xử lý dữ liệu đạt; local `/dashboard` HTTP 200; `/api/health` báo database connected. Không ghi dữ liệu thử vào cơ sở dữ liệu. Chrome trả khung hình đen và sau đó lỗi `failed to activate captured window`; chưa có kiểm tra trực quan hoặc video sau sửa. Các mục kiểm tra thủ công bên dưới vẫn cần thực hiện. Trang đăng nhập, API và backend không được chỉnh sửa trong lần cập nhật theo video này. Không push/deploy.

Địa chỉ kiểm tra: http://127.0.0.1/dashboard. Server cổng 80 là CRA development server của thư mục `frontend`, phục vụ source hiện tại qua `/static/js/bundle.js`. Build production nằm ở `frontend/build`; chưa push hoặc deploy.

## Thay đổi trong đợt này

- Sidebar bệnh nhân cố định theo viewport, chỉ menu cuộn; tài khoản nằm ngoài vùng menu. Bỏ hiệu ứng body cũ làm AppShell chuyển thành cột khi mở chat.
- Checkbox bệnh nền dùng tile riêng và checkbox 20px; loại selector input tổng quát khỏi các trường mới.
- Form sức khỏe có label, icon và suffix đơn vị; BMI phân biệt với trường nhập. Input không còn card lồng bên ngoài. Label hồ sơ gắn với control bằng ID ổn định.
- Chuyển mục: lớp cũ rời đi 140ms, lớp mới vào 300ms với độ trễ nhóm 40ms, dải chuyển sắc 420ms. Có hủy chuyển cảnh cũ khi bấm liên tiếp và hỗ trợ reduced motion. Snapshot trang cũ inert, ẩn khỏi accessibility và không nhận click.
- Chat hai phía dùng chung bộ CSS và animation: cột hội thoại, header, vùng tin nhắn và composer. Nền chấm/gradient cũ đã được tách khỏi các class mới. Bỏ dấu online không có dữ liệu thật ở danh sách bác sĩ. Polling không chạy lại hiệu ứng từng tin lịch sử.
- Đồ họa: giữ một điểm nhấn CSS 3D ở hero; các icon nhỏ chuyển sang hình thức phẳng đồng nhất. Chỉ hero float khi đang hiển thị. Đây không phải WebGL.
- Biểu đồ dùng trục thời gian numeric theo timestamp thật, đường linear, trục Y rộng hơn; tooltip có ngày giờ/đơn vị. Dữ liệu được sắp xếp trên bản sao. Bảng lịch sử có giờ và đơn vị; cuộn ngang bên trong bảng.

## File thực tế thay đổi trong đợt UI này

- `src/pages/Dashboard/Dashboard.jsx`
- `src/pages/Dashboard/DoctorDashboard.jsx`
- `src/CSS/health-studio.css`
- `src/CSS/conversation-studio.css`
- `src/CSS/dashboard-modern.css`
- `src/CSS/health-clarity.css`
- `src/CSS/clinical-theme.css`
- `src/components/WorkspaceMotion.jsx`
- `src/components/ConversationMotion.jsx`
- `src/components/HealthStudioMark.jsx`
- `src/components/DashboardChart.jsx`
- `src/components/healthChartData.js`
- `src/components/healthChartData.test.js`

Các chỉnh sửa backend/admin và `serve_build.js` có sẵn trước đợt này được giữ lại. Trang đăng nhập không thay đổi trong đợt này.

## Đã xác minh

- `npm run build`: thành công; xem `build/asset-manifest.json` để lấy tên bundle mới nhất.
- Sáu test xử lý dữ liệu biểu đồ đạt: sắp xếp không sửa bản ghi gốc, giữ khoảng cách timestamp, bỏ ngày không hợp lệ, không biến dữ liệu trống thành 0, lọc khoảng và tách đoạn khi dữ liệu gián đoạn.
- Development server biên dịch thành công. Bundle được phục vụ local chứa class chat, trường nhập, checkbox tile và chuyển cảnh mới.
- API local `/api/health`: database connected. Không gửi dữ liệu sức khỏe hoặc tin nhắn mới để làm bằng chứng thử giao diện.
- `git diff --check`: không có lỗi khoảng trắng.

## Chưa xác minh trực quan

Lần kiểm tra mới nhất, Chrome trả khung hình đen rồi lỗi kích hoạt cửa sổ. Chưa có ảnh sau sửa, video, xác minh các viewport hoặc kiểm tra tương tác đăng nhập/bác sĩ/admin bằng trình duyệt trong đợt này. Build thành công không chứng minh giao diện đã qua kiểm tra trực quan.

## Cách kiểm tra trên giao diện thật

1. Mở địa chỉ local, tải lại bằng Ctrl+F5 và đăng nhập tài khoản hiện có.
2. Ở Tổng quan và Hồ sơ, cuộn từ đầu đến cuối: sidebar và tài khoản phải luôn truy cập được; không có vùng trống dưới sidebar.
3. Ở Hồ sơ, kiểm tra tên mọi bệnh nền; dùng Tab/Space để chọn rồi bỏ chọn. Có thể thử trạng thái trong form mà không nhấn lưu.
4. Ở Nhập sức khỏe, nhập thử vài trường, chuyển mục rồi quay lại: giá trị đang nhập phải được giữ. Kiểm tra focus và BMI tự tính; không cần lưu dữ liệu thử.
5. Mở Chat: ô soạn phải hiện ngay; lướt lên đọc tin cũ và chờ polling để kiểm tra vị trí đọc không bị kéo về cuối. Lặp lại với tài khoản bác sĩ.
6. Mở Biểu đồ/lịch sử: hover điểm đo và đối chiếu tooltip với bản ghi thật trong bảng. Các lần đo tháng 5 và tháng 9 phải thể hiện khoảng cách thời gian khác nhau.
7. Kiểm tra 390px, 768px, 1280px, 1440px và màn hình rộng; kiểm tra cả đầu/giữa/cuối trang, drawer bệnh nhân, bảng cuộn riêng và không cuộn ngang toàn trang.
