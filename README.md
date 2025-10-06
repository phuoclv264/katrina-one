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

## Làm thế nào để kiểm tra?

Sau khi hoàn tất hai bước trên, hệ thống sẽ tự động sao lưu dữ liệu của bạn vào lúc **3 giờ sáng mỗi ngày** (giờ Việt Nam). Bạn có thể kiểm tra hoạt động của tính năng này bằng 2 cách sau:

### 1. Kiểm tra File sao lưu trong Storage

Đây là cách đơn giản nhất. Sau 3 giờ sáng, bạn có thể vào và kiểm tra xem có bản sao lưu mới được tạo ra không.

1.  Truy cập **Firebase Console** -> **Storage**.
2.  Bạn sẽ thấy một thư mục có tên `backups`.
3.  Bên trong thư mục này, bạn sẽ thấy các thư mục con được đặt tên theo ngày tháng (ví dụ: `2024-07-28`). Sự tồn tại của thư mục với ngày hiện tại chứng tỏ việc sao lưu đã diễn ra.

### 2. Kiểm tra Nhật ký (Logs) của Cloud Function

Đây là cách kiểm tra chi tiết và chính xác nhất, giúp bạn biết được hàm sao lưu đã chạy thành công hay gặp lỗi.

1.  Truy cập **Firebase Console**.
2.  Từ menu bên trái, chọn **Functions** (biểu tượng fx).
3.  Chuyển đến tab **Nhật ký** (Logs).
4.  Bạn có thể lọc theo tên hàm là `backupFirestore`.
    *   Nếu bạn thấy các log màu xanh lá với nội dung như `Starting Firestore backup...` và `Backup operation completed...` thì chức năng đã hoạt động thành công.
    *   Nếu bạn thấy các log màu đỏ với thông báo lỗi, điều đó có nghĩa là có sự cố đã xảy ra (ví dụ: chưa bật API, lỗi quyền...).