# Main Product Specification Memory

## Archived Features

### 001-add-post-reactions (2026-03-27) [Source: specs/001-add-post-reactions]

#### User Stories
- **US1 (P1)**: Friend can react to a post and replace previous reaction with a new one.
- **US2 (P2)**: Post owner can fetch the list of users who reacted, including basic profile and reaction type.
- **US3 (P3)**: Access to reaction data is constrained by valid authorization context.

#### Functional Requirements
- **FR-001**: Allow reacting to a post when friendship eligibility is satisfied.
- **FR-002**: Allow changing an existing reaction for the same `(postId, reactorUserId)`.
- **FR-003**: Allow removing an existing reaction.
- **FR-004**: Enforce exactly one active reaction per `(postId, reactorUserId)` with replace semantics.
- **FR-005**: Expose owner-facing reaction actor list for owner's own post.
- **FR-006**: Include basic profile fields and reaction type per actor entry.
- **FR-007**: Return clear empty-list behavior (`[]`) when no reactions exist.
- **FR-008**: Prevent unauthorized access to reaction actor data.
- **FR-009**: Reflect mutation changes on subsequent owner reads.
- **FR-010**: Do not store or return aggregate reaction counts in this feature scope.

#### Key Entities
- **PostReaction**: `postId`, `reactorUserId`, `postOwnerUserId`, `reactionIcon`, timestamps.
- **ReactionActorProfile**: `userId`, `username`, `displayName`, `avatarUrls`.
- **ReactionListView**: owner-facing projection combining actor profile + current reaction.

#### Edge Cases
- Reaction removal after prior reaction.
- Near-simultaneous reactions from multiple users.
- Missing optional profile fields from actors.
- Owner reads during ongoing reaction updates.

#### Success Criteria
- Friend reaction flow succeeds with minimal interaction overhead.
- Owner receives correct actor + reaction data on own post.
- Reaction updates are reflected on subsequent reads.
- Unauthorized users cannot access restricted reaction actor data.

#### Assumptions
- Authenticated user context is required.
- Friendship relation is the eligibility gate for mutation.
- Actor list returns full array without pagination wrapper.

### Revision: Archive Sync 2026-03-27
- Reason: Bootstrapped project memory spec from feature archive for post reactions.
