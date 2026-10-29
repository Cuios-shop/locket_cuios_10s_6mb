# Cuios • Profile thống nhất v4.0.0

Repo mới **locket_cuios_stable**, kế thừa mã và 54 mẫu ghi chú từ locket60s_amthanh_mic. Các repo cũ không thay đổi. Tên repo không phải cam kết đã kiểm chứng mọi chức năng trên iPhone; đây là bản sửa luồng cấu hình và có công cụ để kiểm chứng trên thiết bị.

**Mục tiêu giữ nguyên:** quay 60s có mic/âm thanh, nhập video có tiếng 60s/100 MiB, 4 ghi chú thương hiệu + 50 mẫu mới, nền riêng và khung Aura trên widget gốc. **Chưa xác nhận các mục tiêu này hoạt động ổn định mỗi lần bật trên máy người dùng.**

## Cài một lần, kiểm tra cùng một profile

Tắt mọi module Locket khác trong cấu hình đang dùng. Không cần xoá Locket, xoá dữ liệu hoặc reset quyền riêng tư.

```text
https://raw.githubusercontent.com/Cuongqtx11/locket_cuios_stable/main/locket_cuios_stable.sgmodule
```

1. Nhập module, giữ HTTPS Decryption/MITM và CA đã tin cậy. Bật kết nối Shadowrocket trước khi mở Locket.
2. Trong Safari, nhập **đầy đủ `http://`** để mở trang cục bộ sau, khi Shadowrocket đang kết nối:

```text
http://cuios-status.invalid/status
```

3. Trang hiện v4.0.0 chứng minh runtime mới đã được proxy tải và thực thi. Bấm hai nút **Kiểm tra HTTPS** RevenueCat/Firebase; chỉ trang mang chữ **Cuios · HTTPS check v4.0.0** là kết quả hook thành công. Trang 404/Google hoặc lỗi chứng chỉ không phải thành công. Kết quả trình duyệt được ghi riêng, chưa chứng minh Locket đã gửi request cấu hình.
4. Mở Locket, vào camera/cài đặt/Gold rồi quay lại trang trạng thái, chọn **Tải lại trạng thái**. So sánh thời gian RevenueCat và Firebase.
5. Nếu Firebase đã sửa response, kiểm tra trong app. App có thể chỉ activate ở lần mở sau. Nếu thời gian request không đổi, đóng/mở liên tục không chứng minh đã fetch mới.
6. Khi vẫn lỗi, mở **Xem báo cáo chẩn đoán** và gửi nội dung đó để đối chiếu. Báo cáo không lưu token, UID, header hoặc response tài khoản đầy đủ.

`.invalid` là địa chỉ trang mock trong script, không phải website công khai. Nó được trả lời cục bộ bởi hook http-request, không cần DNS/server bên ngoài. Không đổi URL thành https. Cơ chế mock cần được Shadowrocket thực thi; chưa thử trên iPhone ở môi trường này. Nếu trang không mở, báo rõ lỗi trang thay vì tiếp tục xoá/cài app.

