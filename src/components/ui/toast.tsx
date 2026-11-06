'use client';

import { toast, Toaster } from 'sonner';
import { UI } from '@/config/constants';
import { getErrorMessage } from '@/utils/errorHandler';

export { Toaster };

export function showSuccess(message: string): void {
  toast.success(message, { duration: UI.toastDurationMs });
}

export function showError(errorOrMessage: unknown): void {
  const message =
    typeof errorOrMessage === 'string' ? errorOrMessage : getErrorMessage(errorOrMessage);
  toast.error(message, { duration: UI.toastDurationMs + 1500 });
}

export function showWarning(message: string): void {
  toast.warning(message, { duration: UI.toastDurationMs });
}

export function showInfo(message: string): void {
  toast.info(message, { duration: UI.toastDurationMs });
}

