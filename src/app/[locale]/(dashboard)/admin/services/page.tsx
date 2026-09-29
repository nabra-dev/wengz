"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc/client";
import { Plus, Edit, ArrowUp, ArrowDown } from "lucide-react";
import { AttributesManager } from "@/components/admin/attributes-manager";
import type { ServiceAttribute } from "@/types/service-attributes";
import { toast } from "sonner";
import { LocalizedInput } from "@/components/ui/localized-input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { showError } from "@/lib/error-handler";

const EMOJI_LIST = [
  "🎨",
  "🔧",
  "💻",
  "📸",
  "✍️",
  "🎬",
  "🎵",
  "🎯",
  "🎓",
  "💼",
  "📊",
  "🏗️",
  "🌐",
  "📱",
  "🎪",
  "🎭",
  "📚",
  "📝",
  "🖼️",
  "🎸",
  "🎹",
  "🎤",
  "🎧",
  "📹",
  "📷",
  "🖌️",
  "🖍️",
  "✨",
  "🌟",
  "⭐",
  "💫",
  "🔆",
  "🎁",
  "🏆",
  "🥇",
  "🏅",
  "💎",
  "👑",
  "🎀",
  "💝",
  "🌹",
  "🌺",
  "🌸",
  "🌼",
  "🌻",
];

type StatusFilter = "all" | "active" | "inactive";

