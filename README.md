Ứng dụng dành riêng cho nội bộ hệ thống Katrina Coffee

---

## Thiết lập Sao lưu Dữ liệu Tự động (Quan trọng)

Để bảo vệ dữ liệu của bạn khỏi các sự cố không mong muốn, hệ thống đã được cấu hình để có thể tự động sao lưu toàn bộ cơ sở dữ liệu mỗi ngày.

Bạn cần thực hiện **2 bước** sau trong trang quản trị của Google Cloud và Firebase để kích hoạt tính năng này.

### Bước 1: Nâng cấp dự án Firebase lên gói trả phí (Blaze Plan)

Tính năng sao lưu tự động yêu cầu dự án của bạn phải ở gói "Blaze" (Pay-as-you-go). Chi phí cho việc sao lưu hàng ngày là rất thấp, nhưng đây là yêu cầu bắt buộc của Google.

1.  Truy cập vào **Firebase Console**: [https://console.firebase.google.com/](https://console.firebase.google.com/)
2.  Chọn dự án của bạn (tên dự án là **katrinaone**).
3.  Ở góc dưới cùng bên trái của menu, nhấp vào **Nâng cấp** (hoặc biểu tượng hình bánh răng cưa, chọn "Mức sử dụng và thanh toán").
4.  Chọn gói **Blaze** và làm theo hướng dẫn để thêm phương thức thanh toán.

### Bước 2: Kích hoạt "Cloud Datastore Admin API"

API này cho phép ứng dụng có quyền thực hiện việc sao lưu.

1.  Truy cập vào trang thư viện API của Google Cloud theo đường dẫn sau. Hãy đảm bảo bạn đã đăng nhập đúng tài khoản Google quản lý dự án Firebase.

    [**Link kích hoạt API Datastore Admin**](https://console.cloud.google.com/apis/library/datastore.googleapis.com)

2.  Trang web có thể yêu cầu bạn chọn một dự án. Hãy chọn dự án có ID là **katrinaone**.
3.  Nhấp vào nút **BẬT** (hoặc **ENABLE**).

---

Sau khi hoàn tất hai bước trên, hệ thống sẽ tự động sao lưu dữ liệu của bạn vào lúc **3 giờ sáng mỗi ngày** (giờ Việt Nam). Bạn có thể kiểm tra các bản sao lưu bằng cách truy cập **Firebase Console** -> **Storage** -> thư mục `backups`.