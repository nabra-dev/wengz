"use client";

import { useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
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
import { useFormatCurrency } from "@/hooks/use-format-currency";
import { Plus, Edit, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { showError } from "@/lib/error-handler";
import { LocalizedInput } from "@/components/ui/localized-input";

type StatusFilter = "all" | "active" | "inactive";

export default function AdminPackagesPage() {
  const t = useTranslations("admin.packages");
  const locale = useLocale();
  const formatCurrency = useFormatCurrency();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [createSupportAllServices, setCreateSupportAllServices] = useState(false);
  const [createIsFeatured, setCreateIsFeatured] = useState(false);
  const [editSupportAllServices, setEditSupportAllServices] = useState(false);
  const [editIsFeatured, setEditIsFeatured] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  // Localized inputs state
  const [createNameI18n, setCreateNameI18n] = useState<{ en: string; ar: string }>({
    en: "",
    ar: "",
  });
  const [createDescI18n, setCreateDescI18n] = useState<{ en: string; ar: string }>({
    en: "",
    ar: "",
  });
  const [createFeaturesI18n, setCreateFeaturesI18n] = useState<{ en: string; ar: string }>({
    en: "",
    ar: "",
  });
  const [editNameI18n, setEditNameI18n] = useState<{ en: string; ar: string }>({ en: "", ar: "" });
  const [editDescI18n, setEditDescI18n] = useState<{ en: string; ar: string }>({ en: "", ar: "" });
  const [editFeaturesI18n, setEditFeaturesI18n] = useState<{ en: string; ar: string }>({
    en: "",
    ar: "",
  });
  const [togglingPackageId, setTogglingPackageId] = useState<string | null>(null);

  const { data: packages, isLoading } = trpc.admin.getPackages.useQuery({
    status: statusFilter,
  });
  const { data: allServices } = trpc.admin.getServiceTypes.useQuery({ status: "all" });
  const utils = trpc.useUtils();

  const createPackage = trpc.admin.createPackage.useMutation({
    onSuccess: () => {
      utils.admin.getPackages.invalidate();
      setShowCreate(false);
      setSelectedServiceIds([]);
      setCreateSupportAllServices(false);
      setCreateIsFeatured(false);
      setCreateNameI18n({ en: "", ar: "" });
      setCreateDescI18n({ en: "", ar: "" });
      setCreateFeaturesI18n({ en: "", ar: "" });
      toast.success(t("toast.created"));
    },
    onError: (error) => {
      showError(error, t("toast.createFailed"));
    },
  });

  const updatePackage = trpc.admin.updatePackage.useMutation({
    onSuccess: () => {
      utils.admin.getPackages.invalidate();
      setEditingId(null);
      setSelectedServiceIds([]);
      setEditSupportAllServices(false);
      setEditIsFeatured(false);
      toast.success(t("toast.updated"));
    },
    onError: (error) => {
      showError(error, t("toast.updateFailed"));
    },
  });

  const setPackageActive = trpc.admin.setPackageActive.useMutation({
    onSuccess: (_data, variables) => {
      setTogglingPackageId(null);
      utils.admin.getPackages.invalidate();
      toast.success(variables.isActive ? t("toast.activated") : t("toast.deactivated"));
    },
    onError: (error) => {
      setTogglingPackageId(null);
      showError(error, t("toast.statusFailed"));
    },
  });
  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nameEn = (formData.get("name_en") as string) || "";
    const nameAr = (formData.get("name_ar") as string) || "";
    const descEn = (formData.get("description_en") as string) || "";
    const descAr = (formData.get("description_ar") as string) || "";
    const featuresEn = (createFeaturesI18n.en || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const featuresAr = (createFeaturesI18n.ar || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const nameI18n: Record<string, string> = {};
    if (nameEn) nameI18n.en = nameEn;
    if (nameAr) nameI18n.ar = nameAr;
    const descriptionI18n: Record<string, string> = {};
    if (descEn) descriptionI18n.en = descEn;
    if (descAr) descriptionI18n.ar = descAr;
    const featuresI18n: Record<string, string[]> = {};
    if (featuresEn.length) featuresI18n.en = featuresEn;
    if (featuresAr.length) featuresI18n.ar = featuresAr;

    const credits = Number.parseInt(formData.get("credits") as string, 10);
    const price = Number.parseFloat(formData.get("price") as string);
    const durationDays = Number.parseInt(formData.get("durationDays") as string, 10);
    if (!Number.isFinite(credits) || credits < 1) {
      toast.error(t("toast.invalidCredits"));
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error(t("toast.invalidPrice"));
      return;
    }
    if (!Number.isFinite(durationDays) || durationDays < 1) {
      toast.error(t("toast.invalidDuration"));
      return;
    }

    createPackage.mutate({
      name: nameEn || nameAr,
      nameI18n: Object.keys(nameI18n).length ? nameI18n : undefined,
      price,
      credits,
      durationDays,
      description: descEn || descAr || undefined,
      descriptionI18n: Object.keys(descriptionI18n).length ? descriptionI18n : undefined,
      features: featuresEn,
      featuresI18n: Object.keys(featuresI18n).length ? featuresI18n : undefined,
      supportAllServices: createSupportAllServices,
      isFeatured: createIsFeatured,
      serviceIds: selectedServiceIds,
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>, id: string) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nameEn = (formData.get("name_en") as string) || "";
    const nameAr = (formData.get("name_ar") as string) || "";
    const descEn = (formData.get("description_en") as string) || "";
    const descAr = (formData.get("description_ar") as string) || "";
    const featuresEn = (editFeaturesI18n.en || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const featuresAr = (editFeaturesI18n.ar || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const nameI18n: Record<string, string> = {};
    if (nameEn) nameI18n.en = nameEn;
    if (nameAr) nameI18n.ar = nameAr;
    const descriptionI18n: Record<string, string> = {};
    if (descEn) descriptionI18n.en = descEn;
    if (descAr) descriptionI18n.ar = descAr;
    const featuresI18n: Record<string, string[]> = {};
    if (featuresEn.length) featuresI18n.en = featuresEn;
    if (featuresAr.length) featuresI18n.ar = featuresAr;

    const credits = Number.parseInt(formData.get("credits") as string, 10);
    const price = Number.parseFloat(formData.get("price") as string);
    if (!Number.isFinite(credits) || credits < 1) {
      toast.error(t("toast.invalidCredits"));
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error(t("toast.invalidPrice"));
      return;
    }

    updatePackage.mutate({
      id,
      name: nameEn || nameAr || undefined,
      nameI18n: Object.keys(nameI18n).length ? nameI18n : undefined,
      price,
      credits,
      description: descEn || descAr || undefined,
      descriptionI18n: Object.keys(descriptionI18n).length ? descriptionI18n : undefined,
      features: featuresEn,
      featuresI18n: Object.keys(featuresI18n).length ? featuresI18n : undefined,
      supportAllServices: editSupportAllServices,
      isFeatured: editIsFeatured,
      serviceIds: selectedServiceIds,
    });
  };

  const toggleService = useCallback((serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  }, []);

  const handleCancelCreate = useCallback(() => {
    setShowCreate(false);
    setSelectedServiceIds([]);
    setCreateSupportAllServices(false);
    setCreateIsFeatured(false);
    setCreateNameI18n({ en: "", ar: "" });
    setCreateDescI18n({ en: "", ar: "" });
    setCreateFeaturesI18n({ en: "", ar: "" });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setSelectedServiceIds([]);
    setEditSupportAllServices(false);
    setEditIsFeatured(false);
  }, []);

  const handleEditPackage = useCallback((pkg: any) => {
    setEditingId(pkg.id);
    setSelectedServiceIds(pkg.services?.map((s: any) => s.serviceType.id) || []);
    setEditSupportAllServices(pkg.supportAllServices || false);
    setEditIsFeatured(!!pkg.isFeatured);
    setEditNameI18n({
      en: (pkg as any).nameI18n?.en || pkg.name || "",
      ar: (pkg as any).nameI18n?.ar || "",
    });
    setEditDescI18n({
      en: (pkg as any).descriptionI18n?.en || (pkg as any).description || "",
      ar: (pkg as any).descriptionI18n?.ar || "",
    });
    setEditFeaturesI18n({
      en: (pkg as any).featuresI18n?.en?.join("\n") || pkg.features?.join("\n") || "",
      ar: (pkg as any).featuresI18n?.ar?.join("\n") || "",
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t("addPackage")}
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card>
          <form onSubmit={handleCreate}>
            <CardHeader>
              <CardTitle>{t("createNewPackage")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>{t("fields.localizedName")}</Label>
                  <LocalizedInput
                    id="create-package-name"
                    label={t("fields.localizedName")}
                    value={createNameI18n}
                    onChange={(val) => setCreateNameI18n(val as { en: string; ar: string })}
                    required
                    variant="input"
                  />
                  <input type="hidden" name="name_en" value={createNameI18n.en} />
                  <input type="hidden" name="name_ar" value={createNameI18n.ar} />
                  <p className="text-xs text-muted-foreground">{t("fields.nameHint")}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">{t("fields.priceRequired")}</Label>
                  <Input id="price" name="price" type="number" step="0.01" min="0" required />
                  <p className="text-xs text-muted-foreground">{t("fields.priceHint")}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credits">{t("fields.creditsRequired")}</Label>
                  <Input id="credits" name="credits" type="number" min="1" required />
                  <p className="text-xs text-muted-foreground">{t("fields.creditsHint")}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="durationDays">{t("fields.durationRequired")}</Label>
                  <Input
                    id="durationDays"
                    name="durationDays"
                    type="number"
                    min="1"
                    defaultValue="30"
                    required
                  />
                  <p className="text-xs text-muted-foreground">{t("fields.durationHint")}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("fields.localizedDescription")}</Label>
                <LocalizedInput
                  id="create-package-description"
                  label={t("fields.localizedDescription")}
                  value={createDescI18n}
                  onChange={(val) => setCreateDescI18n(val as { en: string; ar: string })}
                  variant="textarea"
                />
                <input type="hidden" name="description_en" value={createDescI18n.en} />
                <input type="hidden" name="description_ar" value={createDescI18n.ar} />
              </div>

              <div className="space-y-2">
                <Label>{t("fields.localizedFeatures")}</Label>
                <LocalizedInput
                  id="create-package-features"
                  label={t("fields.localizedFeatures")}
                  value={createFeaturesI18n}
                  onChange={(val) => setCreateFeaturesI18n(val as { en: string; ar: string })}
                  variant="textarea"
                  placeholder={t("fields.featuresPlaceholder")}
                />
                <input type="hidden" name="features_en" value={createFeaturesI18n.en} />
                <input type="hidden" name="features_ar" value={createFeaturesI18n.ar} />
                <p className="text-xs text-muted-foreground">{t("fields.featuresHint")}</p>
              </div>

              <div className="flex items-center gap-3 border rounded-lg p-4 bg-muted/50">
                <Checkbox
                  id="support-all-services"
                  checked={createSupportAllServices}
                  onCheckedChange={(checked: boolean) =>
                    setCreateSupportAllServices(checked as boolean)
                  }
                />
                <Label htmlFor="support-all-services" className="cursor-pointer font-medium flex-1">
                  {t("fields.supportAllServices") || "Support All Services"}
                </Label>
              </div>

              <div className="flex items-center gap-3 border rounded-lg p-4 bg-muted/50">
                <Checkbox
                  id="create-is-featured"
                  checked={createIsFeatured}
                  onCheckedChange={(checked: boolean) => setCreateIsFeatured(checked as boolean)}
                />
                <Label htmlFor="create-is-featured" className="cursor-pointer font-medium flex-1">
                  {t("fields.isFeatured")}
                </Label>
              </div>

              <div className="space-y-2">
                <Label>{t("fields.includedServices")}</Label>
                <div
                  className={`grid gap-3 md:grid-cols-2 border rounded-lg p-4 ${createSupportAllServices ? "opacity-50 pointer-events-none" : ""}`}
                >
                  {allServices?.map((service: any) => (
                    <div key={service.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`service-${service.id}`}
                        checked={selectedServiceIds.includes(service.id)}
                        onCheckedChange={() => toggleService(service.id)}
                        disabled={createSupportAllServices}
                      />
                      <Label
                        htmlFor={`service-${service.id}`}
                        className="cursor-pointer font-normal"
                      >
                        {service.icon} {service.nameI18n?.[locale] || service.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button type="button" variant="outline" onClick={handleCancelCreate}>
                {t("buttons.cancel")}
              </Button>
              <Button type="submit" disabled={createPackage.isPending}>
                {createPackage.isPending ? t("buttons.creating") : t("buttons.create")}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Packages List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("allPackages")}</CardTitle>
          <CardDescription>
            {packages?.length || 0} {t("info.packages")}
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
              <div className="grid gap-6 md:grid-cols-3">
                {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}
                {!isLoading && (!packages || packages.length === 0) && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">
                      {statusFilter === "inactive" ? t("noInactivePackages") : t("noPackagesYet")}
                    </p>
                    <p className="text-sm">
                      {statusFilter === "inactive" ? t("inactiveWillAppear") : t("createFirst")}
                    </p>
                  </div>
                )}
                {!isLoading &&
                  packages &&
                  packages.length > 0 &&
                  packages.map((pkg: any) =>
                    editingId === pkg.id ? (
                      <Card key={pkg.id}>
                        <form onSubmit={(e) => handleUpdate(e, pkg.id)}>
                          <CardHeader>
                            <div className="space-y-2">
                              <Label>{t("fields.localizedName")}</Label>
                              <LocalizedInput
                                id={`edit-package-name-${pkg.id}`}
                                label={t("fields.localizedName")}
                                value={editNameI18n}
                                onChange={(val) =>
                                  setEditNameI18n(val as { en: string; ar: string })
                                }
                                variant="input"
                              />
                              <input type="hidden" name="name_en" value={editNameI18n.en} />
                              <input type="hidden" name="name_ar" value={editNameI18n.ar} />
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <Label>{t("fields.price")}</Label>
                              <Input
                                name="price"
                                type="number"
                                step="0.01"
                                defaultValue={pkg.price}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("fields.creditsRequired")}</Label>
                              <Input
                                name="credits"
                                type="number"
                                min={1}
                                step={1}
                                required
                                defaultValue={pkg.credits}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("fields.localizedDescription")}</Label>
                              <LocalizedInput
                                id={`edit-package-description-${pkg.id}`}
                                label={t("fields.localizedDescription")}
                                value={editDescI18n}
                                onChange={(val) =>
                                  setEditDescI18n(val as { en: string; ar: string })
                                }
                                variant="textarea"
                              />
                              <input type="hidden" name="description_en" value={editDescI18n.en} />
                              <input type="hidden" name="description_ar" value={editDescI18n.ar} />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("fields.localizedFeatures")}</Label>
                              <LocalizedInput
                                id={`edit-package-features-${pkg.id}`}
                                label={t("fields.localizedFeatures")}
                                value={editFeaturesI18n}
                                onChange={(val) =>
                                  setEditFeaturesI18n(val as { en: string; ar: string })
                                }
                                variant="textarea"
                                placeholder={t("fields.featuresPlaceholder")}
                              />
                              <input type="hidden" name="features_en" value={editFeaturesI18n.en} />
                              <input type="hidden" name="features_ar" value={editFeaturesI18n.ar} />
                              <p className="text-xs text-muted-foreground">
                                {t("fields.featuresHint")}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 border rounded-lg p-4 bg-muted/50">
                              <Checkbox
                                id="edit-support-all-services"
                                checked={editSupportAllServices}
                                onCheckedChange={(checked: boolean) =>
                                  setEditSupportAllServices(checked as boolean)
                                }
                              />
                              <Label
                                htmlFor="edit-support-all-services"
                                className="cursor-pointer font-medium flex-1"
                              >
                                {t("fields.supportAllServices") || "Support All Services"}
                              </Label>
                            </div>

                            <div className="flex items-center gap-3 border rounded-lg p-4 bg-muted/50">
                              <Checkbox
                                id="edit-is-featured"
                                checked={editIsFeatured}
                                onCheckedChange={(checked: boolean) =>
                                  setEditIsFeatured(checked as boolean)
                                }
                              />
                              <Label
                                htmlFor="edit-is-featured"
                                className="cursor-pointer font-medium flex-1"
                              >
                                {t("fields.isFeatured")}
                              </Label>
                            </div>

                            <div className="space-y-2">
                              <Label>{t("fields.includedServices")}</Label>
                              <div
                                className={`grid gap-3 md:grid-cols-2 border rounded-lg p-4 ${editSupportAllServices ? "opacity-50 pointer-events-none" : ""}`}
                              >
                                {allServices?.map((service: any) => (
                                  <div key={service.id} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`edit-service-${service.id}`}
                                      checked={selectedServiceIds.includes(service.id)}
                                      onCheckedChange={() => toggleService(service.id)}
                                      disabled={editSupportAllServices}
                                    />
                                    <Label
                                      htmlFor={`edit-service-${service.id}`}
                                      className="cursor-pointer font-normal"
                                    >
                                      {service.icon}{" "}
                                      {(service as any).nameI18n?.[locale] || service.name}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                          <CardFooter className="gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleCancelEdit}
                            >
                              {t("buttons.cancel")}
                            </Button>
                            <Button type="submit" size="sm" disabled={updatePackage.isPending}>
                              {t("buttons.save")}
                            </Button>
                          </CardFooter>
                        </form>
                      </Card>
                    ) : (
                      <Card key={pkg.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {pkg.isFeatured && (
                                  <Badge className="border-0 bg-[#690DD4] text-[#E0F840] hover:opacity-95">
                                    {t("badges.featured")}
                                  </Badge>
                                )}
                                <Badge variant={pkg.isActive ? "default" : "secondary"}>
                                  {pkg.isActive ? t("badges.active") : t("badges.inactive")}
                                </Badge>
                              </div>
                              <CardTitle>{pkg.nameI18n?.[locale] || pkg.name}</CardTitle>
                            </div>
                            <Package className="h-5 w-5 shrink-0 text-muted-foreground" />
                          </div>
                          <CardDescription>
                            <span className="text-2xl font-bold text-foreground">
                              {formatCurrency(pkg.price)}
                            </span>{" "}
                            / {pkg.durationDays} {t("info.dayDuration")}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            <li>
                              {pkg.credits} {t("info.credits")}
                            </li>
                            {(pkg.featuresI18n?.[locale] || pkg.features).map(
                              (feature: string, i: number) => (
                                <li
                                  key={`${pkg.id}-feature-${i}`}
                                  className="text-muted-foreground"
                                >
                                  • {feature}
                                </li>
                              )
                            )}
                          </ul>

                          {pkg.supportAllServices && (
                            <div className="mt-4 pt-4 border-t">
                              <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                ✓ {t("fields.supportsAllServices") || "Supports All Services"}
                              </Badge>
                            </div>
                          )}

                          {pkg.services && pkg.services.length > 0 && !pkg.supportAllServices && (
                            <div className="mt-4 pt-4 border-t">
                              <p className="text-sm font-medium mb-2">
                                {t("info.includedServicesLabel")}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {pkg.services.map((ps: any) => (
                                  <Badge
                                    key={ps.serviceType.id}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {ps.serviceType.icon}{" "}
                                    {(ps.serviceType as any).nameI18n?.[locale] ||
                                      ps.serviceType.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {(!pkg.services || pkg.services.length === 0) &&
                            !pkg.supportAllServices && (
                              <div className="mt-4 pt-4 border-t">
                                <p className="text-sm text-muted-foreground italic">
                                  {t("fields.noServicesConfigured")}
                                </p>
                              </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex flex-wrap items-center gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditPackage(pkg)}
                            className="flex items-center gap-1"
                          >
                            <Edit className="h-3 w-3" />
                            {t("buttons.edit")}
                          </Button>
                          <div className="flex items-center gap-2 ms-auto">
                            <Label
                              htmlFor={`package-active-${pkg.id}`}
                              className="text-sm text-muted-foreground cursor-pointer"
                            >
                              {pkg.isActive ? t("badges.active") : t("badges.inactive")}
                            </Label>
                            <Switch
                              id={`package-active-${pkg.id}`}
                              checked={pkg.isActive}
                              disabled={togglingPackageId === pkg.id}
                              onCheckedChange={(checked: boolean) => {
                                setTogglingPackageId(pkg.id);
                                setPackageActive.mutate({ id: pkg.id, isActive: checked });
                              }}
                            />
                          </div>
                        </CardFooter>
                      </Card>
                    )
                  )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
