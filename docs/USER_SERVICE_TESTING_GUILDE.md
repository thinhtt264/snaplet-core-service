# User Service API Testing Guide

## Mục Lục
1. [Tổng Quan](#tổng-quan)
2. [API Endpoints](#api-endpoints)
   - 2.1. [Check Email Availability](#1-check-email-availability)
   - 2.2. [Check Username Availability](#2-check-username-availability)
   - 2.3. [Get User Profile by Username](#3-get-user-profile-by-username)
3. [Testing with Existing Users](#testing-with-existing-users)
4. [Common Error Responses](#common-error-responses)
5. [Tips for Testing](#tips-for-testing)

---

## Tổng Quan

This guide provides comprehensive information for testing all User Service endpoints.

### Base URL
```
http://localhost:3000/api/v1
```

---

## API Endpoints

### 1. Check Email Availability

Check if an email is available for registration.

**Endpoint:** `GET /users/email-availability`

**Query Parameters:**
- `email` (string, required) - Email to check

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/users/email-availability?email=newuser@example.com" \
  -H "Content-Type: application/json"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "available": true
  },
  "message": "Email is available"
}
```

**Email Already Exists Response (200):**
```json
{
  "success": true,
  "data": {
    "available": false
  },
  "message": "Email is already in use"
}
```

**Validation Error (400):**
```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

---

### 2. Check Username Availability

Check if a username is available for registration.

**Endpoint:** `GET /users/username-availability`

**Query Parameters:**
- `username` (string, required) - Username to check

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/users/username-availability?username=johndoe" \
  -H "Content-Type: application/json"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "available": true
  },
  "message": "Username is available"
}
```

**Username Already Exists Response (200):**
```json
{
  "success": true,
  "data": {
    "available": false
  },
  "message": "Username is already taken"
}
```

**Validation Error (400):**
```json
{
  "statusCode": 400,
  "message": ["username should not be empty"],
  "error": "Bad Request"
}
```

---

### 3. Get User Profile by Username

Retrieve user information by username. This endpoint returns public user profile data excluding sensitive information (password and deviceToken).

**Endpoint:** `GET /users/profile/:username`

**Path Parameters:**
- `username` (string, required) - Username of the user to retrieve

**Example Requests:**
```bash
# Basic request
curl -X GET "http://localhost:3000/api/v1/users/profile/johndoe" \
  -H "Content-Type: application/json"

# With verbose output
curl -X GET "http://localhost:3000/api/v1/users/profile/johndoe" \
  -H "Content-Type: application/json" \
  -v

# With formatted JSON (requires jq)
curl -X GET "http://localhost:3000/api/v1/users/profile/johndoe" \
  -H "Content-Type: application/json" | jq
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "email": "john.doe@example.com",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "displayName": "John Doe",
    "avatarUrl": "https://example.com/avatar.jpg",
    "createdAt": "2024-01-01T00:00:00.000Z",
  },
  "message": "User information retrieved successfully"
}
```

**Not Found Response (404):**
```json
{
  "statusCode": 404,
  "message": "User with username 'nonexistentuser' not found"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | User's unique identifier |
| `email` | string | User's email address |
| `username` | string | User's username (unique, lowercase) |
| `firstName` | string | User's first name |
| `lastName` | string | User's last name |
| `displayName` | string | Full name (virtual field: firstName + lastName) |
| `avatarUrl` | string | URL to user's avatar image |
| `createdAt` | Date | Account creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Note:** The following fields are **excluded** from the response for security and privacy:
- `password` - User's hashed password
- `deviceToken` - User's device token for push notifications

---

## Testing with Existing Users

Based on the system logs, you can test with these existing usernames:
- `testuser`
- `newuser1`

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/users/profile/testuser" | jq
```

---

## Common Error Responses

### 400 Bad Request
Validation error - usually due to missing or invalid parameters.

### 404 Not Found
Resource not found - username doesn't exist in the system.

### 500 Internal Server Error
Server error - check server logs for details.

---

## Tips for Testing

1. **Use jq for better JSON formatting:**
   ```bash
   curl http://localhost:3000/api/v1/users/profile/johndoe | jq
   ```

2. **Save response to file:**
   ```bash
   curl http://localhost:3000/api/v1/users/profile/johndoe -o response.json
   ```

3. **Test with verbose output to see headers:**
   ```bash
   curl -v http://localhost:3000/api/v1/users/profile/johndoe
   ```

4. **Test with non-existent user to verify error handling:**
   ```bash
   curl http://localhost:3000/api/v1/users/profile/nonexistentuser
   ```

---