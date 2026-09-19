"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const router = useRouter();
  const t = useTranslations("notFound");
  const tCommon = useTranslations("common");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="max-w-2xl w-full shadow-lg">
        <CardContent className="p-8 sm:p-12 text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 blur-2xl opacity-20 bg-primary rounded-full" />
              <FileQuestion className="h-24 w-24 text-primary relative" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-6xl font-bold text-primary">404</h1>
            <h2 className="text-2xl font-semibold">{t("title")}</h2>
            <p className="text-muted-foreground max-w-md mx-auto">{t("description")}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button variant="outline" size="lg" onClick={() => router.back()} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {tCommon("buttons.goBack")}
            </Button>
            <Link href="/">
              <Button size="lg" className="gap-2 w-full sm:w-auto">
                <Home className="h-4 w-4" />
                {tCommon("buttons.backHome")}
              </Button>
            </Link>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {t("needHelp")}{" "}
              <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
                {tCommon("nav.contact")}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
