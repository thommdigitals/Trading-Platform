'use client';

import * as React from 'react';

import { AIProvidersManager } from '@/components/ai/AIProvidersManager';
import { AppLayout } from '@/components/layout/AppLayout';

export default function SettingsAIProvidersPage(): React.ReactElement {
  return (
    <AppLayout>
      <AIProvidersManager />
    </AppLayout>
  );
}

