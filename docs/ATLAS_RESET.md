# Đặt lại dữ liệu DOCTIS trên Atlas

CLI bảo trì một lần: `backend/scripts/resetAtlasNonAdmin.js`. Việc tạo file này **chưa thay đổi cơ sở dữ liệu**.

## Cấu hình riêng

Người vận hành điền hai biến vào `backend/.env.maintenance.local` đã được Git bỏ qua:

- `ATLAS_MAINTENANCE_URI`: nguyên URI Atlas đã cấu hình trên Vercel; chấp nhận cả URI chưa ghi database trong đường dẫn.
- `ATLAS_RESET_EXPECTED_DB`: tên database kiểm tra trực tiếp trong Atlas Browse Collections, luôn bắt buộc. Nếu URI có database thì phải trùng chính xác; nếu URI để trống, script truyền rõ tên này qua `dbName`, không dùng database mặc định `test`.

Script chỉ đọc file này bằng `dotenv.parse`. Không đọc `backend/.env`, không lấy URI từ đối số hoặc biến môi trường hiện tại. Không dán URI vào lệnh, báo cáo hoặc log.

## Trình tự vận hành

1. Dừng toàn bộ luồng ghi vào cùng database: web/mobile/API cũ, đăng ký, cron/reminder, AI đang xử lý và các worker. Giữ trạng thái bảo trì trong cả dry-run lẫn apply. Transaction không ngăn được tài khoản mới được chèn từ một ứng dụng khác.
2. Tại thư mục gốc dự án, chạy bước chỉ đọc:

   ```powershell
   node backend/scripts/resetAtlasNonAdmin.js
   ```

3. Đối chiếu `roleCounts`, `adminCount`, từng `counts`, các số lượng dọn tham chiếu và `targetFingerprint`. Không tiếp tục nếu database có dữ liệu hoặc số lượng khác dự kiến. Collection/view không thuộc danh sách sẽ làm script từ chối; cần review mã nguồn, không có `--force`.
4. Chỉ sau khi duyệt đúng kết quả, dùng nguyên fingerprint 64 ký tự của dry-run:

   ```powershell
   node backend/scripts/resetAtlasNonAdmin.js --apply --plan <fingerprint>
   ```

5. Chạy lại dry-run để kiểm tra chỉ còn tài khoản admin và các dữ liệu được giữ theo phạm vi dưới đây, rồi mới mở lại luồng ghi. Không tự apply lại nếu báo `COMMIT_RESULT_UNKNOWN`; đọc trạng thái bằng dry-run và đối chiếu trước.

## Phạm vi đã giới hạn

- Xóa mọi tài khoản hiện có trong snapshot đã duyệt mà role không chuẩn hóa thành `admin`, kể cả role lạ hoặc bị thiếu. Không đọc/log mật khẩu, email, CCCD hay nội dung hồ sơ.
- Giữ tất cả tài khoản admin; chỉ tăng `__v` để khóa CAS và xóa con trỏ `doctorId` cũ nếu đang trỏ đến tài khoản không được giữ. Không thay mật khẩu, thông tin đăng nhập hoặc phân quyền admin.
- Giữ nguyên toàn bộ collection `wards` và `hospitals`, kể cả dữ liệu danh mục chưa xác minh hoặc đã ngừng hoạt động.
- Dọn hồ sơ sức khỏe, lịch hẹn/nhắc nhở, kế hoạch chăm sóc, đơn thuốc, lời khuyên, chat/tệp AI, chat bác sĩ, phân công và tiếp nhận khi chủ sở hữu không phải admin hoặc tham chiếu liên quan đã bị xóa/không còn tồn tại. Bao gồm bản ghi cũ mồ côi; dữ liệu thực sự thuộc admin và có tham chiếu hợp lệ được giữ.
- Password reset challenge và AI rate limit chỉ bị xóa khi chủ sở hữu không phải admin, kể cả chủ sở hữu cũ không còn tài khoản.
- Thông báo của tài khoản bị xóa được dọn. Thông báo admin chỉ giữ khi không có đích hoặc đích xác định vẫn tồn tại; thông báo có đích bị xóa, mồ côi hoặc không thể phân giải được dọn. Danh sách đã đọc của thông báo giữ lại được bỏ các ID không phải admin.
- `preservedCatalogVerifierReferencesNotAdmin` là số tham chiếu người xác minh cũ trong danh mục được giữ nguyên để người vận hành biết; script không tự sửa lịch sử xác minh của danh mục.

Danh sách collection tường minh nằm trong hằng `SCOPE`, không có thao tác drop database/collection, tạo index, seed tài khoản, gọi API gửi tin hoặc sao lưu dữ liệu cá nhân.

## Bảo vệ khi ghi

Dry-run lấy metadata trong snapshot transaction rồi abort, không tạo ghi. Apply yêu cầu fingerprint trùng cả metadata, ID, số lượng, role, `updatedAt` và version. Admin được cập nhật theo CAS; xóa user cũng dùng CAS. Toàn bộ thao tác ghi dùng một transaction với majority write concern, không tự thử lại bằng thao tác ngoài transaction.

Ngay trước commit, script đọc metadata độc lập để phát hiện thay đổi trong quá trình reset. Đây là lớp kiểm tra bổ sung, không thay thế việc dừng toàn bộ luồng ghi: MongoDB snapshot không khóa những bản ghi mới có thể xuất hiện sau lần kiểm tra cuối. Vì vậy kết quả luôn ghi `mutationScope: reviewed-existing-document-ids` và `concurrentInsertsLocked: false`; không khẳng định đã xóa được đăng ký mới xuất hiện sau lần kiểm tra cuối.

Không tự chạy reset trong quá trình build/deploy. Kết quả CLI chỉ chứa số lượng, phạm vi và fingerprint, không xuất danh sách tài khoản hoặc nội dung bệnh án.
