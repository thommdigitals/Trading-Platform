import { z } from 'zod';
import { PROVIDER_TYPES, type ProviderType } from '@/config/aiProviders';
import { CANDLE_INTERVALS, type POSITION_SIDES } from '@/config/market';

export { PROVIDER_TYPES };
export type { ProviderType };

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  /** Tool invocations requested by the assistant in this turn. */
  toolCalls?: ToolCall[];
  /** Present on `role: 'tool'` messages: links back to the assistant `ToolCall.id`. */
  toolCallId?: string;
  toolName?: string;
}

export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: readonly AITool[];
  signal?: AbortSignal;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResult {
  content: string;
  model: string;
  usage?: TokenUsage;
  toolCalls?: ToolCall[];
}

export interface ConnectionTestResult {
  success: boolean;
  latency: number;
  error?: string;
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly type: ProviderType;
  readonly defaultModel: string;
  chat(messages: readonly ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
  chatStream(messages: readonly ChatMessage[], options?: ChatOptions): AsyncGenerator<string, void, void>;
  listModels(signal?: AbortSignal): Promise<string[]>;
  testConnection(signal?: AbortSignal): Promise<ConnectionTestResult>;
}

export const AIProviderConfigSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().trim().min(1).max(80),
  type: z.enum(PROVIDER_TYPES),
  baseURL: z.string().trim(),
  apiKey: z.string(),
  defaultModel: z.string().trim().min(1).max(120),
  createdAt: z.number().finite(),
});
export type AIProviderConfig = z.infer<typeof AIProviderConfigSchema>;

// --- Market analysis & signals ----------------------------------------------------------------

export const AnalysisResultSchema = z.object({
  trend: z.enum(['UPTREND', 'DOWNTREND', 'SIDEWAYS']),
  signal: z.enum(['BUY', 'SELL', 'HOLD', 'WAIT']),
  strength: z.coerce.number().int().min(1).max(5).catch(3),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).catch('MEDIUM'),
  supportLevels: z.array(z.coerce.number().finite()).max(6).catch([]),
  resistanceLevels: z.array(z.coerce.number().finite()).max(6).catch([]),
  entryPrice: z.coerce.number().finite().nullish().transform((v) => v ?? null),
  tpPrice: z.coerce.number().finite().nullish().transform((v) => v ?? null),
  slPrice: z.coerce.number().finite().nullish().transform((v) => v ?? null),
  reasoning: z.string().min(1),
});

export type AnalysisPayload = z.infer<typeof AnalysisResultSchema>;

export interface AnalysisResult extends AnalysisPayload {
  symbol: string;
  interval: (typeof CANDLE_INTERVALS)[number];
  analyzedAt: number;
}

// --- Automation -------------------------------------------------------------------------------

export const ParsedStrategySchema = z.object({
  name: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(600),
  entryConditions: z.array(z.string().trim().min(1)).min(1).max(10),
  exitConditions: z.array(z.string().trim().min(1)).max(10).catch([]),
  suggestedTpPips: z.coerce.number().nonnegative().nullish().transform((v) => v ?? null),
  suggestedSlPips: z.coerce.number().nonnegative().nullish().transform((v) => v ?? null),
});
export type ParsedStrategy = z.infer<typeof ParsedStrategySchema>;

const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Gunakan format HH:MM (00:00–23:59)');

export const StrategyRiskConfigSchema = z.object({
  symbol: z.string().trim().min(1),
  interval: z.enum(CANDLE_INTERVALS),
  volume: z.number().finite().positive(),
  maxOpenPositions: z.number().int().min(1).max(50),
  maxDailyLoss: z.number().finite().positive(),
  maxDrawdownPercent: z.number().finite().min(0.5).max(95),
  activeHoursStart: hhmmSchema,
  activeHoursEnd: hhmmSchema,
});
export type StrategyRiskConfig = z.infer<typeof StrategyRiskConfigSchema>;

export interface AutomationStrategy extends ParsedStrategy, StrategyRiskConfig {
  id: string;
  rawDescription: string;
  createdAt: number;
}

export type AutomationStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

export const AutomationDecisionSchema = z.object({
  action: z.enum(['OPEN_BUY', 'OPEN_SELL', 'CLOSE_POSITION', 'HOLD']),
  positionId: z.string().nullish().transform((v) => v ?? null),
  tpPrice: z.coerce.number().positive().nullish().transform((v) => v ?? null),
  slPrice: z.coerce.number().positive().nullish().transform((v) => v ?? null),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).catch('LOW'),
  reasoning: z.string().default(''),
});
export type AutomationDecision = z.infer<typeof AutomationDecisionSchema>;

export interface AutomationLogEntry {
  id: string;
  time: number;
  level: 'info' | 'action' | 'warn' | 'error';
  message: string;
}

export interface PendingToolApproval {
  call: ToolCall;
  summary: string;
  side?: (typeof POSITION_SIDES)[number];
}
