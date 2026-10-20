# DOCTIS

Hệ thống theo dõi sức khỏe và hỗ trợ chăm sóc đái tháo đường type 2, gồm giao diện bệnh nhân, bác sĩ và quản trị viên.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `frontend/` | Website React, biểu đồ, chat và chuyển động giao diện |
| `backend/` | API Express, xác thực, điều phối, dữ liệu MongoDB và tích hợp AI |
| `AI/` | Dịch vụ dự đoán Python, mã huấn luyện và bộ quy tắc theo dõi |
| `mobile/` | Ứng dụng Expo và bản web/PWA |
| `docs/` | Hướng dẫn luồng nghiệp vụ và bảo trì |
| `scripts/` | Đồng bộ quy tắc theo dõi giữa Python, API và website |

## Chạy local

Chuẩn bị MongoDB và cấu hình `backend/.env` với `MONGO_URI`, `JWT_SECRET` cùng các biến AI/email cần dùng. Các luồng điều phối dùng MongoDB transaction nên cần replica set. Cấu hình frontend local nằm trong `frontend/.env.development`.

Từ thư mục gốc:

```powershell
npm install
npm --prefix frontend install
npm start
```

Mở terminal thứ hai:

```powershell
npm --prefix frontend start
```

Build website bằng `npm run build`. Xem [hướng dẫn frontend](frontend/README.md) để chạy bản build, hoặc [preview DB riêng](docs/PUBLIC_WORKFLOW.md#5-mở-preview-riêng-để-xem-giao-diện) để review mà không dùng Atlas.

## Tài liệu

- [Triển khai Vercel](VERCEL_DEPLOY.md)
- [Đăng ký, địa chỉ và điều phối bệnh viện/bác sĩ](docs/PUBLIC_WORKFLOW.md)
- [Danh mục cơ sở y tế và nguồn dữ liệu](backend/data/HOSPITAL_CATALOG_IMPORT.md)
- [AI local](backend/AI_SETUP.md), [hội thoại và tệp AI](backend/AI_CHAT.md)
- [Xác thực, lịch hẹn và nhắc lịch](backend/AUTH_APPOINTMENTS_REMINDERS.md)
- [Ghi chú UI và phạm vi đã kiểm tra](frontend/UI_REVIEW.md)
- [Công cụ bảo trì Atlas](docs/ATLAS_RESET.md)
- [Ứng dụng mobile](mobile/README.md)

Các file `.env`, database local, dữ liệu huấn luyện, model và ảnh review không được đưa vào Git. Các thư mục `node_modules`, `build`, `dist`, `.expo`, `__pycache__` được sinh bởi công cụ; mã nguồn và lockfile được giữ để có thể dựng lại dự án.
