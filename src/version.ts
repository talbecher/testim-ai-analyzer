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
 