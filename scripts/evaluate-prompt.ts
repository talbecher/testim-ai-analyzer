#!/usr/bin/env npx tsx
/**
 * Shadow evaluation harness for analyze-failures (Phase 3).
 *
 * READ-ONLY: queries historical rows and invokes the edge function only.
 * Does not INSERT, UPDATE, or DELETE any database records.
 *
 * Usage:
 *   npm run evaluate
 *   npm run evaluate -- --dry-run
 *   npm run evaluate -- --limit 50 --concurrency 2
 *
 * Required env (.env.local or shell):
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   VITE_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)
 *   EVAL_SUPABASE_EMAIL + EVAL_SUPABASE_PASSWORD
 *     — or EVAL_SUPABASE_ACCESS_TOKEN (JWT) for edge function auth
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { detectErrorPattern } from '../src/lib/errorPatternDetection.ts';
import flakyTestsJson from '../src/data/flaky-tests.json';
import { normalizeTestName } from '../src/lib/textNormalization.ts';

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnvFiles(): void {
  for (const file of ['.env.local', '.env']) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function getEnv(name: string, fallbacks: string[] = []): string | undefined {
  if (process.env[name]) return process.env[name];
  for (const fb of fallbacks) {
    if (process.env[fb]) return process.env[fb];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const CLASSIFICATIONS = [
  'Potential bug',
  'Likely Flaky',
  'Environment / Infra Issue',
  'Expected Change',
  'Investigate',
] as const;

type Classification = (typeof CLASSIFICATIONS)[number];

interface ReportMeta {
  id: string;
  regression_bucket: string | null;
  mode: string;
  accuracy_percentage: number | null;
  is_feature_rollout: boolean | null;
}

interface EvalRow {
  id: string;
  report_id: string;
  test_name: string;
  test_name_normalized: string;
  error_message: string | null;
  error_pattern: string | null;
  ai_classification: string;
  ai_confidence: number | null;
  user_classification: string;
  was_correct: boolean | null;
  report: ReportMeta;
}

interface FlakyTestForAI {
  testName: string;
  testNameNormalized: string;
  reason?: string;
  notes?: string;
}

interface FailureForAI {
  testName: string;
  testNameNormalized: string;
  errorMessage?: string;
  detectedErrorPattern: string;
  patternConfidence: number;
}

interface EvalOutcome {
  row: EvalRow;
  newClassification: string;
  newConfidence: number | null;
  baselineMatch: boolean;
  newMatch: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOptions {
  dryRun: boolean;
  limit: number;
  concurrency: number;
  delayMs: number;
  verbose: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: false,
    limit: 100,
    concurrency: 1,
    delayMs: 300,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--verbose' || arg === '-v') opts.verbose = true;
    else if (arg === '--limit') {
      const n = Number(argv[++i]);
      opts.limit = Number.isFinite(n) && n >= 0 ? n : opts.limit;
    } else if (arg === '--concurrency') {
      const n = Number(argv[++i]);
      opts.concurrency = Number.isFinite(n) && n >= 1 ? Math.floor(n) : opts.concurrency;
    } else if (arg === '--delay-ms') {
      const n = Number(argv[++i]);
      opts.delayMs = Number.isFinite(n) && n >= 0 ? n : opts.delayMs;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return opts;
}

function printHelp(): void {
  console.log(`
Testim AI Analyzer — prompt evaluation harness (read-only)

Options:
  --dry-run          Load dataset and print baseline metrics only (no edge calls)
  --limit <n>        Max rows to re-evaluate (default: 100, 0 = all)
  --concurrency <n>  Parallel edge invocations (default: 1)
  --delay-ms <n>     Delay between batches in ms (default: 300)
  --verbose, -v      Print per-row mismatches
  --help, -h         Show this help
`);
}

// ---------------------------------------------------------------------------
// Data loading (read-only)
// ---------------------------------------------------------------------------

async function authenticate(supabase: SupabaseClient): Promise<void> {
  const token = getEnv('EVAL_SUPABASE_ACCESS_TOKEN');
  if (token) {
    const { error } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: getEnv('EVAL_SUPABASE_REFRESH_TOKEN') ?? token,
    });
    if (error) throw new Error(`Invalid EVAL_SUPABASE_ACCESS_TOKEN: ${error.message}`);
    return;
  }

  const email = getEnv('EVAL_SUPABASE_EMAIL');
  const password = getEnv('EVAL_SUPABASE_PASSWORD');
  if (!email || !password) {
    throw new Error(
      'Set EVAL_SUPABASE_EMAIL + EVAL_SUPABASE_PASSWORD, or EVAL_SUPABASE_ACCESS_TOKEN, for edge function auth.',
    );
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Auth failed: ${error.message}`);
}

async function fetchEvalRows(supabase: SupabaseClient): Promise<EvalRow[]> {
  const pageSize = 500;
  let offset = 0;
  const all: EvalRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from('analysis_results')
      .select(
        `
        id,
        report_id,
        test_name,
        test_name_normalized,
        error_message,
        error_pattern,
        ai_classification,
        ai_confidence,
        user_classification,
        was_correct,
        report:analysis_reports!inner (
          id,
          regression_bucket,
          mode,
          accuracy_percentage,
          is_feature_rollout
        )
      `,
      )
      .or('was_correct.not.is.null,user_classification.not.is.null')
      .not('user_classification', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Failed to fetch analysis_results: ${error.message}`);

    const batch = (data ?? []) as unknown as EvalRow[];
    if (batch.length === 0) break;

    for (const row of batch) {
      if (row.report?.is_feature_rollout) continue;
      if (!row.report?.regression_bucket?.trim()) continue;
      all.push(row);
    }

    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

function buildFlakyTestsForAI(): FlakyTestForAI[] {
  const tests = (flakyTestsJson as { tests: Array<{ testName: string; reason?: string; notes?: string }> })
    .tests;
  return tests.map((t) => ({
    testName: t.testName,
    testNameNormalized: normalizeTestName(t.testName),
    reason: t.reason,
    notes: t.notes,
  }));
}

function buildFailurePayload(row: EvalRow): FailureForAI {
  const patternResult = row.error_message
    ? detectErrorPattern(row.error_message)
    : { pattern: row.error_pattern ?? 'Unknown', confidence: 50 };

  return {
    testName: row.test_name,
    testNameNormalized: row.test_name_normalized,
    errorMessage: row.error_message ?? undefined,
    detectedErrorPattern: (row.error_pattern as string) || patternResult.pattern,
    patternConfidence: patternResult.confidence,
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function invokeAnalyzeFailures(
  supabase: SupabaseClient,
  row: EvalRow,
  flakyTests: FlakyTestForAI[],
): Promise<{ classification: string; confidence: number | null }> {
  const { data, error } = await supabase.functions.invoke('analyze-failures', {
    body: {
      failures: [buildFailurePayload(row)],
      flakyTests,
      mode: 'learning',
      regressionBucket: row.report.regression_bucket,
    },
  });

  if (error) throw new Error(error.message);

  const legacyFallback =
    data && (data as { fallback?: boolean }).fallback
      ? (data as { error?: string }).error || 'AI temporarily unavailable'
      : null;
  if (legacyFallback) throw new Error(legacyFallback);

  const results = (data?.results ?? []) as Array<{
    analysis?: { classification?: string; confidence?: number };
  }>;
  const analysis = results[0]?.analysis;
  if (!analysis?.classification) throw new Error('No classification in response');

  return {
    classification: analysis.classification,
    confidence: analysis.confidence ?? null,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}

function formatDelta(baseline: number, next: number): string {
  const delta = next - baseline;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

function buildConfusionMatrix(
  rows: EvalOutcome[],
  pick: (o: EvalOutcome) => string,
): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();
  for (const o of rows) {
    if (o.error) continue;
    const truth = o.row.user_classification;
    const pred = pick(o);
    if (!matrix.has(truth)) matrix.set(truth, new Map());
    const inner = matrix.get(truth)!;
    inner.set(pred, (inner.get(pred) ?? 0) + 1);
  }
  return matrix;
}

function printTable(title: string, headers: string[], rows: string[][]): void {
  console.log(`\n${title}`);
  console.log('─'.repeat(Math.max(title.length, 60)));
  const allRows = [headers, ...rows];
  const widths = headers.map((_, col) =>
    Math.max(...allRows.map((r) => (r[col] ?? '').length)),
  );
  const fmt = (cells: string[]) =>
    cells.map((c, i) => (c ?? '').padEnd(widths[i] + 2)).join('');
  console.log(fmt(headers));
  console.log(widths.map((w) => '─'.repeat(w + 2)).join(''));
  for (const row of rows) console.log(fmt(row));
}

function printConfusionMatrix(matrix: Map<string, Map<string, number>>): void {
  const truths = [...new Set([...matrix.keys(), ...CLASSIFICATIONS])].sort();
  const preds = [...CLASSIFICATIONS];
  const rows: string[][] = [];

  for (const truth of truths) {
    const inner = matrix.get(truth) ?? new Map();
    const total = [...inner.values()].reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const cells = preds.map((p) => String(inner.get(p) ?? 0));
    rows.push([truth, String(total), ...cells]);
  }

  printTable('Confusion Matrix (rows = human, cols = AI)', ['Human \\ AI', 'Total', ...preds], rows);
}

function computeMetrics(outcomes: EvalOutcome[]) {
  const evaluated = outcomes.filter((o) => !o.error);
  const total = evaluated.length;
  const baselineCorrect = evaluated.filter((o) => o.baselineMatch).length;
  const newCorrect = evaluated.filter((o) => o.newMatch).length;

  const aiInvestigate = evaluated.filter((o) => o.newClassification === 'Investigate');
  const investigateFp = aiInvestigate.filter(
    (o) => o.row.user_classification !== 'Investigate',
  ).length;

  const humanBugs = evaluated.filter((o) => o.row.user_classification === 'Potential bug');
  const bugRecallHits = humanBugs.filter(
    (o) => o.newClassification === 'Potential bug',
  ).length;

  const storedReportAccuracy = outcomes
    .map((o) => o.row.report.accuracy_percentage)
    .filter((v): v is number => v != null);
  const avgStoredReportAccuracy =
    storedReportAccuracy.length > 0
      ? storedReportAccuracy.reduce((a, b) => a + b, 0) / storedReportAccuracy.length
      : null;

  return {
    total,
    errors: outcomes.length - total,
    baselineCorrect,
    newCorrect,
    baselineAccuracy: total > 0 ? (baselineCorrect / total) * 100 : 0,
    newAccuracy: total > 0 ? (newCorrect / total) * 100 : 0,
    investigateFpRate: aiInvestigate.length > 0 ? (investigateFp / aiInvestigate.length) * 100 : 0,
    investigateCount: aiInvestigate.length,
    investigateFp,
    bugRecall: humanBugs.length > 0 ? (bugRecallHits / humanBugs.length) * 100 : 0,
    humanBugCount: humanBugs.length,
    bugRecallHits,
    avgStoredReportAccuracy,
    baselineMatrix: buildConfusionMatrix(evaluated, (o) => o.row.ai_classification),
    newMatrix: buildConfusionMatrix(evaluated, (o) => o.newClassification),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  loadEnvFiles();
  const opts = parseArgs(process.argv.slice(2));

  const supabaseUrl = getEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
  const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY', ['VITE_SUPABASE_ANON_KEY']);

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY (or VITE_* variants).');
    process.exit(1);
  }

  console.log('Testim AI Analyzer — Prompt Evaluation Harness');
  console.log('Mode: READ-ONLY (no database writes)\n');

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('Loading historical evaluation rows…');
  const allRows = await fetchEvalRows(supabase);
  const rows =
    opts.limit === 0 ? allRows : allRows.slice(0, opts.limit);

  console.log(`  Total eligible rows in DB: ${allRows.length}`);
  console.log(`  Rows selected for evaluation: ${rows.length}`);

  if (rows.length === 0) {
    console.log('\nNo rows with user_classification and regression_bucket found.');
    process.exit(0);
  }

  const baselineOnly = rows.map((row) => ({
    row,
    baselineMatch: row.ai_classification === row.user_classification,
  }));
  const baselineCorrect = baselineOnly.filter((r) => r.baselineMatch).length;
  const baselineAccuracy = (baselineCorrect / rows.length) * 100;

  if (opts.dryRun) {
    printTable('Dry Run — Stored Baseline Only', ['Metric', 'Value'], [
      ['Eligible rows (DB)', String(allRows.length)],
      ['Sample size', String(rows.length)],
      ['Stored AI vs human accuracy', pct(baselineCorrect, rows.length)],
      ['Unique reports in sample', String(new Set(rows.map((r) => r.report_id)).size)],
    ]);
    printConfusionMatrix(
      buildConfusionMatrix(
        baselineOnly.map((r) => ({
          row: r.row,
          newClassification: r.row.ai_classification,
          newConfidence: r.row.ai_confidence,
          baselineMatch: r.baselineMatch,
          newMatch: r.baselineMatch,
        })),
        (o) => o.row.ai_classification,
      ),
    );
    console.log('\nDry run complete — no edge function calls made.');
    return;
  }

  await authenticate(supabase);
  console.log('Authenticated for edge function invocation.\n');

  const flakyTests = buildFlakyTestsForAI();
  let completed = 0;

  const outcomes = await mapWithConcurrency(rows, opts.concurrency, async (row, index) => {
    if (index > 0 && opts.concurrency === 1 && opts.delayMs > 0) {
      await sleep(opts.delayMs);
    }

    const baselineMatch = row.ai_classification === row.user_classification;

    try {
      const { classification, confidence } = await invokeAnalyzeFailures(
        supabase,
        row,
        flakyTests,
      );
      completed++;
      if (completed % 10 === 0 || completed === rows.length) {
        process.stdout.write(`\r  Re-evaluated: ${completed}/${rows.length}`);
      }

      return {
        row,
        newClassification: classification,
        newConfidence: confidence,
        baselineMatch,
        newMatch: classification === row.user_classification,
      } satisfies EvalOutcome;
    } catch (err) {
      completed++;
      return {
        row,
        newClassification: '',
        newConfidence: null,
        baselineMatch,
        newMatch: false,
        error: err instanceof Error ? err.message : String(err),
      } satisfies EvalOutcome;
    }
  });

  console.log('\n');

  const metrics = computeMetrics(outcomes);

  printTable('Accuracy Summary', ['Metric', 'Value'], [
    ['Sample size', String(metrics.total)],
    ['Invoke errors', String(metrics.errors)],
    [
      'Stored report accuracy (avg)',
      metrics.avgStoredReportAccuracy != null
        ? `${metrics.avgStoredReportAccuracy.toFixed(1)}%`
        : 'n/a',
    ],
    ['Baseline accuracy (stored AI vs human)', `${metrics.baselineAccuracy.toFixed(1)}%`],
    ['New accuracy (re-run vs human)', `${metrics.newAccuracy.toFixed(1)}%`],
    ['Accuracy delta', formatDelta(metrics.baselineAccuracy, metrics.newAccuracy)],
  ]);

  printTable('Classification Quality', ['Metric', 'Value'], [
    [
      'Investigate false-positive rate',
      `${metrics.investigateFpRate.toFixed(1)}% (${metrics.investigateFp}/${metrics.investigateCount} AI Investigate calls)`,
    ],
    [
      'Bug detection recall',
      `${metrics.bugRecall.toFixed(1)}% (${metrics.bugRecallHits}/${metrics.humanBugCount} human Potential bug rows)`,
    ],
  ]);

  printConfusionMatrix(metrics.baselineMatrix);
  printConfusionMatrix(metrics.newMatrix);

  const improved = outcomes.filter((o) => !o.error && !o.baselineMatch && o.newMatch);
  const regressed = outcomes.filter((o) => !o.error && o.baselineMatch && !o.newMatch);

  printTable('Net Changes vs Baseline', ['Direction', 'Count'], [
    ['Improved (was wrong → now correct)', String(improved.length)],
    ['Regressed (was correct → now wrong)', String(regressed.length)],
    ['Unchanged correct', String(outcomes.filter((o) => !o.error && o.baselineMatch && o.newMatch).length)],
    ['Unchanged wrong', String(outcomes.filter((o) => !o.error && !o.baselineMatch && !o.newMatch).length)],
  ]);

  if (opts.verbose) {
    const mismatches = outcomes.filter((o) => !o.error && !o.newMatch);
    if (mismatches.length > 0) {
      printTable(
        'New Mismatches (human vs re-run)',
        ['Test', 'Human', 'Stored AI', 'New AI', 'Confidence'],
        mismatches.slice(0, 25).map((o) => [
          o.row.test_name_normalized.slice(0, 40),
          o.row.user_classification,
          o.row.ai_classification,
          o.newClassification,
          o.newConfidence != null ? String(o.newConfidence) : '—',
        ]),
      );
      if (mismatches.length > 25) {
        console.log(`  … and ${mismatches.length - 25} more (use --limit to expand sample)`);
      }
    }
  }

  if (metrics.errors > 0) {
    console.log(`\nWarning: ${metrics.errors} row(s) failed to re-evaluate. Check auth and edge deployment.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
