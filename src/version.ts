// Injected at build time by Vite (from package.json + build date)
export const VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";
export const RELEASE_DATE = typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : new Date().toISOString().slice(0, 10);

export const getVersionInfo = () => ({
  version: VERSION,
  releaseDate: RELEASE_DATE,
  formattedDate: new Date(RELEASE_DATE + "T12:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
});

// Changelog data structure for the dialog
export interface ChangelogEntry {
  version: string;
  date: string;
  added?: string[];
  fixed?: string[];
  changed?: string[];
  removed?: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.2.1",
    date: "2026-04-29",
    changed: [
      "Production recommendation banner is a slim single-line strip (py-1.5, 1px border); removed italic QA subtext",
      "priorityReason collapses to the first sentence (split after . ! ?) with a ghost “Show more / less” toggle on learning and production cards",
      "Flaky KB match shown only as a context chip (icon + short label), not in the recommendation banner"
    ]
  },
  {
    version: "1.2.0",
    date: "2026-04-29",
    added: [
      "Global cross-run test history (implicit pass/fail from last 30 uploads) computed in analyze-failures Edge and sent as history on each analysis",
      "AI prompt §7.5 Cross-Run History + expanded evidence hierarchy; history included in failures payload for the model",
      "TestHistoryChip on failure cards (learning + production) with tooltip for prior outcomes"
    ]
  },
  {
    version: "1.1.1",
    date: "2026-04-30",
    fixed: [
      "Quick filter chips now count and filter using the same canonical buckets, so clicking a chip always shows exactly the number of failures it advertises (e.g. \"Element is not visible · 3\" now reliably returns 3 rows)"
    ]
  },
  {
    version: "1.1.0",
    date: "2026-04-30",
    added: [
      "Quick filter chips: auto-detected error patterns (e.g. \"Element not found · 8\") for one-click filtering",
      "Sticky filter bar — search and filters stay visible while scrolling the list",
      "Active-filter breakdown with one-click Clear filters",
      "Keyboard shortcut: press / to focus the search box",
      "Friendly empty state when filters return no results"
    ]
  },
  {
    version: "1.0.0",
    date: "2025-01-29",
    added: [
      "Streak Info calculation in Edge Function",
      "Confirmed patterns (positive feedback) in AI context",
      "Signal breakdown alignment with classification",
      "Few-shot examples from historical corrections",
      "Investigate vs Skip clarification in prompt",
      "Version tracking in Settings page"
    ],
    fixed: [
      "Classification consistency with signal breakdown"
    ]
  },
  {
    version: "0.9.0",
    date: "2025-01-15",
    added: [
      "Initial AI analysis system",
      "Learning/Production modes",
      "Co-failure detection",
      "Flaky KB matching",
      "Bug category management"
    ]
  }
];
 