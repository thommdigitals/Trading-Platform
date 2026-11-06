'use client';

import * as React from 'react';
import { Eye, EyeOff, PlugZap, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PROVIDER_PRESETS, PROVIDER_TYPES, type ProviderType } from '@/config/aiProviders';
import { createProvider } from '@/services/aiProviders';
import type { AIProviderConfig } from '@/types/ai';

export interface AddProviderModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onAdd: (input: Omit<AIProviderConfig, 'id' | 'createdAt'>) => void;
}

export function AddProviderModal({
  open,
  onOpenChange,
  onAdd,
}: AddProviderModalProps): React.ReactElement {
  const [type, setType] = React.useState<ProviderType>('openai');
  const [displayName, setDisplayName] = React.useState('OpenAI');
  const [baseURL, setBaseURL] = React.useState(PROVIDER_PRESETS.openai.baseURL);
  const [apiKey, setApiKey] = React.useState('');
  const [showKey, setShowKey] = React.useState(false);
  const [defaultModel, setDefaultModel] = React.useState(PROVIDER_PRESETS.openai.defaultModel);
  const [models, setModels] = React.useState<string[]>([...PROVIDER_PRESETS.openai.fallbackModels]);
  const [fetchingModels, setFetchingModels] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);

  const handleTypeChange = (nextType: ProviderType): void => {
    const preset = PROVIDER_PRESETS[nextType];
    setType(nextType);
    setDisplayName(preset.label);
    setBaseURL(preset.baseURL);
    setDefaultModel(preset.defaultModel);
    setModels([...preset.fallbackModels]);
    setStatusMsg(null);
  };

  const handleFetchModels = React.useCallback(
    async (silent: boolean = false, signal?: AbortSignal): Promise<string[]> => {
      const trimmedBase = baseURL.trim();
      if (!/^https?:\/\/.+/i.test(trimmedBase)) {
        if (!silent) setStatusMsg('✕ Masukkan Base URL yang valid terlebih dahulu (contoh: https://kiosapi.com/v1)');
        return [];
      }
      setFetchingModels(true);
      if (!silent) setStatusMsg(null);
      try {
        const instance = createProvider({
          id: 'temp',
          displayName: displayName || 'Custom Provider',
          type,
          baseURL: trimmedBase,
          apiKey: apiKey.trim(),
          defaultModel,
          createdAt: Date.now(),
        });
        const list = await instance.listModels(signal);
        if (signal?.aborted) return [];
        if (list.length > 0) {
          setModels(list);
          setDefaultModel((prev) => (prev && list.includes(prev) ? prev : (list[0] ?? prev)));
          setStatusMsg(`✓ Loaded ${list.length} models`);
          return list;
        }
        if (!silent) {
          setStatusMsg('✕ Tidak ada model yang ditemukan dari endpoint /models provider ini');
        }
        return [];
      } catch (err) {
        if (!signal?.aborted && !silent) {
          setStatusMsg(`✕ ${err instanceof Error ? err.message : 'Failed to fetch models'}`);
        }
        return [];
      } finally {
        if (!signal?.aborted) {
          setFetchingModels(false);
        }
      }
    },
    [baseURL, displayName, type, apiKey, defaultModel],
  );

  // Automatically fetch available models when Base URL and API Key are filled (like Hermes)
  React.useEffect(() => {
    if (!open) return;
    const trimmedBase = baseURL.trim();
    const trimmedKey = apiKey.trim();
    const requiresKey = PROVIDER_PRESETS[type].requiresApiKey;

    if (!/^https?:\/\/.+/i.test(trimmedBase)) return;
    if (requiresKey && !trimmedKey) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void handleFetchModels(true, controller.signal);
    }, 550);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, type, baseURL, apiKey, handleFetchModels]);

  const handleTestConnection = async (): Promise<void> => {
    setTesting(true);
    setStatusMsg(null);
    try {
      let modelToUse = defaultModel.trim();
      if (!modelToUse) {
        const fetched = await handleFetchModels(true);
        if (fetched.length > 0 && fetched[0]) {
          modelToUse = fetched[0];
          setDefaultModel(modelToUse);
        }
      }
      const instance = createProvider({
        id: 'temp',
        displayName: displayName || 'Custom Provider',
        type,
        baseURL: baseURL.trim(),
        apiKey: apiKey.trim(),
        defaultModel: modelToUse,
        createdAt: Date.now(),
      });
      const res = await instance.testConnection();
      setStatusMsg(
        res.success
          ? `✓ Connection verified (${res.latency}ms)${modelToUse ? ` • Model: ${modelToUse}` : ''}`
          : `✕ ${res.error ?? 'Connection failed'}`,
      );
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!displayName.trim() || !baseURL.trim()) return;
    let resolvedModel = defaultModel.trim() || models[0] || PROVIDER_PRESETS[type].defaultModel;
    if (!resolvedModel) {
      const fetched = await handleFetchModels(true);
      resolvedModel = fetched[0] || 'gpt-4o-mini';
    }
    onAdd({
      displayName: displayName.trim(),
      type,
      baseURL: baseURL.trim(),
      apiKey: apiKey.trim(),
      defaultModel: resolvedModel,
    });
    onOpenChange(false);
  };

  const preset = PROVIDER_PRESETS[type];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add AI Provider"
      description="Configure an OpenAI, Anthropic, Gemini, Mistral, Groq, Ollama, or custom OpenAI-compatible endpoint."
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 text-xs">
        <div>
          <label className="mb-1 block font-medium text-slate-300">Provider Type</label>
          <Select
            aria-label="Provider Type"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as ProviderType)}
          >
            {PROVIDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROVIDER_PRESETS[t].label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-1 block font-medium text-slate-300">Display Name</label>
          <Input
            aria-label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block font-medium text-slate-300">Base URL</label>
          <Input
            aria-label="Base URL"
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
            placeholder="https://api.openai.com/v1"
            required
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="font-medium text-slate-300">
              API Key {!preset.requiresApiKey && '(Optional)'}
            </label>
            <span className="text-[10px] text-slate-400">{preset.keyHint}</span>
          </div>
          <div className="relative">
            <Input
              aria-label="API Key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={preset.requiresApiKey ? 'sk-…' : 'Not required for local Ollama'}
              className="pr-9 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="font-medium text-slate-300">Default Model</label>
            <button
              type="button"
              onClick={() => void handleFetchModels()}
              disabled={fetchingModels}
              className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
            >
              <RefreshCw className={`h-3 w-3 ${fetchingModels ? 'animate-spin' : ''}`} />
              Fetch Models
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Select
              aria-label="Select preset model"
              value={models.includes(defaultModel) ? defaultModel : ''}
              onChange={(e) => {
                if (e.target.value) setDefaultModel(e.target.value);
              }}
            >
              <option value="">Custom model ID…</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Default Model ID"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              placeholder="Auto-detected or e.g. gpt-4o"
            />
          </div>
        </div>

        {statusMsg && (
          <p className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] text-slate-300">
            {statusMsg}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={testing}
            onClick={() => void handleTestConnection()}
          >
            <PlugZap className="mr-1.5 h-3.5 w-3.5" />
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="default">
              Save Provider
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

