# DOCTIS — ghi chú UI

Cập nhật ngày 20/10/2026. Tài liệu này giữ trạng thái hiện tại; lịch sử chỉnh sửa chi tiết có trong Git.

## Các phần đã triển khai

- Hồ sơ: các nhóm thông tin, dị ứng/bệnh nền, ảnh đại diện và chế độ xem/chỉnh sửa. Địa chỉ đăng ký hiển thị tại Thông tin địa chỉ, lưu qua API địa chỉ riêng và giữ bản nháp khi đổi chức năng.
- Nhập sức khỏe: form gọn có nhãn/đơn vị, BMI và phản hồi API. Biểu đồ dùng timestamp thật, tooltip theo lần đo, tách khoảng thiếu dữ liệu và không chèn giá trị 0 giả.
- Chuyển chức năng: rời/vào theo nhóm nội dung, trạng thái hover/press/loading, chỉ báo điều hướng; hỗ trợ reduced motion và giao diện đơn giản. Không dùng chuyển cảnh để tạo lại dữ liệu hoặc hội thoại.
- Chat: lịch sử, vị trí đọc, tin mới, bản nháp và tệp đính kèm. Tin người dùng căn phải; danh sách và hội thoại thích ứng trên điện thoại.
- Kế hoạch chăm sóc: phân biệt gợi ý AI với kế hoạch bác sĩ xác nhận; tiến độ có revision, lịch sử và phản hồi lưu.
- Bác sĩ: quản lý tạo/duyệt/hoàn tất/hủy/nhắc email trong Lịch hẹn; lịch tương lai không thể hoàn tất. Giờ hẹn dùng múi giờ Việt Nam.
- Admin: badge số có chỗ riêng; nút kết thúc phân công không bị ép thành nút icon. Điều phối đối chiếu địa chỉ, nhóm bệnh viện cùng phường và chỉ dùng bác sĩ thuộc bệnh viện đã tiếp nhận.
- Danh mục: dữ liệu có nguồn, hỗ trợ bản chờ đối chiếu; chỉ bệnh viện đủ điều kiện mới dùng cho điều phối. Mục bệnh viện/bác sĩ không lặp địa chỉ nhà bệnh nhân.

## Phạm vi xác minh

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
