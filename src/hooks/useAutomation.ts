'use client';

import { useCallback } from 'react';
import { aiRouter } from '@/services/aiProviders';
import { AutomationEngine, parseStrategyWithAI } from '@/services/automationEngine';
import { fortunoApi } from '@/services/fortunoApi';
import { useAIStore } from '@/store/aiStore';
import { useConfigStore } from '@/store/configStore';
import type { AutomationStrategy } from '@/types/ai';

let singletonEngine: AutomationEngine | null = null;

function getEngine(): AutomationEngine {
  singletonEngine ??= new AutomationEngine(fortunoApi, aiRouter, {
    onStatusChange: (status) => useAIStore.getState().setAutomationStatus(status),
    onLog: (entry) => useAIStore.getState().addAutomationLog(entry),
    onStatsUpdate: (stats) => useAIStore.getState().updateAutomationStats(stats),
    getProviderId: () => {
      const cfg = useConfigStore.getState();
      return cfg.activeProviderId ?? cfg.aiProviders[0]?.id ?? null;
    },
    isDemoMode: () => useConfigStore.getState().demoMode,
  });
  return singletonEngine;
}

export function useAutomation() {
  const activeStrategy = useAIStore((s) => s.activeStrategy);
  const automationStatus = useAIStore((s) => s.automationStatus);
  const automationLog = useAIStore((s) => s.automationLog);
  const automationStats = useAIStore((s) => s.automationStats);

  const parseStrategy = useCallback(async (description: string) => {
    const cfg = useConfigStore.getState();
    aiRouter.syncConfigs(cfg.aiProviders);
    const providerId = cfg.activeProviderId ?? cfg.aiProviders[0]?.id ?? '';
    return parseStrategyWithAI({
      description,
      providerId,
      router: aiRouter,
      allowDemoFallback: cfg.demoMode,
    });
  }, []);

  const startStrategy = useCallback((strategy: AutomationStrategy) => {
    const cfg = useConfigStore.getState();
    aiRouter.syncConfigs(cfg.aiProviders);
    useAIStore.getState().setActiveStrategy(strategy);
    getEngine().start(strategy);
  }, []);

  const pauseStrategy = useCallback(() => {
    getEngine().pause();
  }, []);

  const resumeStrategy = useCallback(() => {
    getEngine().resume();
  }, []);

  const stopStrategy = useCallback(async (closeStrategyPositions: boolean = false) => {
    const strategy = useAIStore.getState().activeStrategy;
    getEngine().stop();
    if (closeStrategyPositions && strategy) {
      const open = await fortunoApi.getPositions([strategy.symbol]).catch(() => []);
      for (const pos of open) {
        await fortunoApi.closePosition(pos.id, pos.volume).catch(() => undefined);
      }
      useAIStore.getState().addAutomationLog({
        level: 'action',
        message: `Menutup ${open.length} posisi terbuka pada ${strategy.symbol} saat strategi dihentikan.`,
      });
    }
  }, []);

  return {
    activeStrategy,
    automationStatus,
    automationLog,
    automationStats,
    parseStrategy,
    startStrategy,
    pauseStrategy,
    resumeStrategy,
    stopStrategy,
    clearLog: useAIStore((s) => s.clearAutomationLog),
  };
}

