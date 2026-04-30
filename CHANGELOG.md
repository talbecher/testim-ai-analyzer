# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
