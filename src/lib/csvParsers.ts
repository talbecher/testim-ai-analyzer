import { FailureEntry, FlakyTest } from '@/types/testim';
import { normalizeTestName, generateId, parseDuration } from './textNormalization';

// Column name mappings for flexible parsing
const COLUMN_MAPPINGS = {
  testName: ['testname', 'test_name', 'test name', 'test', 'scenario', 'name', 'testid', 'test_id'],
  folder: ['folder', 'suite', 'group', 'category', 'path'],
  failureStep: ['failurestep', 'failure_step', 'failure step', 'step', 'failed_step', 'failed step'],
  errorMessage: ['errormessage', 'error_message', 'error message', 'error', 'message', 'failure_reason', 'reason'],
  status: ['status', 'result', 'state', 'outcome'],
  duration: ['duration', 'time', 'runtime', 'run_time', 'elapsed', 'elapsed_time'],
  reason: ['reason', 'flaky_reason', 'flakyReason', 'why', 'cause'],
  notes: ['notes', 'note', 'comment', 'comments', 'description'],
  lastReviewed: ['lastreviewed', 'last_reviewed', 'last reviewed', 'reviewed', 'date', 'reviewed_at'],
};

/**
 * Parse CSV content into rows
 */
function parseCSVContent(content: string): string[][] {
  const lines = content.trim().split(/\r?\n/);
  const result: string[][] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    row.push(current.trim());
    result.push(row);
  }
  
  return result;
}

/**
 * Find column index by checking against known column names
 */
function findColumnIndex(headers: string[], targetNames: string[]): number {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  
  for (const target of targetNames) {
    const normalizedTarget = target.replace(/[^a-z0-9]/g, '');
    const index = normalizedHeaders.findIndex(h => h === normalizedTarget || h.includes(normalizedTarget));
    if (index !== -1) return index;
  }
  
  return -1;
}

/**
 * Parse failures CSV from Testim
 */
export function parseFailuresCSV(content: string): FailureEntry[] {
  const rows = parseCSVContent(content);
  if (rows.length < 2) return [];
  
  const headers = rows[0];
  const dataRows = rows.slice(1);
  
  // Find column indices
  const testNameIdx = findColumnIndex(headers, COLUMN_MAPPINGS.testName);
  const folderIdx = findColumnIndex(headers, COLUMN_MAPPINGS.folder);
  const failureStepIdx = findColumnIndex(headers, COLUMN_MAPPINGS.failureStep);
  const errorMessageIdx = findColumnIndex(headers, COLUMN_MAPPINGS.errorMessage);
  const statusIdx = findColumnIndex(headers, COLUMN_MAPPINGS.status);
  const durationIdx = findColumnIndex(headers, COLUMN_MAPPINGS.duration);
  
  if (testNameIdx === -1) {
    throw new Error('Could not find test name column. Expected columns: testName, test_name, test, scenario, or name');
  }
  
  const failures: FailureEntry[] = [];
  
  for (const row of dataRows) {
    const testName = row[testNameIdx]?.trim();
    if (!testName) continue;
    
    const duration = durationIdx !== -1 ? row[durationIdx]?.trim() : undefined;
    
    failures.push({
      id: generateId(),
      testName,
      testNameNormalized: normalizeTestName(testName),
      folder: folderIdx !== -1 ? row[folderIdx]?.trim() : undefined,
      failureStep: failureStepIdx !== -1 ? row[failureStepIdx]?.trim() : undefined,
      errorMessage: errorMessageIdx !== -1 ? row[errorMessageIdx]?.trim() : undefined,
      status: statusIdx !== -1 ? row[statusIdx]?.trim() : undefined,
      duration,
      durationMs: parseDuration(duration),
    });
  }
  
  return failures;
}

/**
 * Parse Flaky KB CSV
 */
export function parseFlakyCSV(content: string): FlakyTest[] {
  const rows = parseCSVContent(content);
  if (rows.length < 2) return [];
  
  const headers = rows[0];
  const dataRows = rows.slice(1);
  
  // Find column indices
  const testNameIdx = findColumnIndex(headers, COLUMN_MAPPINGS.testName);
  const reasonIdx = findColumnIndex(headers, COLUMN_MAPPINGS.reason);
  const notesIdx = findColumnIndex(headers, COLUMN_MAPPINGS.notes);
  const lastReviewedIdx = findColumnIndex(headers, COLUMN_MAPPINGS.lastReviewed);
  
  if (testNameIdx === -1) {
    throw new Error('Could not find test name column. Expected columns: testName, test_name, test, scenario, or name');
  }
  
  const tests: FlakyTest[] = [];
  const now = new Date().toISOString();
  
  for (const row of dataRows) {
    const testName = row[testNameIdx]?.trim();
    if (!testName) continue;
    
    tests.push({
      id: generateId(),
      testName,
      testNameNormalized: normalizeTestName(testName),
      reason: reasonIdx !== -1 ? row[reasonIdx]?.trim() : undefined,
      notes: notesIdx !== -1 ? row[notesIdx]?.trim() : undefined,
      lastReviewed: lastReviewedIdx !== -1 ? row[lastReviewedIdx]?.trim() : undefined,
      createdAt: now,
    });
  }
  
  return tests;
}

/**
 * Export Flaky KB to CSV string
 */
export function exportFlakyTestsToCSV(tests: FlakyTest[]): string {
  const headers = ['testName', 'reason', 'notes', 'lastReviewed'];
  const rows = tests.map(test => [
    `"${(test.testName || '').replace(/"/g, '""')}"`,
    `"${(test.reason || '').replace(/"/g, '""')}"`,
    `"${(test.notes || '').replace(/"/g, '""')}"`,
    `"${(test.lastReviewed || '').replace(/"/g, '""')}"`,
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
