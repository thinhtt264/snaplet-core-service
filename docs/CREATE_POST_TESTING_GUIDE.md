# Hướng Dẫn Test Create Post API bằng Postman

## Mục Lục
1. [Tổng Quan](#tổng-quan)
2. [Cấu Hình Postman](#cấu-hình-postman)
3. [Luồng Create Post](#luồng-create-post)
   - 3.1. [Step 1: Request Batch Upload (Lấy Presigned URL)](#1-step-1-request-batch-upload-lấy-presigned-url)
   - 3.2. [Step 2: Upload File Lên R2](#2-step-2-upload-file-lên-r2)
   - 3.3. [Step 3: Confirm Upload](#3-step-3-confirm-upload)
   - 3.4. [Step 4: Create Post](#4-step-4-create-post)
4. [Test Cases Chi Tiết](#test-cases-chi-tiết)
5. [Test Scenarios](#test-scenarios)
6. [Troubleshooting](#troubleshooting)

---

## Tổng Quan

Tài liệu này hướng dẫn QC test luồng Create Post của hệ thống Snaplet Core Service sử dụng Postman. Luồng bao gồm 4 bước:
1. Request presigned URL để upload file
2. Upload file trực tiếp lên R2 storage qua presigned URL
3. Confirm upload để xác nhận file đã upload thành công
4. Tạo post với media đã upload

### Base URL
```
http://localhost:3000/api/v1
```
*Lưu ý: Thay đổi URL này theo môi trường test (dev, staging, production)*

### Headers Chung
- `Content-Type: application/json` (cho các request POST)
- `Authorization: Bearer <access-token>` (bắt buộc cho tất cả endpoints)
- `x-client-fingerprint: <base64-encoded-fingerprint>` (bắt buộc)

### Prerequisites
Trước khi test Create Post API, bạn cần:
1. **Authenticated User**: Đã login và có `access_token`
2. **Fingerprint**: Có `x-client-fingerprint` header (xem hướng dẫn tại `docs/FINGERPRINT.md`)

---

## Cấu Hình Postman

### 1. Tạo Environment Variables

Tạo một Environment mới trong Postman với các biến sau:

| Variable | Initial Value | Current Value | Mô tả |
|----------|---------------|---------------|-------|
| `base_url` | `http://localhost:3000/api/v1` | `http://localhost:3000/api/v1` | Base URL của API |
| `access_token` | (để trống) | (sẽ được set sau khi login) | Access token từ authentication |
| `fingerprint` | `ewoiZGV2aWNlSWQiOiJhYmMtMTIzIiwKInBsYXRmb3JtIjoiYW5kcm9pZCIsCiJtb2RlbCI6IlNNLVM5MThCIiwKImFwcFZlcnNpb24iOiIxLjIuMyIsCiJpcCI6IjEuMi4zLjQiLAoidXNlckFnZW50IjoiTXlBcHAvMS4yLjMiLAoidHMiOjE3MzY5MzI4MDAKfQo=` | (giữ nguyên) | Client fingerprint |
| `media_id_1` | (để trống) | (sẽ được set sau step 1) | Media ID từ request batch upload |
| `upload_url_1` | (để trống) | (sẽ được set sau step 1) | Presigned URL để upload file |
| `post_id` | (để trống) | (sẽ được set sau step 4) | Post ID sau khi tạo post |

### 2. Cấu Hình Collection

Tạo một Collection mới tên "Create Post API Tests" và thêm các request sau.

---

## Luồng Create Post

### 1. Step 1: Request Batch Upload (Lấy Presigned URL)

**Mục đích:** Lấy presigned URL để upload file trực tiếp lên R2 storage

#### Request
- **Method:** `POST`
- **URL:** `{{base_url}}/media/upload/request`
- **Headers:**
  ```
  Content-Type: application/json
  Authorization: Bearer {{access_token}}
  x-client-fingerprint: {{fingerprint}}
  ```
- **Body:**
  ```json
  {
    "items": [
      {
        "mimeType": "image/jpeg",
        "size": 1048576,
        "transform": {
          "rotation": 0,
          "scaleX": 1,
          "scaleY": 1
        }
      }
    ]
  }
  ```

#### Response Success (200 OK)
```json
{
  "status": {
    "code": 200,
    "message": "OK"
  },
  "data": {
    "data": [
      {
        "mediaId": "507f1f77bcf86cd799439011",
        "uploadUrl": "https://...presigned-url...",
        "expiresIn": 900
      }
    ]
  }
}
```

#### Lưu ý
- `mimeType` phải là một trong: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`
- `size` phải từ 1 đến 8388608 bytes (8MB)
- `transform` là **bắt buộc** với cấu trúc:
  - `rotation`: số nguyên (integer) - góc xoay của image (0, 90, 180, 270, ...)
  - `scaleX`: số (1 hoặc -1) - scale theo trục X (1 = bình thường, -1 = flip ngang)
  - `scaleY`: số (1 hoặc -1) - scale theo trục Y (1 = bình thường, -1 = flip dọc)
- Có thể request tối đa 3 items trong một lần
- `expiresIn` là thời gian presigned URL còn hiệu lực (giây), mặc định 15 phút

#### Ví dụ Request với Multiple Items
```json
{
  "items": [
    {
      "mimeType": "image/jpeg",
      "size": 1048576,
      "transform": {
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1
      }
    },
    {
      "mimeType": "image/png",
      "size": 2097152,
      "transform": {
        "rotation": 90,
        "scaleX": -1,
        "scaleY": 1
      }
    }
  ]
}
```

#### Ví dụ Transform Phổ Biến
- **Không xoay, không flip:** `{"rotation": 0, "scaleX": 1, "scaleY": 1}`
- **Xoay 90 độ:** `{"rotation": 90, "scaleX": 1, "scaleY": 1}`
- **Xoay 180 độ:** `{"rotation": 180, "scaleX": 1, "scaleY": 1}`
- **Xoay 270 độ:** `{"rotation": 270, "scaleX": 1, "scaleY": 1}`
- **Flip ngang:** `{"rotation": 0, "scaleX": -1, "scaleY": 1}`
- **Flip dọc:** `{"rotation": 0, "scaleX": 1, "scaleY": -1}`
- **Xoay 90 độ + flip ngang:** `{"rotation": 90, "scaleX": -1, "scaleY": 1}`

#### Postman Script (Tests tab)
```javascript
if (pm.response.code === 200) {
  const response = pm.response.json();
  const mediaId = response.data.data[0].mediaId;
  const uploadUrl = response.data.data[0].uploadUrl;
  
  pm.environment.set("media_id_1", mediaId);
  pm.environment.set("upload_url_1", uploadUrl);
  
  console.log("Media ID:", mediaId);
  console.log("Upload URL:", uploadUrl);
}
```

---

### 2. Step 2: Upload File Lên R2

**Mục đích:** Upload file trực tiếp lên R2 storage sử dụng presigned URL

#### Request
- **Method:** `PUT`
- **URL:** `{{upload_url_1}}` (URL từ step 1)
- **Headers:**
  ```
  Content-Type: image/jpeg
  ```
- **Body:** 
  - Chọn tab **Body** → **binary**
  - Chọn file image để upload (JPEG, PNG, etc.)

#### Response Success (200 OK)
- Status: `200 OK`
- Body: (thường là empty hoặc success message từ R2)

#### Lưu ý
- Phải upload file trong thời gian `expiresIn` (15 phút)
- File size không được vượt quá size đã khai báo trong step 1
- Content-Type phải khớp với `mimeType` đã khai báo

#### Postman Script (Tests tab)
```javascript
if (pm.response.code === 200) {
  console.log("File uploaded successfully to R2");
}
```

---

### 3. Step 3: Confirm Upload

**Mục đích:** Xác nhận file đã upload thành công và chuyển media sang trạng thái READY

#### Request
- **Method:** `POST`
- **URL:** `{{base_url}}/media/upload/confirm`
- **Headers:**
  ```
  Content-Type: application/json
  Authorization: Bearer {{access_token}}
  x-client-fingerprint: {{fingerprint}}
  ```
- **Body:**
  ```json
  {
    "mediaIds": ["{{media_id_1}}"]
  }
  ```

#### Response Success (200 OK)
```json
{
  "status": {
    "code": 200,
    "message": "OK"
  },
  "data": {
    "media": [
      {
        "id": "507f1f77bcf86cd799439011",
        "ownerId": "507f191e810c19729de860ea",
        "mimeType": "image/jpeg",
        "originalUrl": "https://your-bucket.r2.dev/imageV1/507f1f77bcf86cd799439011",
        "transform": {
          "rotation": 0,
          "scaleX": 1,
          "scaleY": 1
        },
        "status": "READY",
        "createdAt": "2025-01-13T10:00:00.000Z",
        "updatedAt": "2025-01-13T10:00:00.000Z"
      }
    ],
    "message": "Upload confirmed and processing started"
  }
}
```

#### Lưu ý
- `mediaIds` phải là array chứa ít nhất 1 media ID từ step 1 (tối đa 3)
- Tất cả media IDs phải thuộc về user hiện tại
- Media sẽ được chuyển từ status `PENDING` → `PROCESSING` → `READY`
- Response trả về array `media` chứa thông tin của tất cả media đã confirm
- Mỗi media trong response có field `transform` với thông tin rotation và scale đã gửi trong step 1

#### Postman Script (Tests tab)
```javascript
if (pm.response.code === 200) {
  const response = pm.response.json();
  const mediaArray = response.data.media;
  
  pm.test("Media array is not empty", function () {
    pm.expect(mediaArray).to.be.an('array');
    pm.expect(mediaArray.length).to.be.greaterThan(0);
  });
  
  const media = mediaArray[0];
  
  pm.test("Media status is READY", function () {
    pm.expect(media.status).to.eql("READY");
  });
  
  pm.test("Media has originalUrl", function () {
    pm.expect(media.originalUrl).to.not.be.empty;
  });
  
  pm.test("Media has transform", function () {
    pm.expect(media.transform).to.be.an('object');
    pm.expect(media.transform).to.have.property('rotation');
    pm.expect(media.transform).to.have.property('scaleX');
    pm.expect(media.transform).to.have.property('scaleY');
  });
  
  console.log("Media confirmed:", media.id);
}
```

---

### 4. Step 4: Create Post

**Mục đích:** Tạo post với media đã upload và confirm thành công

#### Request
- **Method:** `POST`
- **URL:** `{{base_url}}/posts`
- **Headers:**
  ```
  Content-Type: application/json
  Authorization: Bearer {{access_token}}
  x-client-fingerprint: {{fingerprint}}
  ```
- **Body:**
  ```json
  {
    "mediaIds": ["{{media_id_1}}"],
    "caption": "My first post!",
    "visibility": "friend-only"
  }
  ```

#### Response Success (201 Created)
```json
{
  "status": {
    "code": 201,
    "message": "Created"
  },
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "createdAt": "2025-01-13T10:05:00.000Z"
  }
}
```

#### Lưu ý
- `mediaIds` phải là array chứa ít nhất 1 media ID
- Tất cả media trong `mediaIds` phải có status `READY` và thuộc về user
- `caption` là optional (mặc định empty string)
- `visibility` là optional, có thể là:
  - `friend-only` (mặc định) - Chỉ bạn bè mới thấy
  - `public` - Tất cả mọi người đều thấy

#### Postman Script (Tests tab)
```javascript
if (pm.response.code === 201) {
  const response = pm.response.json();
  const postId = response.data.id;
  
  pm.environment.set("post_id", postId);
  
  pm.test("Post created successfully", function () {
    pm.expect(postId).to.not.be.empty;
  });
  
  console.log("Post created:", postId);
}
```

---

## Test Cases Chi Tiết

### Test Case 1: Create Post với 1 Image

**Mục tiêu:** Test luồng đầy đủ với 1 image

**Steps:**
1. Request batch upload với 1 item (mimeType: `image/jpeg`, size: 1MB, transform: `{rotation: 0, scaleX: 1, scaleY: 1}`)
2. Upload file JPEG lên presigned URL
3. Confirm upload với mediaIds array
4. Create post với mediaId từ step 1

**Expected Result:**
- Tất cả các step đều thành công
- Post được tạo với media đã upload
- Media có status `READY` và có `originalUrl`

---

### Test Case 2: Create Post với Multiple Images

**Mục tiêu:** Test với nhiều images trong một post

**Steps:**
1. Request batch upload với 2-3 items
2. Upload từng file lên presigned URL tương ứng
3. Confirm từng upload
4. Create post với tất cả mediaIds

**Expected Result:**
- Tất cả media được upload và confirm thành công
- Post được tạo với tất cả media

---

### Test Case 3: Invalid MimeType

**Mục tiêu:** Test validation mimeType

**Steps:**
1. Request batch upload với `mimeType: "video/mp4"`

**Expected Result:**
- Response 400 Bad Request
- Error message về mimeType không hợp lệ

---

### Test Case 3.1: Missing Transform Field

**Mục tiêu:** Test validation transform field (required)

**Steps:**
1. Request batch upload với item không có field `transform`

**Expected Result:**
- Response 400 Bad Request
- Error message về transform field là required

---

### Test Case 3.2: Invalid Transform Values

**Mục tiêu:** Test validation transform values

**Steps:**
1. Request batch upload với `transform.scaleX: 2` (không phải 1 hoặc -1)
2. Request batch upload với `transform.scaleY: 0.5` (không phải 1 hoặc -1)
3. Request batch upload với `transform.rotation: "90"` (không phải integer)

**Expected Result:**
- Response 400 Bad Request
- Error message về transform values không hợp lệ

---

### Test Case 4: File Size Exceeded

**Mục tiêu:** Test validation file size

**Steps:**
1. Request batch upload với `size: 10000000` (vượt quá 8MB)

**Expected Result:**
- Response 400 Bad Request
- Error message về size vượt quá limit

---

### Test Case 5: Confirm Upload với Media không tồn tại

**Mục tiêu:** Test error handling

**Steps:**
1. Confirm upload với `mediaIds` chứa ID không tồn tại

**Expected Result:**
- Response 400 Bad Request
- Error message: "Media key not found" hoặc "Media not found"

---

### Test Case 6: Create Post với Media chưa READY

**Mục tiêu:** Test validation media status

**Steps:**
1. Request batch upload
2. Upload file (nhưng chưa confirm)
3. Create post với mediaId từ step 1

**Expected Result:**
- Response 400 Bad Request
- Error message: "Some media is not READY or not owned by user"

---

### Test Case 7: Create Post với Media của user khác

**Mục tiêu:** Test authorization

**Steps:**
1. User A: Request batch upload và confirm
2. User B: Create post với mediaId của User A

**Expected Result:**
- Response 400 Bad Request
- Error message: "Some media is not READY or not owned by user"

---

## Test Scenarios

### Scenario 1: Happy Path - Tạo Post Thành Công

1. Login để lấy `access_token`
2. Request batch upload với 1 image (bao gồm transform field)
3. Upload file lên R2
4. Confirm upload với mediaIds array
5. Create post
6. Verify post trong feed

**Expected:** Tất cả steps thành công, post xuất hiện trong feed, media có transform field

---

### Scenario 2: Upload Multiple Images

1. Request batch upload với 3 images (mỗi image có transform riêng)
2. Upload từng file lên R2
3. Confirm upload với tất cả 3 mediaIds trong một request
4. Create post với 3 mediaIds

**Expected:** Post được tạo với 3 images, mỗi image giữ nguyên transform đã gửi

---

### Scenario 3: Presigned URL Expired

1. Request batch upload
2. Đợi hơn 15 phút (expiresIn)
3. Upload file lên presigned URL

**Expected:** Upload fail với error về expired URL

---

### Scenario 4: Retry Confirm Upload

1. Request batch upload
2. Upload file
3. Confirm upload lần 1 với mediaIds (thành công)
4. Confirm upload lần 2 (với cùng mediaIds)

**Expected:** Lần 2 fail vì media đã không còn status PENDING

---

### Scenario 5: Upload với Transform Khác Nhau

1. Request batch upload với 2 images:
   - Image 1: `transform: {rotation: 90, scaleX: 1, scaleY: 1}`
   - Image 2: `transform: {rotation: 0, scaleX: -1, scaleY: 1}`
2. Upload từng file lên R2
3. Confirm upload với cả 2 mediaIds
4. Create post với 2 mediaIds

**Expected:** Post được tạo, mỗi image giữ nguyên transform riêng của nó

---

## Troubleshooting

### Lỗi: "Media key not found" hoặc "Media not found"
- **Nguyên nhân:** Media chưa có `mediaKey` hoặc media không tồn tại
- **Giải pháp:** Đảm bảo đã gọi request batch upload trước khi confirm và mediaId đúng

### Lỗi: "transform must be an object" hoặc validation errors về transform
- **Nguyên nhân:** 
  - Thiếu field `transform` trong request batch upload
  - `transform.rotation` không phải integer
  - `transform.scaleX` hoặc `transform.scaleY` không phải 1 hoặc -1
- **Giải pháp:** 
  - Đảm bảo gửi đầy đủ field `transform` với cấu trúc: `{rotation: number, scaleX: 1|-1, scaleY: 1|-1}`
  - Ví dụ: `{"rotation": 90, "scaleX": 1, "scaleY": -1}`

### Lỗi: "Some media is not READY or not owned by user"
- **Nguyên nhân:** 
  - Media chưa được confirm (status vẫn là PENDING)
  - Media không thuộc về user hiện tại
- **Giải pháp:** Đảm bảo đã confirm upload và media thuộc về user

### Lỗi: "mimeType must be one of: ..."
- **Nguyên nhân:** MimeType không hợp lệ
- **Giải pháp:** Chỉ dùng các mimeType được phép: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`

### Lỗi: Upload file lên R2 fail
- **Nguyên nhân:** 
  - Presigned URL đã hết hạn
  - File size vượt quá limit
  - Content-Type không khớp
- **Giải pháp:** 
  - Kiểm tra `expiresIn` trong response step 1
  - Đảm bảo file size <= size đã khai báo
  - Đảm bảo Content-Type header khớp với mimeType

### Lỗi: "Media not found, does not belong to user, or is not in PENDING status"
- **Nguyên nhân:** 
  - Media không tồn tại
  - Media không thuộc về user
  - Media đã được confirm rồi (status không còn PENDING)
- **Giải pháp:** Kiểm tra mediaId và đảm bảo chưa confirm

---

## Tips

1. **Sử dụng Postman Variables:** Lưu `media_id_1`, `upload_url_1` vào environment variables để dùng lại
2. **Test Scripts:** Thêm scripts trong Tests tab để tự động set variables
3. **File Upload:** Sử dụng binary body type trong Postman để upload file
4. **Timeout:** Presigned URL có thời hạn 15 phút, upload file trong thời gian này
5. **Multiple Files:** Có thể request tối đa 3 items trong một batch upload request
6. **Transform Field:** Luôn gửi field `transform` trong request batch upload với:
   - `rotation`: số nguyên (0, 90, 180, 270, ...)
   - `scaleX`: 1 (bình thường) hoặc -1 (flip ngang)
   - `scaleY`: 1 (bình thường) hoặc -1 (flip dọc)
7. **Confirm Upload:** Sử dụng array `mediaIds` thay vì single `mediaId`, có thể confirm nhiều media cùng lúc

---

## Related Documentation

- [Authentication Testing Guide](./AUTHENTICATION_TESTING_GUIDE.md) - Hướng dẫn login để lấy access_token
- [Fingerprint Guide](./FINGERPRINT.md) - Hướng dẫn về x-client-fingerprint header
- [Post Testing Guide](./POST_TESTING_GUIDE.md) - Hướng dẫn test các API liên quan đến Post
