# EZRA Integration Exploration Report
## Analysis of MAH SDK, Agen-MVP, and Quiz-to-build

**Date:** March 29, 2026  
**Status:** Completed Exploration | Plan Mode (Read-Only)  
**Goal:** Understand what capabilities already exist to avoid duplication and identify integration potential

---

## Executive Summary

Three interconnected TypeScript projects have been identified that EZRA should integrate with:

1. **MAH SDK** (C:\Dev\MAH) - Multi-Agent Hierarchy Orchestrator framework
2. **Agen-MVP** (C:\Dev\Agen-MVP) - Reward/reputation service microservice  
3. **Quiz-to-build** (C:\Dev\quiz-to-build) - Adaptive questionnaire + auto-documentation system

All three are EZRA-governed projects with .ezra/ directories containing governance rules, decisions, and progress tracking.

---

## Project Analysis Matrix

| Aspect | MAH SDK | Agen-MVP | Quiz-to-build |
|--------|---------|----------|---------------|
| **Purpose** | Multi-agent orchestrator framework | Reputation/tier progression service | Questionnaire → technical docs generator |
| **Primary Framework** | TypeScript, NestJS | NestJS 11 | NestJS 10 (API) + React 19 (web) |
| **Port** | N/A (library) | 3200 | N/A (full app) |
| **Package Manager** | npm workspaces | npm 10.9.4 | npm (monorepo) |
| **Node Version** | ≥20.0.0 | ≥22.0.0 | ≥22.0.0 |
| **Database** | PostgreSQL (auto-migration) | PostgreSQL + Prisma | PostgreSQL + Prisma |
| **AI/LLM Integration** | ✅ Provider-agnostic adapters (Anthropic, OpenAI, Google, Ollama) | ✅ @anthropic-ai/sdk 0.78.0 | ✅ Claude + document generation |
| **Task Orchestration** | ✅ Core competency - hierarchical agent routing | ✅ Agent management, tier progression | ✅ Form logic → document pipeline |
| **Job Queue** | ✅ Bull/BullMQ + Redis | ✅ Bull/BullMQ + Redis | ✅ Bull/BullMQ + Redis |
| **Webhook/Notification** | ✅ Comms package (Telegram, WhatsApp, Email, SMS, Voice/Twilio, Webhooks) | ❓ Unknown | ❓ Unknown |
| **Web Scraping** | ❓ Unknown | ❓ Unknown | ❓ Unknown |
| **File Processing** | ✅ PDF, Word, Excel, CSV, OCR | ❓ Unknown | ✅ DOCX, PDF export |
| **Status** | Production-ready, 16-section architecture | Production-ready | Production-ready (94.20/100 UX, 792/792 tests) |

---

## Detailed Project Breakdowns

### 1. MAH SDK (Multi-Agent Hierarchy Orchestrator)
**Location:** C:\Dev\MAH  
**Type:** Core orchestration framework (library)  
**Status:** Production-ready

#### Capabilities

**Core Orchestration:**
- Hierarchical agent routing and task distribution
- Provider-agnostic AI model adapters: Anthropic, OpenAI, Google, Ollama
- Agent tier-based task routing
- Decision logging with approval workflows
- Evidence registry system

**Communication Gateways (Comms Package):**
- Telegram, WhatsApp
- Email (Microsoft Graph)
- SMS (Twilio)
- Voice/Call (Twilio)
- Generic Webhooks
- Notification scheduling

**File Processing Pipeline:**
- PDF parsing and extraction
- Word document processing (.docx)
- Excel spreadsheet handling
- CSV data processing
- OCR (optical character recognition)

**Agent Management:**
- Skill parser (@bas-more/skills)
- Skill security scanner (prompt injection, shell execution, credential harvesting detection)
- Skill registry and loader (context-aware skill injection)
- Memory vault (persistent key-value store with TTL)

**Premium Features (@bas-more/premium):**
- ISO document schemas (business plans, privacy policies, security policies, etc.)
- Pre-built 8-agent configuration packs
- Tier 2 cross-model validation (primary + secondary model comparison)
- MCP tool definitions for protocol exposure
- Dashboard interface types

#### API Surface
```typescript
const orchestrator = await init({
  models: { primary: 'anthropic', secondary?: 'openai' },
  database: { url: 'postgresql://...' },
  redis: { url: 'redis://...' }
});

const result = await orchestrator.processInstruction('user instruction text');
```

