'use client';

import * as React from 'react';
import { CheckCircle2, Cpu, Edit3, PlugZap, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PROVIDER_PRESETS } from '@/config/aiProviders';
import { createProvider } from '@/services/aiProviders';
import type { AIProviderConfig, ConnectionTestResult } from '@/types/ai';
import { maskSecret } from '@/utils/formatters';

export interface AIProviderCardProps {
  readonly provider: AIProviderConfig;
  readonly isActive: boolean;
  readonly onSetActive: (id: string) => void;
  readonly onEdit: (provider: AIProviderConfig) => void;
  readonly onDelete: (id: string) => void;
}

export function AIProviderCard({
  provider,
  isActive,
  onSetActive,
  onEdit,
  onDelete,
}: AIProviderCardProps): React.ReactElement {
  const preset = PROVIDER_PRESETS[provider.type];
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<ConnectionTestResult | null>(null);

  const handleTest = async (): Promise<void> => {
    setTesting(true);
    try {
      const instance = createProvider(provider);
      const res = await instance.testConnection();
      setTestResult(res);
    } catch (err) {
      setTestResult({
        success: false,
        latency: 0,
        error: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card
      className={
        isActive
          ? 'border-blue-500/70 bg-blue-500/5 shadow-sm'
          : 'border-slate-800/80 bg-slate-900/50'
      }
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-blue-400 shrink-0" />
            <CardTitle className="text-sm font-semibold truncate">{provider.displayName}</CardTitle>
            {isActive && <Badge variant="success">ACTIVE</Badge>}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {preset.label} • <span className="font-mono">{provider.defaultModel}</span>
          </p>
        </div>

        <Badge variant="outline" className="text-[10px] uppercase">
          {provider.type}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 pt-0 text-xs">
        <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 font-mono text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Endpoint:</span>
            <span className="truncate text-slate-200">{provider.baseURL}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">API Key:</span>
            <span className="text-slate-200">
              {provider.apiKey
                ? maskSecret(provider.apiKey)
                : preset.requiresApiKey
                  ? 'Not configured'
                  : 'Local (No key needed)'}
            </span>
          </div>
        </div>

        {testResult && (
          <div
            className={`rounded-md px-2.5 py-1.5 text-[11px] ${
              testResult.success
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
            }`}
          >
            {testResult.success
              ? `✓ Connected (${testResult.latency}ms)`
              : `✕ ${testResult.error ?? 'Connection failed'}`}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5">
            {!isActive && (
              <Button
                size="sm"
                variant="default"
                onClick={() => onSetActive(provider.id)}
                className="h-7 px-2.5 text-[11px]"
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Set Active
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={testing}
              onClick={() => void handleTest()}
              className="h-7 px-2.5 text-[11px]"
            >
              <PlugZap className="mr-1 h-3 w-3" />
              {testing ? 'Testing…' : 'Test Connection'}
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(provider)}
              aria-label={`Edit ${provider.displayName}`}
              className="h-7 px-2 text-[11px]"
            >
              <Edit3 className="mr-1 h-3 w-3" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(provider.id)}
              aria-label={`Delete ${provider.displayName}`}
              className="h-7 px-2 text-[11px] text-rose-400 hover:text-rose-300"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

