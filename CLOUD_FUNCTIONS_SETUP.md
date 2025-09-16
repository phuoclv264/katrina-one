# Hướng dẫn Thiết lập Tác vụ Tự động (Cron Job)

Tài liệu này hướng dẫn cách thiết lập một tác vụ tự động (cron job) để gọi đến API endpoint vừa được tạo, nhằm mục đích dọn dẹp các yêu cầu pass ca đã hết hạn.

Chúng ta sẽ sử dụng **Google Cloud Scheduler** để thực hiện việc này.

## Bước 1: Lấy URL của API Endpoint

Sau khi bạn đã deploy (triển khai) ứng dụng của mình lên Firebase App Hosting, API endpoint của bạn sẽ có dạng sau:

`https://<YOUR_PROJECT_ID>.web.app/api/cron`

Thay thế `<YOUR_PROJECT_ID>` bằng ID dự án Firebase của bạn.

## Bước 2: Tạo một "Secret" để bảo vệ Endpoint (Tuỳ chọn nhưng khuyến khích)

Để đảm bảo chỉ có Cloud Scheduler mới có thể gọi endpoint của bạn, chúng ta nên dùng một chuỗi bí mật (secret).

1.  Mở file `.env` trong dự án của bạn.
2.  Thêm một dòng mới:
    ```
    CRON_SECRET="MOT_CHUOI_BI_MAT_NGAY_LAP_TUC"
    ```
    Hãy thay `"MOT_CHUOI_BI_MAT_NGAY_LAP_TUC"` bằng một chuỗi ký tự ngẫu nhiên, phức tạp của riêng bạn.
3.  Lưu file và **deploy lại ứng dụng** để cập nhật biến môi trường.

## Bước 3: Thiết lập Cloud Scheduler trên Google Cloud Console

1.  **Mở Google Cloud Console:**
    *   Truy cập [https://console.cloud.google.com/](https://console.cloud.google.com/)
    *   Đảm bảo bạn đã chọn đúng dự án Google Cloud tương ứng với dự án Firebase của bạn.

2.  **Đi đến Cloud Scheduler:**
    *   Sử dụng thanh tìm kiếm ở trên cùng, gõ "Cloud Scheduler" và chọn kết quả tương ứng.
    *   Nếu đây là lần đầu tiên bạn sử dụng, bạn có thể cần phải nhấn nút **"Enable API"**.

3.  **Tạo một Job mới:**
    *   Nhấn vào nút **"+ CREATE JOB"**.
    *   **Name:** Đặt tên cho job, ví dụ: `expire-pass-requests`.
    *   **Region:** Chọn một khu vực gần bạn, ví dụ: `asia-southeast1` (Singapore).
    *   **Description:** (Tuỳ chọn) Thêm mô tả, ví dụ: "Tự động hết hạn các yêu cầu pass ca mỗi giờ".

4.  **Thiết lập Tần suất (Frequency):**
    *   Trong ô **Frequency**, nhập vào cú pháp "unix-cron" sau để chạy mỗi giờ một lần:
        ```
        0 * * * *
        ```
    *   **Timezone:** Chọn `(GMT+07:00) Asia/Ho_Chi_Minh`.

5.  **Thiết lập Mục tiêu (Target):**
    *   **Target type:** Chọn **`HTTP`**.
    *   **URL:** Dán URL bạn đã chuẩn bị ở Bước 1.
    *   **HTTP method:** Chọn **`GET`**.

6.  **(Tuỳ chọn) Thêm Header xác thực:**
    *   Nếu bạn đã tạo secret ở Bước 2, hãy nhấn vào **"SHOW MORE"**.
    *   Trong phần **Auth header**, chọn **`Add OIDC token`** hoặc **`Add OAuth token`** KHÔNG phải là lựa chọn đúng. Thay vào đó, chúng ta sẽ thêm một header tuỳ chỉnh.
    *   Hãy kéo xuống phần **Headers**.
    *   Nhấn **"ADD HEADER"**.
    *   **Header name:** `Authorization`
    *   **Header value:** `Bearer MOT_CHUOI_BI_MAT_NGAY_LAP_TUC` (Hãy thay thế bằng chuỗi secret thật của bạn).

7.  **Tạo Job:**
    *   Nhấn nút **"CREATE"** ở dưới cùng.

**Hoàn tất!** Cloud Scheduler bây giờ sẽ tự động gọi đến API endpoint của bạn mỗi giờ một lần để dọn dẹp các yêu cầu đã hết hạn. Bạn có thể nhấn nút "RUN NOW" trong danh sách các job để kiểm tra ngay lập tức.
