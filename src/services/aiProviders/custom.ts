import type { ProviderType } from '@/config/aiProviders';
import type { AIProviderConfig } from '@/types/ai';
import { OpenAIProvider } from './openai';

export class CustomProvider extends OpenAIProvider {
  override readonly type: ProviderType = 'custom';

  constructor(config: AIProviderConfig, fetchImpl?: typeof fetch) {
    super(config, fetchImpl);
  }
}
