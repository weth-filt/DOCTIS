# DOCTIS — ghi chú UI

Cập nhật ngày 21/10/2026. Tài liệu này giữ trạng thái hiện tại; lịch sử chỉnh sửa chi tiết có trong Git.

## Các phần đã triển khai

- Hồ sơ: các nhóm thông tin, dị ứng/bệnh nền, ảnh đại diện và chế độ xem/chỉnh sửa. Địa chỉ đăng ký hiển thị tại Thông tin địa chỉ, lưu qua API địa chỉ riêng và giữ bản nháp khi đổi chức năng.
- Cập nhật hồ sơ: kiểm tra CCCD đúng 12 chữ số, email và định dạng SĐT Việt Nam ở cả form và API. Hiện lỗi dưới từng ô khi rời ô/bấm lưu; số liên hệ phụ được để trống, nhưng nếu nhập phải đúng định dạng. API trả HTTP 400 cùng lỗi từng trường trước khi ghi, giữ kiểm tra trùng CCCD/email; không tự sửa dữ liệu cũ.
- Ô hồ sơ có icon (CCCD, SĐT, họ tên) dùng chính input làm khung viền, nền và focus như ô SĐT bố/mẹ. Icon đặt bên trong bằng position; wrapper không còn viền/focus riêng nên không tạo hai khung lồng nhau.
- Nhập sức khỏe: form gọn có nhãn/đơn vị, BMI và phản hồi API. Biểu đồ dùng timestamp thật, tooltip theo lần đo, tách khoảng thiếu dữ liệu và không chèn giá trị 0 giả.
- Chuyển chức năng: rời/vào theo nhóm nội dung, trạng thái hover/press/loading, chỉ báo điều hướng; hỗ trợ reduced motion và giao diện đơn giản. Không dùng chuyển cảnh để tạo lại dữ liệu hoặc hội thoại.
- Chat: lịch sử, vị trí đọc, tin mới, bản nháp và tệp đính kèm. Tin người dùng căn phải; danh sách và hội thoại thích ứng trên điện thoại.
- Ảnh trong chat bác sĩ dùng thẻ tối đa 360px, xem trước giữ tỷ lệ không cắt nội dung; tên tệp/dung lượng và hàng nút Mở ảnh/Tải xuống có khu vực riêng. Bubble thu theo thẻ, chữ trên nút không xuống dòng; có giới hạn chiều rộng cho điện thoại.
- Mở ảnh ở cả bệnh nhân/bác sĩ dùng viewer trong website (portal), không điều hướng trực tiếp tới URL base64. Bấm thumbnail hoặc Mở ảnh đều mở viewer; hỗ trợ vừa màn hình/kích thước gốc, Esc, đóng ngoài nền, giữ focus trong hộp thoại và trả focus về nút mở. Nút tải xuống phía bác sĩ vẫn dùng xử lý cũ.
- Chat bác sĩ: phản hồi polling cũ được hợp nhất theo ID thay vì xóa danh sách đang hiển thị; giữ tin gửi tạm và tin server đã xác nhận. Trong lúc chờ POST, tạm hoãn nhận snapshot để tránh hiện cả tin tạm lẫn bản đã lưu. Giữ key hiển thị qua bước xác nhận để không tạo lại bubble; dữ liệu từng hội thoại được tách trong bộ nhớ component. Polling không chạy chồng, bỏ phản hồi sau khi rời màn hình; request đọc/gửi có thời hạn để không bị treo mãi. Gửi lỗi trả nội dung về ô soạn khi vẫn đang ở đúng hội thoại.
- Kế hoạch chăm sóc: phân biệt gợi ý AI với kế hoạch bác sĩ xác nhận; tiến độ có revision, lịch sử và phản hồi lưu.
- Bác sĩ: quản lý tạo/duyệt/hoàn tất/hủy/nhắc email trong Lịch hẹn; lịch tương lai không thể hoàn tất. Giờ hẹn dùng múi giờ Việt Nam.
- Admin: badge số có chỗ riêng; nút kết thúc phân công không bị ép thành nút icon. Điều phối đối chiếu địa chỉ, nhóm bệnh viện cùng phường và chỉ dùng bác sĩ thuộc bệnh viện đã tiếp nhận.
- Danh mục: dữ liệu có nguồn, hỗ trợ bản chờ đối chiếu; chỉ bệnh viện đủ điều kiện mới dùng cho điều phối. Mục bệnh viện/bác sĩ không lặp địa chỉ nhà bệnh nhân.

