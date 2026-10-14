import { describe, expect, it } from "vitest";

import { loadKb } from "@/domain/kb/load";
import type { FacetKey } from "@/domain/kb/taxonomy";

import coherenceCentroHistorico from "../../../test/fixtures/demo/coherence-centro-historico.json";
import coherenceCentroHistoricoReport from "../../../test/fixtures/demo/coherence-centro-historico.report.json";
import coherenceEzequielMontes from "../../../test/fixtures/demo/coherence-ezequiel-montes-vinedo.json";
import coherenceEzequielMontesReport from "../../../test/fixtures/demo/coherence-ezequiel-montes-vinedo.report.json";
import { computeTargetFacet } from "./engine";
import { chosenRefs, knownFacets, type Transcript, type TranscriptEntry } from "./transcript";

/**
 * Replays the two REAL conversations recorded against a live dev server
 * (`scripts/quiz/replay-coherence.ts`, run with real `OPENROUTER_API_KEY`
 * — one choosing a vineyard in Ezequiel Montes, one Centro Histórico) and
 * asserts the coherence invariants the owner reported broken: the zone is
 * never asked again once a venue is chosen, no option ever contradicts a
 * known facet, and the "¿qué no puede faltar?" step cites real experience
 * ids. Entirely offline: replays the saved JSON, no network calls.
 */

interface ReportedOption {
  id: string;
  title: string;
  facets: Record<string, string>;
  refs: { venueIds: string[]; experienceIds: string[] };
}

interface StepReport {
  index: number;
  question: string;
  topic: string;
  targetFacet: string;
  source: string;
  options: ReportedOption[];
  chosenOptionId: string;
}

interface CoherenceReport {
  reports: StepReport[];
  violations: string[];
}

const kb = loadKb();

const fixtures: Array<{ name: string; transcript: Transcript; report: CoherenceReport }> = [
  {
    name: "coherence-ezequiel-montes-vinedo",
    transcript: coherenceEzequielMontes as Transcript,
    report: coherenceEzequielMontesReport as CoherenceReport,
  },
  {
    name: "coherence-centro-historico",
    transcript: coherenceCentroHistorico as Transcript,
    report: coherenceCentroHistoricoReport as CoherenceReport,
  },
];

describe("replaying the two real conversations recorded against a live dev server", () => {
  for (const { name, transcript, report } of fixtures) {
    it(`${name}: the live run itself recorded zero coherence violations`, () => {
      expect(report.violations).toEqual([]);
    });

    it(`${name}: the recorded targetFacet sequence matches computeTargetFacet replayed over the saved entries`, () => {
      const entries: TranscriptEntry[] = [];

      for (const step of report.reports) {
        const known = knownFacets(entries, kb);
        const { venueIds } = chosenRefs(entries);
        const target = computeTargetFacet(known, venueIds);

        expect(target).toBe(step.targetFacet);

        const chosenEntry = transcript.entries.find(
          (entry) => entry.chosen.id === step.chosenOptionId,
        );
        if (chosenEntry) entries.push(chosenEntry);
      }
    });

    it(`${name}: zone is never asked again once a venue has been chosen`, () => {
      let sawVenue = false;

      for (const step of report.reports) {
        const chosenOption = step.options.find((option) => option.id === step.chosenOptionId);
        if (chosenOption && chosenOption.refs.venueIds.length > 0) {
          sawVenue = true;
        }
        if (sawVenue) {
          expect(step.targetFacet).not.toBe("zone");
        }
      }
    });

    it(`${name}: no option at any step contradicts the facets known at that point`, () => {
      const entries: TranscriptEntry[] = [];

      for (const step of report.reports) {
        const known = knownFacets(entries, kb);

        for (const option of step.options) {
          const contradicts = (Object.keys(option.facets) as FacetKey[]).some((key) => {
            const value = option.facets[key];
            const knownValue = known[key];
            return value !== undefined && knownValue !== undefined && value !== knownValue;
          });
          expect(contradicts).toBe(false);
        }

        const chosenEntry = transcript.entries.find(
          (entry) => entry.chosen.id === step.chosenOptionId,
        );
        if (chosenEntry) entries.push(chosenEntry);
      }
    });

    it(`${name}: the "experience" step's options always cite a real experience ref, never only a venue`, () => {
      const experienceStep = report.reports.find((step) => step.targetFacet === "experience");
      expect(experienceStep).toBeDefined();

      for (const option of experienceStep?.options ?? []) {
        expect(option.refs.experienceIds.length).toBeGreaterThan(0);
        for (const id of option.refs.experienceIds) {
          expect(kb.experiences.some((experience) => experience.id === id)).toBe(true);
        }
      }
    });
  }
});
