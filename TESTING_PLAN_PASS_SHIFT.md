# Kịch bản kiểm thử (Test Plan) - Tính năng Pass ca & Đổi ca

## 1. Mục tiêu
- **Tính đúng đắn:** Đảm bảo các luồng pass ca, đổi ca, và nhờ nhận ca hoạt động chính xác từ lúc tạo yêu cầu đến khi được phê duyệt và cập nhật vào lịch.
- **Phân quyền:** Xác minh các vai trò (Nhân viên, Quản lý, Chủ nhà hàng) có quyền hạn đúng với chức năng.
- **Trải nghiệm người dùng:** Đảm bảo thông tin hiển thị rõ ràng, đầy đủ cho tất cả các bên liên quan.
- **Tính toàn vẹn dữ liệu:** Lịch làm việc phải được cập nhật chính xác sau mỗi hành động.

## 2. Các vai trò & Điều kiện tiên quyết

### Vai trò tham gia:
1.  **Nhân viên A (Phục vụ):** Người tạo yêu cầu.
2.  **Nhân viên B (Phục vụ):** Người nhận yêu cầu.
3.  **Nhân viên C (Phục vụ):** Nhân viên rảnh, không liên quan trực tiếp.
4.  **Quản lý:** Người có quyền phê duyệt yêu cầu của nhân viên cấp dưới.
5.  **Chủ nhà hàng:** Người có quyền cao nhất, có thể chỉ định và hoàn tác.

### Điều kiện tiên quyết:
- Đã có một lịch làm việc cho tuần hiện tại ở trạng thái **"published"**.
- **Nhân viên A** được xếp **Ca Sáng (05:30 - 12:00)** vào **Thứ Ba**.
- **Nhân viên B** được xếp **Ca Trưa (12:00 - 17:00)** vào **Thứ Ba**.
- **Nhân viên C** **rảnh** cả ngày **Thứ Ba**.
- Tất cả các tài khoản trên đều có thể đăng nhập.

---

## 3. Kịch bản chi tiết

### Luồng 1: Pass ca công khai (Public Pass Request)

**Mục tiêu:** Nhân viên A muốn pass ca sáng Thứ Ba, Nhân viên C nhận ca và được Quản lý phê duyệt.

| Bước | Người thực hiện | Hành động | Kết quả mong muốn |
| :--- | :--- | :--- | :--- |
| 1.1 | **Nhân viên A** | - Mở lịch làm việc. <br>- Tại ca sáng Thứ Ba, chọn "Xin pass ca". | - Yêu cầu được tạo. <br>- Trong dialog "Yêu cầu Pass ca", thấy yêu cầu của mình ở trạng thái `pending`. |
| 1.2 | **Nhân viên C** | - Mở lịch làm việc, vào dialog "Yêu cầu Pass ca". | - Thấy yêu cầu của Nhân viên A. <br>- **Không** thấy các yêu cầu pass ca của vai trò khác (nếu có). |
| 1.3 | **Nhân viên C** | - Nhấn nút "Nhận ca" trên yêu cầu của A. | - Yêu cầu chuyển sang trạng thái `pending_approval`. <br>- Nút "Nhận ca" biến mất. <br>- Nhân viên C thấy trạng thái "Chờ duyệt". |
| 1.4 | **Quản lý** | - Mở dialog "Yêu cầu Pass ca". | - Thấy yêu cầu của A đã được C nhận, ở trạng thái `pending_approval`. <br>- Thông tin hiển thị rõ: "A pass ca, C đã nhận". |
| 1.5 | **Quản lý** | - Nhấn nút "Phê duyệt". | - Yêu cầu chuyển sang trạng thái `resolved`. <br>- Lịch làm việc được cập nhật: A không còn ca sáng T3, C được gán vào ca đó. <br>- Thông báo thành công hiển thị. |
| 1.6 | **Nhân viên A & C** | - Tải lại trang lịch làm việc. | - Lịch của cả hai được cập nhật chính xác theo thay đổi ở bước 1.5. |
| 1.7 | **Chủ nhà hàng** | - Mở dialog "Yêu cầu Pass ca", xem tab "Lịch sử". | - Thấy yêu cầu đã được giải quyết. <br>- Nhấn "Hoàn tác". |
| 1.8 | **Tất cả** | - Quan sát lịch làm việc. | - Lịch làm việc quay trở lại trạng thái như ở bước 1.1. Yêu cầu pass ca quay về `pending`. |

---

### Luồng 2: Nhờ nhận ca trực tiếp (Direct Pass Request)

**Mục tiêu:** Nhân viên A muốn nhờ Nhân viên C (đang rảnh) nhận ca giúp mình.

