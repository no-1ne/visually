import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

class ResizeObserverMock implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

for (const method of ['scrollIntoView', 'setPointerCapture', 'releasePointerCapture'] as const) {
  Object.defineProperty(Element.prototype, method, { configurable: true, value: vi.fn() });
}
Object.defineProperty(Element.prototype, 'hasPointerCapture', { configurable: true, value: vi.fn(() => false) });

afterEach(() => {
  cleanup();
  localStorage.clear();
});
