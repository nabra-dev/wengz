"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";
import { emailSchema, phoneNumberOnlySchema } from "@/lib/validations";
import {
  ASSIGNABLE_ROLES,
  getRoleChangeBlockReason,
  type AssignableRole,
} from "@/lib/roles";
import { toast } from "sonner";
import { Loader2, User, Mail } from "lucide-react";

type EditableUser = {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
  role: string;
  clientRequestCount: number;
  providerRequestCount: number;
};

interface EditUserDialogProps {
  readonly user: EditableUser | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess?: () => void;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: Readonly<EditUserDialogProps>) {
  const t = useTranslations("admin.users");
  const tCommon = useTranslations("common");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+20");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AssignableRole>("CLIENT");

  const updateUser = trpc.admin.updateUser.useMutation();

  useEffect(() => {
    if (!user) return;
    queueMicrotask(() => {
      setName(user.name || "");
      setEmail(user.email);
      setRole(
        ASSIGNABLE_ROLES.includes(user.role as AssignableRole)
          ? (user.role as AssignableRole)
          : "CLIENT"
      );

      const rawPhone = user.phone;
      if (rawPhone) {
        const parts = rawPhone.split(" ");
        if (parts.length > 1 && parts[0].startsWith("+")) {
          setCountryCode(parts[0]);
          setPhone(parts.slice(1).join(" "));
        } else {
          setPhone(rawPhone);
        }
      } else {
        setPhone("");
        setCountryCode("+20");
      }
    });
  }, [user]);

  const roleHint = useMemo(() => {
    if (!user) return null;
    return getRoleChangeBlockReason({
      currentRole: user.role,
      newRole: role,
      clientRequestCount: user.clientRequestCount,
      providerRequestCount: user.providerRequestCount,
    });
  }, [user, role]);

  const isRoleOptionDisabled = (option: AssignableRole) => {
    if (!user || option === user.role) return false;
    return Boolean(
      getRoleChangeBlockReason({
        currentRole: user.role,
        newRole: option,
        clientRequestCount: user.clientRequestCount,
        providerRequestCount: user.providerRequestCount,
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (roleHint) {
      toast.error(roleHint);
      return;
    }

    try {
      const updates: {
        name?: string;
        email?: string;
        phone?: string;
        role?: AssignableRole;
      } = {};

      if (name !== user.name) {
        updates.name = name;
      }

      if (email !== user.email) {
        const emailValidation = emailSchema.safeParse(email);
        if (!emailValidation.success) {
          toast.error(
            emailValidation.error.errors[0]?.message ||
              t("dialog.validation.invalidEmail") ||
              "Invalid email"
          );
          return;
        }
        updates.email = email.toLowerCase().trim();
      }

      let composedPhone: string | undefined = undefined;
      if (phone) {
        const phoneValidation = phoneNumberOnlySchema.safeParse(phone);
        if (!phoneValidation.success) {
          toast.error(
            phoneValidation.error.errors[0]?.message ||
              t("dialog.validation.invalidPhone") ||
              "Invalid phone"
          );
          return;
        }
        composedPhone = `${countryCode} ${phone}`;
      }
      if (composedPhone && composedPhone !== user.phone) {
        updates.phone = composedPhone;
      }

      if (role !== user.role) {
        updates.role = role;
      }

      if (Object.keys(updates).length === 0) {
        onOpenChange(false);
        return;
      }

      await updateUser.mutateAsync({
        userId: user.id,
        ...updates,
      });

      toast.success(t("dialog.toast.updated"));
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("dialog.toast.error");
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("dialog.edit.title")}</DialogTitle>
          <DialogDescription>{t("dialog.edit.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="flex items-center gap-1">
              <User className="inline h-4 w-4" />
              {t("dialog.fields.name")}
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("dialog.fields.name")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email" className="flex items-center gap-1">
              <Mail className="inline h-4 w-4" />
              {t("dialog.fields.email")}
            </Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("dialog.fields.email")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">{t("dialog.fields.phone")}</Label>
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
                id="edit-phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  const value = e.target.value.replaceAll(/\D/g, "");
                  setPhone(value);
                }}
                pattern="\d{7,15}"
                title="Phone number must be 7-15 digits"
                placeholder="123456789"
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role">{t("dialog.fields.role")}</Label>
            <Select
              value={role}
              onValueChange={(value: AssignableRole) => setRole(value)}
            >
              <SelectTrigger id="edit-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                    disabled={isRoleOptionDisabled(option)}
                  >
                    {tCommon(`roles.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {roleHint ? (
              <p className="text-xs text-destructive">{roleHint}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t("dialog.edit.roleHint")}</p>
            )}
          </div>

          <DialogFooter>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateUser.isPending}
              >
                {t("dialog.buttons.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={updateUser.isPending || Boolean(roleHint)}
                className="flex items-center gap-2"
              >
                {updateUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("dialog.buttons.update")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
