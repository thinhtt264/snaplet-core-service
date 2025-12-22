# Hướng Dẫn Test Relationship API bằng Postman

## Mục Lục
1. [Tổng Quan](#tổng-quan)
2. [Cấu Hình Postman](#cấu-hình-postman)
3. [Các Endpoint Relationship](#các-endpoint-relationship)
   - 3.1. [Get Relationships By Status](#1-get-relationships-by-status)
   - 3.2. [Create Relationship (Send Friend Request)](#2-create-relationship-send-friend-request)
   - 3.3. [Update Relationship Status](#3-update-relationship-status)
   - 3.4. [Delete Relationship](#4-delete-relationship)
4. [Test Cases Chi Tiết](#test-cases-chi-tiết)
5. [Test Scenarios](#test-scenarios)
6. [Troubleshooting](#troubleshooting)

---

## Tổng Quan

Tài liệu này hướng dẫn QC test các API Relationship của hệ thống Snaplet Core Service sử dụng Postman.

### Base URL
```
http://localhost:3000/api/v1
```
*Lưu ý: Thay đổi URL này theo môi trường test (dev, staging, production)*

### Headers Chung
- `Content-Type: application/json` (cho các request POST, PATCH)
- `Authorization: Bearer <access-token>` (bắt buộc cho tất cả endpoints)

### Relationship Status
- `pending`: Lời mời kết bạn đang chờ phản hồi
- `accepted`: Đã chấp nhận lời mời, trở thành bạn bè
- `blocked`: Đã chặn người dùng

---

## Cấu Hình Postman

### 1. Tạo Environment Variables

Tạo một Environment mới trong Postman với các biến sau:

| Variable | Initial Value | Current Value | Mô tả |
|----------|---------------|---------------|-------|
| `base_url` | `http://localhost:3000/api/v1` | `http://localhost:3000/api/v1` | Base URL của API |
| `access_token` | (để trống) | (sẽ được set sau khi login) | Access token từ authentication |
| `user1_id` | (để trống) | (sẽ được set sau khi login user 1) | User ID của user 1 |
| `user2_id` | (để trống) | (sẽ được set sau khi login user 2) | User ID của user 2 |
| `user1_token` | (để trống) | (sẽ được set sau khi login user 1) | Access token của user 1 |
| `user2_token` | (để trống) | (sẽ được set sau khi login user 2) | Access token của user 2 |
| `relationship_id` | (để trống) | (sẽ được set sau khi create relationship) | Relationship ID |

### 2. Cấu Hình Collection

Tạo một Collection mới tên "Relationship API Tests" và thêm các request sau.

---

## Các Endpoint Relationship

### 1. Get Relationships By Status
**Lấy danh sách relationships theo status (pending, accepted, blocked)**

#### Request
- **Method:** `GET`
- **URL:** `{{base_url}}/relationships/status/{{status}}`
- **Headers:**
  ```
  Authorization: Bearer {{access_token}}
  ```
- **Path Parameters:**
  - `status`: `pending`, `accepted`, hoặc `blocked`

#### Response Success (200 OK)
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "username": "friend_username",
    "displayName": "Friend Display Name",
    "avatarUrl": "https://example.com/avatar.jpg",
    "relationshipId": "507f1f77bcf86cd799439012",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "status": "accepted"
  }
]
```

#### Response Empty (200 OK)
```json
[]
```

---

### 2. Create Relationship (Send Friend Request)
**Gửi lời mời kết bạn**

#### Request
- **Method:** `POST`
- **URL:** `{{base_url}}/relationships`
- **Headers:**
  ```
  Content-Type: application/json
  Authorization: Bearer {{access_token}}
  ```
- **Body (JSON):**
```json
{
  "targetUserId": "507f1f77bcf86cd799439011"
}
```

#### Response Success (201 Created)
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "user1Id": "507f1f77bcf86cd799439010",
  "user2Id": "507f1f77bcf86cd799439011",
  "status": "pending",
  "initiator": "507f1f77bcf86cd799439010",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Response Error - Relationship Already Exists (409 Conflict)
```json
{
  "statusCode": 409,
  "message": "Relationship already exists",
  "error": "Conflict"
}
```

#### Response Error - Cannot Create With Yourself (409 Conflict)
```json
{
  "statusCode": 409,
  "message": "Cannot create relationship with yourself",
  "error": "Conflict"
}
```

#### Script để lưu Relationship ID (Postman Tests)
Thêm script sau vào tab "Tests" của request:
```javascript
if (pm.response.code === 201) {
    const response = pm.response.json();
    if (response._id) {
        pm.environment.set("relationship_id", response._id);
    }
}
```

---

### 3. Update Relationship Status
**Cập nhật status của relationship (accept, block)**

#### Request
- **Method:** `PATCH`
- **URL:** `{{base_url}}/relationships/{{relationship_id}}`
- **Headers:**
  ```
  Content-Type: application/json
  Authorization: Bearer {{access_token}}
  ```
- **Path Parameters:**
  - `relationshipId`: ID của relationship cần update
- **Body (JSON):**
```json
{
  "status": "accepted"
}
```

**Lưu ý:** 
- Chỉ có thể `accept` từ status `pending`
- Có thể `block` từ bất kỳ status nào
- User phải là `user1Id` hoặc `user2Id` của relationship

#### Response Success (200 OK)
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "user1Id": "507f1f77bcf86cd799439010",
  "user2Id": "507f1f77bcf86cd799439011",
  "status": "accepted",
  "initiator": "507f1f77bcf86cd799439010",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:01.000Z"
}
```

#### Response Error - Relationship Not Found (404 Not Found)
```json
{
  "statusCode": 404,
  "message": "Relationship not found",
  "error": "Not Found"
}
```

#### Response Error - No Permission (403 Forbidden)
```json
{
  "statusCode": 403,
  "message": "You do not have permission to update this relationship",
  "error": "Forbidden"
}
```

#### Response Error - Invalid Status Transition (409 Conflict)
```json
{
  "statusCode": 409,
  "message": "Can only accept relationship with pending status",
  "error": "Conflict"
}
```

---

### 4. Delete Relationship
**Xóa relationship (unfriend, cancel request)**

#### Request
- **Method:** `DELETE`
- **URL:** `{{base_url}}/relationships/{{relationship_id}}`
- **Headers:**
  ```
  Authorization: Bearer {{access_token}}
  ```
- **Path Parameters:**
  - `relationshipId`: ID của relationship cần xóa

#### Response Success (200 OK)
```json
{}
```

#### Response Error - Relationship Not Found (404 Not Found)
```json
{
  "statusCode": 404,
  "message": "Relationship not found",
  "error": "Not Found"
}
```

#### Response Error - No Permission (403 Forbidden)
```json
{
  "statusCode": 403,
  "message": "You do not have permission to delete this relationship",
  "error": "Forbidden"
}
```

---

## Test Cases Chi Tiết

### Test Case 1: Get Relationships By Status - Pending
**Mục đích:** Lấy danh sách lời mời kết bạn đang chờ

**Steps:**
1. Login với user 1 để lấy access token
2. User 2 gửi lời mời kết bạn cho user 1
3. Gửi GET request đến `/relationships/status/pending` với token của user 1
4. Verify response status = 200
5. Verify response là array chứa relationship với status = "pending"

**Expected Result:** Trả về danh sách relationships có status pending

---

### Test Case 2: Get Relationships By Status - Accepted
**Mục đích:** Lấy danh sách bạn bè

**Steps:**
1. Login với user 1 để lấy access token
2. Tạo relationship và accept nó
3. Gửi GET request đến `/relationships/status/accepted` với token của user 1
4. Verify response status = 200
5. Verify response là array chứa relationships với status = "accepted"

**Expected Result:** Trả về danh sách bạn bè

---

### Test Case 3: Get Relationships By Status - Blocked
**Mục đích:** Lấy danh sách người đã chặn

**Steps:**
1. Login với user 1 để lấy access token
2. Block user 2
3. Gửi GET request đến `/relationships/status/blocked` với token của user 1
4. Verify response status = 200
5. Verify response là array chứa relationships với status = "blocked"

**Expected Result:** Trả về danh sách người đã chặn

---

### Test Case 4: Get Relationships By Status - Empty
**Mục đích:** Kiểm tra khi không có relationship nào

**Steps:**
1. Login với user mới (chưa có relationship nào)
2. Gửi GET request đến `/relationships/status/accepted`
3. Verify response status = 200
4. Verify response là array rỗng `[]`

**Expected Result:** Trả về array rỗng

---

### Test Case 5: Create Relationship - Success
**Mục đích:** Gửi lời mời kết bạn thành công

**Steps:**
1. Login với user 1 để lấy access token
2. Gửi POST request đến `/relationships` với:
   - Body: `{ "targetUserId": "<user2_id>" }`
   - Header: `Authorization: Bearer {{user1_token}}`
3. Verify response status = 201
4. Verify response có `status = "pending"`
5. Verify `initiator = user1_id`
6. Lưu `relationship_id` vào environment variable

**Expected Result:** Relationship được tạo với status pending

---

### Test Case 6: Create Relationship - Duplicate
**Mục đích:** Kiểm tra không thể tạo duplicate relationship

**Steps:**
1. Tạo relationship giữa user 1 và user 2
2. Gửi POST request lại với cùng targetUserId
3. Verify response status = 409
4. Verify error message = "Relationship already exists"

**Expected Result:** Error về relationship đã tồn tại

---

### Test Case 7: Create Relationship - With Yourself
**Mục đích:** Kiểm tra không thể gửi lời mời cho chính mình

**Steps:**
1. Login với user 1
2. Gửi POST request đến `/relationships` với:
   - Body: `{ "targetUserId": "<user1_id>" }`
3. Verify response status = 409
4. Verify error message = "Cannot create relationship with yourself"

**Expected Result:** Error về không thể tạo relationship với chính mình

---

### Test Case 8: Create Relationship - Invalid User ID
**Mục đích:** Kiểm tra validation user ID

**Steps:**
1. Login với user 1
2. Gửi POST request đến `/relationships` với:
   - Body: `{ "targetUserId": "invalid-id" }`
3. Verify response status = 400
4. Verify error message về invalid user id

**Expected Result:** Error về invalid user id

---

### Test Case 9: Create Relationship - Missing Authorization
**Mục đích:** Kiểm tra validation khi thiếu token

**Steps:**
1. Gửi POST request đến `/relationships` không có header `Authorization`
2. Verify response status = 401
3. Verify error message

**Expected Result:** Error về unauthorized

---

### Test Case 10: Update Relationship Status - Accept Success
**Mục đích:** Chấp nhận lời mời kết bạn thành công

**Steps:**
1. User 1 gửi lời mời cho user 2 (status = pending)
2. Login với user 2
3. Gửi PATCH request đến `/relationships/{{relationship_id}}` với:
   - Body: `{ "status": "accepted" }`
   - Header: `Authorization: Bearer {{user2_token}}`
4. Verify response status = 200
5. Verify response có `status = "accepted"`

**Expected Result:** Relationship status được update thành accepted

---

### Test Case 11: Update Relationship Status - Accept From Non-Pending
**Mục đích:** Kiểm tra chỉ có thể accept từ pending

**Steps:**
1. Tạo relationship với status = accepted
2. Gửi PATCH request để accept lại
3. Verify response status = 409
4. Verify error message = "Can only accept relationship with pending status"

**Expected Result:** Error về chỉ có thể accept từ pending

---

### Test Case 12: Update Relationship Status - Block
**Mục đích:** Chặn người dùng thành công

**Steps:**
1. Tạo relationship giữa user 1 và user 2
2. Login với user 1
3. Gửi PATCH request đến `/relationships/{{relationship_id}}` với:
   - Body: `{ "status": "blocked" }`
4. Verify response status = 200
5. Verify response có `status = "blocked"`

**Expected Result:** Relationship status được update thành blocked

---

### Test Case 13: Update Relationship Status - No Permission
**Mục đích:** Kiểm tra user không có quyền update

**Steps:**
1. Tạo relationship giữa user 1 và user 2
2. Login với user 3 (không liên quan)
3. Gửi PATCH request đến `/relationships/{{relationship_id}}` với token của user 3
4. Verify response status = 403
5. Verify error message = "You do not have permission to update this relationship"

**Expected Result:** Error về không có quyền

---

### Test Case 14: Update Relationship Status - Relationship Not Found
**Mục đích:** Kiểm tra khi relationship không tồn tại

**Steps:**
1. Login với user 1
2. Gửi PATCH request đến `/relationships/invalid-relationship-id` với:
   - Body: `{ "status": "accepted" }`
3. Verify response status = 404
4. Verify error message = "Relationship not found"

**Expected Result:** Error về relationship không tồn tại

---

### Test Case 15: Delete Relationship - Success
**Mục đích:** Xóa relationship thành công

**Steps:**
1. Tạo relationship giữa user 1 và user 2
2. Login với user 1
3. Gửi DELETE request đến `/relationships/{{relationship_id}}` với token của user 1
4. Verify response status = 200
5. Verify relationship đã bị xóa (get lại sẽ không tìm thấy)

**Expected Result:** Relationship được xóa thành công

---

### Test Case 16: Delete Relationship - No Permission
**Mục đích:** Kiểm tra user không có quyền delete

**Steps:**
1. Tạo relationship giữa user 1 và user 2
2. Login với user 3 (không liên quan)
3. Gửi DELETE request đến `/relationships/{{relationship_id}}` với token của user 3
4. Verify response status = 403
5. Verify error message = "You do not have permission to delete this relationship"

**Expected Result:** Error về không có quyền

---

### Test Case 17: Delete Relationship - Relationship Not Found
**Mục đích:** Kiểm tra khi relationship không tồn tại

**Steps:**
1. Login với user 1
2. Gửi DELETE request đến `/relationships/invalid-relationship-id`
3. Verify response status = 404
4. Verify error message = "Relationship not found"

**Expected Result:** Error về relationship không tồn tại

---

### Test Case 18: Delete Relationship - Missing Authorization
**Mục đích:** Kiểm tra validation khi thiếu token

**Steps:**
1. Gửi DELETE request đến `/relationships/{{relationship_id}}` không có header `Authorization`
2. Verify response status = 401
3. Verify error message

**Expected Result:** Error về unauthorized

---

## Test Scenarios

### Scenario 1: Flow Kết Bạn Hoàn Chỉnh
1. User 1 login → Lấy `user1_token` và `user1_id`
2. User 2 login → Lấy `user2_token` và `user2_id`
3. User 1 gửi lời mời cho user 2 → Success, status = pending
4. User 2 get pending relationships → Thấy lời mời từ user 1
5. User 2 accept lời mời → Success, status = accepted
6. User 1 get accepted relationships → Thấy user 2 trong danh sách bạn bè
7. User 2 get accepted relationships → Thấy user 1 trong danh sách bạn bè
8. User 1 delete relationship → Success
9. User 1 get accepted relationships → Không còn user 2

---

### Scenario 2: Flow Chặn Người Dùng
1. User 1 và user 2 đã là bạn bè (status = accepted)
2. User 1 block user 2 → Success, status = blocked
3. User 1 get blocked relationships → Thấy user 2
4. User 2 get relationships → Không thấy user 1 (vì bị block)
5. User 1 unblock (delete relationship) → Success
6. User 1 có thể gửi lời mời lại cho user 2

---

### Scenario 3: Flow Từ Chối Lời Mời
1. User 1 gửi lời mời cho user 2 → Success, status = pending
2. User 2 get pending relationships → Thấy lời mời từ user 1
3. User 2 delete relationship (từ chối) → Success
4. User 1 get pending relationships → Không còn lời mời
5. User 1 có thể gửi lời mời lại cho user 2

---

### Scenario 4: Flow Multiple Relationships
1. User 1 gửi lời mời cho user 2 → Success
2. User 1 gửi lời mời cho user 3 → Success
3. User 1 gửi lời mời cho user 4 → Success
4. User 1 get pending relationships → Thấy 3 lời mời
5. User 2 accept → Success
6. User 3 accept → Success
7. User 4 delete (từ chối) → Success
8. User 1 get accepted relationships → Thấy user 2 và user 3
9. User 1 get pending relationships → Không còn lời mời nào

---

### Scenario 5: Validation Tests
1. Create relationship với invalid user id → Error 400
2. Create relationship với chính mình → Error 409
3. Create duplicate relationship → Error 409
4. Update status với relationship không tồn tại → Error 404
5. Update status với user không có quyền → Error 403
6. Accept từ non-pending status → Error 409
7. Delete relationship không tồn tại → Error 404
8. Delete relationship với user không có quyền → Error 403
9. Get relationships không có token → Error 401

---

## Troubleshooting

### Lỗi Thường Gặp

#### 1. "Unauthorized" hoặc "Invalid token"
**Nguyên nhân:** 
- Access token không hợp lệ hoặc đã hết hạn
- Thiếu header `Authorization`

**Giải pháp:**
- Kiểm tra access token trong environment variable
- Đảm bảo đã login và lưu token vào environment
- Thử login lại để lấy token mới

---

#### 2. "Relationship already exists"
**Nguyên nhân:** Relationship giữa 2 user đã tồn tại

**Giải pháp:** 
- Kiểm tra relationship đã tồn tại chưa trước khi tạo mới
- Hoặc xóa relationship cũ trước (nếu cần)
- Lưu ý: Relationship được tạo với user1Id < user2Id để đảm bảo unique

---

#### 3. "Cannot create relationship with yourself"
**Nguyên nhân:** Đang cố gắng tạo relationship với chính mình

**Giải pháp:**
- Kiểm tra `targetUserId` khác với `userId` hiện tại

---

#### 4. "You do not have permission to update/delete this relationship"
**Nguyên nhân:** 
- User không phải là `user1Id` hoặc `user2Id` của relationship

**Giải pháp:**
- Đảm bảo user đang thực hiện action là một trong hai user trong relationship
- Kiểm tra `relationshipId` có đúng không

---

#### 5. "Can only accept relationship with pending status"
**Nguyên nhân:** Đang cố gắng accept relationship không ở trạng thái pending

**Giải pháp:**
- Chỉ có thể accept từ status `pending`
- Kiểm tra status hiện tại của relationship trước khi accept

---

#### 6. "Relationship not found"
**Nguyên nhân:** 
- Relationship ID không tồn tại
- Relationship đã bị xóa

**Giải pháp:**
- Kiểm tra `relationshipId` có đúng không
- Đảm bảo relationship chưa bị xóa
- Lấy lại `relationshipId` từ create response

---

#### 7. "Invalid user id" hoặc "Invalid relationship id"
**Nguyên nhân:** 
- ID không đúng format ObjectId của MongoDB

**Giải pháp:**
- Kiểm tra ID có đúng format 24 ký tự hex không
- Đảm bảo ID là string hợp lệ

---

#### 8. Connection Error
**Nguyên nhân:** 
- Server chưa chạy
- Base URL sai
- Network issue

**Giải pháp:**
- Kiểm tra server đã chạy chưa
- Kiểm tra base URL trong environment variable
- Kiểm tra network connection

---

### Tips

1. **Sử dụng Environment Variables:** Luôn sử dụng `{{variable_name}}` thay vì hardcode values
2. **Lưu Relationship ID:** Sử dụng Postman Tests script để tự động lưu `relationship_id` sau khi create
3. **Test với 2 Users:** Cần ít nhất 2 user accounts để test đầy đủ flow (user 1 gửi lời mời, user 2 accept)
4. **Test Flow:** Chạy các test cases theo thứ tự logic (create → get → update → delete)
5. **Clean Up:** Sau khi test xong, có thể delete relationships để cleanup
6. **Multiple Status:** Test với các status khác nhau (pending, accepted, blocked)
7. **Permission Tests:** Luôn test với user không có quyền để đảm bảo security

---

## Postman Collection Export

Để export collection, click vào Collection → "..." → Export → Chọn format Collection v2.1

Sau đó chia sẻ file JSON với team để mọi người có thể import và sử dụng.

---

## Kết Luận

Tài liệu này cung cấp hướng dẫn chi tiết để test tất cả các endpoint relationship. Nếu có thắc mắc hoặc cần hỗ trợ, vui lòng liên hệ team development.

**Chúc bạn test thành công! 🚀**

