// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountSummaryWidget } from '@/components/account/AccountSummaryWidget';
import { ConnectionStatus } from '@/components/account/ConnectionStatus';
import { PortfolioOverview } from '@/components/account/PortfolioOverview';
import { TokenExpiryBanner } from '@/components/layout/TokenExpiryBanner';
import { GlobalErrorBoundary } from '@/components/ui/error-boundary';
import { createFortunoClient } from '@/services/fortuno/client';
import { resetDemoState } from '@/services/fortuno/demoBackend';
import { ApiError } from '@/services/http/errors';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import { getErrorMessage } from '@/utils/errorHandler';

function base64Url(json: unknown): string {
  return btoa(JSON.stringify(json))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function makeSampleJwt(expSeconds: number, login = 778899): string {
  const header = base64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64Url({
    exp: expSeconds,
    tradingAccountLogin: login,
    environment: 'LIVE',
  });
  return `${header}.${payload}.sig`;
}

describe('Auth, Layout, Error Boundaries & Error Scenarios (TASK-008, TASK-009, TASK-011, TASK-012, TASK-048)', () => {
  beforeEach(() => {
    resetDemoState();
    useConfigStore.getState().setDemoMode(false);
    useTradingStore.getState().reset();
  });

  it('displays TokenExpiryBanner when token expires within 7 days (TASK-009, TASK-048)', async () => {
    const expIn3Days = Math.floor(Date.now() / 1000) + 3 * 86_400;
    const token = makeSampleJwt(expIn3Days);
    await useConfigStore.getState().setToken(token, false);

    render(<TokenExpiryBanner />);
    expect(screen.getByText(/akan kadaluarsa dalam/i)).toBeInTheDocument();
  });

  it('renders AccountSummaryWidget, ConnectionStatus & PortfolioOverview accurately (TASK-012)', () => {
    useTradingStore.getState().setConnectionState('connected');
    useTradingStore.getState().setAccount({
      login: '880011',
      name: 'Trader Pro',
      currency: 'USD',
      currencyPrecision: 2,
      leverage: 100,
      accessRight: 'FULL',
    });
    useTradingStore.getState().setAccountSummary({
      balance: 10_000,
      equity: 10_250,
      margin: 250,
      freeMargin: 10_000,
      marginLevel: 4100,
      floatingProfit: 250,
    });

    render(
      <div>
        <ConnectionStatus />
        <AccountSummaryWidget />
        <PortfolioOverview />
      </div>,
    );

    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Balance/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Equity/i).length).toBeGreaterThan(0);
  });

  it('catches runtime component errors with GlobalErrorBoundary and allows reset (TASK-011)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;

    function BuggyChild(): React.ReactElement {
      if (shouldThrow) {
        throw new Error('Simulated UI crash');
      }
      return <div>Recovered UI</div>;
    }

    render(
      <GlobalErrorBoundary>
        <BuggyChild />
      </GlobalErrorBoundary>,
    );

    expect(screen.getByText(/Simulated UI crash/i)).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /Muat Ulang Komponen/i }));
    expect(screen.getByText('Recovered UI')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('handles 401 Unauthorized by invoking onUnauthorized and clearing session (TASK-048)', async () => {
    const onUnauthorized = vi.fn();
    const client = createFortunoClient({
      baseUrl: 'https://api.test.local',
      getAuthToken: () => 'invalid.jwt.token',
      onUnauthorized,
      fetchImpl: async () =>
        new Response(JSON.stringify({ status: 401, title: 'Token expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
    });

    await expect(client.getAccount()).rejects.toThrow();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('handles 429 Too Many Requests with automatic backoff & retry (TASK-048)', async () => {
    let attempts = 0;
    const client = createFortunoClient({
      baseUrl: 'https://api.test.local',
      getAuthToken: () => 'valid.jwt.token',
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) {
          return new Response(JSON.stringify({ status: 429, title: 'Rate limit exceeded' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'Retry-After': '0' },
          });
        }
        return new Response(
          JSON.stringify({
            login: 12345,
            name: 'Demo',
            currency: 'USD',
            currencyPrecision: 2,
            leverage: 100,
            accessRight: 'FULL',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    });

    const account = await client.getAccount();
    expect(account.login).toBe('12345');
    expect(attempts).toBe(2);
  });

  it('maps 409 insufficient margin & market closed errors to clear Indonesian messages (TASK-048)', () => {
    const marginErr = new ApiError({
      status: 409,
      path: '/v1/positions/open',
      type: 'https://errors.match-trader.com/not-enough-margin',
      detail: 'Not enough money / insufficient margin to open position',
    });
    expect(getErrorMessage(marginErr)).toMatch(/Margin tidak cukup/i);

    const closedErr = new ApiError({
      status: 409,
      path: '/v1/positions/open',
      type: 'https://errors.match-trader.com/session-closed',
      detail: 'Market is closed for this symbol',
    });
    expect(getErrorMessage(closedErr)).toMatch(/Sesi trading.*sedang tutup/i);
  });
});
