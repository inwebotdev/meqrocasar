import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./msw/server";

beforeAll(() =>
  // MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`; "error" fails any unmocked request.
  server.listen({ onUnhandledFrame: "error" }),
);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
