import { create } from 'zustand';
import { z } from 'zod';
import { STORAGE_KEYS } from '@/config/constants';
import { buildDefaultProviders } from '@/config/defaultProviders';
import {
  CANDLE_INTERVALS,
  DEFAULT_CANDLE_INTERVAL,
  DEFAULT_SYMBOL,
  DEFAULT_WATCHLIST,
  type CandleInterval,
} from '@/config/market';
import {
  persistentSecureStorage,
  sessionSecureStorage,
  type SecureStorage,
} from '@/services/storage';
import { AIProviderConfigSchema, type AIProviderConfig } from '@/types/ai';

export type ThemeMode = 'dark' | 'light' | 'system';
export type FontSizeMode = 'sm' | 'md' | 'lg';

export const RiskSettingsSchema = z.object({
  maxLotWarning: z.number().finite().positive().catch(1),
  defaultTpPips: z.number().finite().nonnegative().catch(0),
  defaultSlPips: z.number().finite().nonnegative().catch(0),
  confirmBeforeTrade: z.boolean().catch(true),
});
export type RiskSettings = z.infer<typeof RiskSettingsSchema>;

const StoredProvidersSchema = z.object({
  providers: z.array(AIProviderConfigSchema),
  activeProviderId: z.string().nullable(),
});

const StoredPrefsSchema = z.object({
  watchlist: z.array(z.string().min(1)).min(1),
  defaultSymbol: z.string().min(1),
  defaultInterval: z.enum(CANDLE_INTERVALS),
  theme: z.enum(['dark', 'light', 'system']),
  fontSize: z.enum(['sm', 'md', 'lg']).catch('md'),
  riskSettings: RiskSettingsSchema,
});

const StoredTokenSchema = z.object({
  token: z.string().min(1),
});

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  maxLotWarning: 1,
  defaultTpPips: 0,
  defaultSlPips: 0,
  confirmBeforeTrade: true,
};

export interface ConfigState {
  hydrated: boolean;
  apiToken: string | null;
  rememberToken: boolean;
  demoMode: boolean;
  aiProviders: AIProviderConfig[];
  activeProviderId: string | null;
  watchlist: string[];
  defaultSymbol: string;
  defaultInterval: CandleInterval;
  theme: ThemeMode;
  fontSize: FontSizeMode;
  riskSettings: RiskSettings;

  hydrate: (storages?: {
    persistent?: SecureStorage;
    session?: SecureStorage;
  }) => Promise<void>;
  setToken: (token: string | null, remember?: boolean) => Promise<void>;
  setDemoMode: (enabled: boolean) => void;
  logout: () => void;
  addProvider: (
    input: Omit<AIProviderConfig, 'id' | 'createdAt'> & { id?: string },
  ) => AIProviderConfig;
  updateProvider: (
    id: string,
    update: Partial<Omit<AIProviderConfig, 'id' | 'createdAt'>>,
  ) => void;
  removeProvider: (id: string) => void;
  setActiveProvider: (id: string) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  reorderWatchlist: (fromIndex: number, toIndex: number) => void;
  setDefaultSymbol: (symbol: string) => void;
  setDefaultInterval: (interval: CandleInterval) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setFontSize: (fontSize: FontSizeMode) => void;
  updateRiskSettings: (settings: Partial<RiskSettings>) => void;
}

const initialProviders = buildDefaultProviders();

let activePersistentStorage: SecureStorage = persistentSecureStorage;
let activeSessionStorage: SecureStorage = sessionSecureStorage;

function persistProviders(state: Pick<ConfigState, 'aiProviders' | 'activeProviderId'>): void {
  void activePersistentStorage.setSecure(STORAGE_KEYS.aiProviders, {
    providers: state.aiProviders,
    activeProviderId: state.activeProviderId,
  });
}

