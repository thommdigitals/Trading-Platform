'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, Info, KeyRound, LogOut, Palette, ShieldAlert } from 'lucide-react';

import { AIProvidersManager } from '@/components/ai/AIProvidersManager';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { showError, showSuccess } from '@/components/ui/toast';
import { fortunoApi } from '@/services/fortunoApi';
import { type FontSizeMode, type ThemeMode, useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import { maskSecret } from '@/utils/formatters';
import {
  getAccountLogin,
  getDaysUntilExpiry,
  getEnvironment,
  getTokenExpiry,
  tryDecodeJWT,
} from '@/utils/jwtUtils';

type SettingsTab = 'providers' | 'token' | 'appearance' | 'risk' | 'about';

export default function SettingsPage(): React.ReactElement {
  const router = useRouter();
  const apiToken = useConfigStore((s) => s.apiToken);
  const demoMode = useConfigStore((s) => s.demoMode);
  const setToken = useConfigStore((s) => s.setToken);
  const setDemoMode = useConfigStore((s) => s.setDemoMode);
  const logout = useConfigStore((s) => s.logout);

  const theme = useConfigStore((s) => s.theme);
  const setTheme = useConfigStore((s) => s.setTheme);
  const fontSize = useConfigStore((s) => s.fontSize);
  const setFontSize = useConfigStore((s) => s.setFontSize);

  const riskSettings = useConfigStore((s) => s.riskSettings);
  const updateRiskSettings = useConfigStore((s) => s.updateRiskSettings);

  const [tab, setTab] = React.useState<SettingsTab>('providers');
  const [newToken, setNewToken] = React.useState('');

  const tokenDetails = React.useMemo(() => {
    if (!apiToken) return null;
    const payload = tryDecodeJWT(apiToken);
    if (!payload) return null;
    return {
      login: getAccountLogin(apiToken),
      env: getEnvironment(apiToken),
      expiry: getTokenExpiry(apiToken),
      daysLeft: getDaysUntilExpiry(apiToken),
    };
  }, [apiToken]);

  const handleUpdateToken = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = newToken.trim();
    if (!trimmed) return;
    if (!tryDecodeJWT(trimmed)) {
      showError('Format JWT tidak valid');
      return;
    }
    try {
      fortunoApi.clearCaches();
      setDemoMode(false);
      await setToken(trimmed, true);
      const [account, summary] = await Promise.all([
        fortunoApi.getAccount({ force: true }),
        fortunoApi.getAccountSummary().catch(() => null),
      ]);
      useTradingStore.getState().setAccount(account);
      if (summary) useTradingStore.getState().setAccountSummary(summary);
      setNewToken('');
      showSuccess(`Token diperbarui untuk akun #${account.login}`);
    } catch (err) {
      showError(err);
    }
  };

  const handleLogout = (): void => {
    fortunoApi.clearCaches();
    logout();
    useTradingStore.getState().reset();
    showSuccess('Sesi diputuskan dan token dihapus.');
    router.push('/');
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2.5">
          <button
            type="button"
            onClick={() => setTab('providers')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'providers'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            AI Providers
          </button>

          <button
            type="button"
            onClick={() => setTab('token')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'token'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            API Token &amp; Session
          </button>

          <button
            type="button"
            onClick={() => setTab('appearance')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'appearance'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            Appearance
          </button>

          <button
            type="button"
            onClick={() => setTab('risk')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'risk'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Risk &amp; Defaults
          </button>

          <button
            type="button"
            onClick={() => setTab('about')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'about'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Info className="h-3.5 w-3.5" />
            About
          </button>
        </div>

        {tab === 'providers' && <AIProvidersManager />}

        {tab === 'token' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                Fortuno Markets API Token &amp; Sandbox Mode
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Connection Mode:</span>
                  <Badge variant={demoMode ? 'warning' : 'success'}>
                    {demoMode ? 'DEMO SANDBOX' : 'LIVE MATCH-TRADER API'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Stored JWT:</span>
                  <span>{apiToken ? maskSecret(apiToken, 8) : 'None (Demo Mode)'}</span>
                </div>
                {tokenDetails && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Account Login:</span>
                      <span>#{tokenDetails.login ?? '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Environment:</span>
                      <span>{tokenDetails.env ?? '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Expiration:</span>
                      <span>
                        {tokenDetails.expiry.toLocaleDateString()} ({tokenDetails.daysLeft} days left)
                      </span>
                    </div>
                  </>
                )}
              </div>

              <form onSubmit={(e) => void handleUpdateToken(e)} className="space-y-2">
                <label className="block font-medium text-slate-300">
                  Replace Bearer JWT Token
                </label>
                <div className="flex gap-2">
                  <Input
                    aria-label="New Bearer JWT Token"
                    type="password"
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                    placeholder="Paste new JWT token…"
                    className="font-mono text-xs"
                  />
                  <Button type="submit" size="sm" variant="default">
                    Update Token
                  </Button>
                </div>
              </form>

              <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDemoMode(!demoMode);
                    showSuccess(
                      !demoMode
                        ? 'Switched to Demo Sandbox Mode'
                        : 'Switched to Live API Mode',
                    );
                  }}
                >
                  {demoMode ? 'Switch to Live API Mode' : 'Switch to Demo Sandbox Mode'}
                </Button>

                <Button size="sm" variant="destructive" onClick={handleLogout}>
                  <LogOut className="mr-1.5 h-3.5 w-3.5" />
                  Disconnect &amp; Clear Token
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'appearance' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Theme &amp; Display Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-medium text-slate-300">Color Theme</label>
                  <Select
                    aria-label="Color Theme"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as ThemeMode)}
                  >
                    <option value="dark">Dark Mode (Recommended for Trading)</option>
                    <option value="light">Light Mode</option>
                    <option value="system">System Preference</option>
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block font-medium text-slate-300">
                    Terminal Density &amp; Font Size
                  </label>
                  <Select
                    aria-label="Font Size"
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value as FontSizeMode)}
                  >
                    <option value="sm">Compact (Small)</option>
                    <option value="md">Standard (Medium)</option>
                    <option value="lg">Comfortable (Large)</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'risk' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                Risk Management &amp; Order Execution Guardrails
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block font-medium text-slate-300">
                    High Volume Warning Threshold (Lots)
                  </label>
                  <Input
                    aria-label="Max Lot Warning"
                    type="number"
                    step="0.1"
                    min="0.01"
                    value={riskSettings.maxLotWarning}
                    onChange={(e) =>
                      updateRiskSettings({ maxLotWarning: Number(e.target.value) || 1 })
                    }
                    className="font-mono"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-medium text-slate-300">
                    Default Take Profit Offset (Pips)
                  </label>
                  <Input
                    aria-label="Default TP Pips"
                    type="number"
                    min="0"
                    value={riskSettings.defaultTpPips}
                    onChange={(e) =>
                      updateRiskSettings({ defaultTpPips: Number(e.target.value) || 0 })
                    }
                    className="font-mono"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-medium text-slate-300">
                    Default Stop Loss Offset (Pips)
                  </label>
                  <Input
                    aria-label="Default SL Pips"
                    type="number"
                    min="0"
                    value={riskSettings.defaultSlPips}
                    onChange={(e) =>
                      updateRiskSettings({ defaultSlPips: Number(e.target.value) || 0 })
                    }
                    className="font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'about' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                FortunoAI Trading Platform v1.0.0
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                Built for <strong>Fortuno Markets</strong> (Match-Trader Trader API v1) with Next.js
                15 App Router, TypeScript 5.8, Zustand, TradingView Lightweight Charts v5, and
                Multi-Provider AI Co-Pilot.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li>Non-extractable Web Crypto AES-256-GCM key storage in IndexedDB with AAD binding</li>
                <li>Sliding-window client &amp; server rate limiters + exponential backoff retry</li>
                <li>7 AI provider integrations (OpenAI, Claude, Gemini, Mistral, Groq, Ollama, Custom)</li>
                <li>CSV export formula-injection sanitization &amp; strict Zod runtime validation</li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
