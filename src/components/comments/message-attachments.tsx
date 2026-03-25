import {
  attachmentPublicUrl,
  parseCommentAttachments,
} from "@/lib/comment-attachments";
import { cn } from "@/lib/utils";

export function MessageAttachments({
  raw,
  variant = "compact",
}: {
  raw: unknown;
  variant?: "compact" | "full";
}) {
  const items = parseCommentAttachments(raw);
  if (!items?.length) return null;

  const imgMax =
    variant === "full" ? "max-h-[min(70vh,520px)]" : "max-h-44";
  const audioH = variant === "full" ? "h-11" : "h-9";

  return (
    <div className={cn("space-y-3", variant === "full" ? "mt-2" : "mt-1.5")}>
      {items.map((a, i) => {
        const src = attachmentPublicUrl(a.path);
        return (
          <div key={`${a.path}-${i}`}>
            {a.kind === "image" && (
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "block rounded-md border border-border bg-muted/30 overflow-hidden",
                  imgMax
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={src}
                  alt={a.name}
                  className={cn(
                    "w-full h-auto object-contain",
                    imgMax
                  )}
                />
              </a>
            )}
            {a.kind === "audio" && (
              <audio
                controls
                className={cn("w-full", audioH)}
                src={src}
                preload="metadata"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {a.kind === "file" && (
              <a
                href={src}
                download={a.name}
                className="text-sm text-primary underline-offset-2 hover:underline inline-block"
                onClick={(e) => e.stopPropagation()}
              >
                {a.name}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
