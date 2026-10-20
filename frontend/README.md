# DOCTIS Web

Website React cho bệnh nhân, bác sĩ và admin. API Express nằm trong `../backend`; cấu trúc toàn bộ dự án ở [README gốc](../README.md).

## Lệnh chạy

Chạy trong thư mục `frontend`:

```powershell
npm install
npm start
```

`npm start` mở development server; địa chỉ/cổng được in trong terminal. API local mặc định là `http://localhost:5000/api`; có thể đặt `REACT_APP_API_URL` trong cấu hình môi trường frontend.

```powershell
npm run build
node serve_build.js
```

Build nằm ở `frontend/build`. Máy chủ xem build mặc định tại `http://127.0.0.1:3000`; có thể đặt `HOST` và `PORT`. Biến API của bản build được lấy lúc build. Khi chạy trên Vercel, dùng `REACT_APP_API_URL` của API production.

## Tài liệu liên quan

- [Triển khai Vercel](../VERCEL_DEPLOY.md)
- [UI và hướng dẫn kiểm tra thủ công](UI_REVIEW.md)
- [Luồng đăng ký và điều phối](../docs/PUBLIC_WORKFLOW.md)

Các file `*.test.jsx` và `*.test.js` là kiểm thử hồi quy của dự án. Ảnh review, log và thư mục build không thuộc mã nguồn phát hành.
