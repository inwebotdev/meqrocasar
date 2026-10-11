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

  it("shows the rating pill with review count when the venue has real Places data", () => {
    render(
      <VenueCard
        venue={buildVenue({
          photoId: undefined,
          photoUrl: "https://example.com/photo.jpg",
          rating: 4.7,
          userRatingCount: 1234,
        })}
      />,
    );

    expect(screen.getByText((text) => text.includes("4.7"))).toBeInTheDocument();
    expect(screen.getByText((text) => text.includes("1,234 reseñas"))).toBeInTheDocument();
  });

  it("does not show a rating pill when the venue has no rating", () => {
    render(<VenueCard venue={buildVenue()} />);

    expect(screen.queryByText((text) => text.includes("reseñas"))).not.toBeInTheDocument();
  });

  it("shows the address, website and Google Maps links when the venue has them", () => {
    render(
      <VenueCard
        venue={buildVenue({
          address: "Andador Juárez 12, Tequisquiapan, Qro.",
          websiteUri: "https://example.com/venue",
          googleMapsUri: "https://maps.google.com/?cid=1004",
        })}
      />,
    );

    expect(screen.getByText("Andador Juárez 12, Tequisquiapan, Qro.")).toBeInTheDocument();

    const websiteLink = screen.getByRole("link", { name: /Sitio web/ });
    expect(websiteLink).toHaveAttribute("href", "https://example.com/venue");

    const mapsLink = screen.getByRole("link", { name: /Ver en Google Maps/ });
    expect(mapsLink).toHaveAttribute("href", "https://maps.google.com/?cid=1004");
  });

  it("does not show website/maps links when the venue has neither url", () => {
    render(<VenueCard venue={buildVenue()} />);

    expect(screen.queryByRole("link", { name: /Sitio web/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver en Google Maps/ })).not.toBeInTheDocument();
  });

  it("uses photoUrl and shows the attribution caption when present", () => {
    render(
      <VenueCard
        venue={buildVenue({
          photoId: undefined,
          photoUrl: "https://example.com/photo.jpg",
          photoAttribution: "Fotógrafo Ejemplo",
        })}
      />,
    );

    const image = screen.getByRole("img", { name: "Casona de los Cinco Patios" });
    expect(image).toHaveAttribute("src", "https://example.com/photo.jpg");
    expect(screen.getByText("Fotógrafo Ejemplo")).toBeInTheDocument();
  });
});
