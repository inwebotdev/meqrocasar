/**
 * Verified photo registry.
 *
 * Every entry below points at a real Unsplash CDN asset (`images.unsplash.com`),
 * confirmed with `curl -sI <url> | head -1` returning HTTP 200 before being
 * added here. No API key is required because we hit the CDN directly with the
 * photo's id instead of going through the Unsplash API.
 *
 * This module is pure TypeScript: no React, no Next.js, no `server-only`. It
 * must stay importable from both the node and jsdom Vitest projects, and from
 * client components later.
 */

export type PhotoTag =
  | "colonial"
  | "hacienda"
  | "vineyard"
  | "wine"
  | "bernal"
  | "desert"
  | "garden"
  | "night"
  | "sunset"
  | "modern"
  | "boho"
  | "banquet"
  | "fireworks"
  | "street"
  | "bougainvillea"
  | "courtyard"
  | "chapel";

/** Every photo id, as a runtime tuple so both the `PhotoId` type and the Zod schema derive from one source. */
export const PHOTO_ID_VALUES = [
  "patio-cantera-rosa",
  "banca-palmeras-buganvilia",
  "patio-arcos-buganvilia",
  "puerta-azul-buganvilia",
  "callejon-balcon-amarillo",
  "entrada-vinedo-barril",
  "pareja-vinedo-abrazo",
  "pareja-vinedo-atardecer",
  "cava-barricas-roble",
  "jardin-atardecer-recien-casados",
  "ceremonia-jardin-luz-dorada",
  "candelabro-sala-oscura",
  "evento-nocturno-luces-calidas",
  "pareja-muro-concreto",
  "candelabros-blancos-florales",
  "cactus-semidesierto-cielo",
  "planta-solitaria-desierto",
  "formacion-rocosa-luz-dorada",
  "monolito-desierto-atardecer",
  "arco-flores-silvestres",
  "fuegos-artificiales-multicolor",
  "fuegos-artificiales-rojo-amarillo",
  "calle-empedrada-banderas",
  "capilla-blanca-campanario",
  "mesa-larga-velas-flores",
  "recepcion-nocturna-palmeras",
] as const;

export type PhotoId = (typeof PHOTO_ID_VALUES)[number];

export interface Photo {
  id: PhotoId;
  url: string;
  alt: string;
  credit: string;
  orientation: "landscape" | "portrait";
  tags: PhotoTag[];
}

