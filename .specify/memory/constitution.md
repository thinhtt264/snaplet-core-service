<!--
Sync Impact Report
- Version change: N/A -> 1.0.0
- Modified principles:
  - [PRINCIPLE_1_NAME] -> I. Domain-Driven Module Boundaries
  - [PRINCIPLE_2_NAME] -> II. Contract-First API and Event Design
  - [PRINCIPLE_3_NAME] -> III. Verification Before Merge
  - [PRINCIPLE_4_NAME] -> IV. Security and Secrets by Default
  - [PRINCIPLE_5_NAME] -> V. Operability and Failure Transparency
- Added sections:
  - Engineering Standards
  - Delivery Workflow and Quality Gates
- Removed sections:
  - None
- Templates requiring updates:
  - ✅ `.specify/templates/plan-template.md` (validated; Constitution Check placeholder remains compatible)
  - ✅ `.specify/templates/spec-template.md` (validated; scenarios + requirements structure remains compatible)
  - ✅ `.specify/templates/tasks-template.md` (validated; supports test and operational work items)
  - ⚠ pending `.specify/templates/commands/*.md` (directory not present in repository)
  - ✅ `.cursor/commands/speckit.constitution.md` (validated reference to generic agent guidance)
- Follow-up TODOs:
  - None
-->
# Snaplet Core Service Constitution

## Core Principles

### I. Domain-Driven Module Boundaries
All new behavior MUST be implemented within explicit feature modules
(`src/modules/*`) with clear ownership of controllers, services, DTOs, and
data access concerns. Cross-module calls MUST use stable interfaces and MUST
NOT bypass module boundaries through ad-hoc imports.
Rationale: Clear boundaries reduce coupling, improve change safety, and keep
the service maintainable as feature count grows.

### II. Contract-First API and Event Design
External contracts (HTTP/WebSocket payloads, events, and persistence-facing
DTOs) MUST be defined before implementation and validated with class-validator
or equivalent schema checks. Breaking contract changes MUST be explicitly
documented and migration-safe.
Rationale: Contract discipline prevents consumer regressions and keeps
multi-client integrations predictable.

### III. Verification Before Merge
Every functional change MUST include reproducible verification evidence:
automated tests when behavior is testable in isolation, plus targeted manual
validation steps for integration-heavy flows. A change is not complete until
the relevant test and validation commands pass locally or in CI.
Rationale: Enforced verification lowers regression risk and preserves delivery
confidence.

### IV. Security and Secrets by Default
Authentication, authorization, and transport safeguards MUST be preserved or
strengthened with every change. Secrets MUST be sourced from environment or
secret managers and MUST NOT be committed to the repository. Inputs from
untrusted clients MUST be validated and sanitized before use.
Rationale: Secure defaults reduce the blast radius of feature work and protect
user and system data.

### V. Operability and Failure Transparency
Production-impacting flows MUST produce actionable logs/metrics and MUST fail
with explicit, traceable error paths. Background jobs, websocket flows, and
third-party integrations MUST include retry/timeout behavior or documented
failure handling.
Rationale: Observable systems shorten incident response time and improve
reliability under real-world conditions.

## Engineering Standards

- Runtime and tooling MUST remain aligned with Node.js 22+ and TypeScript.
- NestJS framework patterns (modules, providers, guards, interceptors, pipes)
  MUST be preferred over custom framework-like abstractions.
- Linting and formatting MUST pass for touched files before merge.
- New dependencies SHOULD be justified in plan/spec artifacts when native or
  existing project capabilities are insufficient.

## Delivery Workflow and Quality Gates

- Work items MUST trace to a specification and implementation plan when using
  Speckit workflows.
- Pull requests MUST document scope, risk, test evidence, and any operational
  rollout/rollback considerations.
- High-risk changes (auth, permissions, data model changes, infra integrations)
  MUST include at least one independent reviewer.
- If a principle cannot be satisfied, the exception MUST be documented in the
  relevant plan under a clear complexity/risk justification.

## Governance

This constitution is the authoritative engineering policy for this repository
and supersedes conflicting local practices.

Amendment process:
1. Propose a change with rationale and impact on templates/workflows.
2. Update this file and run a consistency pass across dependent templates and
   command guidance.
3. Record the version bump according to semantic governance versioning.

Versioning policy:
- MAJOR: Incompatible principle removals or redefinitions.
- MINOR: New principle/section or materially expanded mandates.
- PATCH: Clarifications, wording improvements, or non-semantic refinements.

Compliance review expectations:
- Every plan/spec/tasks artifact generated for feature work MUST be checked for
  constitution alignment.
- Reviewers SHOULD block merges that violate non-negotiable principles unless a
  documented exception is approved.

**Version**: 1.0.0 | **Ratified**: 2026-03-27 | **Last Amended**: 2026-03-27
