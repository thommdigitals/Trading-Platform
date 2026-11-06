import { afterEach } from 'vitest';

if (typeof window !== 'undefined') {
  // jsdom: load jest-dom matchers + automatic cleanup for Testing Library
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());
}

