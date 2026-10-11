import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { buildCatalogVenues, buildCatalogZones } from "@/domain/kb/catalog";
import { loadKb } from "@/domain/kb/load";

import { CatalogScreen } from "./CatalogScreen";

const kb = loadKb();
const venues = buildCatalogVenues(kb);
const zones = buildCatalogZones(kb);

describe("CatalogScreen", () => {
  it("shows every KB venue by default", () => {
    render(<CatalogScreen venues={venues} zones={zones} />);

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(venues.length);
  });

  it("renders a zone filter button for all 10 taxonomy zones plus 'Todas'", () => {
    render(<CatalogScreen venues={venues} zones={zones} />);

    expect(screen.getByRole("button", { name: "Todas" })).toBeInTheDocument();
    for (const zone of zones) {
      expect(screen.getByRole("button", { name: zone.label })).toBeInTheDocument();
    }
  });

  it("filters the venue list down to the selected zone", async () => {
    const user = userEvent.setup();
    const targetZone = zones.find((zone) => venues.some((venue) => venue.zoneId === zone.id))!;
    const expectedVenues = venues.filter((venue) => venue.zoneId === targetZone.id);

    render(<CatalogScreen venues={venues} zones={zones} />);

    await user.click(screen.getByRole("button", { name: targetZone.label }));

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(expectedVenues.length);

    for (const venue of expectedVenues) {
      expect(screen.getByRole("heading", { name: venue.name })).toBeInTheDocument();
    }
  });

  it("goes back to showing every venue when 'Todas' is re-selected", async () => {
    const user = userEvent.setup();
    const targetZone = zones[0]!;

    render(<CatalogScreen venues={venues} zones={zones} />);

    await user.click(screen.getByRole("button", { name: targetZone.label }));
    await user.click(screen.getByRole("button", { name: "Todas" }));

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(venues.length);
  });
});
