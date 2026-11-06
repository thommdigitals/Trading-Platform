// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { AIProvidersManager } from '@/components/ai/AIProvidersManager';
import { AutomationBuilder } from '@/components/ai/AutomationBuilder';
import { AutomationMonitor } from '@/components/ai/AutomationMonitor';
import { ChatInterface } from '@/components/ai/ChatInterface';
import { MarketAnalysisPanel } from '@/components/ai/MarketAnalysisPanel';
import { MultiSignalGrid } from '@/components/ai/MultiSignalGrid';
import { resetDemoState } from '@/services/fortuno/demoBackend';
import { fortunoApi } from '@/services/fortunoApi';
import { useAIStore } from '@/store/aiStore';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';

describe('AI Suite Components (TASK-030, TASK-032, TASK-033, TASK-034, TASK-035, TASK-036, TASK-039)', () => {
  beforeEach(async () => {
    resetDemoState();
    useConfigStore.getState().setDemoMode(true);
    useConfigStore.getState().setDefaultSymbol('EURUSD');
    useTradingStore.getState().reset();
    useAIStore.getState().clearMessages();
    useAIStore.getState().clearAutomationLog();

    const symbols = await fortunoApi.getSymbols(undefined, { force: true });
    useTradingStore.getState().setSymbols(symbols);
  });

  it('renders AIProvidersManager, opens AddProviderModal, and adds a custom provider (TASK-030)', () => {
    render(<AIProvidersManager />);
    expect(screen.getByText(/AI Provider Configurations/i)).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /Add AI Provider/i });
    fireEvent.click(addBtn);

    const nameInput = screen.getByLabelText('Display Name');
    fireEvent.change(nameInput, { target: { value: 'My Custom LLM' } });

    const saveBtn = screen.getByRole('button', { name: /Save Provider/i });
    fireEvent.click(saveBtn);

    expect(screen.getByText('My Custom LLM')).toBeInTheDocument();
  });

  it('renders ChatInterface, sends a user message, and receives Demo AI response (TASK-032, TASK-033)', async () => {
    render(<ChatInterface />);
    const textarea = screen.getByLabelText('Pesan untuk AI Co-Pilot');
    fireEvent.change(textarea, { target: { value: 'Ringkas portofolio saya' } });

    const sendBtn = screen.getByLabelText('Kirim pesan');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(useAIStore.getState().chatMessages.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders MarketAnalysisPanel & MultiSignalGrid and runs AI analysis (TASK-034, TASK-035)', async () => {
    render(
      <div>
        <MarketAnalysisPanel />
        <MultiSignalGrid />
      </div>,
    );

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Market/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(useAIStore.getState().analysisResults['EURUSD']).toBeDefined();
    });
  });

  it('renders AutomationBuilder & AutomationMonitor, parses strategy with AI, and activates/stops automation (TASK-036, TASK-039)', async () => {
    render(
      <div>
        <AutomationBuilder />
        <AutomationMonitor />
      </div>,
    );

    const parseBtn = screen.getByRole('button', { name: /Parse Strategy with AI/i });
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(screen.getByText(/Review & Customize AI-Extracted Conditions/i)).toBeInTheDocument();
    });

    const activateBtn = screen.getByRole('button', { name: /Activate AI Automation/i });
    fireEvent.click(activateBtn);

    await waitFor(() => {
      expect(useAIStore.getState().automationStatus).toBe('running');
    });

    const stopBtn = screen.getByRole('button', { name: /^Stop$/i });
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(useAIStore.getState().automationStatus).toBe('stopped');
    });
  });
});

