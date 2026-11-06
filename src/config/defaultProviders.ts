import { DEFAULT_PROVIDER_SEEDS, PROVIDER_PRESETS } from './aiProviders';
import type { AIProviderConfig } from '@/types/ai';

export { DEFAULT_PROVIDER_SEEDS, PROVIDER_PRESETS };

/** Builds the initial list of seeded AI providers when none are stored yet. */
export function buildDefaultProviders(now: number = Date.now()): AIProviderConfig[] {
  return DEFAULT_PROVIDER_SEEDS.map((seed, index) => {
    const preset = PROVIDER_PRESETS[seed.type];
    return {
      id: `default-${seed.type}`,
      displayName: seed.displayName,
      type: seed.type,
      baseURL: preset.baseURL,
      apiKey: '',
      defaultModel: preset.defaultModel,
      createdAt: now + index,
    };
  });
}
