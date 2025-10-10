# Logic chi tiết của Tính năng Pass ca

Tài liệu này mô tả toàn bộ luồng hoạt động và các quy tắc nghiệp vụ của tính năng Pass ca (bao gồm pass công khai, nhờ đích danh và đổi ca).

## 1. Các loại Yêu cầu

Một nhân viên có thể tạo ra 3 loại yêu cầu khác nhau cho một ca làm việc của mình:

1.  **Pass công khai (Public Pass):**
    *   **Mô tả:** Nhân viên muốn nhượng lại ca làm của mình và gửi yêu cầu đến **tất cả** các nhân viên khác có cùng vai trò (hoặc vai trò phù hợp) và đang rảnh trong khung giờ đó.
    *   **Ai thấy:** Tất cả nhân viên đủ điều kiện và chưa từ chối yêu cầu này.
    *   **Trạng thái ban đầu:** `pending`.

2.  **Nhờ đích danh (Direct Pass):**
    *   **Mô tả:** Nhân viên A muốn nhờ cụ thể nhân viên B nhận ca của mình.
    *   **Ai thấy:** Chỉ nhân viên B thấy yêu cầu này.
    *   **Trạng thái ban đầu:** `pending`.

3.  **Đổi ca (Swap Request):**
    *   **Mô tả:** Nhân viên A muốn đổi ca của mình với một ca làm việc khác của nhân viên B.
    *   **Ai thấy:** Chỉ nhân viên B thấy yêu cầu này.
    *   **Trạng thái ban đầu:** `pending`.

## 2. Quy trình tạo Yêu cầu và Xử lý Xung đột

**Quy tắc cốt lõi:** Mỗi nhân viên chỉ có thể có **một** yêu cầu (thuộc bất kỳ loại nào) đang hoạt động (`pending` hoặc `pending_approval`) cho **một** ca làm việc cụ thể.

Khi một nhân viên (User A) cố gắng tạo một yêu cầu mới cho một ca làm việc:

1.  **Kiểm tra xung đột:** Hệ thống sẽ quét collection `notifications` để tìm xem có yêu cầu nào khác do User A tạo cho chính `shiftId` này mà đang có status là `pending` hoặc `pending_approval` hay không.

2.  **Xử lý kết quả:**
    *   **Nếu không có xung đột:** Yêu cầu mới sẽ được tạo thành công.
    *   **Nếu có xung đột:**
        *   Hệ thống **không báo lỗi**, thay vào đó, hàm `requestPassShift` hoặc `requestDirectPassShift` sẽ **trả về thông tin của yêu cầu cũ** đang gây xung đột.
        *   Giao diện người dùng (`schedule-view.tsx`) nhận được thông tin về yêu cầu cũ này và hiển thị một hộp thoại `AlertDialog`.
        *   Hộp thoại này sẽ hỏi người dùng: *"Bạn đã có một yêu cầu khác đang chờ xử lý cho ca này. Bạn có muốn hủy yêu cầu cũ và tạo yêu cầu mới không?"*
        *   **Nếu người dùng đồng ý:**
            1.  Giao diện sẽ gọi hàm `handleCancelPassRequest` để cập nhật trạng thái của yêu cầu cũ thành `cancelled`.
            2.  Ngay sau đó, giao diện sẽ tự động gọi lại hàm tạo yêu cầu mới mà người dùng vừa thực hiện.
        *   **Nếu người dùng từ chối:** Hộp thoại đóng lại và không có hành động nào xảy ra.

## 3. Quy trình Xử lý từ phía Người nhận

Khi một nhân viên khác (User B) thấy một yêu cầu pass ca:

1.  **Chấp nhận (Accept):**
    *   **Hành động:** User B nhấn nút "Nhận ca" hoặc "Đồng ý đổi".
    *   **Logic:**
        *   Hệ thống kiểm tra xem ca làm việc của User A có còn hợp lệ không (User A có còn trong ca đó không). Nếu không, yêu cầu sẽ tự động bị hủy.
        *   Đối với yêu cầu "Nhận ca" (không phải đổi ca), hệ thống kiểm tra xem User B có bị **trùng lịch** với ca đang nhận hay không. Nếu có, sẽ báo lỗi cho User B.
        *   Nếu mọi thứ hợp lệ, trạng thái của yêu cầu sẽ được chuyển thành `pending_approval`. Thông tin của User B (`takenBy`) sẽ được lưu vào `payload` của notification.
    *   **Kết quả:** Yêu cầu này biến mất khỏi danh sách của các nhân viên khác và chỉ hiển thị cho Quản lý/Chủ nhà hàng để chờ phê duyệt.

