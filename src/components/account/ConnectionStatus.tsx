'use client';

import { Wifi, WifiOff, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useOnlineStatus } from '@/hooks/usePageVisibility';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';

export function ConnectionStatus() {
  const isOnline = useOnlineStatus();
  const demoMode = useConfigStore((s) => s.demoMode);
  const connectionState = useTradingStore((s) => s.connectionState);

  if (!isOnline) {
    return (
      <Badge variant="danger" className="gap-1.5">
        <WifiOff className="h-3 w-3" />
        Offline
      </Badge>
    );
  }

  if (demoMode) {
    return (
      <Badge variant="default" className="gap-1.5">
        <Sparkles className="h-3 w-3" />
        Demo Sandbox
      </Badge>
    );
  }

  if (connectionState === 'connecting') {
    return (
      <Badge variant="warning" className="gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        Connecting
      </Badge>
    );
  }

  if (connectionState === 'connected') {
    return (
      <Badge variant="success" className="gap-1.5">
        <Wifi className="h-3 w-3" />
        Connected
      </Badge>
    );
  }

  return (
    <Badge variant="danger" className="gap-1.5">
      <WifiOff className="h-3 w-3" />
      Disconnected
    </Badge>
  );
}
