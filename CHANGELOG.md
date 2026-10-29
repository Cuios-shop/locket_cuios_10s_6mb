# Thay đổi

## 2.1.0

- Giữ phần quay 60 giây mà người dùng đã xác nhận hoạt động trên Shadowrocket.
- Bổ sung đăng ký ID ghi chú remote vào danh sách dynamic captions, giữ nhóm và tránh trùng ID.
- Bổ sung cờ tương thích media/mic và log chẩn đoán cấu trúc/flag trước khi patch, không in dữ liệu riêng.
- Thêm khung Gold PNG tự tạo trong biến thể module tuỳ chọn; không bật khung sự kiện ở module thường.
- 25 kiểm thử logic offline; chưa xác nhận sửa được mic, tiếng video, video thư viện hay ghi chú trên bản App Store của người dùng.

## 2.0.0

- Cấu hình thử nghiệm 60 giây đồng bộ cho quay, nhập, cắt và các key thời lượng được hỗ trợ.
- Bổ sung feature gates và cờ thư viện video, mic/âm thanh; xử lý các cờ mute/strip có sẵn trong object media.
- Thêm 20 ghi chú tự viết và các loại native còn thiếu, giữ nội dung server và tránh ID trùng.
- Thêm URL `locket60s.sgmodule`; giữ URL cũ; thêm version query vào URL script và phiên bản trong log.
- Bổ sung xử lý HTTP cache cho response đã sửa, kiểm thử và tài liệu chẩn đoán trên Shadowrocket.
- Kiểm thử offline; chưa xác nhận quay/gửi 60 giây có tiếng trên iPhone thật.

## 1.0.0

- Sửa routing RevenueCat/Firebase, dependency 404, header cache và xử lý dữ liệu lỗi.
- 14 bài kiểm thử offline; cấu hình mục tiêu 30 giây. Người dùng báo quay được 15 giây trên Shadowrocket.
