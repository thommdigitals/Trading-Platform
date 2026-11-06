'use client';

import * as React from 'react';

import { ChatInterface } from '@/components/ai/ChatInterface';
import { AppLayout } from '@/components/layout/AppLayout';

export default function AIChatPage(): React.ReactElement {
  return (
    <AppLayout>
      <ChatInterface />
    </AppLayout>
  );
}

