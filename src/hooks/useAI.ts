'use client';

import { useCallback, useEffect } from 'react';
import { AI } from '@/config/constants';
import { DemoSandboxAIProvider, aiRouter } from '@/services/aiProviders';
import { fortunoApi } from '@/services/fortunoApi';
import { analyzeSymbolWithAI } from '@/services/marketAnalysis';
import { buildSystemPrompt } from '@/services/tradingContext';
import {
  TRADING_TOOLS,
  describeToolCall,
  executeTradingTool,
  requiresUserConfirmation,
} from '@/services/tradingTools';
import { useAIStore } from '@/store/aiStore';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import type { ChatMessage, PendingToolApproval } from '@/types/ai';
import type { CandleInterval } from '@/types/api';
import { getErrorMessage } from '@/utils/errorHandler';

export function useAI() {
  const aiProviders = useConfigStore((s) => s.aiProviders);
  const activeProviderId = useConfigStore((s) => s.activeProviderId);
  const demoMode = useConfigStore((s) => s.demoMode);

  const chatMessages = useAIStore((s) => s.chatMessages);
  const sessionProviderId = useAIStore((s) => s.sessionProviderId);
  const sessionModel = useAIStore((s) => s.sessionModel);
  const isAILoading = useAIStore((s) => s.isAILoading);
  const currentStreamContent = useAIStore((s) => s.currentStreamContent);
  const pendingToolApprovals = useAIStore((s) => s.pendingToolApprovals);
  const analysisResults = useAIStore((s) => s.analysisResults);
  const isAnalyzing = useAIStore((s) => s.isAnalyzing);

  const effectiveProviderId = sessionProviderId ?? activeProviderId ?? aiProviders[0]?.id ?? '';
  const effectiveProviderConfig = aiProviders.find((p) => p.id === effectiveProviderId) ?? null;

  useEffect(() => {
    aiRouter.syncConfigs(aiProviders);
  }, [aiProviders]);

  useEffect(() => {
    useAIStore.getState().hydrateChatFromSession();
  }, []);

  const sendMessage = useCallback(
    async (userText: string) => {
      const trimmed = userText.trim();
      if (!trimmed || useAIStore.getState().isAILoading) return;

      const aiState = useAIStore.getState();
      const tradingState = useTradingStore.getState();
      const cfgState = useConfigStore.getState();

      aiRouter.syncConfigs(cfgState.aiProviders);

      const userMsg = aiState.addMessage({ role: 'user', content: trimmed });
      aiState.setAILoading(true);
      aiState.updateStreamContent('');

      const systemMsg: ChatMessage = {
        id: 'system-ctx',
        role: 'system',
        createdAt: Date.now(),
        content: buildSystemPrompt({
          account: tradingState.account,
          accountSummary: tradingState.accountSummary,
          positions: tradingState.positions,
          pendingOrders: tradingState.pendingOrders,
          quotes: tradingState.quotes,
        }),
      };

      const providerId =
        aiState.sessionProviderId ?? cfgState.activeProviderId ?? cfgState.aiProviders[0]?.id ?? '';
      const modelOverride = aiState.sessionModel ?? undefined;

      try {
        const conversation: ChatMessage[] = [
          systemMsg,
          ...useAIStore.getState().chatMessages,
        ];

        // First try tool-aware chat so commands ("Buka BUY EURUSD 0.05") can emit tool calls
        const result = await aiRouter.chat(providerId, conversation, {
          model: modelOverride,
          tools: TRADING_TOOLS,
          allowDemoFallback: cfgState.demoMode,
        });

        if (result.toolCalls && result.toolCalls.length > 0) {
          const readOnlyCalls = result.toolCalls.filter((c) => !requiresUserConfirmation(c.name));
          const approvalCalls = result.toolCalls.filter((c) => requiresUserConfirmation(c.name));

          if (result.content) {
            aiState.addMessage({
              role: 'assistant',
              content: result.content,
              toolCalls: result.toolCalls,
            });
          }

          // Execute read-only tools immediately and feed back to AI
          for (const call of readOnlyCalls.slice(0, AI.maxToolRounds)) {
            const toolOutput = await executeTradingTool(call.name, call.arguments, fortunoApi);
            aiState.addMessage({
              role: 'tool',
              toolCallId: call.id,
              toolName: call.name,
              content: toolOutput,
            });
          }

          if (readOnlyCalls.length > 0 && approvalCalls.length === 0) {
            const followUp = await aiRouter.chat(
              providerId,
              [systemMsg, ...useAIStore.getState().chatMessages],
              { model: modelOverride, allowDemoFallback: cfgState.demoMode },
            );
            aiState.addMessage({ role: 'assistant', content: followUp.content });
          }

          if (approvalCalls.length > 0) {
            const approvals: PendingToolApproval[] = approvalCalls.map(describeToolCall);
            aiState.setPendingToolApprovals(approvals);
            if (!result.content) {
              aiState.addMessage({
                role: 'assistant',
                content:
                  'Saya telah menyiapkan perintah trading berikut. Silakan periksa detailnya dan klik **Konfirmasi** untuk mengeksekusi.',
                toolCalls: approvalCalls,
              });
            }
          }
        } else {
          // Stream progressive display for smooth UX
          const provider = aiRouter.hasUsableCredentials(providerId)
            ? aiRouter.getProvider(providerId)
            : cfgState.demoMode
              ? new DemoSandboxAIProvider()
              : null;

          if (result.content) {
            // Animate token stream into currentStreamContent before committing
            let acc = '';
            const tokens = result.content.split(/(?=\s)/);
            for (const tok of tokens) {
              acc += tok;
              aiState.updateStreamContent(acc);
            }
            aiState.updateStreamContent('');
            aiState.addMessage({ role: 'assistant', content: result.content });
          } else if (provider) {
            let streamed = '';
            for await (const chunk of provider.chatStream(conversation, {
              model: modelOverride,
            })) {
              streamed += chunk;
              aiState.updateStreamContent(streamed);
            }
            aiState.updateStreamContent('');
            aiState.addMessage({
              role: 'assistant',
              content: streamed || 'Tidak ada respons dari model AI.',
            });
          }
        }
      } catch (err) {
        aiState.updateStreamContent('');
        aiState.addMessage({
          role: 'assistant',
          content: `⚠️ Gagal memproses permintaan AI: ${getErrorMessage(err)}`,
          createdAt: userMsg.createdAt + 1,
        });
      } finally {
        aiState.setAILoading(false);
      }
    },
    [],
  );

  const confirmToolCall = useCallback(async (approval: PendingToolApproval) => {
    const aiState = useAIStore.getState();
    const cfgState = useConfigStore.getState();
    aiState.removePendingToolApproval(approval.call.id);
    aiState.setAILoading(true);

    try {
      const output = await executeTradingTool(
        approval.call.name,
        approval.call.arguments,
        fortunoApi,
      );
      aiState.addMessage({
        role: 'tool',
        toolCallId: approval.call.id,
        toolName: approval.call.name,
        content: output,
      });
      aiState.addMessage({
        role: 'assistant',
        content: `✅ **Berhasil dieksekusi:** ${output}`,
      });

      // Refresh positions & orders in store
      const [positions, orders] = await Promise.all([
        fortunoApi.getPositions().catch(() => null),
        fortunoApi.getPendingOrders().catch(() => null),
      ]);
      if (positions) useTradingStore.getState().setPositions(positions);
      if (orders) useTradingStore.getState().setPendingOrders(orders);
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      aiState.addMessage({
        role: 'tool',
        toolCallId: approval.call.id,
        toolName: approval.call.name,
        content: `Error: ${errorMsg}`,
      });
      // Let AI explain or recover
      const providerId =
        aiState.sessionProviderId ?? cfgState.activeProviderId ?? cfgState.aiProviders[0]?.id ?? '';
      try {
        const recovery = await aiRouter.chat(
          providerId,
          [
            {
              id: 'sys',
              role: 'system',
              createdAt: Date.now(),
              content: 'Jelaskan penyebab gagalnya eksekusi order berikut secara singkat dan solusinya.',
            },
            {
              id: 'u',
              role: 'user',
              createdAt: Date.now(),
              content: `Eksekusi ${approval.summary} gagal dengan pesan: ${errorMsg}`,
            },
          ],
          { allowDemoFallback: cfgState.demoMode },
        );
        aiState.addMessage({
          role: 'assistant',
          content: `❌ **Eksekusi gagal:** ${errorMsg}\n\n${recovery.content}`,
        });
      } catch {
        aiState.addMessage({
          role: 'assistant',
          content: `❌ **Eksekusi gagal:** ${errorMsg}`,
        });
      }
    } finally {
      aiState.setAILoading(false);
    }
  }, []);

  const cancelToolCall = useCallback((callId: string) => {
    const aiState = useAIStore.getState();
    aiState.removePendingToolApproval(callId);
    aiState.addMessage({
      role: 'assistant',
      content: 'ℹ️ Eksekusi perintah trading dibatalkan oleh pengguna.',
    });
  }, []);

  const runMarketAnalysis = useCallback(
    async (symbol: string, interval: CandleInterval) => {
      const aiState = useAIStore.getState();
      const cfgState = useConfigStore.getState();
      aiRouter.syncConfigs(cfgState.aiProviders);
      aiState.setIsAnalyzing(true);
      try {
        const providerId =
          aiState.sessionProviderId ??
          cfgState.activeProviderId ??
          cfgState.aiProviders[0]?.id ??
          '';
        const result = await analyzeSymbolWithAI({
          symbol,
          interval,
          providerId,
          router: aiRouter,
          apiClient: fortunoApi,
          allowDemoFallback: cfgState.demoMode,
        });
        aiState.setAnalysisResult(symbol, result);
        return result;
      } finally {
        aiState.setIsAnalyzing(false);
      }
    },
    [],
  );

  return {
    chatMessages,
    sessionModel,
    isAILoading,
    currentStreamContent,
    pendingToolApprovals,
    analysisResults,
    isAnalyzing,
    effectiveProviderId,
    effectiveProviderConfig,
    demoMode,
    sendMessage,
    confirmToolCall,
    cancelToolCall,
    clearMessages: useAIStore((s) => s.clearMessages),
    setSessionProvider: useAIStore((s) => s.setSessionProvider),
    runMarketAnalysis,
  };
}
