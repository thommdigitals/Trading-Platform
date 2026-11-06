'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Bot,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { showError, showSuccess } from '@/components/ui/toast';
import { fortunoApi } from '@/services/fortunoApi';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import { getErrorMessage } from '@/utils/errorHandler';
import {
  getAccountLogin,
  getDaysUntilExpiry,
  getEnvironment,
  getTokenExpiry,
  isTokenExpired,
  tryDecodeJWT,
} from '@/utils/jwtUtils';

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const hydrated = useConfigStore((s) => s.hydrated);
  const apiToken = useConfigStore((s) => s.apiToken);
  const demoMode = useConfigStore((s) => s.demoMode);
  const setToken = useConfigStore((s) => s.setToken);
  const setDemoMode = useConfigStore((s) => s.setDemoMode);

  const [tokenInput, setTokenInput] = React.useState('');
  const [showToken, setShowToken] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!hydrated) {
      void useConfigStore.getState().hydrate();
    }
  }, [hydrated]);

  React.useEffect(() => {
    if (hydrated && (apiToken || demoMode)) {
      router.replace('/dashboard');
    }
  }, [hydrated, apiToken, demoMode, router]);

  const decodedPreview = React.useMemo(() => {
    const trimmed = tokenInput.trim();
    if (!trimmed) return null;
    const payload = tryDecodeJWT(trimmed);
    if (!payload) return { valid: false as const };
    return {
      valid: true as const,
      login: getAccountLogin(trimmed),
      env: getEnvironment(trimmed),
      expiry: getTokenExpiry(trimmed),
      daysLeft: getDaysUntilExpiry(trimmed),
      expired: isTokenExpired(trimmed),
    };
  }, [tokenInput]);

  const handleConnect = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      setError('Masukkan JWT API Token Anda terlebih dahulu.');
      return;
    }

    const payload = tryDecodeJWT(trimmed);
    if (!payload) {
      setError('Format JWT API Token tidak valid.');
      return;
    }
    if (isTokenExpired(trimmed)) {
      setError('Token sudah kadaluarsa. Silakan generate token baru di portal Fortuno Markets.');
      return;
    }

    setConnecting(true);
    setError(null);
    useTradingStore.getState().setConnectionState('connecting');

    try {
      setDemoMode(false);
      await setToken(trimmed, remember);
      const account = await fortunoApi.getAccount();
      useTradingStore.getState().setAccount(account);
      useTradingStore.getState().setConnectionState('connected');
      showSuccess(`Terhubung ke akun #${account.login} (${account.currency})`);
      router.push('/dashboard');
    } catch (err) {
      await setToken(null, remember);
      const msg = getErrorMessage(err);
      setError(msg);
      useTradingStore.getState().setConnectionState('disconnected', msg);
      showError(msg);
    } finally {
      setConnecting(false);
    }
  };

  const handleLaunchDemo = async (): Promise<void> => {
    setConnecting(true);
    setError(null);
    try {
      setDemoMode(true);
      const account = await fortunoApi.getAccount();
      useTradingStore.getState().setAccount(account);
      useTradingStore.getState().setConnectionState('connected');
      showSuccess('Demo Sandbox aktif! Semua fitur trading & AI siap diuji.');
      router.push('/dashboard');
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      showError(msg);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Fortuno Markets • Match-Trader API v1 • Multi-Provider AI</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            FortunoAI Trading Platform
          </h1>
          <p className="mt-2 text-xs text-slate-400 sm:text-sm">
            Institutional-grade web trading terminal with encrypted client-side key vault,
            multi-provider AI Co-Pilot, and automated risk guardrails.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3 border-slate-800 bg-slate-900/80">
            <CardHeader>
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-blue-400" />
                <CardTitle className="text-base font-semibold">
                  Connect with Fortuno Markets JWT Token
                </CardTitle>
              </div>
              <p className="text-xs text-slate-400">
                Your token is encrypted with AES-256-GCM (non-extractable Web Crypto key in
                IndexedDB) and never stored on any external server.
              </p>
            </CardHeader>

            <CardContent>
              <form onSubmit={(e) => void handleConnect(e)} className="space-y-4">
                <div>
                  <label
                    htmlFor="jwt-token-input"
                    className="mb-1.5 block text-xs font-medium text-slate-300"
                  >
                    Match-Trader Bearer JWT Token
                  </label>
                  <div className="relative">
                    <Input
                      id="jwt-token-input"
                      aria-label="Match-Trader Bearer JWT Token"
                      type={showToken ? 'text' : 'password'}
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzUxMiJ9.eyJleHAiOj..."
                      className="pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((v) => !v)}
                      aria-label={showToken ? 'Sembunyikan token' : 'Tampilkan token'}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {decodedPreview && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs">
                    {!decodedPreview.valid ? (
                      <p className="text-rose-400">
                        Format JWT belum lengkap atau tidak valid (harus terdiri dari header.payload.signature).
                      </p>
                    ) : (
                      <div className="space-y-1.5 font-mono text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Account Login:</span>
                          <span className="font-semibold text-slate-100">
                            #{decodedPreview.login ?? 'Unknown'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Environment:</span>
                          <Badge variant="outline" className="text-[10px]">
                            {decodedPreview.env ?? 'Match-Trader'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Expires:</span>
                          <span
                            className={
                              decodedPreview.expired
                                ? 'text-rose-400 font-semibold'
                                : decodedPreview.daysLeft <= 7
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                            }
                          >
                            {decodedPreview.expiry.toLocaleDateString()} ({decodedPreview.daysLeft}d left)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="rounded border-slate-700"
                    />
                    <span>Remember encrypted token on this device</span>
                  </label>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300"
                  >
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <Button
                    type="submit"
                    variant="default"
                    disabled={connecting}
                    className="flex-1"
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting…
                      </>
                    ) : (
                      'Connect to Fortuno Markets'
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="buy"
                    disabled={connecting}
                    onClick={() => void handleLaunchDemo()}
                    className="flex-1"
                  >
                    <Play className="mr-1.5 h-4 w-4" />
                    Launch Demo Sandbox (Instant)
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4 lg:col-span-2">
            <Card className="border-slate-800 bg-slate-900/60">
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex items-center gap-2 font-semibold text-slate-100">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Zero-Trust Client-Side Security</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  AES-256-GCM encryption with non-extractable Web Crypto keys stored in IndexedDB,
                  AAD slot binding, strict CSP nonces, and hardened upstream CORS proxy.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex items-center gap-2 font-semibold text-slate-100">
                  <Bot className="h-4 w-4 text-blue-400" />
                  <span>7 AI Provider Integrations</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Switch seamlessly between OpenAI, Anthropic Claude, Google Gemini, Mistral AI,
                  Groq, local Ollama, or any custom OpenAI-compatible endpoint.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex items-center gap-2 font-semibold text-slate-100">
                  <Activity className="h-4 w-4 text-amber-400" />
                  <span>Interactive Demo Sandbox Included</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Click <strong>Launch Demo Sandbox</strong> to test live candlesticks, market &amp;
                  pending orders, AI Co-Pilot tool execution, and automated trading immediately.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
