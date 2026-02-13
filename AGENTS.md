# AGENTS.md

## North star
Ship small, **modular**, **production-ready** changes with **high-signal context** and **tests that gate progress**. Correctness > speed.

## Commands (keep updated)
> Put real, copy-pastable commands here. If missing, discover them in `README.md`, `package.json` scripts, `Makefile`, or `.github/workflows/*`.

- Install deps: `<command>`
- Lint: `<command>`
- Typecheck: `<command>`
- Unit tests: `<command>`
- Integration/E2E tests: `<command>`
- Full local check (closest to CI): `<command>`

---

## 1) Context engineering (mandatory before acting)
**Before editing anything, gather and organize only the context needed to execute correctly.**

### Before starting any task
- **Understand scope**
  - Read the relevant existing files first (don’t guess).
  - Identify existing patterns/utilities/conventions to follow.
  - Note dependencies and potential side effects.
- **Gather context**
  - Which files/modules will be affected?
  - What existing code should be referenced or reused?
  - Are there similar implementations to mirror?
- **Plan the approach**
  - Break work into discrete, verifiable steps.
  - Call out risks/failure points and how you’ll detect them.
- **Maintain focus**
  - Keep working memory limited to task-relevant facts.
  - For long tasks: periodically summarize “what changed / what’s next”.
  - Record decisions that affect future work (short comments, docs, or ADR).

If requirements are unclear: **ask a targeted question or propose a short plan**—don’t invent requirements.

---

## 2) Modular architecture (default posture)
- Prefer **small, composable modules** with single responsibility.
- Keep boundaries explicit: **clear public interfaces**, minimal coupling.
- Reuse existing utilities and patterns; avoid duplicating logic.
- Localize change: avoid drive-by refactors unless required for correctness.
- Prefer dependency direction that keeps core logic independent of frameworks/UI/IO.

---

## 3) Production-ready quality (no leftovers)
**No “almost done” code. No shortcuts.**
- 🚫 No `TODO`, `FIXME`, “temporary” hacks, commented-out blocks, dead code.
- 🚫 No debug logs/noisy prints left behind.
- Handle errors and edge cases; validate inputs; preserve backward compatibility unless explicitly changing it.
- Keep code readable: good names, small functions, consistent style, strict types where applicable.
- Update docs/examples when behavior or APIs change.
- Never introduce or leak secrets/PII; avoid logging sensitive data.

---

## 4) Tests + gated progress (TDD for non-trivial work) 
**Tests are part of the feature.** **EVERYTHING IS DONE VIA TEST DRIVEN DEVELOPMENT**
- For bugs: add a **failing test that reproduces**, then fix to green.
- For complex logic/features: **write/update tests first**, then implement.
- Choose the right level: unit → integration → e2e, based on risk and surface area.
- Prefer deterministic tests; remove flakiness (no sleeps, stable fixtures/mocks).
- **Hard gate:** do not proceed while lint/typecheck/tests are failing.
  - Fix to green **before** continuing or handing off.

---

## Boundaries (always / ask / never)
- ✅ **Always**
  - Keep diffs small and scoped.
  - Follow existing conventions and architecture.
  - Run the relevant commands in “Commands” before finishing.
  - Explain rationale and tradeoffs in the PR/summary.
- ⚠️ **Ask first**
  - Adding new dependencies, changing public APIs, large refactors,
    schema/data migrations, auth/security-sensitive changes.
- 🚫 **Never**
  - Commit secrets.
  - Disable/remove tests to “make it pass”.
  - Ship failing checks or “we’ll fix later” leftovers.

---

## Definition of done
- Scope satisfied and aligned with existing patterns.
- Modular structure preserved/improved (clear interfaces, low coupling).
- No leftovers (`TODO`, debug prints, dead code).
- Lint/typecheck/tests: **100% green** locally and in CI-equivalent checks.