// setup vitest for assertion test cases 
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// run cleanup after each vitest test case
afterEach(() => {
  cleanup();
});