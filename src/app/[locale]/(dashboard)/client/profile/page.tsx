"use client";

import { EditProfileForm } from "@/components/profile/edit-profile-form";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { useTranslations } from "next-intl";
import { User, Lock } from "lucide-react";

export default function ClientProfilePage() {
  const t = useTranslations("client.profile");

  return (
    <div className="max-w-4xl space-y-6">
      <DashboardPageHeader title={t("title")} description={t("subtitle")} />

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-11">
          <TabsTrigger value="profile" className="flex items-center gap-1.5 md:gap-2">
            <User className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="text-xs md:text-sm">{t("tabs.profile")}</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-1.5 md:gap-2">
            <Lock className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="text-xs md:text-sm">{t("tabs.security")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 md:mt-6">
          <EditProfileForm />
        </TabsContent>

        <TabsContent value="security" className="mt-4 md:mt-6">
          <ChangePasswordForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