2.  **Từ chối (Decline):**
    *   **Hành động:** User B nhấn nút "Từ chối" hoặc "Bỏ qua".
    *   **Logic:** ID của User B sẽ được thêm vào mảng `declinedBy` trong `payload` của notification.
    *   **Kết quả:** Yêu cầu này sẽ không còn hiển thị cho User B nữa.

## 4. Quy trình Phê duyệt của Quản lý / Chủ nhà hàng

Khi một yêu cầu có trạng thái là `pending_approval`:

1.  **Phê duyệt (Approve):**
    *   **Ai thực hiện:** Quản lý (nếu người tạo và người nhận đều không phải Quản lý) hoặc Chủ nhà hàng.
    *   **Logic:**
        *   Hệ thống thực hiện một `transaction` để đảm bảo tính toàn vẹn dữ liệu.
        *   **Kiểm tra xung đột lần cuối:** Kiểm tra lại xem người yêu cầu và người nhận có còn nằm trong các ca làm việc tương ứng của họ hay không. Nếu không, giao dịch thất bại và báo lỗi.
        *   **Cập nhật lịch (`schedules`):**
            *   **Pass ca/Nhờ nhận:** Xóa User A khỏi ca, thêm User B vào ca.
            *   **Đổi ca:** Hoán đổi vị trí của User A và User B trong hai ca làm việc tương ứng.
        *   **Cập nhật `notification`:** Chuyển `status` thành `resolved`, lưu thông tin người duyệt (`resolvedBy`) và thời gian duyệt (`resolvedAt`).
        *   **Hủy các yêu cầu khác:** Tìm và hủy tất cả các yêu cầu `pending` hoặc `pending_approval` khác cho cùng một ca làm việc đó.
    *   **Kết quả:** Lịch làm việc được cập nhật. Yêu cầu được chuyển sang tab "Lịch sử".

2.  **Từ chối Phê duyệt (Reject Approval):**
    *   **Ai thực hiện:** Quản lý hoặc Chủ nhà hàng.
    *   **Logic:**
        *   Trạng thái của yêu cầu được chuyển ngược lại thành `pending`.
        *   Thông tin người nhận ca (`takenBy`) bị xóa khỏi `payload`.
        *   ID của người vừa bị từ chối sẽ được thêm vào danh sách `declinedBy` để họ không thấy lại yêu cầu này.
    *   **Kết quả:** Yêu cầu trở lại trạng thái công khai, sẵn sàng cho người khác nhận.

3.  **Chức năng đặc biệt của Chủ nhà hàng:**
    *   **Chỉ định (Assign):** Với một yêu cầu đang `pending` và chưa có ai nhận, Chủ nhà hàng có thể nhấn "Chỉ định" để mở trực tiếp hộp thoại phân công và chọn một người khác vào ca đó. Khi lưu lại, yêu cầu sẽ được giải quyết ngay lập tức.
    *   **Hủy (Cancel):** Chủ nhà hàng có quyền hủy bất kỳ yêu cầu `pending` nào.

## 5. Quy trình Hoàn tác và Xóa

*   **Hoàn tác (Revert):**
    *   **Ai thực hiện:** Chỉ Chủ nhà hàng.
    *   **Áp dụng cho:** Các yêu cầu đã `resolved`.
    *   **Logic:** Đảo ngược lại các thay đổi trong lịch làm việc (trả lại User A và User B về vị trí cũ) và chuyển trạng thái `notification` về lại `pending`.
*   **Xóa khỏi Lịch sử (Delete History):**
    *   **Ai thực hiện:** Chỉ Chủ nhà hàng.
    *   **Áp dụng cho:** Các yêu cầu đã `resolved` hoặc `cancelled`.
    *   **Logic:** Xóa vĩnh viễn `notification` khỏi hệ thống. Hành động này **không** ảnh hưởng đến lịch làm việc đã được thay đổi.

## 6. Logic Hệ thống Tự động

*   **Tự động hủy yêu cầu quá hạn:** Khi một yêu cầu `pass_request` ở trạng thái `pending` hoặc `pending_approval` mà thời gian bắt đầu ca làm việc đã qua, hệ thống sẽ tự động chuyển trạng thái của nó thành `cancelled` với lý do "Tự động hủy do đã quá hạn."
