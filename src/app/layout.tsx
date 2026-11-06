import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { Toaster } from '@/components/ui/toast';

import './globals.css';

export const metadata: Metadata = {
  title: 'FortunoAI Trading Platform — Multi-Provider AI Trading Terminal',
  description:
    'Web-based trading terminal and AI Co-Pilot for Fortuno Markets (Match-Trader Trader API) with multi-provider LLM intelligence and automated risk guardrails.',
};

export default async function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): Promise<React.ReactElement> {
  const headerList = await headers();
  const nonce = headerList.get('x-nonce') ?? undefined;

  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body data-nonce={nonce} className="min-h-screen antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
