# Kịch bản kiểm thử (Test Plan) - Ứng dụng Katrina One

Kịch bản này được tạo ra để kiểm tra toàn diện các tính năng của ứng dụng quản lý nội bộ Katrina One, đảm bảo ứng dụng hoạt động ổn định, chính xác và bảo mật.

## 1. Mục tiêu

-   **Tính đúng đắn:** Đảm bảo tất cả các chức năng (báo cáo, xếp lịch, quản lý...) hoạt động đúng theo yêu cầu.
-   **Tính ổn định:** Kiểm tra ứng dụng trong các điều kiện khác nhau (mạng yếu, mất kết nối, dữ liệu lớn).
-   **Trải nghiệm người dùng:** Đảm bảo giao diện thân thiện, dễ sử dụng và logic điều hướng hợp lý.
-   **Bảo mật & Phân quyền:** Xác minh rằng mỗi vai trò người dùng chỉ có thể truy cập và thực hiện các chức năng được cho phép.

## 2. Các vai trò cần kiểm tra

1.  **Phục vụ (Server)**
2.  **Pha chế (Bartender)**
3.  **Quản lý (Manager)**
4.  **Chủ nhà hàng (Owner)**

---

## 3. Kịch bản chi tiết

### 3.1. Vai trò: Phục vụ

#### 3.1.1. Đăng nhập & Điều hướng
-   **TC-SV-01:** Đăng nhập thành công với tài khoản "Phục vụ".
    -   *Kết quả mong muốn:* Chuyển hướng đến trang chọn ca làm việc (`/shifts`).
-   **TC-SV-02:** Truy cập trực tiếp vào đường dẫn của vai trò khác (ví dụ: `/manager`, `/users`).
    -   *Kết quả mong muốn:* Bị từ chối truy cập và tự động chuyển hướng về trang chính của vai trò Phục vụ.

#### 3.1.2. Báo cáo Checklist Công việc (`/checklist/[ca]`)
-   **TC-SV-03 (Happy Path):**
    1.  Chọn một ca (Sáng, Trưa, Tối).
    2.  Thực hiện một công việc loại "Hình ảnh": Nhấn nút, chụp và gửi ảnh.
    3.  Thực hiện một công việc loại "Boolean": Nhấn nút "Đảm bảo" hoặc "Không đảm bảo".
    4.  Thực hiện một công việc loại "Ý kiến": Nhấn nút, nhập văn bản và lưu.
    5.  Thực hiện một công việc nhiều lần.
    6.  Nhập ghi chú vào ô "Vấn đề phát sinh".
    7.  Nhấn nút "Gửi báo cáo".
    -   *Kết quả mong muốn:* Báo cáo được gửi thành công, thông báo hiển thị. Các trạng thái được cập nhật.
-   **TC-SV-04 (Offline):**
    1.  Tắt kết nối mạng của thiết bị.
    2.  Thực hiện một vài công việc (chụp ảnh, nhấn nút).
    3.  Tải lại trang.
    -   *Kết quả mong muốn:* Các công việc đã thực hiện không bị mất, được lưu cục bộ. Hiển thị trạng thái "Có thay đổi chưa gửi".
    4.  Bật lại mạng, nhấn "Gửi báo cáo".
    -   *Kết quả mong muốn:* Báo cáo gửi thành công, ảnh được tải lên.
-   **TC-SV-05 (Xóa):**
    1.  Xóa một ảnh vừa chụp (chưa gửi đi).
    2.  Xóa một lần hoàn thành công việc.
    -   *Kết quả mong muốn:* Ảnh hoặc lần hoàn thành công việc bị xóa khỏi giao diện. Dữ liệu được cập nhật đúng.
-   **TC-SV-06 (Đồng bộ):**
    1.  Mở báo cáo trên 2 thiết bị cùng lúc với cùng 1 tài khoản.
    2.  Trên thiết bị 1, thực hiện 1 công việc.
    3.  Chờ và quan sát thiết bị 2.
    -   *Kết quả mong muốn:* Thông báo "Có bản mới trên máy chủ" xuất hiện trên thiết bị 2. Nhấn tải về và dữ liệu được đồng bộ.

#### 3.1.3. Lịch làm việc & Pass ca (`/schedule`)
-   **TC-SV-07:** Đăng ký thời gian rảnh cho tuần tới.
    -   *Kết quả mong muốn:* Lưu thành công. Các khung giờ chồng chéo được tự động hợp nhất.
-   **TC-SV-08:** Xem lịch làm việc đã được công bố.
    -   *Kết quả mong muốn:* Chỉ thấy các ca được phân công cho mình.