| Bước | Người thực hiện | Hành động | Kết quả mong muốn |
| :--- | :--- | :--- | :--- |
| 2.1 | **Nhân viên A** | - Mở lịch làm việc, nhấn vào ca sáng Thứ Ba. <br>- Trong dialog thông tin ca, chọn tab "Nhân viên rảnh". <br>- Tìm và nhấn nút "Nhờ nhận ca" bên cạnh tên Nhân viên C. | - Yêu cầu được gửi đi. <br>- Nút "Nhờ nhận ca" của C chuyển thành "Đã nhờ". <br>- Trong dialog "Yêu cầu Pass ca", thấy yêu cầu đã gửi cho C. |
| 2.2 | **Nhân viên C** | - Mở dialog "Yêu cầu Pass ca". | - Thấy một yêu cầu trực tiếp từ A. <br>- **Không** thấy các yêu cầu công khai khác. |
| 2.3 | **Nhân viên C** | - Nhấn "Nhận ca". | - Yêu cầu chuyển sang `pending_approval`. |
| 2.4 | **Quản lý** | - Phê duyệt yêu cầu. | - Lịch làm việc được cập nhật đúng (tương tự bước 1.5). |
| 2.5 | **Nhân viên A** | - Thực hiện lại bước 2.1, nhưng chọn "Hủy yêu cầu" sau khi gửi. | - Yêu cầu bị hủy thành công. |
| 2.6 | **Nhân viên C** | - Thực hiện lại bước 2.2, nhưng chọn "Từ chối". | - Yêu cầu bị hủy thành công. A nhận được thông báo (nếu có). |

---

### Luồng 3: Yêu cầu đổi ca (Swap Request)

**Mục tiêu:** Nhân viên A (ca sáng T3) muốn đổi ca với Nhân viên B (ca trưa T3).

| Bước | Người thực hiện | Hành động | Kết quả mong muốn |
| :--- | :--- | :--- | :--- |
| 3.1 | **Nhân viên A** | - Mở lịch, nhấn vào ca sáng Thứ Ba. <br>- Trong dialog thông tin ca, chọn tab "Nhân viên trong ca". <br>- Tìm và nhấn nút "Đổi ca" bên cạnh tên Nhân viên B. | - Yêu cầu được gửi đi. <br>- Nút "Đổi ca" của B chuyển thành "Đã nhờ". <br>- Dialog "Yêu cầu Pass ca" hiển thị yêu cầu đổi ca, ghi rõ "đổi với ca Trưa". |
| 3.2 | **Nhân viên B** | - Mở dialog "Yêu cầu Pass ca". | - Thấy yêu cầu đổi ca từ A, hiển thị rõ ca của B sẽ được đổi. |
| 3.3 | **Nhân viên B** | - Nhấn "Đổi ca". | - Yêu cầu chuyển sang `pending_approval`. |
| 3.4 | **Quản lý** | - Mở dialog "Yêu cầu Pass ca". | - Thấy yêu cầu đổi ca với đầy đủ thông tin: A đổi ca Sáng lấy ca Trưa của B. |
| 3.5 | **Quản lý** | - Nhấn "Phê duyệt". | - **Quan trọng:** Lịch làm việc được cập nhật: <br>  &nbsp;&nbsp;&nbsp;&nbsp;- A được gán vào ca Trưa của B. <br>  &nbsp;&nbsp;&nbsp;&nbsp;- B được gán vào ca Sáng của A. |
| 3.6 | **Nhân viên A & B** | - Tải lại trang lịch làm việc. | - Lịch của cả hai hiển thị đúng ca mới sau khi hoán đổi. |

---

### Luồng 4: Các trường hợp đặc biệt & Xung đột

- **TC-CONFLICT-01:** Nhân viên C đã có một ca làm việc từ 10:00 - 15:00. Nhân viên A (ca 05:30 - 12:00) nhờ C nhận ca.
    - *Kết quả mong muốn:* Nhân viên C **không** thể nhận ca. Hệ thống hiển thị cảnh báo "Ca này bị trùng giờ với ca bạn đã được phân công".
- **TC-CONFLICT-02:** Quản lý A phân công Nhân viên X vào một ca. Sau đó, Quản lý B cũng cố gắng phân công Nhân viên X vào một ca khác trùng giờ.
    - *Kết quả mong muốn:* Hệ thống của Quản lý B hiển thị cảnh báo "Nhân viên này đã được xếp ca khác" và không cho phép lưu.
- **TC-ROLE-01:** Nhân viên A (Phục vụ) muốn pass ca. Nhân viên D (Pha chế, không có vai trò phụ) vào xem.
    - *Kết quả mong muốn:* Nhân viên D **không** thấy yêu cầu pass ca của A.
- **TC-PERMISSION-01:** Nhân viên đăng nhập, thử truy cập vào trang `/shift-scheduling`.
    - *Kết quả mong muốn:* Bị từ chối và điều hướng về trang lịch của nhân viên.
- **TC-PERMISSION-02:** Quản lý đăng nhập, thử truy cập vào các trang chỉ dành cho Chủ nhà hàng (ví dụ: QL Người dùng).
    - *Kết quả mong muốn:* Bị từ chối.