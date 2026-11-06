'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CandlestickChart,
  History,
  MessageSquareText,
  Settings,
} from 'lucide-react';
import { cn } from '@/utils/cn';

const MOBILE_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trading', label: 'Trading', icon: CandlestickChart },
  { href: '/history', label: 'History', icon: History },
  { href: '/ai/chat', label: 'AI Hub', icon: MessageSquareText },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 px-1 backdrop-blur-md md:hidden dark:border-slate-800 dark:bg-slate-900/95"
    >
      {MOBILE_ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          pathname.startsWith(`${item.href}/`) ||
          (item.href === '/ai/chat' && pathname.startsWith('/ai/'));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
              active
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

