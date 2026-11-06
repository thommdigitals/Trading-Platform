'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bot, Cpu, Radar, Sparkles } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AIHubPage(): React.ReactElement {
  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Fortuno AI Intelligence Suite</h1>
          <p className="text-xs text-slate-400">
            Multi-provider LLM Trading Co-Pilot, technical signal scanner, and automated strategy engine.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link href="/ai/chat" className="block group">
            <Card className="h-full transition-colors group-hover:border-blue-500/60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-blue-400" />
                  <CardTitle className="text-sm font-semibold">AI Trading Co-Pilot Chat</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-slate-400">
                Natural language trading assistant with live portfolio context and confirmed tool calling.
              </CardContent>
            </Card>
          </Link>

          <Link href="/ai/analysis" className="block group">
            <Card className="h-full transition-colors group-hover:border-emerald-500/60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Radar className="h-5 w-5 text-emerald-400" />
                  <CardTitle className="text-sm font-semibold">Market Analysis &amp; Signals</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-slate-400">
                Single-symbol deep technical analysis and multi-instrument watchlist signal scanner.
              </CardContent>
            </Card>
          </Link>

          <Link href="/ai/automation" className="block group">
            <Card className="h-full transition-colors group-hover:border-amber-500/60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  <CardTitle className="text-sm font-semibold">Automated Strategy Engine</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-slate-400">
                Convert plain-language trading rules into automated strategies with strict risk guardrails.
              </CardContent>
            </Card>
          </Link>
        </div>

        <Card className="border-slate-800/80 bg-slate-900/50">
          <CardContent className="flex items-center justify-between p-4 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Cpu className="h-4 w-4 text-blue-400" />
              <span>Configure OpenAI, Claude, Gemini, Mistral, Groq, or Ollama providers in Settings.</span>
            </div>
            <Link
              href="/settings/ai-providers"
              className="font-semibold text-blue-400 hover:text-blue-300"
            >
              Manage AI Providers →
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

