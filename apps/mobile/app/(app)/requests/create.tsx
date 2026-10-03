import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createRequest, getActiveSubscription, getServiceTypes } from "../../../src/lib/api";
import { t, i18n } from "../../../src/i18n";
import { ServiceAttributesForm } from "../../../src/components/ServiceAttributesForm";
import { AttachmentPicker } from "../../../src/components/AttachmentPicker";
import { SelectDropdown } from "../../../src/components/SelectDropdown";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  Loading,
  Muted,
  PageHeader,
  ScrollScreen,
  colors,
  SCROLL_BOTTOM_PAD,
  AppText,
} from "../../../src/components/ui";
import { fonts } from "../../../src/theme/brand";
import {
  calculateAttributeCredits,
  type AttributeResponse,
  type ServiceAttribute,
} from "../../../src/types/service-attributes";

type ServiceRow = {
  id: string;
  name?: string;
  nameI18n?: Record<string, string> | null;
  description?: string | null;
  descriptionI18n?: Record<string, string> | null;
  icon?: string | null;
  creditCost?: number;
  isSupported?: boolean;
  attributes?: ServiceAttribute[];
  supportingPackages?: Array<{ name?: string; nameI18n?: Record<string, string> }>;
};

function localized(
  base: string | null | undefined,
  map: Record<string, string> | null | undefined
): string {
  return map?.[i18n.locale] || map?.en || base || "";
}

