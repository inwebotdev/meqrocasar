import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VENUES, venuesByZone, ZONES } from "@/domain/venues/catalog";

import { CatalogScreen } from "./CatalogScreen";

describe("CatalogScreen", () => {
  it("shows every catalog venue by default", () => {
    render(<CatalogScreen venues={VENUES} zones={ZONES} />);

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(VENUES.length);
  });

  it("filters the venue list down to the selected zone", async () => {
    const user = userEvent.setup();
    const targetZone = ZONES[0];
    const expectedVenues = venuesByZone(targetZone);

    render(<CatalogScreen venues={VENUES} zones={ZONES} />);

    await user.click(screen.getByRole("button", { name: targetZone }));

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(expectedVenues.length);

    for (const venue of expectedVenues) {
      expect(screen.getByRole("heading", { name: venue.name })).toBeInTheDocument();
    }
  });
});
