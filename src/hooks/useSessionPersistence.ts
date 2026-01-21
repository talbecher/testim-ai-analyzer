import { useCallback } from 'react';
import { AnalyzedFailure, ReportMode } from '@/types/testim';
import { AnalyzedFailureWithFeedback, RunDetails } from '@/types/feedback';
import { PreClassifiedUploadStats } from './useChecklist';

const SESSION_KEYS = {
  ANALYSIS_SESSION: 'testim_analysis_session',
  FEEDBACK_SESSION: 'testim_feedback_session',
  RUN_DETAILS: 'testim_run_details',
} as const;

export interface AnalysisSessionData {
  failures: AnalyzedFailure[];
  reportMode: ReportMode;
  preClassifiedStats: PreClassifiedUploadStats | null;
  isPreClassifiedMode: boolean;
  timestamp: number;
}

export interface FeedbackSessionData {
  failuresWithFeedback: AnalyzedFailureWithFeedback[];
  timestamp: number;
}

export function useSessionPersistence() {
  // Save analysis session data
  const saveAnalysisSession = useCallback((data: Omit<AnalysisSessionData, 'timestamp'>) => {
    if (data.failures.length === 0) return;
    
    try {
      const sessionData: AnalysisSessionData = {
        ...data,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(SESSION_KEYS.ANALYSIS_SESSION, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to save analysis session:', error);
    }
  }, []);

  // Load analysis session data
  const loadAnalysisSession = useCallback((): AnalysisSessionData | null => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEYS.ANALYSIS_SESSION);
      if (!stored) return null;
      
      const data = JSON.parse(stored) as AnalysisSessionData;
      
      // Check if session is less than 24 hours old
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - data.timestamp > maxAge) {
        sessionStorage.removeItem(SESSION_KEYS.ANALYSIS_SESSION);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Failed to load analysis session:', error);
      return null;
    }
  }, []);

  // Save feedback session data
  const saveFeedbackSession = useCallback((failuresWithFeedback: AnalyzedFailureWithFeedback[]) => {
    if (failuresWithFeedback.length === 0) return;
    
    try {
      const sessionData: FeedbackSessionData = {
        failuresWithFeedback,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(SESSION_KEYS.FEEDBACK_SESSION, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to save feedback session:', error);
    }
  }, []);

  // Load feedback session data
  const loadFeedbackSession = useCallback((): FeedbackSessionData | null => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEYS.FEEDBACK_SESSION);
      if (!stored) return null;
      
      const data = JSON.parse(stored) as FeedbackSessionData;
      
      // Check if session is less than 24 hours old
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - data.timestamp > maxAge) {
        sessionStorage.removeItem(SESSION_KEYS.FEEDBACK_SESSION);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Failed to load feedback session:', error);
      return null;
    }
  }, []);

  // Save run details
  const saveRunDetails = useCallback((runDetails: RunDetails) => {
    try {
      sessionStorage.setItem(SESSION_KEYS.RUN_DETAILS, JSON.stringify(runDetails));
    } catch (error) {
      console.error('Failed to save run details:', error);
    }
  }, []);

  // Load run details
  const loadRunDetails = useCallback((): RunDetails | null => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEYS.RUN_DETAILS);
      if (!stored) return null;
      
      const data = JSON.parse(stored);
      // Ensure date is properly parsed
      return {
        ...data,
        date: new Date(data.date),
      };
    } catch (error) {
      console.error('Failed to load run details:', error);
      return null;
    }
  }, []);

  // Clear all session data
  const clearAllSessions = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEYS.ANALYSIS_SESSION);
    sessionStorage.removeItem(SESSION_KEYS.FEEDBACK_SESSION);
    sessionStorage.removeItem(SESSION_KEYS.RUN_DETAILS);
  }, []);

  // Check if there's an existing session
  const hasExistingSession = useCallback((): boolean => {
    const analysisSession = sessionStorage.getItem(SESSION_KEYS.ANALYSIS_SESSION);
    return !!analysisSession;
  }, []);

  return {
    saveAnalysisSession,
    loadAnalysisSession,
    saveFeedbackSession,
    loadFeedbackSession,
    saveRunDetails,
    loadRunDetails,
    clearAllSessions,
    hasExistingSession,
  };
}
