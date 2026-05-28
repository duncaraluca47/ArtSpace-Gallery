# Bronze Backend Technology Benchmark

## Goal
Select a free backend framework and technology stack for ArtSpace Gallery Bronze requirements:
- REST API for CRUD + statistics
- strict server-side validation
- in-memory storage only (no persistence)
- separated endpoint layer
- server-side pagination
- high testability and high coverage

## Candidate Frameworks (Free, Open Source)
- Express.js
- Fastify
- NestJS
- Hono
- Koa

## Evaluation Criteria
Scoring: 1 (weak) to 5 (excellent)

| Criterion | Express | Fastify | NestJS | Hono | Koa |
|---|---:|---:|---:|---:|---:|
| Learning curve for small team | 5 | 4 | 2 | 4 | 4 |
| Validation ecosystem maturity | 5 | 4 | 5 | 4 | 3 |
| Runtime performance (typical) | 3 | 5 | 4 | 5 | 3 |
| Testing ergonomics | 5 | 4 | 4 | 4 | 4 |
| Community + documentation | 5 | 4 | 5 | 3 | 4 |
| TypeScript developer experience | 4 | 4 | 5 | 4 | 3 |
| Bronze assignment fit | 5 | 5 | 3 | 4 | 4 |
| **Weighted total (fit-focused)** | **4.65** | **4.55** | **4.05** | **4.10** | **3.70** |

Weights used:
- Bronze fit 25%
- Learning curve 20%
- Validation ecosystem 15%
- Testing ergonomics 15%
- Community + docs 10%
- TypeScript DX 10%
- Runtime performance 5%

## Competitor Analysis Notes
- Fastify and Hono are excellent on performance, but performance is not the primary Bronze bottleneck.
- NestJS is powerful, but for a compact lab-grade API it adds architectural overhead.
- Express has the largest middleware ecosystem and lowest onboarding friction.
- Koa is clean but requires more manual setup for parity with Express ecosystem support.

## Selected Stack
- Runtime: Node.js
- Framework: Express.js
- Language: TypeScript
- Validation: Zod
- Test stack: Vitest + Supertest
- Storage: in-memory repository class (array-based), process-local only

## Logical Assertions for Lab Justification
1. If assignment risk is dominated by correctness and delivery time, then lower framework complexity reduces delivery risk.
2. Express + Zod minimizes complexity while keeping strict validation and testability.
3. Bronze requires no persistence; an in-memory store class provides deterministic behavior and easy reset in tests.
4. High coverage target is easier with explicit service and route separation plus Supertest endpoint tests.
5. Therefore, Express + TypeScript + Zod + Vitest/Supertest is an optimal Bronze stack for this project.

## Community Best Practices Applied
- Layer separation: routes -> service -> store.
- Schema-first request validation with consistent 400 payloads.
- Centralized error handling and explicit 404 handling.
- Pagination defaults and safety limits to avoid abuse.
- Deterministic tests that reset memory state per test app instance.
