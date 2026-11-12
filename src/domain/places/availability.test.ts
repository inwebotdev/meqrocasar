import { describe, expect, it, vi } from "vitest";

import { createPlacesAvailability } from "./availability";

const TEN_MINUTES_MS = 10 * 60 * 1000;

describe("createPlacesAvailability", () => {
  it("is never usable when no API key is configured", () => {
    const availability = createPlacesAvailability({ hasApiKey: () => false });
    expect(availability.isUsable()).toBe(false);

    availability.markSuccess();
    expect(availability.isUsable()).toBe(false);
  });

  it("is usable with a key configured and no failures", () => {
    const availability = createPlacesAvailability({ hasApiKey: () => true });
    expect(availability.isUsable()).toBe(true);
  });

  it("disables for 10 minutes after a 403 SERVICE_DISABLED failure, then recovers", () => {
    let now = 0;
    const log = vi.fn();
    const availability = createPlacesAvailability({
      hasApiKey: () => true,
      now: () => now,
      log,
    });

    availability.markFailure({ httpStatus: 403, code: "SERVICE_DISABLED" });
    expect(availability.isUsable()).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);

    now += TEN_MINUTES_MS - 1;
    expect(availability.isUsable()).toBe(false);

    now += 1;
    expect(availability.isUsable()).toBe(true);
  });

  it("disables for 10 minutes after a 403 PERMISSION_DENIED failure", () => {
    let now = 0;
    const availability = createPlacesAvailability({ hasApiKey: () => true, now: () => now });

    availability.markFailure({ httpStatus: 403, code: "PERMISSION_DENIED" });
    expect(availability.isUsable()).toBe(false);

    now += TEN_MINUTES_MS;
    expect(availability.isUsable()).toBe(true);
  });

  it("stays usable through fewer than 5 consecutive failures of another kind", () => {
    const availability = createPlacesAvailability({ hasApiKey: () => true });

    for (let i = 0; i < 4; i += 1) {
      availability.markFailure({ httpStatus: 500 });
    }

    expect(availability.isUsable()).toBe(true);
  });

  it("disables for 10 minutes after 5 consecutive failures of a non-denial kind", () => {
    let now = 0;
    const log = vi.fn();
    const availability = createPlacesAvailability({
      hasApiKey: () => true,
      now: () => now,
      log,
    });

    for (let i = 0; i < 5; i += 1) {
      availability.markFailure({ httpStatus: 500 });
    }

    expect(availability.isUsable()).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);

    now += TEN_MINUTES_MS;
    expect(availability.isUsable()).toBe(true);
  });

  it("logs the disable only once even if markFailure is called again while still disabled", () => {
    const now = 0;
    const log = vi.fn();
    const availability = createPlacesAvailability({
      hasApiKey: () => true,
      now: () => now,
      log,
    });

    availability.markFailure({ httpStatus: 403, code: "SERVICE_DISABLED" });
    availability.markFailure({ httpStatus: 403, code: "SERVICE_DISABLED" });
    availability.markFailure({ httpStatus: 403, code: "SERVICE_DISABLED" });

    expect(log).toHaveBeenCalledTimes(1);
  });

  it("markSuccess resets the consecutive-failure counter", () => {
    const availability = createPlacesAvailability({ hasApiKey: () => true });

    for (let i = 0; i < 4; i += 1) {
      availability.markFailure({ httpStatus: 500 });
    }
    availability.markSuccess();
    availability.markFailure({ httpStatus: 500 });

    expect(availability.isUsable()).toBe(true);
  });

  it("an unrelated 403 (no SERVICE_DISABLED/PERMISSION_DENIED code) only counts toward the consecutive-failure threshold", () => {
    const availability = createPlacesAvailability({ hasApiKey: () => true });

    for (let i = 0; i < 4; i += 1) {
      availability.markFailure({ httpStatus: 403, code: "SOMETHING_ELSE" });
    }

    expect(availability.isUsable()).toBe(true);

    availability.markFailure({ httpStatus: 403, code: "SOMETHING_ELSE" });
    expect(availability.isUsable()).toBe(false);
  });
});