Bản [giữ khung server](https://raw.githubusercontent.com/Cuongqtx11/locket_cuios_stable/main/locket_cuios_no_widget.sgmodule) có cùng xử lý video/mic/ghi chú, chỉ không chèn khung Aura. Chỉ chọn một trong hai module.

## Đọc trạng thái

| Trạng thái | Ý nghĩa thực tế | Việc cần đối chiếu |
| --- | --- | --- |
| Trang trạng thái không mở | Chưa xác nhận hook/runtime hoạt động | Cấu hình đang chọn, tải script, kết nối proxy |
| Chưa thấy request | Script chưa quan sát được app gọi endpoint | MITM, rule trùng, app cache, routing |
| Chỉ thấy request, chưa có response mới | Hook request đã chạy | Request có lỗi hoặc response bị rule khác xử lý không |
| Đã sửa response | Profile mục tiêu đã gửi về app | Native activate, renderer, mic/picker và server upload |
| Sửa một phần / partial | Có object media không khớp schema | warnings và inputMediaFields trong báo cáo |
| no_entries | Server không trả cấu hình đầy đủ | Không dựng cấu hình giả hoặc replay dữ liệu tài khoản cũ |
| http_error / unsupported format | API lỗi hoặc body chưa hỗ trợ | Mã HTTP, endpoint/runtime tương ứng |
| unhandled_project_or_namespace | Thấy request nhận diện Locket ngoài project/namespace hỗ trợ | Cần xác định route thật trước khi sửa |

Quan sát cũ hơn 5 phút được đánh dấu rõ. Chưa có record khi kho chẩn đoán hỏng không được coi là bằng chứng app không gửi request. Các trạng thái kỹ thuật không tự xác nhận chức năng đã hoạt động trên máy.

## Những thay đổi có căn cứ trong v4

- Nhận diện Locket bằng **X-Client-Bundle-ID / X-Ios-Bundle-Identifier**, bên cạnh User-Agent và mã sản phẩm trong response. Header bundle mâu thuẫn sẽ không bị UA ghi đè.
- Hỗ trợ ba host RevenueCat được SDK/tài liệu chính thức sử dụng; vẫn chỉ sửa receipts/subscriber v1. Các route khác được chẩn đoán và trả nguyên dữ liệu.
- Bỏ conditional-cache header trên request đã nhận diện; không đổi Authorization, nonce, body upload hoặc dữ liệu video.
- Firebase trả state UPDATE cho cấu hình hợp lệ đã sửa, và **ETag theo toàn bộ nội dung cấu hình đã sửa**, gồm metadata. Cùng nội dung giữ cùng ETag; nội dung/theme khác có revision khác.
- Một profile 60s/100 MiB/54 ghi chú dùng một runtime độc lập, URL chứa SHA-256 rút gọn. Tất cả rule trỏ đúng cùng file; release.json lưu hash đầy đủ để kiểm tra.
- Chẩn đoán cục bộ tách key RevenueCat/Firebase và hai phép kiểm tra HTTPS từ trình duyệt, tránh các script chạy song song ghi đè trạng thái nhau. Không lưu/replay response có thông tin tài khoản.

Firebase có fetched config và active config riêng. **Proxy không thể ép app gọi fetch/activate hoặc xin quyền microphone nếu native không làm.** ETag mới sửa được một lớp giao thức khi có fetch; không vượt qua minimumFetchInterval của SDK hoặc giới hạn máy chủ. Xem [phân tích, nguồn và mức độ chắc chắn](docs/ANALYSIS-v4.md).

## Nội dung và giới hạn tính năng

- 60 giây và 104857600 bytes là cấu hình mục tiêu, không chứng minh picker/encoder/server chấp nhận file đó. Không thay codec, bitrate hoặc storage bucket.
- Giữ các cờ mic/thư viện của nhánh trước, không coi tên cờ cộng đồng là API Locket chính thức. Báo cáo tên/kiểu field media giúp đối chiếu khi app dùng schema khác.
- 54 ghi chú: bốn mẫu đầu là **mua chứng chỉ Cuios.shop**, **Bản quyền Cuios**, **Cưn🍤**, **tom11th5**; sau đó 50 mẫu trong năm nhóm. Ghi chú đã đăng không bị sửa.
- 11 nền tự thiết kế và khung Aura dùng PNG từ repo mới. Khung là hiệu ứng hình ảnh tĩnh; không ép WidgetKit reload/animate.
- Có chữ ký RevenueCat được ghi nhận bằng một boolean. Script không tạo chữ ký hợp lệ thay máy chủ; app có thể từ chối response đã sửa.

![54 mẫu ghi chú](assets/captions-preview.jpg)

## Kiểm thử

Node.js 20 trở lên, không cần dependency:

```bash
npm run check
npm test
```

40 test logic: hồi quy Gold/media/54 ghi chú, nhận diện thiếu UA/bundle mâu thuẫn, host dự phòng, validator ổn định/đổi nội dung/metadata, mô hình fetched-active của SDK, NO_CHANGE, trạng thái cục bộ, lỗi/kho lưu trữ và dữ liệu chẩn đoán không chứa giá trị riêng.

Các test không thay thế kiểm tra mic/picker/upload trên iPhone. Để xác nhận trên máy cần test clip 10/20/60 giây có tiếng trước/sau gửi, file lớn hơn 6 MB, ghi chú và widget, rồi đối chiếu báo cáo cùng thời điểm.

## Dựng bản phát hành

```bash
python3 tools/build_script.py
python3 tools/build_modules.py
npm test
```

build_modules tạo runtime content-addressed trong scripts/releases và module trỏ tới đúng artifact. Không sửa đè artifact đã phát hành. Khi đổi logic hoặc artwork, tăng version, dựng lại và kiểm tra. Artwork dựng bằng tools/build_artwork.py (chỉ bước authoring cần Pillow).

Mã kế thừa MIT. Các ghi chép v2/v3 trong docs là lịch sử; tài liệu hiện tại là README và ANALYSIS-v4.md.
