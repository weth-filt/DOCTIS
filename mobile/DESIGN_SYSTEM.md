# DOCTIS Mobile — Nhịp chăm sóc

## 1. Hướng thiết kế

Một không gian chăm sóc riêng, ấm và rõ ràng: nền ngà, xanh rừng pha teal,
xanh lá non, sắc đào; chữ Lora ở lời chào và tiêu đề, Manrope ở biểu mẫu và
số liệu. Cả hai font có tiếng Việt, được đóng gói cùng ứng dụng.

Hai kỹ thuật tạo chiều sâu: **ceramic mềm** cho linh vật/biểu tượng tim và
**bề mặt kính nhẹ** trong hero. Dữ liệu và biểu mẫu vẫn là bề mặt phẳng.
Ánh sáng đến từ phía trên trái; bóng mờ nằm dưới, không dùng viền phát sáng
quanh dữ liệu y tế. Đồ họa gốc được dựng bằng SVG, không tải mô hình 3D.

### Chuyển thể tham khảo

| Kỹ thuật | Cách dùng trong DOCTIS |
| --- | --- |
| Rèm/cánh cửa | Hai mảng teal tách ở lần mở ứng dụng, tối đa khoảng 1,05 giây; có Bỏ qua. Không đợi API/font mới cho vào app. |
| Chữ hiện lần lượt | “Xin chào,” hiện từng ký tự; tên người dùng hiện mềm ngay sau đó. |
| Thẻ kính, số chuyển động | Hero có nền mờ, đổi giữa huyết áp, đường huyết, cân nặng; số chuyển mềm khi dữ liệu đổi. |
| Đổi ngữ cảnh | Đổi nền hero, nhãn, giá trị và đơn vị cùng lúc; BMI vẫn xuất hiện riêng. |
| Sunburst và vật thể nổi | Tim trên vật thể ceramic, vòng sáng/tia sáng; cùng hệ hình cho linh vật AI và empty state. |
| Pagination | Nội dung đồng hành có 3 trang, số trang và nút chấm có vùng chạm 44 px. |
| Hero theo nhịp chậm | Nội dung đồng hành đổi sau 6 giây khi ứng dụng đang mở; có thể chọn trang thủ công. |
| Editorial stagger | Các lối tắt xuất hiện cách nhau 50 ms, có thứ bậc icon → tên → mô tả. |
| Chuyển cảnh | Fade + dịch 12 px trong 300 ms; không phủ rèm lên màn đọc/nhập số liệu. |
| Hạt sáng | Chấm sáng nhỏ tích hợp vào SVG, đi cùng nhịp trôi của linh vật. Không có particle engine. |

## 2. Design tokens

Nguồn triển khai: `ui/design.js`, `ui/styles.js`.

| Token | Giá trị |
| --- | --- |
| Ink | `#183E40` |
| Nội dung phụ | `#57706E` |
| Teal / hành động chính | `#087E80` |
| Hero | `#103F40` → `#1D5955` |
| Nền ứng dụng | `#F7F8F2` |
| Nền khung desktop | `#E6EBE0` |
| Mint | `#DDF1E9` |
| Lime trang trí | `#DDF2AB` |
| Peach | `#F9E9DA` |
| Viền | `#DCE6DF` |
| Lỗi | `#AD3E4A` |
| Display | Lora Medium, 27–34 px |
| Nội dung | Manrope Regular/Medium/Bold, 14–18 px |
| Số liệu nổi bật | Manrope Bold, 28–43 px, tabular numbers |
| Khoảng cách | 4 / 8 / 12 / 16 / 20 / 24 / 32 |
| Bo góc | Input 15; nút 16; thẻ 20–25; hero 28 |
| Shadow thẻ | y=3, blur=8, opacity=.03 |
| Shadow hero | y=10, blur=18, opacity=.16 |
| Shadow dock | y=4, blur=18, opacity=.10 |
| Vùng chạm | Ít nhất 44 px; nút chính 52 px |
| Chiều rộng | Mobile toàn màn hình; tối đa 600 px trên tablet/desktop |

Mục tiêu tương phản AA: chữ đậm/màu phụ trên nền ngà hoặc trắng; chữ sáng
trên hero teal. Placeholder dùng màu phụ, không dùng xám quá nhạt. Trạng thái
có nhãn chữ; không chỉ dựa vào màu. Chưa có chứng nhận audit WCAG trên thiết bị.

## 3. Các màn hình đã triển khai

### Mở app và xác thực

- Splash ceramic + tên DOCTIS, hai cánh mở, Bỏ qua; chạy một lần mỗi lần app mount.
- Đăng nhập/đăng ký dùng cùng font, khoảng cách, nút và khung trường nhập.
- Địa chỉ đăng ký, tìm/chọn phường và các trạng thái lỗi/tải lại giữ nguyên.
- Khôi phục phiên đăng nhập trước, dữ liệu được tải tiếp ở workspace.

### Trang chủ

