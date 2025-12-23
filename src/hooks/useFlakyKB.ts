import { useState, useEffect, useCallback } from 'react';
import { FlakyTest, FlakyKBData, FuzzyMatchResult } from '@/types/testim';
import { exportFlakyTestsToCSV } from '@/lib/csvParsers';
import { normalizeTestName, fuzzyMatchTestName, generateId } from '@/lib/textNormalization';
import staticFlakyData from '@/data/flaky-tests.json';

const MATCH_THRESHOLD = 85; // Minimum confidence for fuzzy match

// Load static flaky tests from JSON file
function loadStaticFlakyTests(): FlakyKBData {
  try {
    const tests: FlakyTest[] = staticFlakyData.tests.map((test) => ({
      id: generateId(),
      testName: test.testName,
      testNameNormalized: normalizeTestName(test.testName),
      reason: test.reason,
      notes: test.notes,
      lastReviewed: test.lastReviewed,
      createdAt: staticFlakyData.lastUpdated || new Date().toISOString(),
    }));
    
    return {
      tests,
      lastUpdated: staticFlakyData.lastUpdated || null,
    };
  } catch (e) {
    console.error('Failed to load static Flaky KB:', e);
    return { tests: [], lastUpdated: null };
  }
}

export function useFlakyKB() {
  const [data, setData] = useState<FlakyKBData>(() => loadStaticFlakyTests());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reload from static file (useful if you want to reset)
  const reloadFromStatic = useCallback(() => {
    setData(loadStaticFlakyTests());
  }, []);

  // Check if a test is in Flaky KB (exact match)
  const isTestFlaky = useCallback((testName: string): boolean => {
    const normalized = normalizeTestName(testName);
    return data.tests.some(t => t.testNameNormalized === normalized);
  }, [data.tests]);

  // Find fuzzy match in Flaky KB
  const findFlakyTestMatch = useCallback((testName: string): FuzzyMatchResult => {
    const normalized = normalizeTestName(testName);
    
    let bestMatch: FuzzyMatchResult = { matched: false, confidence: 0 };
    
    for (const test of data.tests) {
      // Exact match
      if (test.testNameNormalized === normalized) {
        return { matched: true, confidence: 100, matchedTest: test };
      }
      
      // Fuzzy match
      const confidence = fuzzyMatchTestName(testName, test.testName);
      if (confidence >= MATCH_THRESHOLD && confidence > bestMatch.confidence) {
        bestMatch = { matched: true, confidence, matchedTest: test };
      }
    }
    
    return bestMatch;
  }, [data.tests]);

  // Get flaky test info
  const getFlakyTestInfo = useCallback((testName: string): FlakyTest | undefined => {
    const match = findFlakyTestMatch(testName);
    return match.matched ? match.matchedTest : undefined;
  }, [findFlakyTestMatch]);

  // Export to CSV
  const exportToCSV = useCallback((): string => {
    return exportFlakyTestsToCSV(data.tests);
  }, [data.tests]);

  return {
    tests: data.tests,
    lastUpdated: data.lastUpdated,
    isLoading,
    error,
    // Queries
    isTestFlaky,
    findFlakyTestMatch,
    getFlakyTestInfo,
    exportToCSV,
    reloadFromStatic,
    // Count
    count: data.tests.length,
  };
}
