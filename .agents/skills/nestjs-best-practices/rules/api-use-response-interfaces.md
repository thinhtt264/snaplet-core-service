---
title: Define Explicit Response Interfaces in Controllers
impact: MEDIUM
impactDescription: Improves API contract clarity and reduces accidental response drift
tags: api, interfaces, response, contracts, typescript
---

## Define Explicit Response Interfaces in Controllers

When a controller returns structured response data (especially wrapped objects like `{ data, meta }`), define and use explicit response interfaces or DTOs instead of inline object literals. This makes API contracts self-documenting, easier to reuse, and safer during refactors.

**Incorrect (inline response shapes in controllers):**

```typescript
@Get(':id')
async getPost(@Param('id') id: string): Promise<any> {
  const post = await this.postsService.findById(id);

  return {
    data: {
      id: post._id.toString(),
      caption: post.caption,
    },
    meta: {
      fetchedAt: new Date().toISOString(),
    },
  };
}
```

```typescript
@Post('verify-token')
verifyToken(@AccessToken() token: string) {
  const payload = this.authService.verifyJwtToken(token);
  return {
    success: true,
    data: payload,
  };
}
```

**Correct (explicit response interface/DTO contract):**

```typescript
interface VerifyTokenResponse {
  success: boolean;
  data: JwtPayload;
}

interface PostDetailResponse {
  data: {
    id: string;
    caption: string;
  };
  meta: {
    fetchedAt: string;
  };
}

@Get(':id')
async getPost(@Param('id') id: string): Promise<PostDetailResponse> {
  const post = await this.postsService.findById(id);
  return {
    data: {
      id: post._id.toString(),
      caption: post.caption,
    },
    meta: {
      fetchedAt: new Date().toISOString(),
    },
  };
}

@Post('verify-token')
verifyToken(@AccessToken() token: string): VerifyTokenResponse {
  const payload = this.authService.verifyJwtToken(token);
  return {
    success: true,
    data: payload,
  };
}
```

Reference: [TypeScript Handbook - Interfaces](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#interfaces)
