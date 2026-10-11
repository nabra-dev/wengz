"use client";

import { linkifyText } from "@/lib/linkify";
import { CONTACT_LEAK_ENFORCEMENT_ENABLED, isOffPlatformContactUrl } from "@/lib/contact-leak";
import { cn } from "@/lib/utils";

interface LinkifiedTextProps {
  readonly text: string;
  readonly className?: string;
  /** Render as span (inline) instead of p */
  readonly inline?: boolean;
}

/**
 * Renders plain text with http(s)/www URLs as safe external links.
 * Off-platform contact URLs stay plain text when CONTACT_LEAK_ENFORCEMENT_ENABLED.
 */
export function LinkifiedText({ text, className, inline = false }: LinkifiedTextProps) {
  const segments = linkifyText(text);
  const Comp = inline ? "span" : "p";

  return (
    <Comp className={cn("whitespace-pre-wrap break-words", className)}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={`t-${index}`}>{segment.value}</span>;
        }

        if (
          CONTACT_LEAK_ENFORCEMENT_ENABLED &&
          (isOffPlatformContactUrl(segment.href) || isOffPlatformContactUrl(segment.value))
        ) {
          return (
            <span
              key={`b-${index}`}
              className="break-all text-muted-foreground line-through decoration-destructive/60"
              title="Off-platform contact links are blocked"
            >
              {segment.value}
            </span>
          );
        }

        return (
          <a
            key={`l-${index}`}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 break-all hover:opacity-90"
          >
            {segment.value}
          </a>
        );
      })}
    </Comp>
  );
}
