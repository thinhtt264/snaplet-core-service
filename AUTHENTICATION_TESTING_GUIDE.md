# Hướng Dẫn Test Authentication API bằng Postman

## Mục Lục
1. [Tổng Quan](#tổng-quan)
2. [Cấu Hình Postman](#cấu-hình-postman)
3. [Các Endpoint Authentication](#các-endpoint-authentication)
4. [Test Cases Chi Tiết](#test-cases-chi-tiết)
5. [Test Scenarios](#test-scenarios)
6. [Troubleshooting](#troubleshooting)

---

## Tổng Quan

Tài liệu này hướng dẫn QC test các API Authentication của hệ thống Snaplet Core Service sử dụng Postman.

### Base URL
```
http://localhost:3000/api/v1
```
*Lưu ý: Thay đổi URL này theo môi trường test (dev, staging, production)*

### Headers Chung
- `Content-Type: application/json` (cho các request POST)
- `X-Device-Id: <device-id>` (bắt buộc cho register, login, refresh, logout)
- `Authorization: Bearer <access-token>` (bắt buộc cho logout)

---

## Cấu Hình Postman

### 1. Tạo Environment Variables

Tạo một Environment mới trong Postman với các biến sau:

| Variable | Initial Value | Current Value | Mô tả |
|----------|---------------|---------------|-------|
| `base_url` | `http://localhost:3000/api/v1` | `http://localhost:3000/api/v1` | Base URL của API |
| `device_id` | `test-device-123` | `test-device-123` | Device ID để test |
| `access_token` | (để trống) | (sẽ được set sau khi login) | Access token |
| `refresh_token` | (để trống) | (sẽ được set sau khi login) | Refresh token |
| `user_email` | `test@example.com` | `test@example.com` | Email test |
| `user_password` | `Test123456` | `Test123456` | Password test |
| `user_username` | `testuser` | `testuser` | Username test |

### 2. Cấu Hình Collection

Tạo một Collection mới tên "Authentication API Tests" và thêm các request sau.

---

## Các Endpoint Authentication

### 1. Check Email Available
**Kiểm tra email có sẵn để đăng ký không**

#### Request
- **Method:** `GET`
- **URL:** `{{base_url}}/users/email-availability?email={{user_email}}`
- **Headers:** Không cần header đặc biệt

#### Response Success (200 OK)
```json
{
  "available": true
}
```

#### Response Email Đã Tồn Tại (200 OK)
```json
{
  "available": false
}
```

---

### 2. Check Username Available
**Kiểm tra username có sẵn để đăng ký không**

#### Request
- **Method:** `GET`
- **URL:** `{{base_url}}/users/username-availability?username={{user_username}}`
- **Headers:** Không cần header đặc biệt

#### Response Success (200 OK)
```json
{
  "available": true
}
```

#### Response Username Đã Tồn Tại (200 OK)
```json
{
  "available": false
}
```

---

### 3. Register (Đăng Ký)
**Đăng ký user mới**

#### Request
- **Method:** `POST`
- **URL:** `{{base_url}}/auth/register`
- **Headers:**
  ```
  Content-Type: application/json
  X-Device-Id: {{device_id}}
  ```
- **Body (JSON):**
```json
{
  "email": "newuser@example.com",
  "username": "newuser",
  "firstName": "Nguyen",
  "lastName": "Van A",
  "password": "Password123"
}
```

#### Response Success (201 Created)
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "newuser@example.com",
    "username": "newuser",
    "firstName": "Nguyen",
    "lastName": "Van A",
    "avatarUrl": null
  }
}
```

#### Script để lưu Access Token (Postman Tests)
Thêm script sau vào tab "Tests" của request:
```javascript
if (pm.response.code === 201) {
    const response = pm.response.json();
    if (response.data && response.data.accessToken) {
        pm.environment.set("access_token", response.data.accessToken);
    } else if (response.accessToken) {
        pm.environment.set("access_token", response.accessToken);
    }
}
```

---

### 4. Login (Đăng Nhập)
**Đăng nhập với email và password**

#### Request
- **Method:** `POST`
- **URL:** `{{base_url}}/auth/login`
- **Headers:**
  ```
  Content-Type: application/json
  X-Device-Id: {{device_id}}
  ```
- **Body (JSON):**
```json
{
  "email": "{{user_email}}",
  "password": "{{user_password}}"
}
```

#### Response Success (200 OK)
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "username": "testuser",
    "firstName": "Nguyen",
    "lastName": "Van A",
    "avatarUrl": null
  }
}
```

#### Script để lưu Access Token (Postman Tests)
Thêm script sau vào tab "Tests":
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    if (response.data && response.data.accessToken) {
        pm.environment.set("access_token", response.data.accessToken);
    } else if (response.accessToken) {
        pm.environment.set("access_token", response.accessToken);
    }
}
```

---

### 5. Refresh Token
**Làm mới access token bằng refresh token**

**Lưu ý:** Refresh token được lưu trong database và không được trả về cho client. Để test endpoint này, bạn cần:
1. Login thành công để tạo refresh token trong database
2. Sử dụng refresh token từ database (hoặc implement endpoint để lấy refresh token)

#### Request
- **Method:** `POST`
- **URL:** `{{base_url}}/auth/refresh`
- **Headers:**
  ```
  Content-Type: application/json
  X-Device-Id: {{device_id}}
  ```
- **Body (JSON):**
```json
{
  "refreshToken": "{{refresh_token}}"
}
```

#### Response Success (200 OK)
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Script để lưu Access Token mới (Postman Tests)
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    if (response.data && response.data.accessToken) {
        pm.environment.set("access_token", response.data.accessToken);
    } else if (response.accessToken) {
        pm.environment.set("access_token", response.accessToken);
    }
}
```

---

### 6. Verify Token
**Kiểm tra tính hợp lệ của JWT token**

#### Request
- **Method:** `GET`
- **URL:** `{{base_url}}/auth/verify-token?token={{access_token}}`
- **Headers:** Không cần header đặc biệt

#### Response Success (200 OK)
```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "iat": 1234567890
  }
}
```

#### Response Token Invalid/Expired (200 OK)
```json
{
  "success": false,
  "message": "Invalid or expired token",
  "error": "jwt expired"
}
```

---

### 7. Logout
**Đăng xuất và revoke refresh token**

#### Request
- **Method:** `POST`
- **URL:** `{{base_url}}/auth/logout`
- **Headers:**
  ```
  Content-Type: application/json
  Authorization: Bearer {{access_token}}
  X-Device-Id: {{device_id}}
  ```

#### Response Success (200 OK)
```json
{
  "message": "Logged out successfully"
}
```

---

## Test Cases Chi Tiết

### Test Case 1: Check Email Available - Email Chưa Tồn Tại
**Mục đích:** Kiểm tra email mới có thể sử dụng

**Steps:**
1. Gửi GET request đến `/users/email-availability?email=newemail@test.com`
2. Verify response status = 200
3. Verify `available = true`

**Expected Result:** Email available

---

### Test Case 2: Check Email Available - Email Đã Tồn Tại
**Mục đích:** Kiểm tra email đã được sử dụng

**Steps:**
1. Gửi GET request đến `/users/email-availability?email=existing@test.com`
2. Verify response status = 200
3. Verify `available = false`

**Expected Result:** Email không available

---

### Test Case 3: Check Username Available - Username Chưa Tồn Tại
**Mục đích:** Kiểm tra username mới có thể sử dụng

**Steps:**
1. Gửi GET request đến `/users/username-availability?username=newusername`
2. Verify response status = 200
3. Verify `available = true`

**Expected Result:** Username available

---

### Test Case 4: Register - Success
**Mục đích:** Đăng ký user mới thành công

**Steps:**
1. Check email available trước
2. Check username available trước
3. Gửi POST request đến `/auth/register` với:
   - Valid email, username, firstName, lastName
   - Password >= 8 characters
   - Header `X-Device-Id`
4. Verify response status = 201
5. Verify response có `accessToken` và `user` object
6. Lưu `accessToken` vào environment variable

**Expected Result:** User được tạo thành công, nhận được access token

---

### Test Case 5: Register - Email Đã Tồn Tại
**Mục đích:** Kiểm tra validation khi email đã tồn tại

**Steps:**
1. Gửi POST request đến `/auth/register` với email đã tồn tại
2. Verify response status = 400 hoặc 409
3. Verify error message

**Expected Result:** Error về email đã tồn tại

---

### Test Case 6: Register - Username Đã Tồn Tại
**Mục đích:** Kiểm tra validation khi username đã tồn tại

**Steps:**
1. Gửi POST request đến `/auth/register` với username đã tồn tại
2. Verify response status = 400 hoặc 409
3. Verify error message

**Expected Result:** Error về username đã tồn tại

---

### Test Case 7: Register - Thiếu X-Device-Id Header
**Mục đích:** Kiểm tra validation khi thiếu header bắt buộc

**Steps:**
1. Gửi POST request đến `/auth/register` không có header `X-Device-Id`
2. Verify response status = 400 hoặc 401
3. Verify error message

**Expected Result:** Error về thiếu device ID

---

### Test Case 8: Register - Password Quá Ngắn
**Mục đích:** Kiểm tra validation password

**Steps:**
1. Gửi POST request đến `/auth/register` với password < 8 characters
2. Verify response status = 400
3. Verify error message về password length

**Expected Result:** Error về password phải >= 8 characters

---

### Test Case 9: Register - Email Format Invalid
**Mục đích:** Kiểm tra validation email format

**Steps:**
1. Gửi POST request đến `/auth/register` với email không hợp lệ (ví dụ: "invalid-email")
2. Verify response status = 400
3. Verify error message về email format

**Expected Result:** Error về email format không hợp lệ

---

### Test Case 10: Login - Success
**Mục đích:** Đăng nhập thành công

**Steps:**
1. Gửi POST request đến `/auth/login` với:
   - Valid email và password
   - Header `X-Device-Id`
2. Verify response status = 200
3. Verify response có `accessToken` và `user` object
4. Lưu `accessToken` vào environment variable

**Expected Result:** Đăng nhập thành công, nhận được access token

---

### Test Case 11: Login - Email Không Tồn Tại
**Mục đích:** Kiểm tra login với email không tồn tại

**Steps:**
1. Gửi POST request đến `/auth/login` với email không tồn tại
2. Verify response status = 401
3. Verify error message = "Invalid email or password"

**Expected Result:** Error về email/password không đúng

---

### Test Case 12: Login - Password Sai
**Mục đích:** Kiểm tra login với password sai

**Steps:**
1. Gửi POST request đến `/auth/login` với password sai
2. Verify response status = 401
3. Verify error message = "Invalid email or password"

**Expected Result:** Error về email/password không đúng

---

### Test Case 13: Login - Thiếu X-Device-Id Header
**Mục đích:** Kiểm tra validation khi thiếu header bắt buộc

**Steps:**
1. Gửi POST request đến `/auth/login` không có header `X-Device-Id`
2. Verify response status = 400 hoặc 401
3. Verify error message

**Expected Result:** Error về thiếu device ID

---

### Test Case 14: Verify Token - Valid Token
**Mục đích:** Kiểm tra token hợp lệ

**Steps:**
1. Login để lấy access token
2. Gửi GET request đến `/auth/verify-token?token={{access_token}}`
3. Verify response status = 200
4. Verify `success = true` và có `data` với `userId`

**Expected Result:** Token hợp lệ

---

### Test Case 15: Verify Token - Invalid Token
**Mục đích:** Kiểm tra token không hợp lệ

**Steps:**
1. Gửi GET request đến `/auth/verify-token?token=invalid-token`
2. Verify response status = 200
3. Verify `success = false` và có error message

**Expected Result:** Token không hợp lệ

---

### Test Case 16: Verify Token - Expired Token
**Mục đích:** Kiểm tra token đã hết hạn

**Steps:**
1. Sử dụng access token đã hết hạn (đợi token expire hoặc dùng token cũ)
2. Gửi GET request đến `/auth/verify-token?token={{expired_token}}`
3. Verify response status = 200
4. Verify `success = false` và error message về token expired

**Expected Result:** Token đã hết hạn

---

### Test Case 17: Logout - Success
**Mục đích:** Đăng xuất thành công

**Steps:**
1. Login để lấy access token
2. Gửi POST request đến `/auth/logout` với:
   - Header `Authorization: Bearer {{access_token}}`
   - Header `X-Device-Id`
3. Verify response status = 200
4. Verify message = "Logged out successfully"
5. Sau khi logout, thử refresh token → phải fail

**Expected Result:** Logout thành công, refresh token bị revoke

---

### Test Case 18: Logout - Thiếu Access Token
**Mục đích:** Kiểm tra validation khi thiếu token

**Steps:**
1. Gửi POST request đến `/auth/logout` không có header `Authorization`
2. Verify response status = 401
3. Verify error message

**Expected Result:** Error về unauthorized

---

### Test Case 19: Logout - Invalid Token
**Mục đích:** Kiểm tra logout với token không hợp lệ

**Steps:**
1. Gửi POST request đến `/auth/logout` với invalid token
2. Verify response status = 401
3. Verify error message

**Expected Result:** Error về token không hợp lệ

---

### Test Case 20: Logout - Thiếu X-Device-Id
**Mục đích:** Kiểm tra validation khi thiếu device ID

**Steps:**
1. Login để lấy access token
2. Gửi POST request đến `/auth/logout` không có header `X-Device-Id`
3. Verify response status = 400 hoặc 401
4. Verify error message

**Expected Result:** Error về thiếu device ID

---

## Test Scenarios

### Scenario 1: Flow Đăng Ký và Đăng Nhập Hoàn Chỉnh
1. Check email available (`/users/email-availability`) → `available: true`
2. Check username available (`/users/username-availability`) → `available: true`
3. Register với email/username đó → Success, nhận access token
4. Check email available lại → `available: false`
5. Check username available lại → `available: false`
6. Login với email/password vừa đăng ký → Success, nhận access token
7. Verify token → `success: true`
8. Logout → Success
9. Verify token lại → Vẫn valid (vì chỉ revoke refresh token, không invalidate access token)
10. Thử refresh token → Fail (vì đã logout)

---

### Scenario 2: Flow Refresh Token
1. Login → Nhận access token
2. Đợi access token hết hạn (hoặc dùng token cũ)
3. Verify token → `success: false` (token expired)
4. Refresh token → Nhận access token mới
5. Verify token mới → `success: true`
6. Logout
7. Thử refresh token lại → Fail (vì đã logout)

---

### Scenario 3: Multi-Device Login
1. Login với device_id_1 → Nhận access token 1
2. Login với device_id_2 (cùng user) → Nhận access token 2
3. Logout với device_id_1 → Success
4. Thử refresh token của device_id_1 → Fail
5. Thử refresh token của device_id_2 → Success (vì device 2 chưa logout)

---

### Scenario 4: Validation Tests
1. Register với email invalid format → Error
2. Register với password < 8 chars → Error
3. Register thiếu required fields → Error
4. Login với email không tồn tại → Error
5. Login với password sai → Error
6. Login thiếu X-Device-Id → Error
7. Logout thiếu Authorization header → Error

---

## Troubleshooting

### Lỗi Thường Gặp

#### 1. "X-Device-Id is required"
**Nguyên nhân:** Thiếu header `X-Device-Id` trong request

**Giải pháp:** Thêm header `X-Device-Id: {{device_id}}` vào request

---

#### 2. "Unauthorized" hoặc "Invalid token"
**Nguyên nhân:** 
- Access token không hợp lệ hoặc đã hết hạn
- Thiếu header `Authorization`

**Giải pháp:**
- Kiểm tra access token trong environment variable
- Đảm bảo đã login và lưu token vào environment
- Thử login lại để lấy token mới

---

#### 3. "Email already exists" hoặc "Username already exists"
**Nguyên nhân:** Email/username đã được sử dụng

**Giải pháp:** 
- Sử dụng email/username khác
- Hoặc xóa user cũ trong database (nếu có quyền)

---

#### 4. "Invalid email or password"
**Nguyên nhân:** 
- Email không tồn tại
- Password sai
- Email/password không khớp

**Giải pháp:**
- Kiểm tra lại email và password
- Đảm bảo user đã được đăng ký trước đó

---

#### 5. Connection Error
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
2. **Lưu Token Tự Động:** Sử dụng Postman Tests script để tự động lưu access token sau khi login/register
3. **Test Flow:** Chạy các test cases theo thứ tự logic (register → login → verify → logout)
4. **Clean Up:** Sau khi test xong, có thể logout để cleanup refresh tokens
5. **Multiple Environments:** Tạo nhiều environments cho dev, staging, production

---

## Postman Collection Export

Để export collection, click vào Collection → "..." → Export → Chọn format Collection v2.1

Sau đó chia sẻ file JSON với team để mọi người có thể import và sử dụng.

---

## Kết Luận

Tài liệu này cung cấp hướng dẫn chi tiết để test tất cả các endpoint authentication. Nếu có thắc mắc hoặc cần hỗ trợ, vui lòng liên hệ team development.

**Chúc bạn test thành công! 🚀**

