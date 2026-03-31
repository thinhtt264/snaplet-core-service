## Merged Features Log

### add-post-reactions - 2026-03-27
**Branch:** 001-add-post-reactions  
**Spec:** specs/001-add-post-reactions

**What was added:**
- Friend-only post reaction flows with overwrite semantics (`PUT` replace behavior).
- Owner-facing reaction actor list containing basic profile + reaction type.
- Response contract simplification to direct array without pagination wrapper and without aggregate count fields.
- Redis-backed actor list caching keyed by `postId` with active invalidation on reaction mutations.

**New Components:**
- `src/modules/posts/constants/post-reaction.constants.ts`
- `src/modules/posts/dto/react-to-post.dto.ts`
- `src/modules/posts/dto/post-reaction-param.dto.ts`
- `src/modules/posts/interfaces/post-reaction-response.interface.ts`
- `src/modules/posts/interfaces/post-reaction-repository.interface.ts`
- `src/modules/posts/repositories/post-reaction.repository.ts`
- `src/modules/posts/schemas/post-reaction.schema.ts`
- `src/common/constants/redis-keys.constants.ts` (new feature key)

**Tasks Completed:** 34/34 tasks

### Revision: Archive Sync 2026-03-27
- Reason: Created initial changelog memory entry from archived feature artifacts. [Source: specs/001-add-post-reactions]