- Ngày hiện tại → lời chào serif → tên người dùng.
- Hero chuyển 3 chỉ số, thời điểm lần đo; BMI có hàng riêng.
- Bốn lối tắt thành lưới 2×2; tên ngắn, mô tả dễ đọc.
- Thẻ DOCTIS AI có linh vật và hành động trực tiếp.
- Thẻ tổng hợp vẫn hiển thị glucose, huyết áp, nhịp tim, cân nặng thật.
- Nội dung đồng hành có 3 trang liên kết đến tính năng tương ứng.
- Bệnh nền, dị ứng và nội dung tham khảo vẫn được giữ.

### Chỉ số sức khỏe

- Thẻ chỉ số 2×2, giá trị và đơn vị tách dòng, đánh giá từ API dùng nhãn rõ.
- Form một cột trên điện thoại; nhãn không bị ép nhỏ để vừa hai cột.
- Trường focus chỉ đổi màu viền, không thêm khung input thứ hai.
- Lưu thành công hiện thông báo có dấu tích, rung nhẹ trên native.
- Giữ lịch sử 8 lần đo gần đây; không tạo biểu đồ hoặc trạng thái sức khỏe giả.

### Kế hoạch chăm sóc

- Thẻ nguồn kế hoạch, thời điểm và ghi chú bác sĩ.
- Thanh ngày vuốt ngang với số việc, tỷ lệ hoàn thành thật.
- Ngày chọn nền teal; tên/ngày/tỷ lệ đổi sang chữ sáng.
- Chi tiết hoạt động có hàng giờ/icon/nội dung; nhóm Nhắc email/Đánh dấu xong
  nằm ở hàng riêng để không bóp nhỏ chữ.
- Giữ toàn bộ đơn thuốc, liều dùng, tần suất và thời gian uống.

### Lịch hẹn

- Tóm tắt số lịch đang theo dõi từ dữ liệu thực.
- Mỗi lịch là một thẻ riêng: ô ngày/tháng, loại khám, giờ, trạng thái và ngày đầy đủ.
- Chạm mở chi tiết bác sĩ/ghi chú/hủy, có nhãn expanded cho screen reader.
- Không phát hiệu ứng “thành công” chỉ vì vừa tải một lịch đã xác nhận.

### Hồ sơ

- Identity có avatar ceramic, tên/email.
- Chạm avatar hoặc Thêm/Đổi ảnh đại diện để chọn ảnh; có xem trước, Lưu ảnh và Bỏ chọn. Ảnh được cắt vuông, chuyển JPEG tối đa512×512 và lưu riêng qua `PUT /profile` với trường `avatar`. Ảnh đã lưu xuất hiện ở header và được lấy lại từ API sau khi đăng nhập. Không đưa dữ liệu ảnh vào SecureStore.
- Phân nhóm trong cùng khung: cá nhân, y tế, liên hệ khẩn cấp, địa chỉ phục vụ.
- Giữ chỉnh sửa/lưu/hủy/đăng xuất và hướng dẫn cập nhật địa chỉ đồng bộ qua web.
- Hồ sơ không có nút AI nổi hoặc khung lời mời che thông tin; truy cập AI từ thẻ ở trang chủ.

### DOCTIS AI và nhắn bác sĩ

- AI có linh vật riêng, tiêu đề rõ, gợi ý điền nội dung, trạng thái đang trả lời,
  bong bóng hội thoại và thanh soạn tin.
- Chiều cao vùng chat AI theo viewport, có giới hạn để không tạo khoảng trắng lớn.
- Giữ gửi tin AI, chọn bác sĩ, polling chat, chọn ảnh/tệp, mở/lưu và gửi tệp.
- Thẻ tệp của bác sĩ có preview, tên/size và nút riêng; không ép mọi thứ vào một hàng.
- Dock năm mục luôn có nhãn; indicator trượt và tab Chăm sóc được nhấn nhẹ ở giữa.

## 4. Motion spec

