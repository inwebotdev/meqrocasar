import type { PhotoId } from "@/domain/media/photos";

/** Every venue zone, as a runtime tuple so both the `Zone` type and the Zod schema derive from one source. */
export const ZONE_VALUES = [
  "Centro Histórico",
  "Huimilpan",
  "Ezequiel Montes",
  "Bernal",
  "Tequisquiapan",
  "San Juan del Río",
  "Colón",
  "El Marqués",
] as const;

export type Zone = (typeof ZONE_VALUES)[number];

/** Every venue tag, as a runtime tuple so both the `VenueTag` type and the Zod schema derive from one source. */
export const VENUE_TAG_VALUES = [
  "colonial",
  "casona",
  "hacienda",
  "vineyard",
  "wine_cellar",
  "garden",
  "chapel",
  "lodging",
  "modern",
  "boho",
  "desert",
  "night",
  "sunset",
  "day",
  "intimate",
  "grand",
  "weekend",
  "wine_tasting",
  "fireworks",
  "gourmet",
  "callejoneada",
  "pueblo_magico",
] as const;

export type VenueTag = (typeof VENUE_TAG_VALUES)[number];

export interface Venue {
  id: string;
  name: string;
  zone: Zone;
  municipality: string;
  /** e.g. "Arquitectura Virreinal Siglo XVIII". */
  subtitle: string;
  capacity: number;
  capacityApprox: boolean;
  features: [string, string, string];
  priceCategory: "Medio" | "Medio-Alto" | "Exclusivo";
  tags: VenueTag[];
  photoId: PhotoId;
  /** Alternate names a user or an LLM might use, e.g. "Casona de los 5 Patios". */
  aliases: string[];
  website?: string;
}
