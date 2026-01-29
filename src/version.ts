export const VERSION = "1.0.0";
export const RELEASE_DATE = "2025-01-29";

export const getVersionInfo = () => ({
  version: VERSION,
  releaseDate: RELEASE_DATE,
  formattedDate: new Date(RELEASE_DATE).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
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
