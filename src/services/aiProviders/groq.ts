import { PROVIDER_PRESETS, type ProviderType } from '@/config/aiProviders';
import type { AIProviderConfig } from '@/types/ai';
import { OpenAIProvider } from './openai';

export class GroqProvider extends OpenAIProvider {
  override readonly type: ProviderType = 'groq';

  constructor(config: AIProviderConfig, fetchImpl?: typeof fetch) {
    super(
      {
        ...config,
        baseURL: config.baseURL || PROVIDER_PRESETS.groq.baseURL,
        defaultModel: config.defaultModel || PROVIDER_PRESETS.groq.defaultModel,
      },
      fetchImpl,
    );
  }

  override async listModels(): Promise<string[]> {
    return [...PROVIDER_PRESETS.groq.fallbackModels];
  }
}
