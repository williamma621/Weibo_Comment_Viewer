# Refactoring Next Steps

This document ranks the next refactoring steps for the `Weibo_Comment_Viewer` codebase from most emergent to least emergent.

The goal is not just cleaner code. The goal is to reduce operational risk, improve security, make the app survivable under growth, and create a codebase that can be changed safely.

## Priority 0: Immediate Risk Containment

These items are the most emergent because they expose credentials, create security risk, or can cause silent failure in production.

### 1. Remove hardcoded secrets from source control

Files involved:

- `scraper/deepseekApi.js`
- `scraper/mailService.js`

Problems:

- API keys and Gmail credentials are embedded directly in source.
- In an Electron app, hardcoded secrets are distributed with the app bundle.
- Credential rotation, environment separation, and incident response are all blocked by this design.

Next steps:

- Move all secrets to environment variables or an external secure config source.
- Create a single config module that reads and validates required settings at startup.
- Fail fast with clear startup errors when required config is missing.
- Remove committed credentials from the repo history if they were real.
- Rotate any exposed credentials immediately.

Recommended abstraction:

- `config/appConfig.js`
- `config/validateConfig.js`

Acceptance criteria:

- No secrets remain in committed code.
- App startup clearly reports missing configuration.
- Mail and DeepSeek integrations read credentials from config only.

### 2. Fix renderer-side fetch loops and accidental repeated IPC calls

Files involved:

- `src/components/SavedScrapeList.jsx`

Problems:

- `fetchList()` is called inside render.
- This can trigger repeated IPC requests and repeated file scans.
- As data grows, this will create unnecessary load and unstable rendering behavior.

Next steps:

- Remove the render-time `fetchList()` call.
- Keep fetch behavior inside `useEffect`.
- Add loading and error states for the saved scrape list.
- Refresh the list only when navigation changes or when a new scrape is saved.

Acceptance criteria:

- Sidebar performs one fetch per intended refresh event.
- No re-render loop or redundant IPC traffic occurs.

### 3. Add basic error handling and user-visible failure states

Files involved:

- `src/pages/Home.jsx`
- `src/pages/Dashboard.jsx`
- `src/components/EmailSchedule.jsx`
- `electron/main.js`

Problems:

- Most failures are only logged to the console.
- Users do not get actionable feedback when login, scrape, analysis, schedule, or email fails.
- Production debugging will be difficult.

Next steps:

- Standardize backend error objects returned through IPC.
- Display user-facing error messages in the UI.
- Add loading, success, and failure states for scrape, schedule, and email actions.
- Remove debug `console.log` noise and replace it with structured logging where needed.

Acceptance criteria:

- Main user flows surface clear errors in the UI.
- Debug-only console output is removed or gated.

## Priority 1: Stabilize Architecture

These items are the next most emergent because the current code organization makes change risky and prevents clean scaling.

### 4. Break `electron/main.js` into focused services

Files involved:

- `electron/main.js`

Problems:

- `electron/main.js` currently owns window creation, session/cookie logic, scraping orchestration, persistence, AI analysis, mail sending, and scheduling.
- This is a classic god module.
- Testing and change isolation are difficult.

Next steps:

- Keep `electron/main.js` focused on app bootstrapping and IPC registration.
- Extract service modules:
  - `services/weiboAuthService.js`
  - `services/scrapeService.js`
  - `services/analysisService.js`
  - `services/mailService.js`
  - `services/scheduleService.js`
  - `repositories/scrapeRepository.js`
- Move business logic out of IPC handlers and into service functions.

Recommended target shape:

- IPC handlers should validate input, call one service, and return a result.
- Services should orchestrate workflows.
- Repositories should own persistence details.

Acceptance criteria:

- `electron/main.js` becomes a thin composition layer.
- Business logic is testable without Electron window setup.

### 5. Replace multi-step frontend orchestration with one backend pipeline command

Files involved:

- `src/pages/Home.jsx`
- `electron/main.js`

Problems:

- The renderer manually calls scrape, then analysis, then save.
- Workflow logic is split across UI and backend.
- This increases coupling and makes retries, progress reporting, and transactional behavior harder.

Next steps:

- Create a single IPC endpoint such as `run-full-scrape`.
- Move the full pipeline into backend orchestration:
  - validate URL
  - scrape comments
  - analyze sentiment
  - summarize keywords
  - merge top comments
  - save record
- Return one final payload containing the saved record id and metadata.
- Optionally expose progress events later if needed.

Acceptance criteria:

- Home page calls one backend pipeline action for a full scrape.
- Workflow logic is no longer duplicated across UI and backend.

### 6. Introduce shared types or schema validation for IPC payloads

Files involved:

- `electron/preload.cjs`
- `electron/main.js`
- React components using `window.api`

Problems:

- IPC contracts are implicit and loosely shaped.
- The UI and backend can drift silently.
- Invalid payloads will only fail at runtime.

