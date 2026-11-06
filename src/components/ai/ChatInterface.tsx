'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, Eraser, Loader2, Send, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { PROVIDER_PRESETS } from '@/config/aiProviders';
import { CHAT } from '@/config/constants';
import { useAI } from '@/hooks/useAI';
import { useConfigStore } from '@/store/configStore';

import { ChatMessage } from './ChatMessage';
import { TradeConfirmCard } from './TradeConfirmCard';

const QUICK_PROMPTS = [
  'Analisa teknikal EURUSD.pro timeframe H1 sekarang',
  'Ringkas saldo akun, margin level, dan posisi terbuka saya',
  'Buka BUY EURUSD.pro 0.05 lot dengan SL & TP otomatis',
  'Evaluasi eksposur risiko portofolio saya saat ini',
] as const;

export function ChatInterface(): React.ReactElement {
  const aiProviders = useConfigStore((s) => s.aiProviders);
  const {
    chatMessages,
    isAILoading,
    currentStreamContent,
    pendingToolApprovals,
    effectiveProviderId,
    effectiveProviderConfig,
    demoMode,
    sendMessage,
    confirmToolCall,
    cancelToolCall,
    clearMessages,
    setSessionProvider,
  } = useAI();

  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const availableModels = React.useMemo(() => {
    if (!effectiveProviderConfig) return [];
    const preset = PROVIDER_PRESETS[effectiveProviderConfig.type];
    const set = new Set<string>([
      effectiveProviderConfig.defaultModel,
      ...preset.fallbackModels,
    ]);
    return Array.from(set);
  }, [effectiveProviderConfig]);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, currentStreamContent, pendingToolApprovals]);

  const handleSend = (): void => {
    const trimmed = input.trim();
    if (!trimmed || isAILoading) return;
    setInput('');
    void sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="flex h-[calc(100vh-140px)] min-h-[540px] flex-col">
      <CardHeader className="flex flex-col gap-2.5 border-b border-slate-800/80 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">Fortuno AI Trading Co-Pilot</CardTitle>
              {demoMode && <Badge variant="warning">Demo AI Active</Badge>}
            </div>
            <p className="text-[11px] text-slate-400">
              Real-time portfolio context + Natural language order execution
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Select AI Provider for session"
            value={effectiveProviderId}
            onChange={(e) => {
              const nextProv = aiProviders.find((p) => p.id === e.target.value);
              setSessionProvider(e.target.value, nextProv?.defaultModel ?? null);
            }}
            className="h-8 w-40 text-xs py-0.5 px-2"
          >
            {aiProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </Select>

          {availableModels.length > 0 && (
            <Select
              aria-label="Select AI Model for session"
              value={effectiveProviderConfig?.defaultModel ?? ''}
              onChange={(e) => setSessionProvider(effectiveProviderId, e.target.value)}
              className="h-8 w-44 font-mono text-xs py-0.5 px-2"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={clearMessages}
            disabled={chatMessages.length === 0 && !currentStreamContent}
            className="h-8 px-2.5 text-xs"
          >
            <Eraser className="mr-1.5 h-3.5 w-3.5" />
            New Chat
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {chatMessages.length === 0 && !currentStreamContent ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
                <Bot className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-100">
                Halo! Saya Asisten AI Trading Fortuno Markets Anda
              </h3>
              <p className="mt-1 max-w-md text-xs text-slate-400">
                Tanyakan analisa teknikal, evaluasi risiko portofolio, atau perintahkan pembukaan/penutupan posisi dengan bahasa sehari-hari. Semua transaksi memerlukan konfirmasi Anda.
              </p>

              <div className="mt-5 grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-left text-xs text-slate-300 transition-colors hover:border-blue-500/50 hover:bg-slate-900 hover:text-white"
                  >
                    “{prompt}”
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {chatMessages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              {pendingToolApprovals.map((approval) => (
                <TradeConfirmCard
                  key={approval.call.id}
                  approval={approval}
                  onConfirm={(a) => void confirmToolCall(a)}
                  onCancel={cancelToolCall}
                  disabled={isAILoading}
                />
              ))}

              {currentStreamContent && (
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-600/20 text-emerald-300">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-xs border border-slate-800 bg-slate-900/90 px-3.5 py-2.5 text-xs text-slate-100">
                    <ReactMarkdown>{currentStreamContent}</ReactMarkdown>
                  </div>
                </div>
              )}

              {isAILoading && !currentStreamContent && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                  <span>AI sedang menganalisa data pasar &amp; portofolio…</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-slate-800/80 bg-slate-950/60 p-3">
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                aria-label="Pesan untuk AI Co-Pilot"
                rows={2}
                maxLength={CHAT.maxInputChars}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik pesan atau perintah trading (Enter untuk kirim, Shift+Enter baris baru)…"
                className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
              />
              <span className="absolute bottom-2 right-3 font-mono text-[10px] text-slate-500">
                {input.length}/{CHAT.maxInputChars}
              </span>
            </div>

            <Button
              variant="default"
              disabled={!input.trim() || isAILoading}
              onClick={handleSend}
              aria-label="Kirim pesan"
              className="h-11 px-4"
            >
              {isAILoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

