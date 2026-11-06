'use client';

import * as React from 'react';

import { AutomationBuilder } from '@/components/ai/AutomationBuilder';
import { AutomationMonitor } from '@/components/ai/AutomationMonitor';
import { AppLayout } from '@/components/layout/AppLayout';

export default function AIAutomationPage(): React.ReactElement {
  return (
    <AppLayout>
      <div className="space-y-4">
        <AutomationBuilder />
        <AutomationMonitor />
      </div>
    </AppLayout>
  );
}
