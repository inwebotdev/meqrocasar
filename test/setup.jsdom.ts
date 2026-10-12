import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./msw/server";

// jsdom doesn't implement `scrollIntoView` (unlike `IntersectionObserver`,
// which it has stubbed since v24) — default it to a no-op so components
// that call it (e.g. `OptionCarousel`'s `useActiveSlide`) don't throw.
// A test that needs to assert the call swaps this for its own `vi.fn()`.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

beforeAll(() =>
  // MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`; "error" fails any unmocked request.
  server.listen({ onUnhandledFrame: "error" }),
);
afterEach(() => server.resetHandlers());
afterEach(() => cleanup());
afterAll(() => server.close());
