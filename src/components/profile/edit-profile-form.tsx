"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc/client";
import { emailSchema, phoneNumberOnlySchema } from "@/lib/validations";
import { toast } from "sonner";
import { Loader2, User, Mail, Upload, X } from "lucide-react";
import { showError } from "@/lib/error-handler";

const DEFAULT_AVATAR = "/images/logo.svg";

const getInitials = (value?: string | null) =>
  value
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    (error as { data?: { code?: string } }).data?.code === "NOT_FOUND"
  );
}

export function EditProfileForm() {
  const t = useTranslations("profile.editProfile");
  const {
    data: profile,
    isLoading,
    error: profileError,
    refetch,
  } = trpc.user.getProfile.useQuery(undefined, {
    retry: (failureCount, error) => (isNotFoundError(error) ? false : failureCount < 2),
  });
  const updateProfile = trpc.user.updateProfile.useMutation();
  const { update: updateSession } = useSession();

  const isClient = profile?.role === "CLIENT";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+20");
  const [phone, setPhone] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    if (!isNotFoundError(profileError)) return;
    toast.error(t("sessionExpired"));
    signOut({ callbackUrl: "/auth/login" });
  }, [profileError, t]);

  // Set form values when profile loads
  useEffect(() => {
    if (!profile) return;
    const isClientProfile = profile.role === "CLIENT";
    setName(profile.name || "");
    setEmail(profile.email);
    setProfileImage(isClientProfile ? profile.image || null : DEFAULT_AVATAR);
    if (profile.phone) {
      const parts = profile.phone.split(" ");
      if (parts.length > 1 && parts[0].startsWith("+")) {
        setCountryCode(parts[0]);
        setPhone(parts.slice(1).join(" "));
      } else {
        setPhone(profile.phone);
      }
    } else {
      setPhone("");
      setCountryCode("+20");
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const updates: {
        name?: string;
        email?: string;
        phone?: string;
        image?: string;
      } = {};

      if (name === profile?.name) {
        /* no change */
      } else {
        updates.name = name;
      }

      // Validate email if changed
      if (email !== profile?.email) {
        const emailValidation = emailSchema.safeParse(email);
        if (!emailValidation.success) {
          toast.error(
            emailValidation.error.errors[0]?.message || "Please enter a valid email address"
          );
          return;
        }
        updates.email = email.toLowerCase().trim();
      }

      // Validate and compose phone if changed
      let composedPhone: string | undefined = undefined;
      if (phone) {
        const phoneValidation = phoneNumberOnlySchema.safeParse(phone);
        if (!phoneValidation.success) {
          toast.error(
            phoneValidation.error.errors[0]?.message ||
              "Please enter a valid phone number (7-15 digits)"
          );
          return;
        }
        composedPhone = `${countryCode} ${phone}`;
      }

      if (composedPhone && composedPhone !== profile?.phone) {
        updates.phone = composedPhone;
      }

      if (isClient && profileImage && profileImage !== profile?.image) {
        updates.image = profileImage;
      }

      const result = await updateProfile.mutateAsync(updates);

      toast.success(t("successMessage"));

      // Update NextAuth session with new data
      await updateSession({
        ...result.user,
      });

      refetch();
    } catch (error: unknown) {
      showError(error, t("errorMessage"));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isClient) return;

    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setProfileImage(data.url);

      const result = await updateProfile.mutateAsync({ image: data.url });
      toast.success(t("uploadMessages.success"));

      await updateSession({
        ...result.user,
      });
      refetch();
    } catch (error) {
      setProfileImage(isClient ? profile?.image || null : DEFAULT_AVATAR);
      showError(error, t("uploadMessages.failed"));
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-1">
              <User className="inline h-4 w-4" />
              {t("labels.name")}
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("placeholders.name")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1">
              <Mail className="inline h-4 w-4" />
              {t("labels.email")}
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("placeholders.email")}
              required
            />
            <p className="text-xs text-muted-foreground">{t("helperText.emailWarning")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t("labels.phone")}</Label>
            <div className="flex rtl:flex-row-reverse gap-2">
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="+20">🇪🇬 +20</SelectItem>
                  <SelectItem value="+966">🇸🇦 +966</SelectItem>
                  <SelectItem value="+971">🇦🇪 +971</SelectItem>
                  <SelectItem value="+965">🇰🇼 +965</SelectItem>
                </SelectContent>
              </Select>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  const value = e.target.value.replaceAll(/\D/g, "");
                  setPhone(value);
                }}
                pattern="\d{7,15}"
                title="Phone number must be 7-15 digits"
                placeholder={t("placeholders.phone")}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("helperText.phone")}</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <User className="inline h-4 w-4" />
              {t("labels.profileImage")}
            </Label>
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Avatar className="h-14 w-14">
                <AvatarImage
                  src={isClient ? profileImage || profile?.image || undefined : DEFAULT_AVATAR}
                  alt="Profile avatar"
                />
                <AvatarFallback>{isClient ? getInitials(name) : "NB"}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{t("helperText.currentPhoto")}</p>
                {isClient && (
                  <div className="flex gap-2 mt-2">
                    <label htmlFor="profileImageInput">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 cursor-pointer"
                        disabled={isUploadingImage}
                        onClick={() => document.getElementById("profileImageInput")?.click()}
                      >
                        {isUploadingImage ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {t("buttons.changePhoto")}
                      </Button>
                    </label>
                    {profileImage && profileImage !== profile?.image && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setProfileImage(profile?.image || null)}
                      >
                        <X className="h-4 w-4" />
                        {t("buttons.reset")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <input
                id="profileImageInput"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isUploadingImage || !isClient}
                className="hidden"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setName(profile?.name || "");
                setEmail(profile?.email || "");
                setProfileImage(isClient ? profile?.image || null : DEFAULT_AVATAR);
                if (profile?.phone) {
                  const parts = profile.phone.split(" ");
                  if (parts.length > 1 && parts[0].startsWith("+")) {
                    setCountryCode(parts[0]);
                    setPhone(parts.slice(1).join(" "));
                  } else {
                    setPhone(profile.phone);
                  }
                } else {
                  setPhone("");
                  setCountryCode("+20");
                }
              }}
            >
              {t("buttons.reset")}
            </Button>
            <Button
              type="submit"
              disabled={updateProfile.isPending}
              className="flex items-center gap-2"
            >
              {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("buttons.saveChanges")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
