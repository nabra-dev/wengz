"use client";

import type { ReactNode } from "react";

type RequestWorkspaceProps = {
  readonly info: ReactNode;
  readonly chat: ReactNode;
};

/**
 * Two-column request workspace: info on the left, chat on the right.
 * Stacks on small screens; chat sticks on large screens.
 */
export function RequestWorkspace({ info, chat }: RequestWorkspaceProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] xl:items-start">
      <div className="min-w-0 space-y-6">{info}</div>
      <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">{chat}</aside>
    </div>
  );
}
