# Thay đổi

## 4.0.0 — profile thống nhất, chẩn đoán và xử lý revision

- Nhận diện bundle ID, thêm host dự phòng RevenueCat chính thức, chẩn đoán route chưa hỗ trợ.
- ETag theo nội dung Firebase đã sửa, giữ metadata và state UPDATE; không tạo/replay cấu hình thiếu entries.
- Một runtime có tên chứa hash cho toàn bộ rule; một profile 60s/100 MiB/54 ghi chú và một variant giữ khung server.
- Trang trạng thái/report cục bộ, lưu riêng từng service; redaction, lỗi storage và freshness rõ ràng.
- Giữ nội dung mic/media/54 ghi chú/nền/khung của nhánh trước; 39 kiểm thử offline.
- Chưa xác nhận ổn định trên iPhone. Cần báo cáo từ thiết bị để xác định lỗi thực tế còn lại.

Các repo nguồn giữ nguyên. Tên repo stable không phải chứng nhận mọi chức năng native đã hoạt động.