-   **TC-SV-09:** Xin pass một ca làm việc chưa diễn ra.
    -   *Kết quả mong muốn:* Yêu cầu được gửi đi. Trong mục "Yêu cầu Pass ca" thấy yêu cầu của mình đang ở trạng thái "pending".
-   **TC-SV-10:** Hủy yêu cầu pass ca vừa tạo.
    -   *Kết quả mong muốn:* Yêu cầu được hủy thành công.
-   **TC-SV-11:** Nhận một ca làm việc do người khác pass.
    -   *Kết quả mong muốn:* Nhận ca thành công, lịch làm việc được cập nhật.
-   **TC-SV-12:** Từ chối một ca làm việc do người khác pass.
    -   *Kết quả mong muốn:* Yêu cầu đó biến mất khỏi danh sách.

### 3.2. Vai trò: Pha chế

#### 3.2.1. Báo cáo Vệ sinh (`/bartender/hygiene-report`)
-   *(Thực hiện các test case tương tự TC-SV-03 đến TC-SV-06 cho báo cáo vệ sinh)*.

#### 3.2.2. Kiểm kê Tồn kho (`/bartender/inventory`)
-   **TC-PC-01 (Happy Path):**
    1.  Nhập số lượng tồn kho cho các mặt hàng (cả số và chữ "hết", "còn ít").
    2.  Chụp ảnh bằng chứng cho các mặt hàng có yêu cầu (đánh dấu sao).
    3.  Nhấn nút "Gửi & Nhận đề xuất".
    -   *Kết quả mong muốn:* Báo cáo được gửi, AI xử lý và trả về đề xuất đặt hàng, nhóm theo nhà cung cấp.
-   **TC-PC-02 (Validation):**
    1.  Bỏ trống số lượng tồn kho của một mặt hàng yêu cầu ảnh.
    2.  Không chụp ảnh cho một mặt hàng yêu cầu ảnh.
    3.  Nhấn nút "Gửi & Nhận đề xuất".
    -   *Kết quả mong muốn:* Hiển thị thông báo lỗi yêu cầu điền đủ thông tin/chụp ảnh, và cuộn đến vị trí mặt hàng bị lỗi.
-   **TC-PC-03 (Offline):**
    1.  Tắt mạng, nhập số lượng tồn kho và chụp ảnh.
    2.  Tải lại trang.
    -   *Kết quả mong muốn:* Dữ liệu đã nhập và ảnh (chưa tải lên) được giữ lại.
-   **TC-PC-04 (Sao chép):** Nhấn nút "Sao chép" ở bảng đề xuất.
    -   *Kết quả mong muốn:* Nội dung đề xuất được sao chép vào bộ nhớ tạm với định dạng đúng.

### 3.3. Vai trò: Quản lý

#### 3.3.1. Báo cáo Toàn diện (`/manager/comprehensive-report`)
-   *(Thực hiện các test case tương tự TC-SV-03 đến TC-SV-06 cho báo cáo toàn diện)*.

#### 3.3.2. Xếp lịch & Phê duyệt (`/shift-scheduling`)
-   **TC-QL-01 (Phân công):**
    1.  Mở một ca trống, danh sách nhân viên rảnh và bận được hiển thị đúng.
    2.  Chọn một nhân viên rảnh.
    3.  Chọn một nhân viên bận.
    -   *Kết quả mong muốn:* Hiển thị cảnh báo "Nhân viên này không đăng ký rảnh", không cho phép chọn.
    4.  Cố tình xếp một nhân viên vào 2 ca trùng giờ.
    -   *Kết quả mong muốn:* Hiển thị thông báo lỗi "Phân công bị trùng".
-   **TC-QL-02 (Lưu & Đề xuất):**
    1.  Thực hiện một vài thay đổi trong lịch.
    2.  Nút "Lưu thay đổi" hiện ra. Nhấn lưu.
    -   *Kết quả mong muốn:* Lưu thành công. Nút "Đề xuất lịch" hiện ra.
    3.  Nhấn "Đề xuất lịch".
    -   *Kết quả mong muốn:* Trạng thái lịch chuyển thành "proposed".
-   **TC-QL-03 (Cảnh báo thiếu người):**
    1.  Trong "Mẫu ca", đặt `minUsers` cho một ca là 2.
    2.  Trong bảng xếp lịch, chỉ xếp 1 người vào ca đó.
    -   *Kết quả mong muốn:* Ô chứa ca đó được tô màu đỏ và/hoặc có biểu tượng cảnh báo.
