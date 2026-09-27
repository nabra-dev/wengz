"use client";

import { Toaster as Sonner } from "sonner";
import { useLocale } from "next-intl";
import { useTheme } from "@/components/providers/theme-provider";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const locale = useLocale();
  const { theme } = useTheme();
  const isRtl = locale === "ar";
  const fontClass = isRtl ? "font-cairo" : "font-unbounded";

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      dir={isRtl ? "rtl" : "ltr"}
      toastOptions={{
        classNames: {
          toast: `group toast ${fontClass} group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg`,
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:bg-green-50 group-[.toaster]:border-green-200 group-[.toaster]:text-green-800",
          error:
            "group-[.toaster]:bg-red-50 group-[.toaster]:border-red-200 group-[.toaster]:text-red-800",
          warning:
            "group-[.toaster]:bg-yellow-50 group-[.toaster]:border-yellow-200 group-[.toaster]:text-yellow-800",
          info: "group-[.toaster]:bg-blue-50 group-[.toaster]:border-blue-200 group-[.toaster]:text-blue-800",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