| Trigger / thành phần | Chuyển động | Thời lượng / easing | Mục đích |
| --- | --- | --- | --- |
| App mount / splash | Cánh mở + logo fade | 450 ms giữ + 600 ms, cubic in/out | Nhận diện nhanh |
| Bỏ qua | Gỡ overlay ngay | 0 ms | Không cản thao tác |
| Lời chào | Opacity từng ký tự | 650 ms, quad out | Cảm giác cá nhân |
| Đổi màn | Fade + y:12→0 | 300 ms, cubic out | Định hướng |
| Nút/thẻ tương tác | Scale 1→.96→1 | 140 ms mỗi lượt, quad out | Phản hồi chạm |
| Nút chính, chọn tab/ngày | Haptic selection native | Phản hồi hệ điều hành | Xác nhận thao tác |
| Đổi tab | Indicator trượt | Spring stiffness260/damping26/mass.8 | Giữ vị trí điều hướng |
| Đổi ngữ cảnh hero | Nền và dữ liệu đổi; nội dung fade/slide | 300 ms | Phân biệt loại chỉ số |
| Số liệu thay đổi | Nội suy số, làm tròn theo giá trị | 550 ms, cubic out | Thấy dữ liệu được cập nhật |
| Lối tắt/lịch hẹn vào màn | Stagger 50 ms | Reveal300 ms, tối đa delay200 ms | Thứ bậc đọc |
| Linh vật trang chủ/AI | Y:0↔−5 | 2.4 giây mỗi chiều, sine in/out | Nhịp thở nhẹ |
| Nội dung đồng hành | Đổi trang + reveal | Sau6 giây, reveal300 ms | Đưa ra lối đi hữu ích |
| Tải dữ liệu | Skeleton opacity .45↔.9 | 750 ms mỗi chiều | Không nhầm chưa tải với không có dữ liệu |
| Kéo làm mới | RefreshControl của nền tảng | Hệ điều hành | Dữ liệu mới theo yêu cầu |
| Lưu lần đo thành công | Dấu tích + thông báo + haptic success native | Thông báo giữ đến khi đóng | Xác nhận API thành công |
| Chọn ngày chăm sóc | Reveal phần chi tiết | 300 ms, cubic out | Đổi ngữ cảnh rõ |
| Mở lịch hẹn | Reveal chi tiết | 300 ms, cubic out | Bớt tải thông tin ban đầu |
| AI chờ phản hồi | ActivityIndicator + nhãn trạng thái | Trong lúc request chạy | Không giả lập câu trả lời |
| Focus input | Đổi màu viền, không đổi kích thước | Ngay | Tránh xô lệch biểu mẫu |
| Reduce Motion | Fade100 ms; không scale, trôi hoặc tự đổi trang | Theo AccessibilityInfo/matchMedia | Giảm kích thích |

Các loop trang trí/skeleton và chuyển nội dung tự động dừng khi ứng dụng ở nền.
Màn chỉ số/hồ sơ không có particle, parallax hay rèm chuyển cảnh.

## 5. Asset và prompt phát triển tiếp

Hiện đã dùng SVG gốc cho tim ceramic, linh vật AI, vòng sunburst, chấm sáng
và icon line. Không cần WebGL, Rive runtime hoặc video. Bốn file font đang
dùng có kích thước khoảng97–134 KB/file. Không phát sinh yêu cầu tải font từ Google.

Các prompt dưới đây dành cho những phiên bản art tiếp theo, chưa phải asset
bitmap/3D đã được tạo trong đợt này:

| Asset | Prompt |
| --- | --- |
| Tim / thương hiệu | “Soft ceramic heart on a rounded mint medical tile, muted coral heart, ivory ECG inset, top-left studio light, forest-teal environment, subtle lime sunburst, isolated transparent background, no text, no clinical claim.” |
| Linh vật AI | “Friendly small ceramic health companion, rounded ivory body, deep-teal face panel, two warm lime eyes, delicate smile, mint antenna, three-quarter view, soft upper-left light, no text, transparent background.” |
| Huyết áp | “Compact ceramic blood pressure monitor, ivory shell, teal screen with no numbers, mint cuff, clean medical silhouette, soft glossy edges, upper-left light, transparent background.” |
| Đường huyết | “Small rounded glucose meter, ivory ceramic, muted teal display with no readings, single coral droplet detail, friendly clinical object, no text, transparent background.” |
| Cân nặng | “Minimal rounded weighing scale in mint and ivory ceramic, no numbers, upper-left lighting, understated depth, transparent background.” |
| Lịch khám | “Ivory clay calendar with teal binding and single lime check, no letters or dates, warm soft shadow, transparent background.” |
| Hồ sơ | “Rounded ivory health record folder with teal profile silhouette and mint tabs, soft ceramic treatment, no text, transparent background.” |
| Empty state | “Small folded medical record tile beside a soft mint heart, calm ivory ceramic, no warning symbols, top-left light, transparent background.” |
| Rive/Lottie thành công | “One lime ring resolving to a teal check, two faint floating light dots, 500 ms once, no loop, transparent background, reduced-motion final frame.” |

Nếu bổ sung bitmap/animation: mỗi asset dưới200 KB; có khung tĩnh; không
thêm hiệu ứng vào màn số liệu. Không cần particle engine để nhận diện thương hiệu.

## 6. Lộ trình và giới hạn xác nhận

**Đã triển khai:** toàn bộ màn hiện có, design system, đồ họa SVG, fonts,
splash, dock, motion, trạng thái tải, accessibility labels/focus/Reduce Motion.

**Hoàn thiện sau vòng xem trên thiết bị thật:** đối chiếu390×844, Dynamic Type,
bàn phím iOS/Android, VoiceOver/TalkBack, độ mượt trên máy cấu hình thấp; tinh
chỉnh theo ảnh thật. Chỉ cân nhắc icon morph, shared-element, art Rive và haptic
nâng cao sau khi đo trên thiết bị; các hiệu ứng đó chưa được mô tả là đã làm.

**Xác nhận trong phiên:** Expo web export thành công. Công cụ browser trả về
inventory rỗng và `Browser is not available: iab`, nên chưa kiểm tra trực quan
trong trình duyệt hoặc trên iOS/Android. Build không thay thế kiểm tra trực quan.