## Phạm vi xác minh

- Sửa mở ảnh base64 21/10: 16 kiểm thử trong `ChatImageViewer`, `useWorkspaceDialog`, `useChatMessages` đã qua; xác nhận src ảnh nhúng đúng, không gọi mở tab mới, đổi kích thước, đóng/khôi phục focus, callback tải tệp và xử lý ảnh lỗi. Dùng ảnh giả, không mở/gửi tệp bệnh nhân thật. Build production thành công; chưa kiểm tra click ảnh trong phiên Chrome đăng nhập thật.
- Sửa nháy/mất tin chat 21/10: 13 kiểm thử trong 3 suite (`useChatMessages`, `ConversationViewport`, `ConversationMotion`) đã qua, gồm snapshot cũ trước/sau POST, ACK đến trái thứ tự, chuyển hội thoại, giữ cùng node DOM, không nhân đôi, tệp đính kèm và trạng thái đã đọc. Chỉ dùng dữ liệu giả, không gửi tin thật. Build production thành công; chưa kiểm tra gửi tin bằng trình duyệt đăng nhập thật.
- Hiệu năng 21/10: build production thành công. JavaScript entry ban đầu giảm từ 349,38 KB xuống 160,61 KB gzip (khoảng 54% theo báo cáo CRA). CSS dùng thứ tự chung trước khi tải các chunk vai trò; tổng CSS entry khoảng 102,72 KB gzip. Đây là dung lượng build, không phải kết quả đo thời gian đăng nhập thật.
- Đăng nhập bắt đầu tải trước chunk và các GET chính của đúng vai trò, không chờ hoàn tất mới điều hướng. Kết quả chỉ bàn giao trong bộ nhớ tối đa 30 giây, dùng một lần; không ghi thêm dữ liệu sức khỏe vào storage. Tách theo JWT hiện tại; xóa bàn giao khi có thao tác ghi; GET thông thường chỉ gộp request còn đang chạy. Màn hình chào vẫn chờ bệnh nhân bấm Bỏ qua, dashboard không dựng ngầm.
- Chat bệnh nhân chỉ tải danh sách bác sĩ khi mở chat; không polling danh sách khi tab bị ẩn. Các bản nháp/hội thoại vẫn do component cũ quản lý.
- Danh sách bác sĩ dùng `/doctor/patients?summary=1` chỉ lấy lần đo gần nhất. Mở bệnh nhân vẫn lấy toàn bộ lịch sử qua endpoint cũ; gọi không có `summary=1` vẫn trả hợp đồng cũ. Truy vấn lịch sử và kiểm tra phân công được gộp theo lô; vẫn kiểm tra vai trò, bệnh viện và hồ sơ tiếp nhận. Thêm index lịch sử theo user/thời gian, lời khuyên theo patient/thời gian; đọc `lean()` cho dữ liệu chỉ đọc. Admin tra cứu phân công/số bệnh nhân bằng Map thay vì lặp tìm từng dòng. CORS cache preflight 600 giây; API vẫn kiểm tra xác thực và quyền cho mỗi thao tác.
- Bảy file backend sửa trong đợt hiệu năng qua kiểm tra cú pháp. Chưa chạy bộ test hoặc đo waterfall bằng phiên đăng nhập thật; chưa đối chiếu vùng triển khai API với vùng Atlas. Không ghi/sửa dữ liệu bệnh nhân để đo hiệu năng.
- Sửa định dạng hồ sơ ngày 20/10: build production thành công, controller và helper backend qua kiểm tra cú pháp. Chưa chạy bộ test hoặc thao tác lưu hồ sơ thật; không thay đổi dữ liệu đã lưu trên Atlas trong đợt sửa này.
- Bộ chọn bệnh viện được thay bằng thẻ có tìm kiếm, lọc trạng thái/cùng phường, số bác sĩ và nhãn thai phụ. Dùng chung trong điều phối, bố trí bác sĩ và chỉnh hồ sơ bác sĩ. Danh mục theo Excel còn 12 cơ sở; Atlas đã đối chiếu giữ 10, thêm 2, xóa 15 không có tham chiếu.
- Build production cho bộ chọn mới thành công. Computer Use tìm thấy Chrome nhưng bị dừng ở bước xác định URL trước khi chụp ảnh; chưa có xác minh trực quan bản này bằng trình duyệt thật.
- Bản phát hành theo yêu cầu ngày 20/10/2026: menu admin có nhãn/badge riêng; chi tiết ngày có icon theo loại hoạt động; thêm hàng chờ/đã phân công và bố trí bác sĩ theo bệnh viện.
- Bệnh viện trong danh mục đều hiển thị cho admin; từng cơ sở có lý do chưa đủ điều kiện. Bệnh viện cùng phường được nhóm trước; không coi cùng phường là gần nhất theo khoảng cách.
- Công cụ phiên này trả `apps:[], browsers:[]`; mở IAB báo `Browser is not available: iab`. Chưa có kiểm tra trực quan bản sửa điều phối trên trình duyệt thật.
- Bản sửa điều phối đã build thành công; 9 file backend qua kiểm tra cú pháp. Preview `/admin`, `/api/health` và bundle mới trả HTTP 200 tại `127.0.0.1:5001`. Không chạy bộ test hoặc thử thao tác ghi phân công trên Atlas trong đợt này.
- Các đợt trước có kiểm thử backend, React DOM và HTTP/Mongo local; kết quả cũ không thay thế việc chạy lại trên thay đổi mới hoặc kiểm tra trình duyệt.
- Bản phát hành trước đợt sửa hiện tại đã build thành công và được xác nhận phục vụ đúng assets/API trên Vercel. Công cụ không có trình duyệt kết nối trong đợt đó nên chưa có xác minh trực quan desktop/mobile sau sửa.
- Ảnh tĩnh cũ và mock API không được coi là bằng chứng animation, email thật hoặc chất lượng AI cloud.
- Đợt dọn file giữ các kiểm thử hồi quy; không thêm hoặc chạy bộ test khi chưa được yêu cầu.

## Kiểm tra thủ công khi có trình duyệt

1. Đăng nhập từng vai trò, kiểm tra 390/768/1280px và màn hình rộng; menu, bảng và nút không chồng nhau.
2. Chuyển Dashboard → Hồ sơ → Sức khỏe → Biểu đồ, rồi quay lại để kiểm tra bản nháp và chuyển động; lặp lại với giảm chuyển động bật/tắt.
3. Đối chiếu tooltip/bảng với ngày giờ và đơn vị của bản ghi thật. Khoảng không có phép đo phải thể hiện đúng.
4. Chat: đọc tin cũ, đổi chức năng/quay lại và chờ polling; vị trí đọc và bản nháp phải được giữ.
5. Lưu hồ sơ/địa chỉ/sức khỏe bằng tài khoản kiểm tra riêng, đối chiếu phản hồi API và đọc lại. Không dùng dữ liệu bệnh nhân thật làm fixture.
6. Bác sĩ/admin: kiểm tra modal, form, điều kiện lịch hẹn và ba bước điều phối, gồm lỗi quyền và dữ liệu vừa thay đổi.

Chi tiết chạy preview và bộ kiểm thử có trong [PUBLIC_WORKFLOW.md](../docs/PUBLIC_WORKFLOW.md).