function unsplashUrl(photoId: string): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=1200&q=80`;
}

export const PHOTOS: readonly Photo[] = [
  {
    id: "patio-cantera-rosa",
    url: unsplashUrl("1714686513923-15494ae02180"),
    alt: "Patio colonial con arcos de cantera y una fuente central",
    credit: "Annie Wood",
    orientation: "landscape",
    tags: ["colonial", "courtyard", "hacienda"],
  },
  {
    id: "banca-palmeras-buganvilia",
    url: unsplashUrl("1789569970538-0e841efbddaf"),
    alt: "Banca entre palmeras bajo buganvilias rosas en flor",
    credit: "Irsyad Rifqi",
    orientation: "landscape",
    tags: ["bougainvillea", "courtyard"],
  },
  {
    id: "patio-arcos-buganvilia",
    url: unsplashUrl("1762926628297-bbb137ed9968"),
    alt: "Patio con arcos, columnas de cantera y buganvilias en flor",
    credit: "shawn kim",
    orientation: "landscape",
    tags: ["colonial", "courtyard", "bougainvillea"],
  },
  {
    id: "puerta-azul-buganvilia",
    url: unsplashUrl("1786806685677-3c13d3d0edbd"),
    alt: "Puerta azul en un muro blanco bajo buganvilias color rosa",
    credit: "Raphael Assouline",
    orientation: "landscape",
    tags: ["bougainvillea"],
  },
  {
    id: "callejon-balcon-amarillo",
    url: unsplashUrl("1789930468046-7bfb3aab5b09"),
    alt: "Callejón colonial empedrado entre edificios con balcón amarillo",
    credit: "Manoa Angelo",
    orientation: "landscape",
    tags: ["colonial", "street"],
  },
  {
    id: "entrada-vinedo-barril",
    url: unsplashUrl("1762926627960-18e533c63134"),
    alt: "Entrada de un viñedo decorada con flores y un barril de vino",
    credit: "shawn kim",
    orientation: "landscape",
    tags: ["vineyard", "wine"],
  },
  {
    id: "pareja-vinedo-abrazo",
    url: unsplashUrl("1779475512261-4a233fd6931a"),
    alt: "Pareja abrazándose entre hileras de un viñedo en flor",
    credit: "Jose Nicdao",
    orientation: "landscape",
    tags: ["vineyard"],
  },
  {
    id: "pareja-vinedo-atardecer",
    url: unsplashUrl("1633118287620-f4ba5d7bdc9b"),
    alt: "Pareja de pie sobre el pasto de un viñedo al atardecer",
    credit: "Anthea Lawrence",
    orientation: "landscape",
    tags: ["vineyard"],
  },
  {
    id: "cava-barricas-roble",
    url: unsplashUrl("1643087448435-72f70bd4ce88"),
    alt: "Hilera de barricas de roble en una cava subterránea",
    credit: "David Goldman",
    orientation: "landscape",
    tags: ["wine"],
  },
  {
    id: "jardin-atardecer-recien-casados",
    url: unsplashUrl("1759054710581-c7745b02cb53"),
    alt: "Recién casados tomados de la mano en un jardín al atardecer",
    credit: "Denisa-Elena Ficau",
    orientation: "landscape",
    tags: ["garden", "sunset"],
  },
  {
    id: "ceremonia-jardin-luz-dorada",
    url: unsplashUrl("1721677337543-37b07e7e28b5"),
    alt: "Ceremonia de boda al aire libre bañada en luz dorada de atardecer",
    credit: "Ben Atkins",
    orientation: "landscape",
    tags: ["garden", "sunset"],
  },
  {
    id: "candelabro-sala-oscura",
    url: unsplashUrl("1679945872342-8fac5b29055e"),
    alt: "Candelabro con velas encendidas en una sala en penumbra",
    credit: "Steven Van Elk",
    orientation: "landscape",
    tags: ["night"],
  },
  {
    id: "evento-nocturno-luces-calidas",
    url: unsplashUrl("1752857015590-ab5254f2523f"),
    alt: "Evento nocturno al aire libre iluminado con luces cálidas",
    credit: "Vidit Goswami",
    orientation: "landscape",
    tags: ["night", "banquet"],
  },
  {
    id: "pareja-muro-concreto",
    url: unsplashUrl("1764380746517-f45e2f31e876"),
    alt: "Pareja de novios abrazándose junto a un muro de concreto minimalista",
    credit: "Fotógrafo Samuel Cruz",
    orientation: "landscape",
    tags: ["modern"],
  },
  {
    id: "candelabros-blancos-florales",
    url: unsplashUrl("1762621175799-5fc1e336e84a"),
    alt: "Candelabros blancos altos con arreglos florales minimalistas",
    credit: "Brunxs",
    orientation: "landscape",
    tags: ["modern", "night"],
  },
  {
    id: "cactus-semidesierto-cielo",
    url: unsplashUrl("1763440932368-0ecfb89222fb"),
    alt: "Cactus altos y oscuros recortados contra un cielo despejado",
    credit: "Theo Laflamme",
    orientation: "landscape",
    tags: ["desert", "boho"],
  },
  {
    id: "planta-solitaria-desierto",
    url: unsplashUrl("1641834698977-66365add9d22"),
    alt: "Planta solitaria en medio de un paisaje semidesértico",
    credit: "David Goldman",
    orientation: "landscape",
    tags: ["desert", "boho"],
  },
  {
    id: "formacion-rocosa-luz-dorada",
    url: unsplashUrl("1766067358250-992ca4cf728b"),
    alt: "Luz dorada iluminando una formación rocosa en el semidesierto",
    credit: "Yina Li",
    orientation: "landscape",
    tags: ["bernal", "desert"],
  },
  {
    id: "monolito-desierto-atardecer",
    url: unsplashUrl("1687225783834-25d4d8d11864"),
    alt: "Gran formación rocosa tipo monolito en medio del desierto",
    credit: "Pete Alexopoulos",
    orientation: "landscape",
    tags: ["bernal", "desert"],
  },
  {
    id: "arco-flores-silvestres",
    url: unsplashUrl("1677677402907-05f2883e3f66"),
    alt: "Arco de boda hecho con hojas y flores silvestres",
    credit: "Sergio Butko",
    orientation: "landscape",
    tags: ["boho"],
  },
  {
    id: "fuegos-artificiales-multicolor",
    url: unsplashUrl("1543718290-a207a786243a"),
    alt: "Fuegos artificiales multicolores iluminando el cielo nocturno",
    credit: "Mike Enerio",
    orientation: "landscape",
    tags: ["fireworks"],
  },
  {
    id: "fuegos-artificiales-rojo-amarillo",
    url: unsplashUrl("1605913485433-f9a9d4265fbc"),
    alt: "Fuegos artificiales rojos y amarillos durante la noche",
    credit: "Leon Wu",
    orientation: "landscape",
    tags: ["fireworks"],
  },
  {
    id: "calle-empedrada-banderas",
    url: unsplashUrl("1717654543196-4d6826ec4bb8"),
    alt: "Calle empedrada colonial decorada con banderines de colores",
    credit: "Shane Lopez",
    orientation: "landscape",
    tags: ["street"],
  },
  {
    id: "capilla-blanca-campanario",
    url: unsplashUrl("1782399903044-6e0955a69709"),
    alt: "Capilla blanca con campanario bajo un cielo despejado",
    credit: "Yuya Hata",
    orientation: "landscape",
    tags: ["chapel"],
  },
  {
    id: "mesa-larga-velas-flores",
    url: unsplashUrl("1536392706976-e486e2ba97af"),
    alt: "Mesa larga de banquete puesta con velas y flores",
    credit: "M F",
    orientation: "landscape",
    tags: ["banquet"],
  },
  {
    id: "recepcion-nocturna-palmeras",
    url: unsplashUrl("1766393524464-e5eb1b05e4c8"),
    alt: "Recepción de boda nocturna al aire libre con palmeras iluminadas",
    credit: "Vidit Goswami",
    orientation: "landscape",
    tags: ["banquet", "night"],
  },
];

const PHOTOS_BY_ID = new Map<PhotoId, Photo>(PHOTOS.map((photo) => [photo.id, photo]));

export function getPhoto(id: PhotoId): Photo {
  const photo = PHOTOS_BY_ID.get(id);

  if (!photo) {
    throw new Error(`Unknown photo id: ${id}`);
  }

  return photo;
}

/**
 * Ranks photos by tag overlap with the requested tags, highest overlap
 * first. Ties are broken by the photo's position in `PHOTOS`, so the result
 * is deterministic across calls.
 */
export function findPhotos(tags: readonly PhotoTag[], limit: number): Photo[] {
  const wanted = new Set(tags);

  return PHOTOS.map((photo, index) => ({
    photo,
    index,
    score: photo.tags.reduce((count, tag) => (wanted.has(tag) ? count + 1 : count), 0),
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index))
    .slice(0, limit)
    .map((entry) => entry.photo);
}
