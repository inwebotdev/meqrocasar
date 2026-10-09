# Reel background audio

The wedding reel player (`src/components/reel/ReelPlayer.tsx`) looks for a
royalty-free background track at:

```
public/audio/wedding-theme.mp3
```

This file is **not** committed to the repository (no binary audio assets in
git). To enable audio in the reel:

1. Source a royalty-free track, 12 seconds or longer, that evokes a romantic
   "Son Huapango Queretano" / classical strings mood (see
   `design/quer_taro_romance_ai/DESIGN.md` §"Vertical Video Reel Player").
2. Drop it at `public/audio/wedding-theme.mp3`.
3. Reload `/resultados` — `useAudioAvailability` HEAD-checks this path on
   mount and wires it into the Remotion composition automatically.

Until the file is present, the reel plays silently and the track pill in the
player chrome reads "Sin audio (agrega public/audio/wedding-theme.mp3)".
