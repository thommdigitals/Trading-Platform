'use client';

import { useRouter } from 'next/navigation';
import { Sun, Moon, Keyboard, LogOut, ShieldCheck } from 'lucide-react';
import { ConnectionStatus } from '@/components/account/ConnectionStatus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import { formatMoney } from '@/utils/formatters';

export interface HeaderProps {
  onOpenShortcuts: () => void;
}

export function Header({ onOpenShortcuts }: HeaderProps) {
  const router = useRouter();
  const theme = useConfigStore((s) => s.theme);
  const toggleTheme = useConfigStore((s) => s.toggleTheme);
  const logout = useConfigStore((s) => s.logout);
  const account = useTradingStore((s) => s.account);
  const summary = useTradingStore((s) => s.accountSummary);
  const resetTrading = useTradingStore((s) => s.reset);

  const handleLogout = () => {
    logout();
    resetTrading();
    router.push('/');
  };

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 overflow-x-auto">
        <ConnectionStatus />
        {account && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              #{account.login}
            </span>
            <span>•</span>
            <span>1:{account.leverage}</span>
            <span>•</span>
            <Badge variant={account.accessRight === 'FULL' ? 'success' : 'warning'}>
              <ShieldCheck className="h-3 w-3" />
              {account.accessRight}
            </Badge>
          </div>
        )}
        {summary && account && (
          <div className="hidden lg:flex items-center gap-3 border-l border-slate-200 pl-3 text-xs dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">
              Equity:{' '}
              <strong className="text-slate-900 dark:text-slate-100">
                {formatMoney(summary.equity, account.currency, account.currencyPrecision)}
              </strong>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              Free Margin:{' '}
              <strong className="text-slate-900 dark:text-slate-100">
                {formatMoney(summary.freeMargin, account.currency, account.currencyPrecision)}
              </strong>
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenShortcuts}
          aria-label="Pintasan keyboard"
          title="Pintasan Keyboard (?)"
        >
          <Keyboard className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Ganti tema tampilan"
          title="Dark / Light Mode"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          aria-label="Keluar"
          className="ml-1"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