Next steps:

- Define schemas for each IPC request and response.
- Validate payloads at the IPC boundary.
- If staying in JavaScript, use a schema library.
- If moving to TypeScript later, define shared DTOs and response shapes.

Acceptance criteria:

- Every IPC handler validates inputs.
- Renderer/backend payload shapes are documented and consistent.

## Priority 2: Fix Persistence and Scale Bottlenecks

These items will not hold up as scrape history and usage increase.

### 7. Replace file-scan lookups with indexed persistence

Files involved:

- `electron/main.js`

Problems:

- To find the latest scrape for a URL, the app scans every saved file.
- To build the history list, the app scans every saved file.
- File-by-file JSON parsing becomes slow as the number of scrapes grows.

Next steps:

- Introduce a persistence abstraction first:
  - `saveScrape(record)`
  - `getScrapeById(id)`
  - `listScrapeSummaries()`
  - `getLatestScrapeForUrl(normalizedUrl)`
- Back it with SQLite or another local indexed store.
- Store normalized URL separately for efficient lookup.
- Add metadata columns for `id`, `url`, `normalized_url`, `date`, `display_name`.

Recommended approach:

- Use SQLite for structured querying and future growth.
- Keep raw comment payloads either in JSON columns or separate tables depending on complexity.

Acceptance criteria:

- Latest-by-URL lookup is indexed.
- Saved-scrape listing no longer requires scanning all JSON files.

### 8. Make schedules persistent and restart-safe

Files involved:

- `scraper/scheduleHandler.js`
- `electron/main.js`
- `src/components/EmailSchedule.jsx`

Problems:

- Schedules are stored only in memory.
- Scheduled monitoring disappears on app restart, crash, or sleep.
- `setTimeout` per run is fragile and does not represent durable monitoring.

Next steps:

- Persist schedules in storage.
- Restore active schedules on app startup.
- Track schedule status, next run time, last run time, and last result.
- Support cancellation and editing of schedules.
- Separate schedule definition from timer execution.

Recommended abstraction:

- `repositories/scheduleRepository.js`
- `services/scheduleRunner.js`
- `services/scheduleService.js`

Acceptance criteria:

- App can restart and continue monitoring.
- User can view active schedules and their state.

### 9. Redesign keyword summarization for larger comment sets

Files involved:

- `scraper/deepseekApi.js`

Problems:

- `summarizeKeywords()` sends all comments in one prompt.
- This will hit latency, token, and cost limits on larger datasets.
- One large request is also less retry-friendly.

Next steps:

- Introduce chunked topic extraction.
- Sample or batch comments when the input exceeds a threshold.
- Reduce intermediate topic summaries into a final summary.
- Add request size limits and fallback behavior.

Recommended abstraction:

- `extractKeywordCandidates(commentsChunk)`
- `reduceKeywordCandidates(candidateSets)`
- `summarizeKeywordsForDataset(comments, options)`

Acceptance criteria:

- Keyword summarization works on large datasets without one unbounded prompt.
- Large runs degrade gracefully instead of failing hard.

### 10. Add pagination or virtualization for large comment datasets

Files involved:

- `src/pages/Dashboard.jsx`
- `src/components/CommentTable.jsx`

Problems:

- The dashboard renders the full comment set at once.
- Large tables will slow rendering and scrolling.

Next steps:

- Paginate comments in the UI or virtualize table rendering.
- If data volume grows significantly, fetch comment pages from the backend instead of loading everything into memory at once.
- Separate summary data from detailed comment data.

Acceptance criteria:

- Dashboard remains responsive on large scrapes.

## Priority 3: Improve Domain Modeling and Data Quality

These changes address missing abstractions and weak data modeling that will make future features harder.

### 11. Introduce explicit domain models for comments, scrapes, summaries, and schedules

Files involved:

- `scraper/helper.js`
- `electron/main.js`
- UI components

Problems:

- Data shape is inferred by convention.
- `top_comments`, `comments`, summary objects, and schedule entries have no explicit contract.
- Placeholder values like `"Loading..."` are mixed into persisted data.

Next steps:

- Define stable domain models:
  - `CommentRecord`
  - `TopCommentRecord`
  - `ScrapeRecord`
  - `KeywordSummary`
  - `ScheduleDefinition`
- Replace placeholder strings with nullable fields or status enums.
- Normalize field names and casing consistently.

Acceptance criteria:

- Persisted and UI-consumed data shapes are explicit and documented.
- Placeholder display state is separated from stored business data.

### 12. Centralize comment merge and deduplication logic

Files involved:

- `scraper/helper.js`
- `src/pages/Home.jsx`
- `electron/main.js`

Problems:

- Similar merge logic appears in more than one place.
- The UI currently maps top comments back to analyzed comments by comment text.
- Text-based matching can be ambiguous if duplicate comment text exists.

Next steps:

