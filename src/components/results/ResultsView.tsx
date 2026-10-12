import { ReelErrorBoundary } from "@/components/reel/ReelErrorBoundary";
import { ReelPlayerLazy } from "@/components/reel/ReelPlayerLazy";
import { ReelPoster } from "@/components/reel/ReelPoster";
import { SectionHeader } from "@/components/ui";
import type { ExperienceResult } from "@/domain/experience/types";
import { FPS, reelDurationInFrames } from "@/remotion/timing";

import { HeroCard } from "./HeroCard";
import { MetaFooter } from "./MetaFooter";
import { MoodboardCard } from "./MoodboardCard";
import { NarrativeCard } from "./NarrativeCard";
import { ReelCard } from "./ReelCard";
import { ResultActions } from "./ResultActions";
import { VenueList } from "./VenueList";

export interface ResultsViewProps {
  result: ExperienceResult;
}

const REEL_TRACK_NAME = "Vals Huapango Queretano";

/** "{n} seg" from the reel's computed total duration — longer than 11s once a ready narration stretches it. */
function reelDurationLabel(result: ExperienceResult): string {
  const narrationDurationSec =
    result.narration?.status === "ready" ? result.narration.durationSec : undefined;
  const frames = reelDurationInFrames({ narrationDurationSec, photoCount: result.photos.length });
  return `${Math.round(frames / FPS)} seg`;
}

export function ResultsView({ result }: ResultsViewProps) {
  return (
    <div className="flex flex-col gap-y-space-lg">
      <HeroCard title={result.conceptTitle} narrative={result.narrative} palette={result.palette} />

      <SectionHeader
        eyebrow="Diseño Exclusivo"
        title="Entregables Destacados"
        icon="auto_awesome"
      />

      <section id="reel">
        <ReelCard
          title={result.conceptTitle}
          trackName={REEL_TRACK_NAME}
          durationLabel={reelDurationLabel(result)}
          narration={result.narration}
        >
          <ReelErrorBoundary
            fallback={
              <ReelPoster
                title={result.conceptTitle}
                trackName={REEL_TRACK_NAME}
                posterUrl={result.photos[0]?.url}
              />
            }
          >
            <ReelPlayerLazy result={result} trackName={REEL_TRACK_NAME} />
          </ReelErrorBoundary>
        </ReelCard>
      </section>

      <MoodboardCard result={result} />

      <NarrativeCard
        title={result.conceptTitle}
        narrative={result.narrative}
        itineraryHint={result.itineraryHint}
      />

      <VenueList venues={result.venues} />

      <ResultActions result={result} />

      <MetaFooter meta={result.meta} transcript={result.transcript} />
    </div>
  );
}
