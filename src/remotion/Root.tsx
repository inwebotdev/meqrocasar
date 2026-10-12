import { Composition } from "remotion";

import { WeddingReel } from "./Reel";
import { ReelPropsSchema, type ReelProps } from "./schema";
import { FPS, HEIGHT, reelDurationInFrames, WIDTH } from "./timing";

const SAMPLE_PROPS: ReelProps = {
  title: "Atardecer Virreinal entre Patios de Cantera",
  tagline: "Romance Virreinal con Fuegos Artificiales",
  narrativeLines: [
    "Imaginan su boda entre patios de cantera rosa y casonas virreinales.",
    "El atardecer tiñe de calidez cada rincón del Centro Histórico.",
    "Un castillo de fuegos artificiales cierra la noche con un último destello.",
  ],
  photos: [
    {
      url: "https://images.unsplash.com/photo-1519741497674-611481863552",
      alt: "Jardín colonial al atardecer",
    },
    {
      url: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6",
      alt: "Patio de cantera rosa",
    },
    {
      url: "https://images.unsplash.com/photo-1583939003579-730e3918a45a",
      alt: "Mesa de banquete con velas",
    },
  ],
  palette: [
    { hex: "#68182E", name: "Vino Tinto" },
    { hex: "#D4AF37", name: "Oro Cantera" },
    { hex: "#F5EDE0", name: "Lino Crudo" },
    { hex: "#2F4839", name: "Verde Musgo" },
  ],
  trackName: "Vals Huapango Queretano",
  script:
    "Imaginen su Atardecer Virreinal entre patios de cantera rosa, con la Casona de los Cinco Patios como escenario principal. Ahí, entre luz y color, su historia de amor cobra vida.",
};

/**
 * Not wired to any build/render script in this PoC (no server-side
 * rendering). Kept so the project is Remotion Studio-ready later.
 */
export function RemotionRoot() {
  return (
    <Composition
      id="WeddingReel"
      component={WeddingReel}
      durationInFrames={reelDurationInFrames()}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={SAMPLE_PROPS}
      schema={ReelPropsSchema}
    />
  );
}
