import { create } from 'zustand';
import { AUTOMATION, CHAT, STORAGE_KEYS } from '@/config/constants';
import type {
  AnalysisResult,
  AutomationLogEntry,
  AutomationStatus,
  AutomationStrategy,
  ChatMessage,
  PendingToolApproval,
} from '@/types/ai';

export interface AutomationStats {
  totalTrades: number;
  profitLoss: number;
  activePositions: number;
}

export interface AIState {
  chatMessages: ChatMessage[];
  sessionProviderId: string | null;
  sessionModel: string | null;
  isAILoading: boolean;
  currentStreamContent: string;
  pendingToolApprovals: PendingToolApproval[];

  analysisResults: Record<string, AnalysisResult>;
  isAnalyzing: boolean;

  activeStrategy: AutomationStrategy | null;
  automationStatus: AutomationStatus;
  automationLog: AutomationLogEntry[];
  automationStats: AutomationStats;

  hydrateChatFromSession: () => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => ChatMessage;
  clearMessages: () => void;
  setSessionProvider: (providerId: string | null, model?: string | null) => void;
  setAILoading: (loading: boolean) => void;
  updateStreamContent: (content: string) => void;
  setPendingToolApprovals: (approvals: PendingToolApproval[]) => void;
  removePendingToolApproval: (callId: string) => void;
  setAnalysisResult: (symbol: string, result: AnalysisResult) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setActiveStrategy: (strategy: AutomationStrategy | null) => void;
  setAutomationStatus: (status: AutomationStatus) => void;
  addAutomationLog: (
    entry: Omit<AutomationLogEntry, 'id' | 'time'> & { id?: string; time?: number },
  ) => void;
  clearAutomationLog: () => void;
  updateAutomationStats: (update: Partial<AutomationStats>) => void;
}

function saveMessagesToSession(messages: readonly ChatMessage[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(STORAGE_KEYS.chat, JSON.stringify(messages));
  } catch {
    /* ignore quota / privacy errors */
  }
}

export const useAIStore = create<AIState>((set, get) => ({
  chatMessages: [],
  sessionProviderId: null,
  sessionModel: null,
  isAILoading: false,
  currentStreamContent: '',
  pendingToolApprovals: [],

  analysisResults: {},
  isAnalyzing: false,

  activeStrategy: null,
  automationStatus: 'idle',
  automationLog: [],
  automationStats: { totalTrades: 0, profitLoss: 0, activePositions: 0 },

  hydrateChatFromSession() {
    try {
      if (typeof window === 'undefined') return;
      const raw = window.sessionStorage.getItem(STORAGE_KEYS.chat);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (Array.isArray(parsed)) {
        set({ chatMessages: parsed.slice(-CHAT.maxMessages) });
      }
    } catch {
      /* ignore malformed session storage */
    }
  },

  addMessage(input) {
    const message: ChatMessage = {
      ...input,
      id: input.id ?? crypto.randomUUID(),
      createdAt: input.createdAt ?? Date.now(),
    };
    const next = [...get().chatMessages, message].slice(-CHAT.maxMessages);
    set({ chatMessages: next });
    saveMessagesToSession(next);
    return message;
  },

  clearMessages() {
    set({ chatMessages: [], currentStreamContent: '', pendingToolApprovals: [] });
    try {
      if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEYS.chat);
    } catch {
      /* ignore */
    }
  },

  setSessionProvider(providerId, model = null) {
    set({ sessionProviderId: providerId, sessionModel: model });
  },

  setAILoading(isAILoading) {
    set({ isAILoading });
  },

  updateStreamContent(currentStreamContent) {
    set({ currentStreamContent });
  },

  setPendingToolApprovals(pendingToolApprovals) {
    set({ pendingToolApprovals });
  },

  removePendingToolApproval(callId) {
    set({
      pendingToolApprovals: get().pendingToolApprovals.filter((item) => item.call.id !== callId),
    });
  },

  setAnalysisResult(symbol, result) {
    set({
      analysisResults: { ...get().analysisResults, [symbol.toUpperCase()]: result },
    });
  },

  setIsAnalyzing(isAnalyzing) {
    set({ isAnalyzing });
  },

  setActiveStrategy(activeStrategy) {
    set({ activeStrategy });
  },

  setAutomationStatus(automationStatus) {
    set({ automationStatus });
  },

  addAutomationLog(entry) {
    const item: AutomationLogEntry = {
      id: entry.id ?? crypto.randomUUID(),
      time: entry.time ?? Date.now(),
      level: entry.level,
      message: entry.message,
    };
    const next = [item, ...get().automationLog].slice(0, AUTOMATION.maxLogEntries);
    set({ automationLog: next });
  },

  clearAutomationLog() {
    set({ automationLog: [] });
  },

  updateAutomationStats(update) {
    set({ automationStats: { ...get().automationStats, ...update } });
  },
}));
