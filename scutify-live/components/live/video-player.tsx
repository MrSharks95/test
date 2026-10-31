import { cn } from "@/lib/utils";

type Props = {
  src: string;
  className?: string;
};

/** Lecteur StreamYard responsive 16:9. */
export function VideoPlayer({ src, className }: Props) {
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden bg-black", className)}>
      <iframe
        src={src}
        title="Conférence Scutify en direct"
        className="absolute inset-0 size-full border-0"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