#### Integration Potential with EZRA
- **HIGH:** Use as core task orchestration engine
- **HIGH:** Leverage communication gateways for notifications
- **MEDIUM:** Use skill system for extensibility
- **MEDIUM:** Integrate file processing pipeline

#### Dependencies
- NestJS framework
- PostgreSQL + auto-migrations
- Redis (job queue, caching)
- Bull/BullMQ for task queues
- OpenTelemetry for observability
- @anthropic-ai/sdk for Claude access

---

### 2. Agen-MVP (Reward Service Microservice)
**Location:** C:\Dev\Agen-MVP  
**Type:** NestJS microservice  
**Status:** Production-ready  
**Port:** 3200

#### Capabilities

**Core Features (10 modules):**
1. **Agents Module** - Agent registration, profile management, metrics
2. **Reputation Module** - Score calculation, contribution tracking
3. **Tiers Module** - 20-tier progression system with thresholds
4. **Deductions Module** - Penalty management, appeal workflows
5. **Coaching Module** - Improvement suggestions, skill development
6. **Gan-Eden Module** - Specialized domain (exact purpose TBD from code)
7. **Supervisor Module** - Agent oversight and monitoring
8. **Feature-Flags Module** - A/B testing, gradual rollouts
9. **Audit Module** - Complete action logging
10. **Health Module** - Service health checks

**Technical Stack:**
- NestJS 11.0.0 framework
- PostgreSQL + Prisma ORM (schema auto-generation)
- Bull/BullMQ for async job processing
- Redis for queuing
- @anthropic-ai/sdk 0.78.0 for Claude integration
- JWT authentication with Passport

**Quality & Observability:**
- OpenTelemetry instrumentation
- Metrics collection with prom-client
- Winston logging
- Jest test suite
- Docker compose for local development

#### API Surface
(Inferred from module structure - likely REST endpoints for agent management, tier progression, reputation scoring, coaching recommendations)

#### Integration Potential with EZRA
- **HIGH:** Agent reputation/tier progression tracking
- **MEDIUM:** Leverage audit module for action logging
- **MEDIUM:** Integration with coach module for improvement recommendations
- **LOW:** Feature-flags system could support EZRA feature rollouts

#### Key Dependencies
- @anthropic-ai/sdk (Claude API access)
- @nestjs/bull, @nestjs/bullmq (task queuing)
- @nestjs/jwt, passport-jwt (authentication)
- @nestjs/swagger (API documentation)
- @nestjs/throttler (rate limiting)

---

### 3. Quiz-to-build (Adaptive Questionnaire + Documentation Generator)
**Location:** C:\Dev\quiz-to-build  
**Type:** Full-stack monorepo application  
**Status:** Production-ready (v1.0.0)

#### Capabilities

**User-Facing:**
- **Adaptive Questionnaires** - 11 question types, branching logic, auto-save every 30s
- **Intelligent Scoring** - 7 technical dimensions with heatmap visualization
- **Auto-Documentation** - Generates 8+ professional document types (45+ pages each):
  - Architecture Dossier
  - SDLC Playbook
  - Test Strategy
  - DevSecOps Guide
  - Policy Packages
  - And 3+ more types
- **Document Export** - DOCX (editable) and PDF formats
- **Compliance Tracking** - Evidence registry, decision logs, audit trails

**Technical Stack:**

*Backend (apps/api):*
- NestJS 10.3.0
- PostgreSQL + Prisma ORM
- Stripe payment integration
- Azure Storage Blob (document hosting)
- Bull/BullMQ + Redis
- Archiver for package generation
- docx library for DOCX generation

*Frontend (apps/web):*
- React 19 with TypeScript
- Vite 7 bundler
- Tailwind CSS 4
- Offline support (IndexedDB)
- Mobile-responsive

*CLI (apps/cli):*
- Command-line interface for batch operations

#### Scoring Dimensions
1. Modern Architecture (cloud, microservices, APIs)
2. AI-Assisted Development (AI tools, automation)
3. Coding Standards (code quality, reviews)
4. Testing & QA (test coverage, automation)
5. Security & DevSecOps (security practices)
6. Workflow & Operations (CI/CD, deployment)
7. Documentation (technical docs, knowledge sharing)

#### Quality Metrics
- **Tests:** 792/792 passing (100% coverage)
- **UX Score:** 94.20/100 (Nielsen heuristics)
- **Accessibility:** WCAG 2.2 Level AA compliant
- **Performance:** <2.1s page load, <150ms API response
- **Security:** 0 production vulnerabilities

