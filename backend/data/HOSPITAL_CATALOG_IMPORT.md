# Danh mục bệnh viện chăm sóc đái tháo đường type 2

## Nguồn lựa chọn ngày 20/10/2026

Chủ dự án cung cấp `Danh_sach_Benh_vien_Dieu_tri_Dai_thao_duong_Da_Nang_Full.xlsx`, gồm 7 bệnh viện công lập/quân y và 5 bệnh viện tư nhân/quốc tế. Bản trích cấu trúc, sheet và ô nguồn nằm trong `danang-diabetes-hospitals.selection.json`; file Excel gốc không bị sửa.

`danang-hospitals.source.json` hiện chỉ có 12 cơ sở này trong `facilities`. Giữ `datasetId` và các `sourceKey` cũ để không đổi ID, tạo trùng hoặc mất liên kết. 15 cơ sở ngoài lựa chọn được ghi trong `retiredFacilities` để đối chiếu lần chuyển danh mục, không dùng cho điều phối mới.

- Thêm Bệnh viện Giao thông Vận tải Đà Nẵng và Bệnh viện Y học Cổ truyền Đà Nẵng.
- Bệnh viện C17 được ghi tên Bệnh viện Quân y 17, giữ tên cũ làm alias.
- Bệnh viện Phụ sản – Nhi có nhãn đối tượng thai phụ; không trình bày như lựa chọn chung cho mọi bệnh nhân trưởng thành.
- Các mô tả trên thẻ là tóm tắt trung tính từ file cung cấp, không dùng nhận định xếp hạng như “tốt nhất” hoặc “cực tốt”.
- Có tên trong danh sách không tự bật tiếp nhận, xác minh địa chỉ/phường mới hoặc tạo bác sĩ. Không lấy tên quận/phường cũ trong Excel để đoán phường hiện hành.

4 hàng trong JSON giữ bằng chứng danh mục đã đối chiếu trước đó: Hoàn Mỹ, Gia Đình, Vinmec và 199. 8 hàng còn lại là bản chờ hoàn thiện. Cấu hình admin đã cập nhật trên database được giữ khi đối chiếu, nên trạng thái thực tế có thể đầy đủ hơn JSON nguồn.

## Nhập các cơ sở còn thiếu

```powershell
node backend/scripts/importHospitalCatalog.js
# Chỉ ghi khi người vận hành truyền rõ CATALOG_MONGO_URI:
node backend/scripts/importHospitalCatalog.js --apply
```

Công cụ chỉ thêm bản ghi thiếu. Không ghi đè các cờ, địa chỉ, phường hoặc điện thoại đã quản lý. Các bản ghi mới chưa bật tiếp nhận.

## Đối chiếu và loại cơ sở ngoài danh sách

```powershell
# Chỉ đọc, cấu hình nguồn ở backend/.env.maintenance.local:
node backend/scripts/reconcileDiabetesHospitals.js
# Ghi theo đúng fingerprint vừa đọc:
node backend/scripts/reconcileDiabetesHospitals.js --apply --expected-plan=<fingerprint>
# DB preview cố định, tách biệt Atlas:
node backend/scripts/reconcileDiabetesHospitals.js --local
```

Công cụ tạo bản lưu danh mục cũ trong thư mục ignored `.local-public-check/catalog-snapshots`, kiểm tra lại danh mục và tham chiếu trong transaction. Cơ sở ngoài danh sách không có tham chiếu được xóa; cơ sở còn liên kết chỉ được loại khỏi lựa chọn mới, giữ lịch sử và quyền chăm sóc hiện hành. Công cụ không sửa tài khoản, hồ sơ, lịch hẹn, đơn thuốc hoặc phân công.

Lần áp dụng trên Atlas ngày 20/10/2026: giữ 10, thêm 2, xóa 15 không có tham chiếu; đọc lại có đúng 12 cơ sở. Các cờ tiếp nhận, xác minh, phường và thông tin liên hệ của 10 cơ sở được giữ.

## Chọn bệnh viện trên giao diện

Bộ chọn có tìm kiếm theo tên/địa chỉ/phường, bộ lọc đang tiếp nhận/cùng phường, thẻ riêng cho tên, địa chỉ, nhóm cơ sở, phạm vi chăm sóc và số bác sĩ. Mục chưa sẵn sàng có trạng thái và lý do riêng. Không dùng cùng phường làm kết luận bệnh viện gần nhất theo khoảng cách.

Backend kiểm tra cùng danh mục khi tiếp nhận hoặc gắn bác sĩ vào bệnh viện. Việc giữ lịch sử của một cơ sở không làm cơ sở đó được chọn cho hồ sơ mới.
