"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, MessageSquare } from "lucide-react";

type RequestWorkspaceProps = {
  readonly info: ReactNode;
  readonly chat: ReactNode;
};

/**
 * Two-column request workspace on lg+: info | chat.
 * Below lg: tabbed Details / Messages so chat is reachable without scrolling past everything.
 */
export function RequestWorkspace({ info, chat }: RequestWorkspaceProps) {
  const t = useTranslations("requests.workspace");

  return (
    <>
      {/* Mobile / tablet: tabs */}
      <div className="lg:hidden">
        <Tabs defaultValue="messages" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11">
            <TabsTrigger value="messages" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              {t("messages")}
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-2">
              <FileText className="h-4 w-4" />
              {t("details")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="messages" className="mt-4 min-w-0">
            {chat}
          </TabsContent>
          <TabsContent value="details" className="mt-4 min-w-0 space-y-6">
            {info}
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden lg:grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] lg:items-start">
        <div className="min-w-0 space-y-6">{info}</div>
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">{chat}</aside>
      </div>
    </>
  );
}
