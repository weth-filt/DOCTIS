# DOCTIS Mobile

Ứng dụng bệnh nhân DOCTIS viết bằng Expo / React Native. Ứng dụng dùng API hiện có; thông tin đăng nhập và dữ liệu vẫn do backend quản lý.

## Dùng thử với Expo Go

1. Cài Expo Go trên iPhone.
2. Trong thư mục này, chạy `npm install`, sau đó `npm start`.
3. Kết nối iPhone và máy tính cùng Wi-Fi, quét mã QR trong terminal bằng Camera iPhone rồi mở bằng Expo Go.

Mã QR Expo Go chỉ dành cho phát triển và máy chủ cần đang chạy trên máy tính.

## Xuất bản web/PWA lên Vercel

Bản web được build thành thư mục tĩnh `dist` bằng `npm run build:web`. Để triển khai thành một dự án Vercel riêng:

1. Import repository hiện có vào Vercel và đặt **Root Directory** là `mobile`.
2. Đặt **Build Command** là `npm run build:web` và **Output Directory** là `dist`.
3. Deploy. Vercel cấp URL HTTPS công khai; mã QR dùng URL này để người dùng mở DOCTIS và đăng nhập.
4. Trên iPhone, mở URL bằng Safari → Chia sẻ → Thêm vào Màn hình chính để có biểu tượng và chế độ hiển thị như app.

Trang chia sẻ công khai có mã QR, nút mở app, tải QR và chia sẻ link tại `https://doctis-mobile.vercel.app/qr`.

Ứng dụng gọi API mặc định tại `https://doctis.vercel.app/api`. Nếu deploy API ở địa chỉ khác, đặt biến `EXPO_PUBLIC_API_URL` trong Vercel trước khi build. Nếu API đang giới hạn CORS bằng `ALLOWED_ORIGINS`, thêm chính xác domain production của app mobile vào biến này ở dự án backend rồi redeploy backend.

Bản PWA chạy qua trình duyệt và có thể ghim vào màn hình chính; để phân phối ứng dụng iOS native cài đặt trực tiếp, cần build và phân phối qua Apple TestFlight/App Store.

## Giao diện Nhịp chăm sóc

Ứng dụng dùng Lora/Manrope tiếng Việt được đóng gói cùng app, đồ họa SVG và React Native Animated. Bố cục ưu tiên điện thoại, giới hạn chiều rộng 600 px trên màn hình lớn. Chế độ giảm chuyển động theo cài đặt hệ thống hoặc trình duyệt.

Xem [design system và motion spec](DESIGN_SYSTEM.md) để biết palette, bố cục từng màn, asset, trạng thái triển khai và giới hạn xác nhận trên thiết bị.
