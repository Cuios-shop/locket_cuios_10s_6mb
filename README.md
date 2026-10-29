# Locket Gold & video 30 giây — bản sửa thử nghiệm

Script viết lại để sửa các lỗi cấu hình phát hiện trong [anhtu4n/locket30s](https://github.com/anhtu4n/locket30s), kiểm tra tại commit `7c9b967b86a402425dd5035879010f39c87e87bc` ngày 29/10/2026. Repo này chứa mã mới cho phần Gold và cấu hình video; không sao chép toàn bộ bộ caption/filter của tác giả gốc. Giấy phép MIT ở đây áp dụng cho mã mới trong repo này.

**Đã kiểm thử bằng Node.js với response giả lập. Chưa kiểm thử trên iPhone hoặc tài khoản Locket thật.** Việc sửa response ở thiết bị không tạo thuê bao App Store, không cấp quyền Gold trên máy chủ và không bảo đảm upload video 30 giây thành công. Chưa xác định phiên bản Locket/iOS cụ thể tương thích.

## Link nhập module

```text
https://raw.githubusercontent.com/Cuongqtx11/locket30s-fixed/main/locket30s.sgmodule
```

Repo công khai để Surge/Shadowrocket tải module và script qua URL raw mà không cần GitHub token.

## Cài đặt

### Shadowrocket trên iOS

1. Tắt hoặc gỡ module Locket cũ và các rule RevenueCat trùng lặp.
2. Trong cấu hình đang dùng, mở phần **Modules**, thêm URL module ở trên rồi bật module. Tên mục có thể khác giữa các phiên bản.
3. Bật HTTPS Decryption/MITM. Nếu chưa có CA, tạo và cài CA từ Shadowrocket; vào iOS **Cài đặt → Cài đặt chung → Giới thiệu → Cài đặt tin cậy chứng nhận**, bật tin cậy đầy đủ cho CA vừa cài.
4. Bật kết nối Shadowrocket, đóng hẳn Locket rồi mở lại. Mở trang Gold/cài đặt để app phát sinh request cập nhật.
5. Xem log script có tiền tố `[locket30s-fixed]`. Log `local Gold response patched` hoặc `local Gold/video configuration patched` chứng minh script đã sửa response; vẫn cần kiểm tra kết quả trong app.

### Surge trên iOS

1. Thêm URL ở phần **Modules** của profile đang dùng và bật module.
2. Bật MITM, cài và tin cậy CA của Surge theo hướng dẫn của app.
3. Tắt các module/script cũ khớp cùng URL, đóng hẳn và mở lại Locket.

Chỉ cần MITM hai hostname trong module. Không sửa cấu hình hệ thống, upload/storage hay API hồ sơ. Không cài module này như một profile VPN hoàn chỉnh.

## Lỗi đã xác định trong cấu hình gốc

| Vấn đề | Bản sửa |
| --- | --- |
| Rule Firebase tải `Locket_anhtu4nn.js`, script chỉ xử lý RevenueCat | Handler Firebase riêng, cùng một script có phân nhánh theo URL |
| URL `deleteHeader.js` bên thứ ba trả HTTP 404 tại thời điểm kiểm tra | Xử lý header cache ngay trong repo, không phụ thuộc URL đó |
| Rule hồ sơ trỏ sang repo khác với repo được cung cấp | Loại bỏ rule hồ sơ; không tự gán badge cho hồ sơ khác |
| JSON lỗi, body rỗng hoặc response lỗi có thể làm script throw | Trả nguyên response và luôn gọi `$done` đúng một lần |
| Regex RevenueCat gốc bỏ sót URL có query/trailing slash | Kiểm thử cả hai dạng URL, giới hạn endpoint `/v1/receipts` và `/v1/subscribers/{id}` |
| Chỉ tìm User-Agent với tên header/chuỗi phân biệt hoa thường | Tìm không phân biệt hoa thường; có fallback khi response chứa mã sản phẩm bắt đầu bằng `locket_` |

Giữ các entry Firebase không liên quan, trộn các trường camera vào object cũ và giữ nguyên thuê bao Gold đang hoạt động. Các key video sử dụng schema được tham khảo từ repo gốc; chưa có bằng chứng mọi phiên bản Locket đều đọc các key này.

## Nếu vẫn không có tác dụng

- **Không có log script:** kiểm tra module đang bật, cấu hình đang được dùng, MITM/CA và rule trùng. Surge chỉ chạy http-response script khớp đầu tiên cho mỗi response: [tài liệu chính thức](https://manual.nssurge.com/scripting/http-response.html).
- **`skipped unrecognized app`:** request thiếu dấu hiệu nhận diện Locket; script giữ nguyên để tránh sửa dữ liệu của app khác dùng RevenueCat.
- **`skipped HTTP 304` / `missing entries (possibly NO_CHANGE)`:** dữ liệu có thể đang được cache. Đóng hẳn app, cập nhật module và kiểm tra rule request. Script không dựng cấu hình đầy đủ từ một response thiếu dữ liệu.
- **`skipped invalid JSON` / `unexpected ... schema`:** API có thể đổi. Cần mã trạng thái và cấu trúc JSON đã che thông tin cá nhân để đối chiếu.
- **Có log patched nhưng không lên Gold:** app có thể dùng cache nội bộ, schema khác hoặc kiểm tra quyền/chữ ký. RevenueCat có cơ chế [Trusted Entitlements](https://www.revenuecat.com/docs/customers/trusted-entitlements) để phát hiện response bị sửa; chưa xác định Locket đang bật cơ chế nào. Script này không tạo chữ ký máy chủ.
- **Chọn/quay được 30 giây nhưng gửi lỗi:** máy chủ có thể kiểm tra thời lượng, kích thước hoặc quyền tài khoản riêng. Cần kiểm tra lỗi upload trên thiết bị; chưa thể giải quyết chỉ từ mã repo.
- **Người khác không thấy badge Gold:** module chỉ thay đổi response phía thiết bị; không tạo badge Gold thật trong tài khoản.

Khi báo lỗi, cung cấp tên/phiên bản app proxy, Locket, iOS, log có tiền tố trên và bước lỗi cụ thể. Không đăng token, Authorization, receipt, số điện thoại, UID hoặc response nguyên bản lên GitHub.

## Kiểm thử

Yêu cầu Node.js 20 trở lên. Không cần cài dependency:

```bash
npm run check
npm test
```

Kiểm thử chạy script trong `node:vm` với globals tương tự Surge/Shadowrocket và kiểm tra trực tiếp regex, đường dẫn script trong module. Bao gồm routing RevenueCat/Firebase, dữ liệu lỗi, app khác, bảo toàn cấu hình, cache và số lần gọi `$done`. GitHub Actions chạy cùng lệnh khi push/PR. Đây là kiểm thử logic offline, không mô phỏng được giao diện, CA, cache SDK hoặc việc máy chủ chấp nhận upload.

## Tài liệu tham chiếu

- [Repo được kiểm tra](https://github.com/anhtu4n/locket30s/tree/7c9b967b86a402425dd5035879010f39c87e87bc).
- [Surge http-request scripting](https://manual.nssurge.com/scripting/http-request.html).
- [Surge http-response scripting](https://manual.nssurge.com/scripting/http-response.html).
- [RevenueCat CustomerInfo và cache](https://www.revenuecat.com/docs/customers/customer-info).

Không có token hoặc dữ liệu tài khoản thật trong source, fixtures hay log của dự án này.
