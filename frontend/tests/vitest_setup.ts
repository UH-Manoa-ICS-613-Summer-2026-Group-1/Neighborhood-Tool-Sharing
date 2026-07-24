// setup vitest for assertion test cases 
import "@testing-library/jest-dom/vitest";
import { configMocks, mockAnimationsApi } from 'jsdom-testing-mocks'
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

configMocks({ beforeAll, afterAll, beforeEach, afterEach });
mockAnimationsApi();

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock localStorage for jsdom environment
// Without this mock, tests that use localStorage.clear(), setItem(), etc. will fail
// because jsdom does not fully implement localStorage by default
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// run cleanup after each vitest test case
afterEach(() => {
  cleanup();
});