-   **TC-QL-04 (Pass ca):**
    1.  Mở mục "Yêu cầu Pass ca".
    2.  Chọn "Chỉ định" cho một yêu cầu.
    3.  Xếp một người khác vào.
    -   *Kết quả mong muốn:* Ca được gán lại thành công, yêu cầu chuyển sang trạng thái "resolved".
    4.  Chọn "Hủy" một yêu cầu.
    -   *Kết quả mong muốn:* Yêu cầu bị hủy.

#### 3.3.3. Xem báo cáo (`/reports`)
-   **TC-QL-05:** Truy cập xem báo cáo chi tiết của một ca Phục vụ, một báo cáo Vệ sinh.
    -   *Kết quả mong muốn:* Xem được đầy đủ dữ liệu, hình ảnh, ghi chú do nhân viên nộp.
-   **TC-QL-06:** Trong báo cáo chi tiết theo ca, chuyển đổi giữa chế độ xem "Tổng hợp" và xem theo từng nhân viên.
    -   *Kết quả mong muốn:* Dữ liệu hiển thị đúng cho từng chế độ xem.

### 3.4. Vai trò: Chủ nhà hàng

*Bao gồm tất cả các quyền của Quản lý, và các tính năng bổ sung.*

#### 3.4.1. Quản lý (Users, Tasks, Inventory,...)
-   **TC-CNH-01 (User):**
    1.  Vào trang "QL Người dùng".
    2.  Tắt/Bật tính năng cho phép đăng ký.
    3.  Chỉnh sửa vai trò của một người dùng.
    4.  Xóa một người dùng.
    -   *Kết quả mong muốn:* Các thay đổi được thực hiện thành công và có hiệu lực.
-   **TC-CNH-02 (Task List):**
    1.  Vào trang "QL Công việc Phục vụ".
    2.  Thêm, sửa, xóa, sắp xếp một công việc.
    3.  Sử dụng AI để thêm/sắp xếp công việc.
    -   *Kết quả mong muốn:* Mọi thay đổi được lưu lại và hiển thị đúng. AI hoạt động chính xác.
-   **TC-CNH-03 (Inventory):**
    1.  Vào trang "QL Hàng tồn kho".
    2.  Thêm, sửa, xóa, sắp xếp một mặt hàng.
    3.  Sử dụng AI để chỉnh sửa/sắp xếp hàng loạt.
    -   *Kết quả mong muốn:* Mọi thay đổi được lưu và hiển thị đúng. AI hoạt động chính xác.

#### 3.4.2. Xếp lịch & Phê duyệt
-   **TC-CNH-04 (Công bố):**
    1.  Nhận một lịch ở trạng thái "proposed" từ Quản lý.
    2.  Nhấn "Công bố lịch".
    -   *Kết quả mong muốn:* Lịch được công bố, nhân viên có thể thấy. Lịch nháp cho tuần kế tiếp được tự động tạo ra.
    3.  Nhấn "Trả về bản nháp".
    -   *Kết quả mong muốn:* Lịch quay về trạng thái "draft", Quản lý có thể chỉnh sửa tiếp.
-   **TC-CNH-05 (Ghi đè):** Trong lúc phân công, chọn một nhân viên bận.
    -   *Kết quả mong muốn:* Vẫn có thể chọn và phân công thành công (khác với Quản lý).

#### 3.4.3. Báo cáo & Giám sát
-   **TC-CNH-06 (AI Summary):**
    1.  Vào trang "Xem Báo cáo".
    2.  Chọn một ngày có nhiều báo cáo, nhấn "Tóm tắt bằng AI".
    3.  Chờ AI xử lý.
    -   *Kết quả mong muốn:* Hiển thị một bản tóm tắt mạch lạc, đầy đủ thông tin về các công việc, vấn đề trong ngày.
-   **TC-CNH-07 (Error Log):** Vào trang "Giám sát Lỗi".
    -   *Kết quả mong muốn:* Hiển thị danh sách các lỗi (nếu có) đã xảy ra trong hệ thống.
-   **TC-CNH-08 (Cleanup):**
    1.  Vào trang "Xem Báo cáo", nhấn "Dọn dẹp Báo cáo".
    2.  Nhập số ngày và xác nhận xóa.
    -   *Kết quả mong muốn:* Các báo cáo cũ hơn số ngày đã chọn bị xóa vĩnh viễn khỏi server.

---

Chúc bạn và đội ngũ có một quá trình kiểm thử hiệu quả!
```