'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, Check, Copy, Terminal, User } from 'lucide-react';

import type { ChatMessage as ChatMessageModel } from '@/types/ai';
import { formatTime } from '@/utils/dateTime';

export interface ChatMessageProps {
  readonly message: ChatMessageModel;
}

export function ChatMessage({ message }: ChatMessageProps): React.ReactElement | null {
  const [copied, setCopied] = React.useState(false);

  if (message.role === 'system') return null;

  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (isTool) {
    return (
      <div className="my-1.5 flex items-start gap-2 rounded-lg border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-[11px] font-mono text-slate-400">
        <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
        <div className="min-w-0 flex-1">
          <span className="font-semibold text-blue-300">{message.toolName ?? 'Tool'}: </span>
          <span className="break-words">{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
          isUser
            ? 'border-blue-500/40 bg-blue-600/20 text-blue-300'
            : 'border-emerald-500/40 bg-emerald-600/20 text-emerald-300'
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      <div
        className={`group relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-xs'
            : 'border border-slate-800 bg-slate-900/90 text-slate-100 rounded-tl-xs'
        }`}
      >
        <div className="prose prose-invert max-w-none text-xs break-words [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_code]:rounded [&_code]:bg-slate-950/80 [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-950 [&_pre]:p-2.5">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        <div
          className={`mt-1.5 flex items-center justify-between gap-3 text-[10px] ${
            isUser ? 'text-blue-200' : 'text-slate-400'
          }`}
        >
          <span>{formatTime(message.createdAt)}</span>
          {!isUser && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy message"
              className="opacity-70 hover:opacity-100 inline-flex items-center gap-1"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

