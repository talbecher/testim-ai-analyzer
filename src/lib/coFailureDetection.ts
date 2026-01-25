/**
 * Co-Failure Detection
 * Identifies groups of failures that share the same step or error pattern,
 * indicating systemic issues rather than individual test problems.
 */

import { FailureEntry } from '@/types/testim';
import { normalizeTestName } from './textNormalization';

export interface CoFailureGroup {
  groupId: string;
  sharedStep?: string;           // The shared step name (if detected)
  sharedErrorPattern?: string;   // Normalized error pattern
  failureIds: string[];          // IDs of failures in this group
  groupSize: number;
  confidence: number;            // How confident we are this is a real group
  groupType: 'shared_step' | 'error_pattern';
}

export interface CoFailureInfo {
  isPartOfGroup: boolean;
  groupSize: number;
  sharedStep?: string;
  sharedErrorPattern?: string;
  otherTestsInGroup: string[];   // Names of other tests in the group
  groupConfidence: number;
}

/**
 * Normalize error message for grouping
 * Removes dynamic values like numbers, timestamps, UUIDs
 */
function normalizeErrorForGrouping(errorMessage: string): string {
  return errorMessage
    .replace(/\d+/g, 'N')                           // Replace numbers
    .replace(/[a-f0-9]{8,}/gi, 'ID')                // Replace UUIDs/hashes
    .replace(/\d{4}-\d{2}-\d{2}/g, 'DATE')          // Replace dates
    .replace(/\d{2}:\d{2}:\d{2}/g, 'TIME')          // Replace times
    .replace(/'[^']+'/g, "'VALUE'")                 // Replace quoted strings
    .replace(/"[^"]+"/g, '"VALUE"')                 // Replace double-quoted strings
    .replace(/\s+/g, ' ')                           // Normalize whitespace
    .trim()
    .substring(0, 150);                             // Limit length
}

/**
 * Detect co-failure groups from a list of failures
 * Groups failures by shared step or similar error patterns
 */
export function detectCoFailures(failures: FailureEntry[]): CoFailureGroup[] {
  const groups: CoFailureGroup[] = [];
  const assignedIds = new Set<string>();

  // Strategy 1: Group by same failureStep
  const byStep = new Map<string, FailureEntry[]>();
  failures.forEach(f => {
    if (f.failureStep && f.failureStep.trim().length > 3) {
      const normalizedStep = normalizeTestName(f.failureStep);
      const list = byStep.get(normalizedStep) || [];
      list.push(f);
      byStep.set(normalizedStep, list);
    }
  });

  byStep.forEach((entries, step) => {
    if (entries.length >= 2) {
      const failureIds = entries.map(e => e.id);
      failureIds.forEach(id => assignedIds.add(id));
      
      groups.push({
        groupId: `step_${step.substring(0, 30).replace(/\s+/g, '_')}`,
        sharedStep: entries[0].failureStep,
        failureIds,
        groupSize: entries.length,
        // Higher confidence for larger groups
        confidence: entries.length >= 4 ? 90 : entries.length >= 3 ? 80 : 70,
        groupType: 'shared_step',
      });
    }
  });

  // Strategy 2: Group by similar error message (for failures not already grouped)
  const byError = new Map<string, FailureEntry[]>();
  failures.forEach(f => {
    if (assignedIds.has(f.id)) return; // Skip already grouped
    
    if (f.errorMessage && f.errorMessage.length > 20) {
      const normalized = normalizeErrorForGrouping(f.errorMessage);
      const list = byError.get(normalized) || [];
      list.push(f);
      byError.set(normalized, list);
    }
  });

  byError.forEach((entries, pattern) => {
    if (entries.length >= 3) { // Require 3+ for error pattern groups
      const failureIds = entries.map(e => e.id);
      failureIds.forEach(id => assignedIds.add(id));
      
      groups.push({
        groupId: `error_${pattern.substring(0, 30).replace(/\s+/g, '_')}`,
        sharedErrorPattern: pattern,
        failureIds,
        groupSize: entries.length,
        // Slightly lower confidence for error-based grouping
        confidence: entries.length >= 5 ? 85 : entries.length >= 4 ? 75 : 65,
        groupType: 'error_pattern',
      });
    }
  });

  return groups;
}

/**
 * Create a map from failure ID to its co-failure group (if any)
 */
export function createFailureToGroupMap(
  failures: FailureEntry[],
  groups: CoFailureGroup[]
): Map<string, CoFailureGroup> {
  const map = new Map<string, CoFailureGroup>();
  
  groups.forEach(group => {
    group.failureIds.forEach(id => {
      map.set(id, group);
    });
  });
  
  return map;
}

/**
 * Enrich failures with co-failure information for AI analysis
 */
export function getCoFailureInfo(
  failure: FailureEntry,
  failures: FailureEntry[],
  failureToGroup: Map<string, CoFailureGroup>
): CoFailureInfo | undefined {
  const group = failureToGroup.get(failure.id);
  
  if (!group) {
    return undefined;
  }

  // Get names of other tests in the group (up to 5)
  const otherTestsInGroup = group.failureIds
    .filter(id => id !== failure.id)
    .slice(0, 5)
    .map(id => {
      const other = failures.find(f => f.id === id);
      return other?.testName || 'Unknown test';
    });

  return {
    isPartOfGroup: true,
    groupSize: group.groupSize,
    sharedStep: group.sharedStep,
    sharedErrorPattern: group.sharedErrorPattern,
    otherTestsInGroup,
    groupConfidence: group.confidence,
  };
}

/**
 * Get summary stats about detected co-failure groups
 */
export function getCoFailureStats(groups: CoFailureGroup[]): {
  totalGroups: number;
  totalFailuresInGroups: number;
  largestGroupSize: number;
  averageGroupSize: number;
} {
  if (groups.length === 0) {
    return {
      totalGroups: 0,
      totalFailuresInGroups: 0,
      largestGroupSize: 0,
      averageGroupSize: 0,
    };
  }

  const totalFailuresInGroups = groups.reduce((sum, g) => sum + g.groupSize, 0);
  const largestGroupSize = Math.max(...groups.map(g => g.groupSize));
  const averageGroupSize = totalFailuresInGroups / groups.length;

  return {
    totalGroups: groups.length,
    totalFailuresInGroups,
    largestGroupSize,
    averageGroupSize: Math.round(averageGroupSize * 10) / 10,
  };
}