export default function CreateRequestScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const services = useQuery({ queryKey: ["service-types"], queryFn: getServiceTypes });
  const sub = useQuery({ queryKey: ["subscription"], queryFn: getActiveSubscription });
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});
  const [attributeResponses, setAttributeResponses] = useState<AttributeResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  const serviceList = useMemo(() => (services.data ?? []) as ServiceRow[], [services.data]);
  const selected = useMemo(
    () => serviceList.find((s) => s.id === serviceTypeId),
    [serviceList, serviceTypeId]
  );
  const attributes = useMemo(() => selected?.attributes ?? [], [selected]);

  const baseCost = selected?.creditCost ?? 1;
  const attrCost = calculateAttributeCredits(attributes, attributeResponses);
  const totalCost = baseCost + attrCost;
  const remainingCredits =
    (sub.data as { remainingCredits?: number } | null)?.remainingCredits ?? 0;
  const hasSub = Boolean(sub.data);
  const hasCredits = hasSub && remainingCredits > 0;
  const canAfford = hasSub && remainingCredits >= totalCost;
  const packageName =
    localized(
      (sub.data as { package?: { name?: string; nameI18n?: Record<string, string> } } | null)
        ?.package?.name,
      (sub.data as { package?: { nameI18n?: Record<string, string> } } | null)?.package?.nameI18n
    ) || "—";

  function isAnswerFilled(answer: string | string[] | undefined): boolean {
    if (answer === undefined) return false;
    if (typeof answer === "string") return Boolean(answer.trim());
    return Array.isArray(answer) && answer.length > 0;
  }

  const requiredAttributesFilled = useMemo(
    () =>
      attributes
        .filter((a) => a.required)
        .every((attr) =>
          isAnswerFilled(attributeResponses.find((r) => r.question === attr.question)?.answer)
        ),
    [attributes, attributeResponses]
  );

  const formValid =
    Boolean(serviceTypeId) &&
    Boolean(title.trim()) &&
    Boolean(description.trim()) &&
    requiredAttributesFilled;

  const serviceOptions = useMemo(
    () =>
      serviceList.map((s) => {
        const name = localized(s.name, s.nameI18n);
        const allowed = Boolean(s.isSupported);
        const pkgHint =
          s.supportingPackages?.[0] &&
          localized(s.supportingPackages[0].name, s.supportingPackages[0].nameI18n);
        return {
          value: s.id,
          icon: s.icon?.trim() || undefined,
          label: `${name} · ${s.creditCost ?? 1} ${t("client.newRequest.credits")}`,
          subtitle:
            !allowed && pkgHint
              ? t("client.newRequest.supportedFromPackage", { name: pkgHint })
              : undefined,
          disabled: !allowed,
        };
      }),
    [serviceList]
  );

  const create = useMutation({
    mutationFn: () =>
      createRequest({
        title: title.trim(),
        description: description.trim(),
        serviceTypeId: serviceTypeId!,
        attachments,
        attributeResponses: attributeResponses.length ? attributeResponses : undefined,
      }) as Promise<{ request?: { id?: string } }>,
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["requests"] });
      await qc.invalidateQueries({ queryKey: ["subscription"] });
      if (res.request?.id) router.replace(`/(app)/requests/${res.request.id}`);
      else router.back();
    },
    onError: (e: Error) => setError(e.message),
  });

  function onSubmit() {
    setError(null);
    if (!formValid || !canAfford || !hasCredits) return;
    create.mutate();
  }

  function onSelectService(id: string) {
    setServiceTypeId(id);
    setAttributeResponses([]);
  }

  if (services.isLoading || sub.isLoading) return <Loading />;

  const buttonLabel = create.isPending
    ? t("client.newRequest.actions.creating")
    : totalCost === 1
      ? t("client.newRequest.actions.create", { cost: totalCost })
      : t("client.newRequest.actions.createCredits", { cost: totalCost });

  const footerPad = 88 + Math.max(insets.bottom, 12);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollScreen bottomPad={footerPad + SCROLL_BOTTOM_PAD}>
        <PageHeader title={t("client.newRequest.title")} />

        {!hasSub ? (
          <Card highlight>
            <AppText
              style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 6 }}
            >
              {t("client.newRequest.noSubscription.title")}
            </AppText>
            <Muted>{t("client.newRequest.noSubscription.description")}</Muted>
            <Button
              label={t("client.newRequest.noSubscription.viewPackages")}
              onPress={() => router.push("/(app)/subscribe")}
              variant="secondary"
            />
          </Card>
        ) : null}

        {hasSub && !canAfford ? (
          <Card highlight>
            <AppText
              style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 6 }}
            >
              {t("client.newRequest.insufficientCredits.title")}
            </AppText>
            <Muted>
              {remainingCredits === 0
                ? t("client.newRequest.insufficientCredits.zeroCredits")
                : t("client.newRequest.insufficientCredits.descriptionNoPriority", {
                    required: totalCost,
                    credit: t("client.newRequest.credits"),
                    baseCost,
                    available: remainingCredits,
                  })}
            </Muted>
            <Button
              label={t("client.newRequest.insufficientCredits.viewPlans")}
              onPress={() => router.push("/(app)/subscribe")}
              variant="ghost"
            />
          </Card>
        ) : null}

        {hasSub && serviceList.length === 0 && !services.isError ? (
          <Card highlight>
            <AppText
              style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 6 }}
            >
              {t("client.newRequest.noServices.title")}
            </AppText>
            <Muted>{t("client.newRequest.noServices.description", { name: packageName })}</Muted>
            <Button
              label={t("client.newRequest.noServices.upgradePackage")}
              onPress={() => router.push("/(app)/subscribe")}
            />
          </Card>
        ) : null}

        {services.isError ? (
          <ErrorText>{(services.error as Error)?.message || t("common.error")}</ErrorText>
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}

        <Card>
          <Label required>{t("client.newRequest.fields.serviceType")}</Label>
          <SelectDropdown
            value={serviceTypeId ?? ""}
            options={serviceOptions}
            onChange={onSelectService}
            placeholder={t("client.newRequest.fields.serviceTypePlaceholder")}
            disabled={!hasCredits || serviceList.length === 0}
          />

          {selected ? (
            <View
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 8,
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Muted style={{ marginBottom: 0 }}>
                {localized(selected.description, selected.descriptionI18n) ||
                  `${selected.creditCost ?? 1} ${t("client.newRequest.credits")}`}
              </Muted>
            </View>
          ) : null}

          <Label required>{t("client.newRequest.fields.title")}</Label>
          <Field
            editable={hasCredits}
            placeholder={t("client.newRequest.fields.titlePlaceholder")}
            value={title}
            onChangeText={setTitle}
          />

          <Label required>{t("client.newRequest.fields.description")}</Label>
          <Field
            editable={hasCredits}
            placeholder={t("client.newRequest.fields.descriptionPlaceholder")}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {attributes.length > 0 ? (
            <ServiceAttributesForm
              attributes={attributes}
              responses={attributeResponses}
              onChange={setAttributeResponses}
              disabled={!hasCredits}
            />
          ) : null}

          <AttachmentPicker
            label={t("client.newRequest.fields.attachments")}
            value={attachments}
            onChange={setAttachments}
            localPreviews={attachmentPreviews}
            onLocalPreviewsChange={setAttachmentPreviews}
            max={5}
            disabled={!hasCredits}
            hint={t("profile.editProfile.helperText.maxFileSize")}
          />

          <Muted style={{ marginTop: 8, marginBottom: 0 }}>{t("errors.contactNotAllowed")}</Muted>
        </Card>

        <Card>
          <Muted>
            {t("client.newRequest.costSummary.total")}: {totalCost}
          </Muted>
          <Muted>
            {t("client.newRequest.costSummary.available")}: {remainingCredits}
          </Muted>
          <Muted style={{ marginBottom: 0 }}>
            {t("client.newRequest.costSummary.remaining")}:{" "}
            {Math.max(0, remainingCredits - totalCost)}
          </Muted>
        </Card>
      </ScrollScreen>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 12),
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Button
          label={buttonLabel}
          variant="secondary"
          disabled={create.isPending || !canAfford || !hasCredits || !formValid}
          onPress={onSubmit}
        />
      </View>
    </View>
  );
}