- Move all comment merge rules into one backend utility or service.
- Introduce stable identifiers where possible.
- Define one canonical method for deriving top comments and attaching analysis.

Acceptance criteria:

- Comment merge logic exists in one place only.
- UI does not have to reconstruct backend business rules.

### 13. Improve Weibo scraping boundary and anti-fragility

Files involved:

- `scraper/weiboApi.js`
- `electron/main.js`

Problems:

- Scrape logic has basic retries but no structured error taxonomy.
- Request pacing, retry policy, and auth failure handling are tightly coupled.
- Regex URL parsing is brittle.

Next steps:

- Add structured error classes:
  - invalid URL
  - auth expired
  - rate limited
  - upstream changed
  - transient network failure
- Separate request client setup from pagination logic.
- Normalize and validate Weibo URLs with a dedicated parser.
- Add configurable retry and backoff settings.

Acceptance criteria:

- Failures are classified and recoverable where possible.
- Scraping logic is easier to test and evolve.

## Priority 4: Add Test Safety Nets

These are less emergent than the items above, but they are necessary to prevent future regressions while refactoring.

### 14. Add unit tests for pure helpers and services

Files involved:

- `scraper/helper.js`
- future service and repository modules

Next steps:

- Add tests for:
  - `convertPostId`
  - duplicate aggregation
  - top comment formatting
  - schedule execution time generation
  - comment merge behavior
  - URL normalization

Acceptance criteria:

- Core pure logic is covered by unit tests before heavy refactors land.

### 15. Add integration tests for core backend workflows

Files involved:

- Electron backend services

Next steps:

- Add tests for:
  - full scrape pipeline orchestration
  - latest-scrape lookup
  - schedule persistence and restore
  - mail generation

Acceptance criteria:

- Critical workflows can be exercised without manual clicking.

### 16. Add UI tests for primary user journeys

Files involved:

- `src/pages/Home.jsx`
- `src/pages/Dashboard.jsx`
- `src/components/EmailSchedule.jsx`

Next steps:

- Test happy path and failure path for:
  - login action
  - scrape submission
  - dashboard load
  - schedule creation
  - send email action

Acceptance criteria:

- Major renderer flows are regression-tested.

## Priority 5: Cleanup and Maintainability

These items are the least emergent, but still worth doing once the structural issues above are underway.

### 17. Remove dead code, commented-out blocks, and debug logging

Files involved:

- `src/components/EmailSchedule.jsx`
- `src/pages/Dashboard.jsx`
- `scraper/weiboApi.js`
- `scraper/mailService.js`
- `electron/main.js`

Problems:

- Old commented UI blocks remain in source.
- Numeric debug logs reduce readability.
- Noise makes real failures harder to spot.

Next steps:

- Remove dead commented code.
- Remove temporary logs like `console.log("123456")`.
- Replace necessary logs with structured messages.

Acceptance criteria:

- Source files contain only active code and intentional logs.

### 18. Standardize naming and code style

Files involved:

- entire project

Problems:

- Mixed naming styles such as `top_comments`, `new_window_id`, and camelCase usage.
- Inconsistent formatting and component API style make the code harder to scan.

Next steps:

- Standardize on one naming convention for JS objects and component props.
- Use lint rules to enforce consistency.
- Rename variables to describe business meaning rather than implementation history.

Acceptance criteria:

- Naming and style feel consistent across frontend and backend.

### 19. Improve documentation for local setup and architecture

Files involved:

- `README.md`
- new architecture docs

Problems:

- Current documentation is minimal.
- Future contributors will have to reverse-engineer setup and flow.

Next steps:

- Document:
  - app architecture
  - config variables
  - scrape pipeline flow
  - schedule lifecycle
  - storage layout
  - development commands
- Keep this `refactoring.md` updated as work completes.

Acceptance criteria:

- A new contributor can run and understand the project without reading every source file first.

## Recommended Execution Plan

If work starts now, this is the recommended order:

1. Remove hardcoded secrets and rotate exposed credentials.
2. Fix render-loop fetching and add basic user-visible error states.
3. Extract backend services from `electron/main.js`.
4. Collapse the scrape workflow into one backend pipeline command.
5. Add config validation and IPC schema validation.
6. Introduce a persistence abstraction and migrate away from file-scan lookups.
7. Make scheduling persistent and restart-safe.
8. Redesign keyword summarization for large datasets.
9. Add pagination or virtualization for large comment views.
10. Add tests while each refactor lands, not afterward.

## Definition of Done for the Refactor Program

The refactor effort should be considered successful when:

- No secrets are stored in source.
- Core workflows are owned by backend services, not scattered across UI and Electron glue code.
- Saved scrapes and schedules use durable, queryable persistence.
- Monitoring survives restart.
- Large scrape histories and large comment sets remain responsive.
- LLM analysis has bounded request size and graceful fallback behavior.
- IPC contracts are validated.
- Core business logic is covered by automated tests.
