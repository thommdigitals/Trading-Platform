/**
 * Single source of truth for AI provider presets.
 * Add a new preset here and (if the wire protocol differs) one provider class.
 */

export const PROVIDER_TYPES = [
  'openai',
  'anthropic',
  'google',
  'mistral',
  'groq',
  'ollama',
  'custom',
] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

/** Wire protocols implemented by provider classes. */
export type ProviderProtocol = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export interface ProviderPreset {
  type: ProviderType;
  label: string;
  protocol: ProviderProtocol;
  baseURL: string;
  defaultModel: string;
  requiresApiKey: boolean;
  /** Models offered when the provider has no (usable) model-listing endpoint. */
  fallbackModels: readonly string[];
  /** Short hint shown in the UI about where to obtain an API key. */
  keyHint: string;
}

export const PROVIDER_PRESETS: Record<ProviderType, ProviderPreset> = {
  openai: {
    type: 'openai',
    label: 'OpenAI',
    protocol: 'openai',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    requiresApiKey: true,
    fallbackModels: ['gpt-4o', 'gpt-4o-mini'],
    keyHint: 'platform.openai.com',
  },
  anthropic: {
    type: 'anthropic',
    label: 'Anthropic (Claude)',
    protocol: 'anthropic',
    baseURL: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    requiresApiKey: true,
    fallbackModels: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    keyHint: 'console.anthropic.com',
  },
  google: {
    type: 'google',
    label: 'Google Gemini',
    protocol: 'gemini',
    baseURL: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-1.5-pro',
    requiresApiKey: true,
    fallbackModels: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    keyHint: 'aistudio.google.com',
  },
  mistral: {
    type: 'mistral',
    label: 'Mistral AI',
    protocol: 'openai',
    baseURL: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    requiresApiKey: true,
    fallbackModels: [
      'mistral-large-latest',
      'mistral-medium-latest',
      'mistral-small-latest',
      'codestral-latest',
    ],
    keyHint: 'console.mistral.ai',
  },
  groq: {
    type: 'groq',
    label: 'Groq',
    protocol: 'openai',
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    requiresApiKey: true,
    fallbackModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'],
    keyHint: 'console.groq.com',
  },
  ollama: {
    type: 'ollama',
    label: 'Ollama (Local)',
    protocol: 'ollama',
    baseURL: 'http://localhost:11434',
    defaultModel: 'llama3',
    requiresApiKey: false,
    fallbackModels: ['llama3', 'qwen2.5'],
    keyHint: 'No API key needed',
  },
  custom: {
    type: 'custom',
    label: 'Custom (OpenAI-compatible)',
    protocol: 'openai',
    baseURL: '',
    defaultModel: '',
    requiresApiKey: true,
    fallbackModels: [],
    keyHint: 'Depends on your provider',
  },
};

/** Providers seeded on first run (API keys are filled in by the user). */
export const DEFAULT_PROVIDER_SEEDS: ReadonlyArray<{
  type: ProviderType;
  displayName: string;
}> = [
  { type: 'openai', displayName: 'OpenAI GPT-4o' },
  { type: 'anthropic', displayName: 'Claude (Anthropic)' },
  { type: 'google', displayName: 'Google Gemini' },
  { type: 'mistral', displayName: 'Mistral AI' },
  { type: 'groq', displayName: 'Groq (Llama)' },
  { type: 'ollama', displayName: 'Ollama (Local)' },
];

