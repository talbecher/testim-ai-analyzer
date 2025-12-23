// Text normalization utilities for test name matching

/**
 * Normalize a test name for comparison
 * - Lowercase
 * - Replace spaces, dashes, dots with underscores
 * - Remove special characters
 * - Collapse multiple underscores
 * - Trim underscores from ends
 */
export function normalizeTestName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    // Replace common separators with underscore
    .replace(/[\s\-\.]+/g, '_')
    // Remove special characters except underscore
    .replace(/[^a-z0-9_]/g, '')
    // Collapse multiple underscores
    .replace(/_+/g, '_')
    // Trim underscores from ends
    .replace(/^_+|_+$/g, '');
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate similarity percentage between two normalized test names
 * Uses Levenshtein distance normalized by max length
 * Also checks for prefix/suffix matching
 */
export function fuzzyMatchTestName(name1: string, name2: string): number {
  const norm1 = normalizeTestName(name1);
  const norm2 = normalizeTestName(name2);
  
  if (!norm1 || !norm2) return 0;
  
  // Exact match
  if (norm1 === norm2) return 100;
  
  // One contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = Math.min(norm1.length, norm2.length);
    const longer = Math.max(norm1.length, norm2.length);
    // Higher score for higher overlap
    return Math.round(70 + (30 * shorter / longer));
  }
  
  // Calculate Levenshtein-based similarity
  const maxLen = Math.max(norm1.length, norm2.length);
  const distance = levenshteinDistance(norm1, norm2);
  const similarity = Math.round(((maxLen - distance) / maxLen) * 100);
  
  // Check for common prefix
  let commonPrefix = 0;
  for (let i = 0; i < Math.min(norm1.length, norm2.length); i++) {
    if (norm1[i] === norm2[i]) {
      commonPrefix++;
    } else {
      break;
    }
  }
  
  // Boost score if there's a significant common prefix
  if (commonPrefix >= 5) {
    const prefixBoost = Math.min(15, Math.round((commonPrefix / Math.max(norm1.length, norm2.length)) * 20));
    return Math.min(100, similarity + prefixBoost);
  }
  
  return similarity;
}

/**
 * Parse duration string to milliseconds
 * Handles: "3.2s", "500ms", "1m 30s", "1:30"
 */
export function parseDuration(duration: string | undefined): number | undefined {
  if (!duration) return undefined;
  
  const str = duration.toLowerCase().trim();
  
  // Already in ms: "500ms"
  const msMatch = str.match(/^([\d.]+)\s*ms$/);
  if (msMatch) return Math.round(parseFloat(msMatch[1]));
  
  // In seconds: "3.2s" or "3.2"
  const sMatch = str.match(/^([\d.]+)\s*s?$/);
  if (sMatch) return Math.round(parseFloat(sMatch[1]) * 1000);
  
  // Minutes and seconds: "1m 30s" or "1:30"
  const minSecMatch = str.match(/^(\d+)\s*[m:]\s*(\d+)\s*s?$/);
  if (minSecMatch) {
    const mins = parseInt(minSecMatch[1], 10);
    const secs = parseInt(minSecMatch[2], 10);
    return (mins * 60 + secs) * 1000;
  }
  
  // Just minutes: "2m"
  const minMatch = str.match(/^([\d.]+)\s*m$/);
  if (minMatch) return Math.round(parseFloat(minMatch[1]) * 60 * 1000);
  
  return undefined;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
