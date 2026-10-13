# Daily product planning

[FACT] The user requests Superpowers for ongoing development and daily product planning, with the greatest possible focus on helping users. Recorded on 2026-10-13 in this project's Codex conversation.

[RECOMMENDATION] Keep the daily plan small enough to finish: at most three priorities, led by the most serious supported user problem. This is a prioritization record; proposed features still follow the applicable Superpowers design and implementation stages.

## Daily routine

1. Read `AGENTS.md`, `ARCHITECTURE.md`, the latest daily plan, recent changes, `docs/verification.md`, `docs/troubleshooting.md` and `docs/release-readiness.md`. Read the available Superpowers entry skill and applicable planning/discovery skills.
2. Collect available user feedback, failures, missing evidence and first-use friction. Record the source and date. If there is no user feedback, state that and mark user-impact estimates as assumptions.
3. Carry forward unfinished work and prioritize concrete user problems. Compare severity, likely reach, evidence confidence and effort without inventing numerical scores or analytics.
4. Save `docs/superpowers/daily/YYYY-MM-DD.md` with facts, assumptions to verify, at most three priorities, acceptance criteria, dependencies and the next action. Use the date in Asia/Bangkok.
5. Read the plan back for contradictory claims, unsupported success claims and repeated completed work. A meaningful new recommendation or blocker merits a concise Vietnamese update; an unchanged state does not require a repeated notification.

## Priority record

For each priority, include:

- **User problem:** who gets stuck and at which step.
- **Evidence:** file, recorded run, test output or actual user feedback; distinguish `[FACT]`, `[ASSUMPTION]`, `[RECOMMENDATION]`.
- **Proposed work:** the smallest useful improvement, with the relevant files or workflow.
- **Acceptance:** an observable user outcome and how it will be checked.
- **Dependencies:** required feedback, environment, decision or authorization.
- **Status:** proposed, approved, in progress, verified, or blocked, with the actual reason.

## Guardrails

[FACT] The runner currently supports a scoped local MVP. Local package evidence and the initial commit's six-job Windows/Linux/macOS CI are recorded. External user testing and public package-release prerequisites remain unverified. See `release-readiness.md` and `verification.md`; subsequent changes need their own validation.

[RECOMMENDATION] Address onboarding and actionable troubleshooting before expanding into email delivery or complex authentication. Reconsider this order when actual user feedback supplies stronger evidence.

[RECOMMENDATION] Daily planning should inspect relevant existing evidence. Run new checks when needed to answer a specific question; avoid reinstalling dependencies or repeating every long test solely because another day has passed.

[RECOMMENDATION] Scheduling the planning routine permits repository review and planning documents. It does not expand authorization to external communications, publication, deployment or speculative product implementation.
