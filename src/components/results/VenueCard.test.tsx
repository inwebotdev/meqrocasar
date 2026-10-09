import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ExperienceVenue } from "@/domain/experience/types";

import { VenueCard } from "./VenueCard";

function buildVenue(overrides: Partial<ExperienceVenue> = {}): ExperienceVenue {
  return {
    id: "casona-cinco-patios",
    name: "Casona de los Cinco Patios",
    zone: "Centro Histórico",
    municipality: "Querétaro",
    subtitle: "Arquitectura Virreinal Siglo XVIII",
    capacity: 280,
    capacityApprox: true,
    features: ["Patio de Cantera Rosa", "Cava Subterránea", "Certificación SECTUR"],
    priceCategory: "Medio-Alto",
    tags: ["colonial", "casona"],
    photoId: "patio-cantera-rosa",
    aliases: [],
    role: "principal",
    reason: "Resuena con su estilo colonial por la cantera rosa y los patios claustrales.",
    ...overrides,
  };
}

describe("VenueCard", () => {
  it("prefixes the capacity with ~ when capacityApprox is true", () => {
    render(<VenueCard venue={buildVenue({ capacityApprox: true, capacity: 280 })} />);

    expect(
      screen.getByText((text) => text.includes("Capacidad: ~280 invitados")),
    ).toBeInTheDocument();
  });

  it("does not prefix the capacity with ~ when capacityApprox is false", () => {
    render(<VenueCard venue={buildVenue({ capacityApprox: false, capacity: 280 })} />);

    expect(
      screen.getByText((text) => text.includes("Capacidad: 280 invitados")),
    ).toBeInTheDocument();
    expect(screen.queryByText((text) => text.includes("~280"))).not.toBeInTheDocument();
  });

  it("toggles the reason text when Ver detalles is clicked", async () => {
    const user = userEvent.setup();
    const venue = buildVenue({ reason: "Conecta con su amor por la cantera rosa." });
    render(<VenueCard venue={venue} />);

    expect(screen.queryByText(venue.reason)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver detalles" }));
    expect(screen.getByText(venue.reason)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver detalles" }));
    expect(screen.queryByText(venue.reason)).not.toBeInTheDocument();
  });
});
