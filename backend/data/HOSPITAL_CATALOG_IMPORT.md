# Danh mục cơ sở y tế từ NIPT Đà Nẵng

Nguồn người dùng yêu cầu: [danh sách bệnh viện/phòng khám](https://niptdanang.com/danh-sach-tong-hop-benh-vien-phong-kham-tai-da-nang/). Dữ liệu được rà soát ngày 19/10/2026 trong `danang-hospitals.source.json`.

## Phạm vi và mức xác minh

- 24 bệnh viện và 1 phòng khám điều trị được giữ trong dataset, gồm cả mục Mắt Sài Gòn Sông Hàn nằm ngoài danh sách đánh số.
- 5 cơ sở có đủ nguồn chính thức cho tên, địa chỉ, phường hiện hành và điện thoại: Medic Sài Gòn, Hoàn Mỹ, Gia Đình, Vinmec và Bệnh viện 199. Nguồn và các trường đã đối chiếu nằm trong `verificationSources` của từng hàng.
- 20 cơ sở còn lại được nhập dạng **bản nháp**, `verified=false`, `wardId=null`. Địa chỉ cũ được giữ có chủ đích để admin rà soát; không suy phường hiện hành từ tên quận cũ. Mắt Sài Gòn Sông Hàn có bằng chứng phường mới nhưng còn thiếu đối chiếu điện thoại chính thức, nên vẫn là bản nháp.
- 8 trung tâm/chi cục có thông tin nguồn được giữ riêng trong `excludedSourceUnits`, không nhập thành bệnh viện. Một số có dịch vụ y tế công cộng nhưng chưa xác minh là cơ sở điều trị độc lập phù hợp workflow. Taxi và phương tiện vận chuyển không nằm trong dataset.
- Không lấy số di động cá nhân của lãnh đạo. Vì mục Bệnh viện Tâm thần chỉ công bố các số cá nhân đó, điện thoại của bản nháp để trống.
- Không tạo bác sĩ, không gán địa bàn phục vụ, không tính khoảng cách hay suy cơ sở gần nhất.

**Tất cả bản ghi mới có `acceptingPatients=false`.** Xác minh thông tin danh mục không đồng nghĩa bệnh viện đã tham gia DOCTIS hoặc đồng ý nhận bệnh nhân. Admin phải đối chiếu việc tiếp nhận và nhân sự thật trước khi bật.

## Chạy công cụ

Mặc định chỉ đọc JSON cục bộ, không kết nối MongoDB:

```powershell
node backend/scripts/importHospitalCatalog.js
```

Chế độ ghi yêu cầu `--apply` và biến môi trường **`CATALOG_MONGO_URI` được cung cấp rõ ràng bởi người vận hành**. Công cụ không tự đọc `.env` và không in chuỗi kết nối. Không ghi khóa/URI vào lệnh lưu trong repository hoặc ảnh chụp.

```powershell
node backend/scripts/importHospitalCatalog.js --apply
```

Trước khi apply:

1. Triển khai schema Hospital hỗ trợ draft: `wardId=null` và `phone=''` chỉ khi `verified=false`; draft không được bật tiếp nhận.
2. Nhập danh mục phường đã xác minh bằng `importVerifiedWards.js`. Công cụ bệnh viện chỉ dùng `Ward` đúng code, thành phố Đà Nẵng, `verified=true`, `active=true`. Thiếu phường của một hàng verified sẽ dừng trước khi ghi bất kỳ hàng nào.
3. Xem kết quả offline và danh mục hiện tại. Danh sách nguồn có tên cũ, đặc biệt C17, Vĩnh Toàn và các trung tâm y tế quận/huyện; không tự xác nhận tình trạng hoạt động hiện nay.

## Tính lặp lại và bảo toàn dữ liệu

- `_id` được tạo ổn định bằng SHA-256 từ namespace, `datasetId` và `sourceKey`. Không đổi các khóa này sau lần nhập đầu.
- Nếu đã có cùng ID, tên/alias đã chuẩn hóa, hoặc cùng địa chỉ và điện thoại, giữ nguyên bản ghi hiện có. Không cập nhật tên, cờ tiếp nhận, tình trạng xác minh, phường hay quan hệ của bệnh viện đã được quản trị viên quản lý.
- Chạy lại cùng dataset sẽ giữ các bản ghi đã nhập. Hai tiến trình nhập cùng dataset dùng cùng ID nên khóa `_id` ngăn tạo hai hàng cho cùng sourceKey. Không chạy đồng thời với thao tác tạo danh mục của admin: schema hiện chưa có unique key chung cho tên cơ sở.
- Không xóa bệnh viện, không sửa người dùng/phân công, không tự nâng bản nháp lên verified ở các lần chạy sau. Việc rà soát và nâng cấp bản nháp thực hiện qua quản trị danh mục.
- Nguồn directory và các bằng chứng chính thức đầy đủ được lưu trong JSON; trường `sourceUrl` của Hospital trỏ nguồn đã dùng cho mức xác minh của hàng đó.

## Giới hạn cần admin hoàn thiện

- Bệnh viện Hòa Vang có địa chỉ tại Hòa Nhơn cũ, có thể thuộc xã ngoài danh mục 23 phường hiện có. Không gán một phường khác để vượt qua validation; cần mở rộng địa bàn bằng nguồn chính thức nếu phù hợp.
- Điện thoại Vinmec và Bệnh viện 199 trên website chính thức khác directory. Dataset dùng số chính thức hiện được công bố, giữ mô tả khác biệt trong `reviewNotes`.
- Công cụ không xác nhận giấy phép, hợp đồng tham gia DOCTIS hoặc số chỗ tiếp nhận; các cờ nghiệp vụ vẫn do admin quyết định.
