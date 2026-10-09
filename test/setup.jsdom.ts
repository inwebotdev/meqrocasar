import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./msw/server";

beforeAll(() =>
  // MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`; "error" fails any unmocked request.
  server.listen({ onUnhandledFrame: "error" }),
);
afterEach(() => server.resetHandlers());
afterEach(() => cleanup());
afterAll(() => server.close());
