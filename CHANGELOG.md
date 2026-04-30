# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2026-04-30

### Changed
- **TestHistoryChip** redesigned as a Datadog/Vercel-style inline timeline: small rounded squares (green pass / red fail) in chronological order in the **Context** row of `ProductionModeCard` (and inline among badges in `FailureReviewCard`).
- The **current run** (last item) is enlarged and ringed with `ring-foreground/30` to read as a "live" health signal.
- An amber `AlertTriangle` appears **only** for `was-passing-now-failing` (regression smell). Other patterns rely on the colored squares alone.
- Tooltip rewritten: pattern-specific headline, `Failed X of Y prior uploads`, and a compact chronological strip.

## [1.2.1] - 2026-04-29

### Changed
- **Production** recommendation row: slimmer single-line strip (`py-1.5`, 1px border); removed the italic “Based on similar failures…” line.
- **priorityReason**: first sentence visible by default; split with `/(?<=[.!?])\s+/`; **Show more / Show less** ghost control on **ProductionModeCard** and **FailureReviewCard**.
- **Flaky KB**: match surfaced only as a small **context chip** (database icon + short label), not inside the recommendation banner.

## [1.2.0] - 2026-04-29

### Added
- Global cross-run **test history** in the `analyze-failures` Edge function: last 30 `analysis_reports`, implicit pass/fail per known test, patterns (`was-passing-now-failing`, `consistent-failure`, `intermittent`, `first-seen`, `sporadic-failure`).
- Prompt **§7.5 Cross-Run History** and updated **hierarchy of evidence** so the model treats global history as a high-weight signal (without overriding P0 / Investigate fallback / session-WebDriver infra).
- **`history`** on each returned `AIAnalysisResult`; **TestHistoryChip** + tooltip on failure cards (learning and production).

## [1.0.0] - 2025-01-29

### Added
- Streak Info calculation in Edge Function - computes failure history from analysis_results
- Confirmed patterns (positive feedback) in AI context - uses was_correct === true cases
- Signal breakdown alignment with classification - post-process validation
- Few-shot examples from historical corrections in prompt
- Investigate vs Skip clarification in prompt - explicit rules for recommendations
- Version tracking in Settings page with changelog dialog

### Fixed
- Classification consistency with signal breakdown via alignSignalBreakdownWithClassification()

## [0.9.0] - 2025-01-15

### Added
- Initial AI analysis system with google/gemini-2.5-flash
- Learning mode for training the AI with feedback
- Production mode for autonomous classification
- Co-failure detection across test runs
- Flaky KB matching with known flaky patterns
- Bug category management in Settings
- Dashboard with accuracy trends and mistake patterns
- Report management with editing capabilities