export default function AdminServicesPage() {
  const t = useTranslations("admin.services");
  const locale = useLocale();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIconField, setSelectedIconField] = useState<"create" | "edit" | null>(null);
  const [createAttributes, setCreateAttributes] = useState<ServiceAttribute[]>([]);
  const [editAttributes, setEditAttributes] = useState<ServiceAttribute[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  // Localized fields state for create/edit forms
  const [createNameI18n, setCreateNameI18n] = useState<{ en: string; ar: string }>({
    en: "",
    ar: "",
  });
  const [createDescI18n, setCreateDescI18n] = useState<{ en: string; ar: string }>({
    en: "",
    ar: "",
  });
  const [editNameI18n, setEditNameI18n] = useState<{ en: string; ar: string }>({ en: "", ar: "" });
  const [editDescI18n, setEditDescI18n] = useState<{ en: string; ar: string }>({ en: "", ar: "" });
  const [togglingServiceId, setTogglingServiceId] = useState<string | null>(null);

  const { data: services, isLoading } = trpc.admin.getServiceTypes.useQuery({
    status: statusFilter,
  });
  const utils = trpc.useUtils();

  const createService = trpc.admin.createServiceType.useMutation({
    onSuccess: () => {
      utils.admin.getServiceTypes.invalidate();
      setShowCreate(false);
      setSelectedIconField(null);
      setCreateAttributes([]);
    },
  });

  const updateService = trpc.admin.updateServiceType.useMutation({
    onSuccess: () => {
      utils.admin.getServiceTypes.invalidate();
      setEditingId(null);
      setSelectedIconField(null);
      setEditAttributes([]);
    },
  });

  const setServiceActive = trpc.admin.setServiceTypeActive.useMutation({
    onSuccess: (_data, variables) => {
      setTogglingServiceId(null);
      utils.admin.getServiceTypes.invalidate();
      toast.success(variables.isActive ? t("toast.activated") : t("toast.deactivated"));
    },
    onError: (error) => {
      setTogglingServiceId(null);
      showError(error, t("toast.statusFailed"));
    },
  });

  const reorderService = trpc.admin.reorderServiceType.useMutation({
    onSuccess: () => {
      void utils.admin.getServiceTypes.invalidate();
      void utils.request.getServiceTypes.invalidate();
    },
    onError: (error) => {
      showError(error, t("toast.reorderFailed"));
    },
  });

  const handleReorder = (id: string, direction: "up" | "down") => {
    if (reorderService.isPending) return;
    reorderService.mutate({ id, direction, status: statusFilter });
  };

  const extractFormData = (formData: FormData) => ({
    iconValue: formData.get("icon") as string,
    creditCostValue: formData.get("creditCost") as string,
    maxFreeRevisionsValue: formData.get("maxFreeRevisions") as string,
    paidRevisionCostValue: formData.get("paidRevisionCost") as string,
    resetFreeRevisionsOnPaidValue: formData.get("resetFreeRevisionsOnPaid") === "on",
    maxDeliveryMinutesValue: formData.get("maxDeliveryMinutes") as string,
    nameEn: (formData.get("name_en") as string) || "",
    nameAr: (formData.get("name_ar") as string) || "",
    descEn: (formData.get("description_en") as string) || "",
    descAr: (formData.get("description_ar") as string) || "",
  });

  const buildI18nObject = (en: string, ar: string) => {
    const obj: Record<string, string> = {};
    if (en) obj.en = en;
    if (ar) obj.ar = ar;
    return Object.keys(obj).length ? obj : undefined;
  };

  const buildMutationPayload = (
    data: ReturnType<typeof extractFormData>,
    attributes: ServiceAttribute[]
  ) => ({
    name: data.nameEn || data.nameAr,
    description: data.descEn || data.descAr || undefined,
    nameI18n: buildI18nObject(data.nameEn, data.nameAr),
    descriptionI18n: buildI18nObject(data.descEn, data.descAr),
    icon: data.iconValue || undefined,
    creditCost: data.creditCostValue ? Number.parseInt(data.creditCostValue, 10) : 1,
    maxFreeRevisions: data.maxFreeRevisionsValue
      ? Number.parseInt(data.maxFreeRevisionsValue, 10)
      : 3,
    paidRevisionCost: data.paidRevisionCostValue
      ? Number.parseInt(data.paidRevisionCostValue, 10)
      : 1,
    resetFreeRevisionsOnPaid: data.resetFreeRevisionsOnPaidValue,
    maxDeliveryMinutes: data.maxDeliveryMinutesValue
      ? Number.parseInt(data.maxDeliveryMinutesValue, 10)
      : 480,
    attributes: attributes.length > 0 ? attributes : undefined,
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = extractFormData(formData);
    createService.mutate(buildMutationPayload(data, createAttributes));
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>, id: string) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = extractFormData(formData);
    const basePayload = buildMutationPayload(data, editAttributes);
    updateService.mutate({
      ...basePayload,
      id,
      creditCost: data.creditCostValue ? Number.parseInt(data.creditCostValue, 10) : undefined,
      maxFreeRevisions: data.maxFreeRevisionsValue
        ? Number.parseInt(data.maxFreeRevisionsValue, 10)
        : undefined,
      paidRevisionCost: data.paidRevisionCostValue
        ? Number.parseInt(data.paidRevisionCostValue, 10)
        : undefined,
      maxDeliveryMinutes: data.maxDeliveryMinutesValue
        ? Number.parseInt(data.maxDeliveryMinutesValue, 10)
        : undefined,
    });
  };

  const handleSelectEmoji = (emoji: string) => {
    const iconInput = document.querySelector(
      selectedIconField === "create" ? "#create-icon" : "#edit-icon"
    ) as HTMLInputElement;
    if (iconInput) {
      iconInput.value = emoji;
      iconInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setSelectedIconField(null);
  };

  const handleResetCreateForm = () => {
    setShowCreate(false);
    setSelectedIconField(null);
    setCreateAttributes([]);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSelectedIconField(null);
    setEditAttributes([]);
  };

  const handleEditClick = (service: any) => {
    setEditingId(service.id);
    setEditAttributes(service.attributes || []);
    // Initialize localized edit state from service
    const nameEn = service.nameI18n?.en || service.name || "";
    const nameAr = service.nameI18n?.ar || "";
    const descEn = service.descriptionI18n?.en || service.description || "";
    const descAr = service.descriptionI18n?.ar || "";
    setEditNameI18n({ en: nameEn, ar: nameAr });
    setEditDescI18n({ en: descEn, ar: descAr });
  };

  const renderServiceEditForm = (service: any) => (
    <form
      key={service.id}
      onSubmit={(e) => handleUpdate(e, service.id)}
      className="p-4 rounded-lg border space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>{t("fields.iconOptional")}</Label>
          <div className="flex gap-2">
            <Input
              id="edit-icon"
              name="icon"
              defaultValue={service.icon || ""}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedIconField(selectedIconField === "edit" ? null : "edit")}
            >
              {selectedIconField === "edit" ? t("buttons.hide") : t("buttons.pick")}
            </Button>
          </div>
          {selectedIconField === "edit" && (
            <div className="mt-2 p-3 border rounded-lg bg-muted">
              <div className="grid grid-cols-6 gap-2">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`Select icon ${emoji}`}
                    className="text-2xl hover:bg-background p-2 rounded transition-colors"
                    onClick={() => handleSelectEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>{t("fields.localizedName")}</Label>
          <LocalizedInput
            id="edit-service-name"
            label={t("fields.localizedName")}
            value={editNameI18n}
            onChange={(next) => setEditNameI18n({ en: next.en || "", ar: next.ar || "" })}
            required
            variant="input"
          />
          {/* Hidden inputs to keep existing form extraction */}
          <input type="hidden" name="name_en" value={editNameI18n.en} />
          <input type="hidden" name="name_ar" value={editNameI18n.ar} />
        </div>
        <div className="space-y-2 md:col-span-3">
          <Label>{t("fields.localizedDescription")}</Label>
          <LocalizedInput
            id="edit-service-description"
            label={t("fields.localizedDescription")}
            value={editDescI18n}
            onChange={(next) => setEditDescI18n({ en: next.en || "", ar: next.ar || "" })}
            variant="input"
          />
          <input type="hidden" name="description_en" value={editDescI18n.en} />
          <input type="hidden" name="description_ar" value={editDescI18n.ar} />
        </div>
      </div>

      {/* Revision Settings for Edit */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>{t("fields.creditCost")}</Label>
          <Input
            name="creditCost"
            type="number"
            min="1"
            defaultValue={service.creditCost || 1}
            required
          />
          <p className="text-xs text-muted-foreground">{t("fields.creditCostHint")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`maxFreeRevisions-${service.id}`}>{t("fields.maxFreeRevisions")}</Label>
          <Input
            id={`maxFreeRevisions-${service.id}`}
            name="maxFreeRevisions"
            type="number"
            min="0"
            defaultValue={service.maxFreeRevisions ?? 3}
            required
          />
          <p className="text-xs text-muted-foreground">{t("fields.maxFreeRevisionsHint")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`paidRevisionCost-${service.id}`}>{t("fields.paidRevisionCost")}</Label>
          <Input
            id={`paidRevisionCost-${service.id}`}
            name="paidRevisionCost"
            type="number"
            min="1"
            defaultValue={service.paidRevisionCost ?? 1}
            required
          />
          <p className="text-xs text-muted-foreground">{t("fields.paidRevisionCostHint")}</p>
          <div className="flex items-center gap-2 mt-2">
            <input
              id={`resetFreeRevisionsOnPaid-${service.id}`}
              name="resetFreeRevisionsOnPaid"
              type="checkbox"
              defaultChecked={service.resetFreeRevisionsOnPaid ?? true}
              className="h-4 w-4"
            />
            <Label htmlFor={`resetFreeRevisionsOnPaid-${service.id}`}>
              {t("fields.resetFreeRevisionsOnPaid")}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("fields.resetFreeRevisionsOnPaidHint")}
          </p>
        </div>
      </div>

      {/* Max Delivery for Edit */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`maxDeliveryMinutes-${service.id}`}>
            {t("fields.maxDeliveryMinutes")}
          </Label>
          <Input
            id={`maxDeliveryMinutes-${service.id}`}
            name="maxDeliveryMinutes"
            type="number"
            min="15"
            defaultValue={service.maxDeliveryMinutes ?? 480}
            required
          />
          <p className="text-xs text-muted-foreground">{t("fields.maxDeliveryMinutesHint")}</p>
        </div>
      </div>

      {/* Attributes Manager for Edit */}
      <AttributesManager attributes={editAttributes} onChange={setEditAttributes} />

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit}>
          {t("buttons.cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={updateService.isPending}>
          {t("buttons.save")}
        </Button>
      </div>
    </form>
  );

  const renderServiceDisplay = (service: any, index: number, total: number) => (
    <div key={service.id} className="flex items-center justify-between p-4 rounded-lg border gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={index === 0 || reorderService.isPending}
            onClick={() => handleReorder(service.id, "up")}
            title={t("buttons.moveUp")}
            aria-label={t("buttons.moveUp")}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={index === total - 1 || reorderService.isPending}
            onClick={() => handleReorder(service.id, "down")}
            title={t("buttons.moveDown")}
            aria-label={t("buttons.moveDown")}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
        {service.icon && <span className="text-2xl shrink-0">{service.icon}</span>}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">
              {resolveLocalizedText((service as any).nameI18n, locale, service.name)}
            </p>
            <Badge variant={service.isActive ? "default" : "secondary"}>
              {service.isActive ? t("badges.active") : t("badges.inactive")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {resolveLocalizedText((service as any).descriptionI18n, locale, service.description)}
          </p>
          <div className="flex gap-3 mt-1 flex-wrap">
            {service.attributes && service.attributes.length > 0 && (
              <p className="text-xs text-muted-foreground">
                📋 {service.attributes.length}{" "}
                {service.attributes.length === 1
                  ? t("display.questionLabel")
                  : t("display.questionsLabel")}
              </p>
            )}
            <p className="text-xs font-medium text-primary">
              💳 {service.creditCost || 1}{" "}
              {(service.creditCost || 1) === 1
                ? t("display.creditLabel")
                : t("display.creditsLabel")}
            </p>
            <p className="text-xs text-muted-foreground">
              🔄 {service.maxFreeRevisions ?? 3} {t("info.freeRevisions")}{" "}
              {service.paidRevisionCost ?? 1}{" "}
              {(service.paidRevisionCost || 1) === 1
                ? t("display.creditLabel")
                : t("display.creditsLabel")}{" "}
              {t("info.perRevision")}
            </p>
            <p className="text-xs text-muted-foreground">
              {service.resetFreeRevisionsOnPaid ? (
                <span className="text-xs text-green-600">♻️ {t("display.resetsOnPaid")}</span>
              ) : (
                <span className="text-xs text-red-600">❌ {t("display.noResetOnPaid")}</span>
              )}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEditClick(service)}
          className="flex items-center gap-1"
        >
          <Edit className="h-3 w-3" />
          {t("buttons.edit")}
        </Button>
        <div className="flex items-center gap-2">
          <Label
            htmlFor={`service-active-${service.id}`}
            className="text-sm text-muted-foreground cursor-pointer"
          >
            {service.isActive ? t("badges.active") : t("badges.inactive")}
          </Label>
          <Switch
            id={`service-active-${service.id}`}
            checked={service.isActive}
            disabled={togglingServiceId === service.id}
            onCheckedChange={(checked: boolean) => {
              setTogglingServiceId(service.id);
              setServiceActive.mutate({ id: service.id, isActive: checked });
            }}
          />
        </div>
      </div>
    </div>
  );

  const renderServiceItem = (service: any, index: number, total: number) => {
    return editingId === service.id
      ? renderServiceEditForm(service)
      : renderServiceDisplay(service, index, total);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t("addServiceType")}
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card>
          <form onSubmit={handleCreate}>
            <CardHeader>
              <CardTitle>{t("createServiceType")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="create-icon">{t("fields.iconOptional")}</Label>
                  <div className="flex gap-2">
                    <Input id="create-icon" name="icon" placeholder="🎨" className="flex-1" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setSelectedIconField(selectedIconField === "create" ? null : "create")
                      }
                    >
                      {selectedIconField === "create" ? t("buttons.hide") : t("buttons.pick")}
                    </Button>
                  </div>
                  {selectedIconField === "create" && (
                    <div className="mt-2 p-3 border rounded-lg bg-muted">
                      <div className="grid grid-cols-6 gap-2">
                        {EMOJI_LIST.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            aria-label={`Select icon ${emoji}`}
                            className="text-2xl hover:bg-background p-2 rounded transition-colors"
                            onClick={() => handleSelectEmoji(emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t("fields.localizedName")}</Label>
                  <LocalizedInput
                    id="create-service-name"
                    label={t("fields.localizedName")}
                    value={createNameI18n}
                    onChange={(next) => setCreateNameI18n({ en: next.en || "", ar: next.ar || "" })}
                    required
                    variant="input"
                  />
                  <input type="hidden" name="name_en" value={createNameI18n.en} />
                  <input type="hidden" name="name_ar" value={createNameI18n.ar} />
                  <p className="text-xs text-muted-foreground">{t("fields.nameHint")}</p>
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label>{t("fields.localizedDescription")}</Label>
                  <LocalizedInput
                    id="create-service-description"
                    label={t("fields.localizedDescription")}
                    value={createDescI18n}
                    onChange={(next) => setCreateDescI18n({ en: next.en || "", ar: next.ar || "" })}
                    variant="input"
                  />
                  <input type="hidden" name="description_en" value={createDescI18n.en} />
                  <input type="hidden" name="description_ar" value={createDescI18n.ar} />
                  <p className="text-xs text-muted-foreground">{t("fields.descriptionHint")}</p>
                </div>
              </div>

              {/* Revision Settings */}
              <div className="grid gap-4 md:grid-cols-3">
                {/* Credit Cost */}
                <div className="space-y-2">
                  <Label htmlFor="creditCost">{t("fields.creditCostRequired")}</Label>
                  <Input
                    id="creditCost"
                    name="creditCost"
                    type="number"
                    min="1"
                    defaultValue="1"
                    required
                  />
                  <p className="text-xs text-muted-foreground">{t("fields.creditCostHint")}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxFreeRevisions">{t("fields.maxFreeRevisions")}</Label>
                  <Input
                    id="maxFreeRevisions"
                    name="maxFreeRevisions"
                    type="number"
                    min="0"
                    defaultValue="3"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("fields.maxFreeRevisionsHint")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paidRevisionCost">{t("fields.paidRevisionCost")}</Label>
                  <Input
                    id="paidRevisionCost"
                    name="paidRevisionCost"
                    type="number"
                    min="1"
                    defaultValue="1"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("fields.paidRevisionCostHint")}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      id="resetFreeRevisionsOnPaid"
                      name="resetFreeRevisionsOnPaid"
                      type="checkbox"
                      defaultChecked={true}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="resetFreeRevisionsOnPaid">
                      {t("fields.resetFreeRevisionsOnPaid")}
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("fields.resetFreeRevisionsOnPaidHint")}
                  </p>
                </div>
              </div>

              {/* Max Delivery */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="maxDeliveryMinutes">{t("fields.maxDeliveryMinutes")}</Label>
                  <Input
                    id="maxDeliveryMinutes"
                    name="maxDeliveryMinutes"
                    type="number"
                    min="15"
                    defaultValue="480"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("fields.maxDeliveryMinutesHint")}
                  </p>
                </div>
              </div>

              {/* Attributes Manager */}
              <AttributesManager attributes={createAttributes} onChange={setCreateAttributes} />
            </CardContent>
            <CardFooter className="gap-2">
              <Button type="button" variant="outline" onClick={handleResetCreateForm}>
                {t("buttons.cancel")}
              </Button>
              <Button type="submit" disabled={createService.isPending}>
                {createService.isPending ? t("buttons.creating") : t("buttons.create")}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Services List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("allServiceTypes")}</CardTitle>
          <CardDescription>
            {services?.length || 0} {t("info.serviceTypes")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            className="w-full"
          >
            <TabsList className="mb-4">
              <TabsTrigger value="all">{t("filters.all")}</TabsTrigger>
              <TabsTrigger value="active">{t("filters.active")}</TabsTrigger>
              <TabsTrigger value="inactive">{t("filters.inactive")}</TabsTrigger>
            </TabsList>
            <TabsContent value={statusFilter}>
              {isLoading && (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              )}
              {!isLoading && services?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {statusFilter === "inactive" ? t("noInactiveServices") : t("noServiceTypes")}
                </div>
              )}
              {!isLoading && (services?.length ?? 0) > 0 && (
                <div className="space-y-4">
                  {services?.map((service: any, index: number) =>
                    renderServiceItem(service, index, services.length)
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
