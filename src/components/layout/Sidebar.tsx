'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CandlestickChart,
  History,
  MessageSquareText,
  BrainCircuit,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useTradingStore } from '@/store/tradingStore';
import { cn } from '@/utils/cn';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trading', label: 'Trading & Chart', icon: CandlestickChart },
  { href: '/history', label: 'History & Ledger', icon: History },
  { href: '/ai/chat', label: 'AI Chat', icon: MessageSquareText },
  { href: '/ai/analysis', label: 'AI Analysis', icon: BrainCircuit },
  { href: '/ai/automation', label: 'AI Automation', icon: Bot },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const platformDetails = useTradingStore((s) => s.platformDetails);

  return (
    <aside
      aria-label="Sidebar Navigation"
      className={cn(
        'hidden md:flex flex-col border-r border-slate-200 bg-white transition-all duration-200 dark:border-slate-800 dark:bg-slate-900',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-3 dark:border-slate-800">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-extrabold text-white">
              FA
            </span>
            <span className="text-sm text-slate-900 dark:text-slate-100">FortunoAI</span>
          </Link>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                collapsed && 'justify-center px-2',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-slate-200 p-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="font-semibold text-slate-700 dark:text-slate-300">
            {platformDetails?.brokerName ?? 'Fortuno Markets'}
          </div>
          {platformDetails?.platformUrl && (
            <a
              href={platformDetails.platformUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
            >
              <span>Platform Web</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </aside>
  );
}
