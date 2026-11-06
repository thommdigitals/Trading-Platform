'use client';

import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  onQuickBuy?: () => void;
  onQuickSell?: () => void;
  onOpenChart?: () => void;
  onOpenPositions?: () => void;
  onOpenOrders?: () => void;
  onEscape?: () => void;
  onToggleHelp?: () => void;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

/**
 * Keyboard shortcuts per SRS FR-UX-003 & TASK-043:
 *  - Alt+B: Quick BUY
 *  - Alt+S: Quick SELL
 *  - Alt+C: Navigate to Chart / Trading
 *  - Alt+P: Navigate to Positions tab
 *  - Alt+O: Navigate to Pending Orders tab
 *  - Esc  : Close active dialog / modal
 *  - ?    : Toggle shortcuts legend modal
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handlers.onEscape?.();
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === 'b') {
          event.preventDefault();
          handlers.onQuickBuy?.();
        } else if (key === 's') {
          event.preventDefault();
          handlers.onQuickSell?.();
        } else if (key === 'c') {
          event.preventDefault();
          handlers.onOpenChart?.();
        } else if (key === 'p') {
          event.preventDefault();
          handlers.onOpenPositions?.();
        } else if (key === 'o') {
          event.preventDefault();
          handlers.onOpenOrders?.();
        }
        return;
      }

      if (
        event.key === '?' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !isEditableElement(event.target)
      ) {
        event.preventDefault();
        handlers.onToggleHelp?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}

