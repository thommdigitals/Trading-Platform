'use client';

import * as React from 'react';
import { AlertTriangle, WifiOff, Gauge, X } from 'lucide-react';
import { RATE_LIMITS, TOKEN } from '@/config/constants';
import { useOnlineStatus } from '@/hooks/usePageVisibility';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import { getDaysUntilExpiry, tryDecodeJWT } from '@/utils/jwtUtils';

export function TokenExpiryBanner() {
  const isOnline = useOnlineStatus();
  const apiToken = useConfigStore((s) => s.apiToken);
  const demoMode = useConfigStore((s) => s.demoMode);
  const rateLimit = useTradingStore((s) => s.rateLimitRemaining);
  const [dismissedRateWarn, setDismissedRateWarn] = React.useState(false);

  const decoded = apiToken ? tryDecodeJWT(apiToken) : null;
  const daysLeft = apiToken && decoded ? getDaysUntilExpiry(apiToken) : null;
  const showExpiryWarning = daysLeft !== null && daysLeft <= TOKEN.expiryWarningDays;
  const showRateWarning =
    !demoMode &&
    !dismissedRateWarn &&
    ((rateLimit.global !== null && rateLimit.global <= RATE_LIMITS.warnRemaining) ||
      rateLimit.endpoint === 0);

  if (isOnline && !showExpiryWarning && !showRateWarning) return null;

  return (
    <div className="space-y-1 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
      {!isOnline && (
        <div className="flex items-center gap-2 font-medium text-rose-600 dark:text-rose-400">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>
            Koneksi internet terputus. Polling dihentikan sementara dan akan dilanjutkan otomatis saat kembali online.
          </span>
        </div>
      )}
      {showExpiryWarning && (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {daysLeft === 0
              ? 'Token API Anda telah atau hampir kadaluarsa hari ini. Segera perbarui token di menu Settings.'
              : `Token API Fortuno Markets akan kadaluarsa dalam ${daysLeft} hari. Buat token baru sebelum kadaluarsa.`}
          </span>
        </div>
      )}
      {showRateWarning && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 shrink-0" />
            <span>
              Peringatan Rate Limit: Kuota request API hampir penuh, sistem otomatis mengatur jeda antrean request.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDismissedRateWarn(true)}
            aria-label="Tutup peringatan rate limit"
            className="rounded p-0.5 hover:bg-amber-500/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

