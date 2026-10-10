import experiencesData from "../../../data/kb/experiences.json";
import zonesData from "../../../data/kb/zones.json";

/**
 * Planner tips shown one at a time (rotating every 2.5s) in `StepLoading`
 * while the adaptive engine prepares the next step. Derived at build time
 * from the curated knowledge base, imported the same way `loadKb` does
 * (`resolveJsonModule`), so the numbers stay accurate if the data changes —
 * but without pulling `loadKb`'s Zod validation into client code, since
 * this is "use client" territory.
 */

interface TipZone {
  id: string;
  name: string;
  travelMinutesFromCity: number;
  puebloMagico: boolean;
}

interface TipExperience {
  id: string;
  name: string;
  zoneIds: string[];
  durationHours: number;
}

const zones = zonesData as TipZone[];
const experiences = experiencesData as TipExperience[];

function zoneById(id: string): TipZone | undefined {
  return zones.find((zone) => zone.id === id);
}

function travelTip(zoneId: string): string | undefined {
  const zone = zoneById(zoneId);
  if (!zone || zone.travelMinutesFromCity <= 0) {
    return undefined;
  }
  return `${zone.name} está a ${zone.travelMinutesFromCity} min del Centro Histórico.`;
}

function puebloMagicoTip(zoneId: string): string | undefined {
  const zone = zoneById(zoneId);
  return zone?.puebloMagico ? `${zone.name} es Pueblo Mágico.` : undefined;
}

function experienceTip(experienceId: string): string | undefined {
  const experience = experiences.find((candidate) => candidate.id === experienceId);
  const zone = experience ? zoneById(experience.zoneIds[0] ?? "") : undefined;
  if (!experience || !zone) {
    return undefined;
  }
  return `${experience.name}: ${experience.durationHours}h en ${zone.name}.`;
}

/**
 * 6–8 rotating tips for `StepLoading`'s glass pill. Each is derived from a
 * curated zone/experience id; `.filter` drops any that ever go missing
 * instead of rendering `undefined`.
 */
export const QUIZ_TIPS: readonly string[] = [
  travelTip("tequisquiapan"),
  experienceTip("vendimia-la-redonda"),
  puebloMagicoTip("bernal"),
  experienceTip("globo-pena-bernal"),
  travelTip("ezequiel_montes"),
  experienceTip("callejoneada-centro-historico"),
  puebloMagicoTip("cadereyta"),
  travelTip("el_marques"),
].filter((tip): tip is string => Boolean(tip));
