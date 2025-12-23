import { useState, useEffect, useCallback } from 'react';
import { FlakyTest, FlakyKBData, FuzzyMatchResult } from '@/types/testim';
import { parseFlakyCSV, exportFlakyTestsToCSV } from '@/lib/csvParsers';
import { normalizeTestName, fuzzyMatchTestName, generateId } from '@/lib/textNormalization';

const STORAGE_KEY = 'testim-flaky-kb';
const MATCH_THRESHOLD = 85; // Minimum confidence for fuzzy match

function loadFromStorage(): FlakyKBData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load Flaky KB from storage:', e);
  }
  return { tests: [], lastUpdated: null };
}

function saveToStorage(data: FlakyKBData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save Flaky KB to storage:', e);
  }
}

export function useFlakyKB() {
  const [data, setData] = useState<FlakyKBData>(() => loadFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync to localStorage whenever data changes
  useEffect(() => {
    saveToStorage(data);
  }, [data]);

  // Upload CSV
  const uploadCSV = useCallback((content: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const tests = parseFlakyCSV(content);
      setData({
        tests,
        lastUpdated: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse CSV');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add a new flaky test
  const addFlakyTest = useCallback((testName: string, reason?: string, notes?: string) => {
    const now = new Date().toISOString();
    const newTest: FlakyTest = {
      id: generateId(),
      testName,
      testNameNormalized: normalizeTestName(testName),
      reason,
      notes,
      lastReviewed: now,
      createdAt: now,
    };
    
    setData(prev => ({
      tests: [...prev.tests, newTest],
      lastUpdated: now,
    }));
    
    return newTest;
  }, []);

  // Update a flaky test
  const updateFlakyTest = useCallback((id: string, updates: Partial<Pick<FlakyTest, 'testName' | 'reason' | 'notes' | 'lastReviewed'>>) => {
    setData(prev => ({
      tests: prev.tests.map(test => {
        if (test.id !== id) return test;
        const updatedTestName = updates.testName ?? test.testName;
        return {
          ...test,
          ...updates,
          testNameNormalized: normalizeTestName(updatedTestName),
        };
      }),
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  // Remove a flaky test
  const removeFlakyTest = useCallback((id: string) => {
    setData(prev => ({
      tests: prev.tests.filter(test => test.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
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

  // Clear all
  const clearAll = useCallback(() => {
    setData({ tests: [], lastUpdated: null });
  }, []);

  return {
    tests: data.tests,
    lastUpdated: data.lastUpdated,
    isLoading,
    error,
    // Mutations
    uploadCSV,
    addFlakyTest,
    updateFlakyTest,
    removeFlakyTest,
    clearAll,
    // Queries
    isTestFlaky,
    findFlakyTestMatch,
    getFlakyTestInfo,
    exportToCSV,
    // Count
    count: data.tests.length,
  };
}