#### Pricing Model
| Plan | Cost | Questionnaires | Documents | Support |
|------|------|----------------|-----------|---------|
| Free | $0/mo | 1 | 3 | Community |
| Professional | $49/mo | 10 | 50 | Email |
| Enterprise | $199/mo | Unlimited | Unlimited | 24/7 |

#### Integration Potential with EZRA
- **MEDIUM:** Document generation pipeline could extend to other document types
- **MEDIUM:** Questionnaire logic could support EZRA workflow design
- **LOW:** Scoring dimensions concept applicable to agent evaluation
- **LOW:** Stripe integration as model for payment processing

---

## Integration Architecture Opportunities

### Recommended Integration Pattern

```
EZRA (Governance Layer)
    ↓
MAH SDK (Orchestration Engine)
    ├─→ Agen-MVP (Agent Reputation Service)
    ├─→ Communication Gateways (Notifications)
    └─→ File Processing Pipeline (Document handling)
    ↓
Quiz-to-build (Specialized Domain Application)
    └─→ Document Generation for assessment results
```

### No Duplication Areas Identified

✅ **Orchestration:** Use MAH SDK as core engine (don't rebuild)  
✅ **Agent Management:** Agen-MVP handles reputation/progression  
✅ **Communication:** MAH SDK comms package covers Telegram, WhatsApp, Email, SMS, Voice, Webhooks  
✅ **File Processing:** MAH SDK pipeline handles PDF, Word, Excel, CSV, OCR  
✅ **Document Generation:** Quiz-to-build has proven DOCX/PDF export pipeline  

### Integration Points to Develop

1. **EZRA → MAH SDK:** Direct integration as task orchestration engine
2. **MAH SDK → Agen-MVP:** Agent identity bridge, tier-aware task routing
3. **MAH SDK → Quiz-to-build:** Leverage document generation for task outputs
4. **EZRA → All:** Governance framework enforcement across all three systems

---

## Governance Status

All three projects include EZRA governance:

- **.ezra/ directories** present in all repos
- **Decision logs** tracking architectural choices
- **Governance rules** enforced via configuration
- **Knowledge state** tracked across projects

---

## Recommendations for EZRA Development

### DO: Leverage Existing Capabilities
1. Use MAH SDK as foundation for orchestration (don't rebuild)
2. Integrate Agen-MVP for agent reputation tracking
3. Build communication workflows on MAH SDK gateways
4. Use Quiz-to-build's document pipeline for output generation

### DON'T: Duplicate
1. Don't create alternative orchestrator (MAH SDK exists)
2. Don't create separate agent tier system (Agen-MVP handles this)
3. Don't build communication layer (MAH SDK comms package complete)
4. Don't create new document generation (Quiz-to-build proven)

### EXPLORE: Strategic Connections
1. How can EZRA governance layer coordinate across all three systems?
2. Can agent progression (Agen-MVP) influence task routing (MAH SDK)?
3. How should evidence/audit trails flow between systems?
4. What shared event stream would coordinate these systems?

---

## Key Files Referenced

| Project | File | Content |
|---------|------|---------|
| MAH SDK | C:\Dev\MAH\package.json | Root monorepo, workspace config |
| MAH SDK | C:\Dev\MAH\ARCHITECTURE.md | 16-section system design |
| MAH SDK | C:\Dev\MAH\packages\core\README.md | Core API documentation |
| MAH SDK | C:\Dev\MAH\packages\comms\README.md | 6 communication gateways |
| MAH SDK | C:\Dev\MAH\packages\skills\README.md | Skill registry and loader |
| MAH SDK | C:\Dev\MAH\packages\premium\README.md | Premium features |
| Agen-MVP | C:\Dev\Agen-MVP\package.json | Service config, 10 modules |
| Agen-MVP | C:\Dev\Agen-MVP\README.md | Service documentation |
| Quiz-to-build | C:\Dev\quiz-to-build\package.json | Monorepo apps, libraries |
| Quiz-to-build | C:\Dev\quiz-to-build\README.md | 443-line comprehensive guide |

---

## Next Steps (When Exiting Plan Mode)

Once user requests execution:

1. **Propose integration architecture** based on recommendations above
2. **Identify specific EZRA modifications** needed for MAH SDK integration
3. **Plan Agen-MVP bridge** for agent reputation feedback
4. **Design event coordination** system across all three projects
5. **Create integration roadmap** with phases and dependencies

---

**Status:** ✅ EXPLORATION COMPLETE
**Awaiting:** User direction to proceed beyond plan mode
