# Locket Gold & video 60 giây — v2.0.0 thử nghiệm

Script viết lại để sửa các lỗi cấu hình phát hiện trong [anhtu4n/locket30s](https://github.com/anhtu4n/locket30s), kiểm tra tại commit `7c9b967b86a402425dd5035879010f39c87e87bc` ngày 29/10/2026. Repo này chứa mã mới cho phần Gold, cấu hình video và 20 mẫu ghi chú tự viết; không sao chép toàn bộ bộ caption/filter của tác giả gốc. Giấy phép MIT ở đây áp dụng cho mã mới trong repo này.

**Đã kiểm thử bằng Node.js với response giả lập. Chưa kiểm thử trên iPhone hoặc tài khoản Locket thật.** Việc sửa response ở thiết bị không tạo thuê bao App Store, không cấp quyền Gold trên máy chủ và không bảo đảm upload video 60 giây thành công. Chưa xác định phiên bản Locket/iOS cụ thể tương thích.

## Nâng cấp v2.0.0

Người dùng đang dùng **Shadowrocket** và báo bản cũ quay được **15 giây**. Chưa có phiên bản Locket/iOS, log Firebase hay video mẫu từ thiết bị để xác định nguyên nhân giới hạn đó. Bản này đặt cấu hình mục tiêu 60 giây; chưa xác nhận 60 giây hoạt động trên thiết bị.

| Yêu cầu | Thay đổi trong module | Phần cần kiểm tra trên iPhone |
| --- | --- | --- |
| Quay 60 giây | Đồng bộ camera, các key thời lượng ở entries và `video_config` nếu có | Camera có tiếp tục sau 15 giây không |
| Up video thư viện | Bật cờ preview/import/upload; đồng bộ chọn và cắt về 60 giây | Có nút chọn video, chọn được đủ clip và gửi được không |
| Ghi chú mới | Bổ sung 20 mẫu mới và 12 loại ghi chú native nếu chưa có, giữ nội dung server | App có hỗ trợ renderer/từng loại ghi chú không |
| Quay có mic/âm thanh | Bật ba cờ âm thanh/microphone tham khảo từ mã cộng đồng | Quyền Microphone, audio session và bản Locket có thu âm không |
| Giữ tiếng video thư viện | Tắt cờ mute/strip đã có trong các object media được xử lý, giữ codec | File gốc có audio track và app có giữ track khi mã hoá/upload không |
| Cập nhật cache | URL script có `?v=2.0.0`; response đã sửa có `Cache-Control: no-store` khi runtime có headers | Shadowrocket tải script mới và Locket thực sự fetch Firebase chưa |

Không thay codec, bitrate, bucket/CDN hoặc giới hạn byte upload. Không chèn schema `video_config`/Android nếu server không cung cấp. Các cờ Remote Config là khả năng tương thích tham khảo từ module cộng đồng, không phải API chính thức do Locket công bố. Xem [phân tích và bằng chứng](docs/analysis-v2.md).

## Link nhập module

```text
https://raw.githubusercontent.com/Cuongqtx11/locket30s-fixed/main/locket60s.sgmodule
```

Repo công khai để Surge/Shadowrocket tải module và script qua URL raw mà không cần GitHub token.

## Cập nhật từ bản 30 giây trên Shadowrocket

1. Tắt module Locket cũ và các module khác bắt cùng RevenueCat/Firebase.
2. Cập nhật module bằng URL `locket60s.sgmodule` ở trên. URL cũ [locket30s.sgmodule](https://raw.githubusercontent.com/Cuongqtx11/locket30s-fixed/main/locket30s.sgmodule) vẫn được giữ và cũng trỏ tới v2.0.0. Chỉ bật một bản.
3. Kiểm tra tên module có **60s - v2.0.0** và script-path kết thúc bằng `locket.js?v=2.0.0`. Nếu Shadowrocket vẫn lưu script cũ, dùng chức năng cập nhật/tải lại script của app.
4. Giữ HTTPS Decryption/MITM và CA đã dùng. Tắt/bật lại kết nối Shadowrocket, đóng hẳn rồi mở Locket.
5. Kiểm tra log **`[locket30s-fixed] firebase: v2.0.0 config target=60s`**. Không có log này thì chưa xác nhận được phần cấu hình 60 giây đã chạy. Firebase có bộ nhớ đệm riêng; đổi module và mở lại app không bảo đảm app lập tức fetch cấu hình mới. Không gỡ Locket chỉ để thử cache.

Tiền tố log và tên repo `locket30s-fixed` được giữ để tương thích, không có nghĩa bản mới vẫn đặt 30 giây.

## Cài đặt

### Shadowrocket trên iOS

1. Tắt hoặc gỡ module Locket cũ và các rule RevenueCat trùng lặp.
2. Trong cấu hình đang dùng, mở phần **Modules**, thêm URL module ở trên rồi bật module. Tên mục có thể khác giữa các phiên bản.
3. Bật HTTPS Decryption/MITM. Nếu chưa có CA, tạo và cài CA từ Shadowrocket; vào iOS **Cài đặt → Cài đặt chung → Giới thiệu → Cài đặt tin cậy chứng nhận**, bật tin cậy đầy đủ cho CA vừa cài.
4. Bật kết nối Shadowrocket, đóng hẳn Locket rồi mở lại. Mở trang Gold/cài đặt để app phát sinh request cập nhật.
5. Xem log script có tiền tố `[locket30s-fixed]`. Log `local Gold response patched` xác nhận phần RevenueCat. Phần Firebase phải có `v2.0.0 config target=60s`; log này chứng minh script sửa response, vẫn cần kiểm tra quay và gửi trong app.

### Surge trên iOS

1. Thêm URL ở phần **Modules** của profile đang dùng và bật module.
2. Bật MITM, cài và tin cậy CA của Surge theo hướng dẫn của app.
3. Tắt các module/script cũ khớp cùng URL, đóng hẳn và mở lại Locket.

Chỉ cần MITM hai hostname trong module. Không sửa cấu hình hệ thống, upload/storage hay API hồ sơ. Không cài module này như một profile VPN hoàn chỉnh.

## Kiểm tra âm thanh và video thực tế

Trên iPhone, vào **Cài đặt → Quyền riêng tư & Bảo mật → Microphone**, bật Locket nếu app có trong danh sách; kiểm tra quyền Camera và Ảnh trong cài đặt ứng dụng. iOS yêu cầu app xin quyền truy cập phần cứng; script mạng không cấp thay quyền này. [Hướng dẫn Apple](https://support.apple.com/en-ie/guide/iphone/iph168c4bbd5/27/ios/27)

Thử theo thứ tự, ghi rõ lỗi xảy ra ở bước quay, chọn, xem trước hay gửi:

1. Quay 10 giây và nói một câu, nghe lại bản xem trước rồi gửi. Người nhận mở video và bật tiếng để đối chiếu.
2. Quay 20 giây, rồi 60 giây. Kiểm tra cả thời lượng trước khi gửi lẫn bản người nhận xem được.
3. Dùng clip 20 giây có tiếng từ Photos. Sau đó thử clip 60 giây. Nếu dùng clip dài hơn, kiểm tra cửa sổ cắt có cho chọn đủ 60 giây không.
4. Mở nhóm **Ghi chú mở rộng · 60s**. Chọn mẫu chữ trước, sau đó thử ghi chú native như nhạc/thăm dò/thời tiết; từng loại còn phụ thuộc hỗ trợ và quyền dữ liệu của app.

Video gốc im lặng hoặc đã bị xoá audio track không thể có lại tiếng chỉ bằng đổi Remote Config. Nếu preview có tiếng nhưng bản gửi mất tiếng, cần kiểm tra bước mã hoá/upload; module không chỉnh sửa dữ liệu MP4/MOV.

## Lỗi đã xác định trong cấu hình gốc

| Vấn đề | Bản sửa |
| --- | --- |
| Rule Firebase tải `Locket_anhtu4nn.js`, script chỉ xử lý RevenueCat | Handler Firebase riêng, cùng một script có phân nhánh theo URL |
| URL `deleteHeader.js` bên thứ ba trả HTTP 404 tại thời điểm kiểm tra | Xử lý header cache ngay trong repo, không phụ thuộc URL đó |
| Rule hồ sơ trỏ sang repo khác với repo được cung cấp | Loại bỏ rule hồ sơ; không tự gán badge cho hồ sơ khác |
| JSON lỗi, body rỗng hoặc response lỗi có thể làm script throw | Trả nguyên response và luôn gọi `$done` đúng một lần |
| Regex RevenueCat gốc bỏ sót URL có query/trailing slash | Kiểm thử cả hai dạng URL, giới hạn endpoint `/v1/receipts` và `/v1/subscribers/{id}` |
| Chỉ tìm User-Agent với tên header/chuỗi phân biệt hoa thường | Tìm không phân biệt hoa thường; có fallback khi response chứa mã sản phẩm bắt đầu bằng `locket_` |

Giữ các entry Firebase không liên quan, trộn các trường camera vào object cũ và giữ nguyên thuê bao Gold đang hoạt động. Các key video được tham khảo từ mã cộng đồng; chưa có bằng chứng mọi phiên bản Locket đều đọc các key này.

## Nếu vẫn không có tác dụng

- **Không có log script:** kiểm tra module đang bật, cấu hình đang được dùng, MITM/CA và rule trùng. Surge chỉ chạy http-response script khớp đầu tiên cho mỗi response: [tài liệu chính thức](https://manual.nssurge.com/scripting/http-response.html).
- **`skipped unrecognized app`:** request thiếu dấu hiệu nhận diện Locket; script giữ nguyên để tránh sửa dữ liệu của app khác dùng RevenueCat.
- **`skipped HTTP 304` / `missing entries (possibly NO_CHANGE)`:** dữ liệu có thể đang được cache. Đóng hẳn app, cập nhật module và kiểm tra rule request. Script không dựng cấu hình đầy đủ từ một response thiếu dữ liệu.
- **`skipped invalid JSON` / `unexpected ... schema`:** API có thể đổi. Cần mã trạng thái và cấu trúc JSON đã che thông tin cá nhân để đối chiếu.
- **Có log patched nhưng không lên Gold:** app có thể dùng cache nội bộ, schema khác hoặc kiểm tra quyền/chữ ký. RevenueCat có cơ chế [Trusted Entitlements](https://www.revenuecat.com/docs/customers/trusted-entitlements) để phát hiện response bị sửa; chưa xác định Locket đang bật cơ chế nào. Script này không tạo chữ ký máy chủ.
- **Chọn/quay được 60 giây nhưng gửi lỗi:** máy chủ có thể kiểm tra thời lượng, kích thước hoặc quyền tài khoản riêng. Cần kiểm tra lỗi upload trên thiết bị; chưa thể giải quyết chỉ từ mã repo.
- **Người khác không thấy badge Gold:** module chỉ thay đổi response phía thiết bị; không tạo badge Gold thật trong tài khoản.

Khi báo lỗi, cung cấp tên/phiên bản app proxy, Locket, iOS, log có tiền tố trên và bước lỗi cụ thể. Không đăng token, Authorization, receipt, số điện thoại, UID hoặc response nguyên bản lên GitHub.

## Kiểm thử

Yêu cầu Node.js 20 trở lên. Không cần cài dependency:

```bash
npm run check
npm test
```

Kiểm thử chạy script trong `node:vm` với globals tương tự Surge/Shadowrocket và kiểm tra trực tiếp regex, đường dẫn script trong module. 21 bài kiểm thử bao gồm routing RevenueCat/Firebase, dữ liệu lỗi, app khác, bảo toàn cấu hình, thời lượng giây/mili-giây, âm thanh, merge ghi chú, cache và số lần gọi `$done`. GitHub Actions chạy cùng lệnh khi push/PR. Đây là kiểm thử logic offline, không mô phỏng được giao diện, CA, cache SDK hoặc việc máy chủ chấp nhận upload.

## Tài liệu tham chiếu

- [Repo được kiểm tra](https://github.com/anhtu4n/locket30s/tree/7c9b967b86a402425dd5035879010f39c87e87bc).
- [Surge http-request scripting](https://manual.nssurge.com/scripting/http-request.html).
- [Surge http-response scripting](https://manual.nssurge.com/scripting/http-response.html).
- [RevenueCat CustomerInfo và cache](https://www.revenuecat.com/docs/customers/customer-info).

Không có token hoặc dữ liệu tài khoản thật trong source, fixtures hay log của dự án này.
