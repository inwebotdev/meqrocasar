import type { PhotoId } from "@/domain/media/photos";

export type Zone =
  | "Centro Histórico"
  | "Huimilpan"
  | "Ezequiel Montes"
  | "Bernal"
  | "Tequisquiapan"
  | "San Juan del Río"
  | "Colón"
  | "El Marqués";

export type VenueTag =
  | "colonial"
  | "casona"
  | "hacienda"
  | "vineyard"
  | "wine_cellar"
  | "garden"
  | "chapel"
  | "lodging"
  | "modern"
  | "boho"
  | "desert"
  | "night"
  | "sunset"
  | "day"
  | "intimate"
  | "grand"
  | "weekend"
  | "wine_tasting"
  | "fireworks"
  | "gourmet"
  | "callejoneada"
  | "pueblo_magico";

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
