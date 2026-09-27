"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type RequestWorkspaceProps = {
  readonly info: ReactNode;
  readonly chat: ReactNode;
};

const LG_QUERY = "(min-width: 1024px)";

function useIsLgUp(): boolean {
  const [isLg, setIsLg] = useState(false);

  useEffect(() => {
    const mq = globalThis.matchMedia(LG_QUERY);
    const apply = () => setIsLg(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return isLg;
}

/**
 * Two-column request workspace on lg+: info | chat.
 * Below lg: tabbed Details / Messages — chat fills most of the viewport.
 */
export function RequestWorkspace({ info, chat }: RequestWorkspaceProps) {
  const t = useTranslations("requests.workspace");
  const isDesktop = useIsLgUp();
  const tabsAnchorRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState("messages");

  const handleTabChange = useCallback((value: string) => {
    setTab(value);
    requestAnimationFrame(() => {
      tabsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  if (isDesktop) {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,36rem)] lg:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)] lg:items-start">
        <div className="min-w-0 space-y-6">{info}</div>
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100dvh-5rem)]">
          {chat}
        </aside>
      </div>
    );
  }

  return (
    <div ref={tabsAnchorRef} className="w-full scroll-mt-3">
      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="sticky top-0 z-10 grid h-12 w-full grid-cols-2 shadow-sm">
          <TabsTrigger value="messages" className="gap-2 text-sm sm:text-base">
            <MessageSquare className="h-4 w-4" />
            {t("messages")}
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-2 text-sm sm:text-base">
            <FileText className="h-4 w-4" />
            {t("details")}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="messages"
          className={cn(
            "mt-3 min-w-0 focus-visible:ring-0 data-[state=inactive]:hidden",
            // Fill remaining viewport under app bar + request header + tabs
            "[&>*]:h-[calc(100dvh-14rem)] [&>*]:min-h-[20rem] [&>*]:max-h-none sm:[&>*]:h-[calc(100dvh-13rem)]"
          )}
        >
          {chat}
        </TabsContent>
        <TabsContent
          value="details"
          className="mt-3 min-w-0 space-y-6 focus-visible:ring-0 data-[state=inactive]:hidden"
        >
          {info}
        </TabsContent>
      </Tabs>
    </div>
  );
}
