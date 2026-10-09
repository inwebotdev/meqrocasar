import { Icon, Pill } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface ReelTopBarProps {
  timeLabel: string;
  muted: boolean;
  onToggleMute: () => void;
}

/** Top scrim: elapsed-time pill (left) + mute toggle & "Remotion AI" pill (right). */
export function ReelTopBar({ timeLabel, muted, onToggleMute }: ReelTopBarProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-space-md">
      <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 font-label-sm text-label-sm text-on-primary backdrop-blur-md">
        <span className="h-2 w-2 animate-ping rounded-full bg-error motion-reduce:animate-none" />
        <span className="font-bold">{timeLabel}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Audio mute/unmute"
          onClick={(event) => {
            event.stopPropagation();
            onToggleMute();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-on-primary backdrop-blur-md transition-colors hover:bg-black/60"
        >
          <Icon name={muted ? "volume_off" : "volume_up"} size={18} />
        </button>
        <Pill tone="primary" className="font-semibold">
          Remotion AI
        </Pill>
      </div>
    </div>
  );
}

export interface ReelPlayButtonProps {
  playing: boolean;
  onToggle: () => void;
}

/** Centered circular play/pause trigger overlay. */
export function ReelPlayButton({ playing, onToggle }: ReelPlayButtonProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <button
        type="button"
        aria-label={playing ? "Pausar reel" : "Reproducir reel"}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className="pointer-events-auto flex h-16 w-16 transform items-center justify-center rounded-full bg-on-primary/80 shadow-2xl backdrop-blur-md transition-transform group-hover:scale-110"
      >
        <Icon
          name={playing ? "pause" : "play_arrow"}
          filled
          size={36}
          className={cn("text-primary", !playing && "ml-1")}
        />
      </button>
    </div>
  );
}

export interface ReelBottomScrimProps {
  title: string;
  trackName: string;
  /** 0..1 */
  progress: number;
}

/** Bottom scrim: title, audio track pill and progress bar. */
export function ReelBottomScrim({ title, trackName, progress }: ReelBottomScrimProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end space-y-space-xs bg-gradient-to-t from-black via-black/70 to-transparent p-space-md pt-space-xl text-on-primary">
      <h4 className="font-headline-sm text-headline-sm leading-tight font-bold text-on-primary">
        {title}
      </h4>
      <div className="flex w-fit items-center gap-space-xs rounded-full bg-white/15 px-space-sm py-1 backdrop-blur-md">
        <Icon name="music_note" size={14} className="text-tertiary-fixed-dim" />
        <span className="max-w-[210px] truncate font-label-sm text-label-sm text-on-primary">
          ♫ {trackName}
        </span>
      </div>
      <div className="mt-space-xs h-1 w-full overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full bg-on-tertiary-container"
          style={{ width: `${clampedProgress * 100}%` }}
        />
      </div>
    </div>
  );
}
