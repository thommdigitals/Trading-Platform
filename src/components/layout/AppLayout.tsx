'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { GlobalErrorBoundary } from '@/components/ui/error-boundary';
import { useAccount } from '@/hooks/useAccount';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePendingOrders } from '@/hooks/usePendingOrders';
import { usePositions } from '@/hooks/usePositions';
import { useQuotes } from '@/hooks/useQuotes';
import { useSymbols } from '@/hooks/useSymbols';
import { useConfigStore } from '@/store/configStore';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { TokenExpiryBanner } from './TokenExpiryBanner';

const SHORTCUTS_LIST = [
  { key: 'Alt + B', desc: 'Buka form order cepat dengan arah BUY' },
  { key: 'Alt + S', desc: 'Buka form order cepat dengan arah SELL' },
  { key: 'Alt + C', desc: 'Buka halaman Trading & Chart' },
  { key: 'Alt + P', desc: 'Fokus ke tabel Posisi Terbuka' },
  { key: 'Alt + O', desc: 'Fokus ke tabel Pending Orders' },
  { key: 'Esc', desc: 'Tutup dialog / modal yang sedang aktif' },
  { key: '?', desc: 'Tampilkan / sembunyikan panduan pintasan ini' },
] as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useConfigStore((s) => s.hydrated);
  const apiToken = useConfigStore((s) => s.apiToken);
  const demoMode = useConfigStore((s) => s.demoMode);
  const theme = useConfigStore((s) => s.theme);
  const fontSize = useConfigStore((s) => s.fontSize);

  const [collapsed, setCollapsed] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!hydrated) {
      void useConfigStore.getState().hydrate();
    }
  }, [hydrated]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    root.classList.toggle('dark', isDark);
    root.dataset.fontSize = fontSize;
  }, [theme, fontSize]);

  // Background polling hooks while authenticated or in Demo Sandbox
  useAccount(Boolean(apiToken || demoMode));
  useSymbols();
  usePositions(Boolean(apiToken || demoMode));
  usePendingOrders(Boolean(apiToken || demoMode));
  useQuotes([], Boolean(apiToken || demoMode));

  useKeyboardShortcuts({
    onQuickBuy: () => router.push('/trading?side=BUY'),
    onQuickSell: () => router.push('/trading?side=SELL'),
    onOpenChart: () => router.push('/trading'),
    onOpenPositions: () => router.push('/trading?tab=positions'),
    onOpenOrders: () => router.push('/trading?tab=orders'),
    onEscape: () => setShortcutsOpen(false),
    onToggleHelp: () => setShortcutsOpen((prev) => !prev),
  });

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 md:flex-row dark:bg-slate-950 dark:text-slate-100">
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <Header onOpenShortcuts={() => setShortcutsOpen(true)} />
        <TokenExpiryBanner />
        <main className="flex-1 p-3 sm:p-5">
          <GlobalErrorBoundary>{children}</GlobalErrorBoundary>
        </main>
      </div>
      <BottomNav />

      <Dialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        title="Pintasan Keyboard (Shortcuts)"
        description="Gunakan kombinasi tombol berikut untuk eksekusi dan navigasi cepat."
      >
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {SHORTCUTS_LIST.map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2.5 text-xs">
              <span className="text-slate-600 dark:text-slate-300">{item.desc}</span>
              <kbd className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