function persistPrefs(
  state: Pick<
    ConfigState,
    'watchlist' | 'defaultSymbol' | 'defaultInterval' | 'theme' | 'fontSize' | 'riskSettings'
  >,
): void {
  void activePersistentStorage.setSecure(STORAGE_KEYS.prefs, {
    watchlist: state.watchlist,
    defaultSymbol: state.defaultSymbol,
    defaultInterval: state.defaultInterval,
    theme: state.theme,
    fontSize: state.fontSize,
    riskSettings: state.riskSettings,
  });
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  hydrated: false,
  apiToken: null,
  rememberToken: true,
  demoMode: false,
  aiProviders: initialProviders,
  activeProviderId: initialProviders[0]?.id ?? null,
  watchlist: [...DEFAULT_WATCHLIST],
  defaultSymbol: DEFAULT_SYMBOL,
  defaultInterval: DEFAULT_CANDLE_INTERVAL,
  theme: 'dark',
  fontSize: 'md',
  riskSettings: { ...DEFAULT_RISK_SETTINGS },

  async hydrate(storages) {
    if (storages?.persistent) activePersistentStorage = storages.persistent;
    if (storages?.session) activeSessionStorage = storages.session;

    const [persistedToken, sessionToken, storedProviders, storedPrefs] = await Promise.all([
      activePersistentStorage.getSecure(STORAGE_KEYS.token, StoredTokenSchema),
      activeSessionStorage.getSecure(STORAGE_KEYS.token, StoredTokenSchema),
      activePersistentStorage.getSecure(STORAGE_KEYS.aiProviders, StoredProvidersSchema),
      activePersistentStorage.getSecure(STORAGE_KEYS.prefs, StoredPrefsSchema),
    ]);

    const nextProviders =
      storedProviders && storedProviders.providers.length > 0
        ? storedProviders.providers
        : buildDefaultProviders();
    const nextActiveId =
      storedProviders?.activeProviderId &&
      nextProviders.some((p) => p.id === storedProviders.activeProviderId)
        ? storedProviders.activeProviderId
        : (nextProviders[0]?.id ?? null);

    set({
      hydrated: true,
      apiToken: persistedToken?.token ?? sessionToken?.token ?? null,
      rememberToken: Boolean(persistedToken?.token) || !sessionToken?.token,
      aiProviders: nextProviders,
      activeProviderId: nextActiveId,
      ...(storedPrefs
        ? {
            watchlist: storedPrefs.watchlist,
            defaultSymbol: storedPrefs.defaultSymbol,
            defaultInterval: storedPrefs.defaultInterval,
            theme: storedPrefs.theme,
            fontSize: storedPrefs.fontSize,
            riskSettings: storedPrefs.riskSettings,
          }
        : {}),
    });
  },

  async setToken(token, remember) {
    const rememberToken = remember ?? get().rememberToken;
    const trimmed = token?.trim() ? token.trim() : null;
    set({ apiToken: trimmed, rememberToken, demoMode: false });

    activePersistentStorage.removeSecure(STORAGE_KEYS.token);
    activeSessionStorage.removeSecure(STORAGE_KEYS.token);
    if (trimmed) {
      const target = rememberToken ? activePersistentStorage : activeSessionStorage;
      await target.setSecure(STORAGE_KEYS.token, { token: trimmed });
    }
  },

  setDemoMode(enabled) {
    set({ demoMode: enabled });
  },

  logout() {
    activePersistentStorage.removeSecure(STORAGE_KEYS.token);
    activeSessionStorage.removeSecure(STORAGE_KEYS.token);
    set({ apiToken: null, demoMode: false });
  },

  addProvider(input) {
    const created: AIProviderConfig = AIProviderConfigSchema.parse({
      ...input,
      id: input.id ?? crypto.randomUUID(),
      createdAt: Date.now(),
    });
    const nextProviders = [...get().aiProviders, created];
    const nextActive = get().activeProviderId ?? created.id;
    set({ aiProviders: nextProviders, activeProviderId: nextActive });
    persistProviders({ aiProviders: nextProviders, activeProviderId: nextActive });
    return created;
  },

  updateProvider(id, update) {
    const nextProviders = get().aiProviders.map((provider) =>
      provider.id === id ? AIProviderConfigSchema.parse({ ...provider, ...update }) : provider,
    );
    set({ aiProviders: nextProviders });
    persistProviders({ aiProviders: nextProviders, activeProviderId: get().activeProviderId });
  },

  removeProvider(id) {
    const nextProviders = get().aiProviders.filter((provider) => provider.id !== id);
    const currentActive = get().activeProviderId;
    const nextActive =
      currentActive === id ? (nextProviders[0]?.id ?? null) : currentActive;
    set({ aiProviders: nextProviders, activeProviderId: nextActive });
    persistProviders({ aiProviders: nextProviders, activeProviderId: nextActive });
  },

  setActiveProvider(id) {
    if (!get().aiProviders.some((provider) => provider.id === id)) return;
    set({ activeProviderId: id });
    persistProviders({ aiProviders: get().aiProviders, activeProviderId: id });
  },

  addToWatchlist(symbol) {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized || get().watchlist.includes(normalized)) return;
    const watchlist = [...get().watchlist, normalized];
    set({ watchlist });
    persistPrefs({ ...get(), watchlist });
  },

  removeFromWatchlist(symbol) {
    const watchlist = get().watchlist.filter((item) => item !== symbol);
    set({ watchlist });
    persistPrefs({ ...get(), watchlist });
  },

  reorderWatchlist(fromIndex, toIndex) {
    const current = [...get().watchlist];
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= current.length ||
      toIndex >= current.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const [moved] = current.splice(fromIndex, 1);
    if (moved === undefined) return;
    current.splice(toIndex, 0, moved);
    set({ watchlist: current });
    persistPrefs({ ...get(), watchlist: current });
  },

  setDefaultSymbol(symbol) {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;
    set({ defaultSymbol: normalized });
    persistPrefs({ ...get(), defaultSymbol: normalized });
  },

  setDefaultInterval(interval) {
    set({ defaultInterval: interval });
    persistPrefs({ ...get(), defaultInterval: interval });
  },

  setTheme(theme) {
    set({ theme });
    persistPrefs({ ...get(), theme });
  },

  toggleTheme() {
    const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme: next });
    persistPrefs({ ...get(), theme: next });
  },

  setFontSize(fontSize) {
    set({ fontSize });
    persistPrefs({ ...get(), fontSize });
  },

  updateRiskSettings(settings) {
    const riskSettings = RiskSettingsSchema.parse({ ...get().riskSettings, ...settings });
    set({ riskSettings });
    persistPrefs({ ...get(), riskSettings });
  },
}));
