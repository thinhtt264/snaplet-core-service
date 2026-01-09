# Fingerprint Documentation

## Mục Lục
1. [Tổng Quan](#tổng-quan)
2. [Header Structure](#header-structure)
3. [Payload Structure](#payload-structure)
4. [Validation Rules](#validation-rules)
5. [Error Handling](#error-handling)
6. [Configuration](#configuration)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)
9. [Migration Notes](#migration-notes)

---

## Tổng Quan

Fingerprint là cơ chế thu thập và xác thực thông tin client (device và network) để tăng cường bảo mật và theo dõi. Hệ thống sử dụng header `X-Client-Fingerprint` để nhận fingerprint từ client.

### Tính Năng Chính
- **Device Fingerprinting**: Thu thập thông tin thiết bị (deviceId, platform, model, appVersion)
- **Network Fingerprinting**: Thu thập thông tin mạng (IP, userAgent, proxy)
- **Timestamp Validation**: Kiểm tra tính hợp lệ của timestamp (có thể bật/tắt)
- **Global Guard**: Tự động validate cho tất cả routes (trừ health check)

---

## Header Structure

### Header Name
```
X-Client-Fingerprint
```

### Format
Header chứa một chuỗi JSON được encode base64.

### Required
- **Bắt buộc** cho tất cả requests (trừ health check routes: `/health`, `/health/db`)
- Nếu thiếu header, request sẽ bị reject với error `INVALID_FINGERPRINT`

---

## Payload Structure

### JSON Payload (trước khi encode base64)

```json
{
  "deviceId": "abc-123",
  "platform": "android",
  "model": "SM-S918B",
  "appVersion": "1.2.3",
  "ip": "1.2.3.4",
  "userAgent": "MyApp/1.2.3",
  "ts": 1736932800
}
```

### Fields

#### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `deviceId` | `string` | Unique device identifier | `"abc-123"` |
| `platform` | `string` | Platform name (must be 'ios' or 'android') | `"android"`, `"ios"` |
| `appVersion` | `string` | Application version | `"1.2.3"` |

#### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `model` | `string` | Device model | `"SM-S918B"`, `"iPhone 15 Pro"` |
| `ip` | `string` | Client IP address | `"1.2.3.4"` |
| `userAgent` | `string` | User agent string | `"MyApp/1.2.3"` |
| `proxy` | `string` | Proxy information | `"proxy-server"` |
| `ts` | `number` | Unix timestamp (seconds) | `1736932800` |

**Lưu ý**: Field `ts` là optional nhưng được khuyến nghị. Validation timestamp có thể được bật/tắt qua config.

---

## Validation Rules

### 1. Base64 Decoding
- Header phải là chuỗi base64 hợp lệ
- Nếu decode fail → Error: `INVALID_FINGERPRINT`

### 2. JSON Parsing
- Sau khi decode, phải là JSON hợp lệ
- Nếu parse fail → Error: `INVALID_FINGERPRINT`

### 3. Required Fields Validation
- Phải có đầy đủ: `deviceId`, `platform`, `appVersion`
- Nếu thiếu → Error: `INVALID_FINGERPRINT` với danh sách fields thiếu

### 4. Platform Validation
- `platform` chỉ có thể là `"ios"` hoặc `"android"`
- Không hỗ trợ `"web"` hoặc các giá trị khác
- Nếu platform không hợp lệ → Error: `INVALID_FINGERPRINT`

### 5. Timestamp Validation (Optional)
- Chỉ validate nếu `ENABLED_TS_CHECK = true`
- Mặc định: `ENABLED_TS_CHECK = false` (tắt validation)
- Nếu bật:
  - `ts` phải tồn tại
  - `ts` không được quá 1 phút trong tương lai (cho phép clock skew)
  - `ts` không được quá 15 phút trong quá khứ
  - Nếu vi phạm → Error: `INVALID_FINGERPRINT`

---

## Error Handling

### Error Response Format

```json
{
  "status": {
    "code": 400,
    "message": "Invalid fingerprint: missing fields: deviceId, platform",
    "meta": {
      "errorCode": "INVALID_FINGERPRINT",
      "message": "Invalid fingerprint: missing fields: deviceId, platform",
      "missingFields": ["deviceId", "platform"]
    }
  },
  "data": null
}
```

### Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `INVALID_FINGERPRINT` | `400 Bad Request` | Fingerprint không hợp lệ |

### Common Error Messages

- `"Missing fingerprint"` - Thiếu header `X-Client-Fingerprint`
- `"Invalid fingerprint format"` - Không thể decode/parse fingerprint
- `"Invalid fingerprint: missing fields: <fields>"` - Thiếu required fields
- `"Fingerprint timestamp is too far in the future"` - Timestamp quá xa trong tương lai
- `"Fingerprint timestamp is too old (max 15 minutes)"` - Timestamp quá cũ (> 15 phút)

---

## Configuration

### Server-Side Configuration

#### Timestamp Validation

File: `src/common/utils/fingerprint.utils.ts`

**Options:**
- `ENABLED_TS_CHECK = false` (default): Bỏ qua validation timestamp
- `ENABLED_TS_CHECK = true`: Validate timestamp (không quá 15 phút, không quá 1 phút trong tương lai)

### Routes Excluded from Fingerprint Validation

Fingerprint validation được skip tự động cho các routes:
- `/health`
- `/health/*`

---

## Best Practices

### 1. Device ID Generation
- Sử dụng unique, persistent device identifier
- Không sử dụng thông tin nhạy cảm (email, phone number)
- Khuyến nghị: UUID hoặc device-specific ID

### 2. Timestamp
- Luôn gửi `ts` field (Unix timestamp in seconds)
- Sử dụng server time hoặc synchronized time
- Không sử dụng client time nếu có thể bị thao túng

### 3. Platform Values
- Chỉ sử dụng giá trị: `"ios"` hoặc `"android"`
- Không hỗ trợ `"web"` hoặc các giá trị khác
- Nếu platform không hợp lệ → Error: `INVALID_FINGERPRINT`

### 4. App Version
- Sử dụng semantic versioning: `"1.2.3"`
- Đảm bảo version string nhất quán

### 5. Error Handling
- Luôn handle error response từ server
- Retry logic nên xử lý `INVALID_FINGERPRINT` error
- Log errors để debug

---

## Troubleshooting

### Issue: "Missing fingerprint" error

**Nguyên nhân:**
- Header `X-Client-Fingerprint` không được gửi
- Header bị misspelled

**Giải pháp:**
- Kiểm tra header name chính xác: `X-Client-Fingerprint` (case-sensitive)
- Đảm bảo header được thêm vào tất cả requests (trừ health check)

### Issue: "Invalid fingerprint format" error

**Nguyên nhân:**
- Base64 encoding sai
- JSON structure không hợp lệ

**Giải pháp:**
- Kiểm tra base64 encoding
- Validate JSON structure trước khi encode
- Đảm bảo không có whitespace thừa

### Issue: "Missing fields" error

**Nguyên nhân:**
- Thiếu required fields: `deviceId`, `platform`, `appVersion`

**Giải pháp:**
- Kiểm tra payload có đầy đủ required fields
- Validate payload trước khi gửi request

### Issue: Timestamp validation fails

**Nguyên nhân:**
- Clock skew giữa client và server
- Timestamp quá cũ (> 15 phút)

**Giải pháp:**
- Đồng bộ thời gian client với server
- Tắt timestamp validation nếu cần: `ENABLED_TS_CHECK = false`

---

## Migration Notes

### Breaking Changes

1. **Removed `X-Device-Id` header**
   - Header `X-Device-Id` không còn được sử dụng
   - `deviceId` phải được gửi trong fingerprint payload
   - Decorator `@DeviceId()` tự động lấy từ fingerprint

2. **Required Fingerprint Header**
   - Tất cả requests (trừ health check) phải có `X-Client-Fingerprint`
   - Requests không có fingerprint sẽ bị reject

### Migration Steps

1. **Update Client Code**
   - Implement fingerprint generation logic
   - Add `X-Client-Fingerprint` header to all requests
   - Remove `X-Device-Id` header usage

2. **Update Server Code**
   - Fingerprint validation tự động qua `FingerprintGuard`
   - Sử dụng `@DeviceId()` decorator để lấy deviceId từ fingerprint
   - Không cần thay đổi logic business

---

## Related Documentation

- [Authentication Testing Guide](./AUTHENTICATION_TESTING_GUIDE.md)
- [User Service Testing Guide](./USER_SERVICE_TESTING_GUILDE.md)
- [Relationship Testing Guide](./RELATIONSHIP_TESTING_GUILDE.md)

---

## Support

Nếu gặp vấn đề, vui lòng liên hệ team development hoặc tạo issue trong repository.
