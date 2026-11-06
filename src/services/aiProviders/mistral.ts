import { PROVIDER_PRESETS, type ProviderType } from '@/config/aiProviders';
import type { AIProviderConfig } from '@/types/ai';
import { OpenAIProvider } from './openai';

export class MistralProvider extends OpenAIProvider {
  override readonly type: ProviderType = 'mistral';

  constructor(config: AIProviderConfig, fetchImpl?: typeof fetch) {
    super(
      {
        ...config,
        baseURL: config.baseURL || PROVIDER_PRESETS.mistral.baseURL,
        defaultModel: config.defaultModel || PROVIDER_PRESETS.mistral.defaultModel,
      },
      fetchImpl,
    );
  }

  override async listModels(): Promise<string[]> {
    return [...PROVIDER_PRESETS.mistral.fallbackModels];
  }
}
