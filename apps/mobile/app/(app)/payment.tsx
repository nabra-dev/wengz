import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Pressable, Text, View } from "react-native";
import {
  cancelSubscription,
  getPaymentInfo,
  getPendingSubscription,
  submitPaymentProof,
  uploadFile,
} from "../../src/lib/api";
import { t, i18n } from "../../src/i18n";
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
} from "../../src/components/ui";
import { fonts } from "../../src/theme/brand";

type MethodId = "bank_transfer" | "instapay" | "fawry" | "meeza" | "visa" | "mastercard";

export default function PaymentScreen() {
  const params = useLocalSearchParams<{ subscriptionId?: string }>();
  const qc = useQueryClient();
  const pending = useQuery({ queryKey: ["subscription-pending"], queryFn: getPendingSubscription });
  const info = useQuery({ queryKey: ["payment-info"], queryFn: getPaymentInfo });

  const [method, setMethod] = useState<MethodId>("bank_transfer");
  const [senderName, setSenderName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [senderCountry, setSenderCountry] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const subscription = pending.data as {
    id?: string;
    package?: {
      price?: number;
      credits?: number;
      name?: string;
      nameI18n?: Record<string, string>;
    };
    paymentProof?: { status?: string } | null;
  } | null;

  const subscriptionId = String(params.subscriptionId || subscription?.id || "");
  const amount = Number(subscription?.package?.price ?? 0);
  const packageName =
    subscription?.package?.nameI18n?.[i18n.locale] ||
    subscription?.package?.nameI18n?.en ||
    subscription?.package?.name ||
    "—";

  const methods = useMemo(() => {
    const list = (
      info.data as {
        methods?: Array<{ id: MethodId; available: boolean; comingSoon: boolean }>;
      } | null
    )?.methods;
    return list ?? [];
  }, [info.data]);

  useEffect(() => {
    const firstAvailable = methods.find((m) => m.available && !m.comingSoon);
    if (firstAvailable) setMethod(firstAvailable.id);
  }, [methods]);

  const submit = useMutation({
    mutationFn: () =>
      submitPaymentProof({
        subscriptionId,
        transferImage: imageUrl!,
        senderName: senderName.trim(),
        senderBank: senderBank.trim(),
        senderCountry: senderCountry.trim(),
        amount,
        currency: "USD",
        transferDate: new Date(transferDate).toISOString(),
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: async () => {
      setDone(true);
      await qc.invalidateQueries({ queryKey: ["subscription-pending"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => cancelSubscription(subscriptionId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["subscription-pending"] });
      router.replace("/(app)/subscribe");
    },
    onError: (e: Error) => setError(e.message),
  });

  async function pickImage() {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const url = await uploadFile(
      asset.uri,
      asset.fileName ?? "proof.jpg",
      asset.mimeType ?? "image/jpeg"
    );
    setImageUrl(url);
  }

  if (pending.isLoading || info.isLoading) return <Loading />;

  if (!subscription) {
    return (
      <ScrollScreen keyboard={false}>
        <PageHeader title={t("client.payment.title")} description={t("client.payment.subtitle")} />
        <Card>
          <Text style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 6 }}>
            {t("client.payment.noPendingPayment.title")}
          </Text>
          <Muted>{t("client.payment.noPendingPayment.description")}</Muted>
          <Button
            label={t("client.payment.noPendingPayment.viewSubscriptions")}
            onPress={() => router.push("/(app)/subscribe")}
            variant="secondary"
          />
        </Card>
      </ScrollScreen>
    );
  }

  if (subscription.paymentProof) {
    const status = String(subscription.paymentProof.status || "PENDING").toLowerCase();
    return (
      <ScrollScreen keyboard={false}>
        <PageHeader
          title={t("client.payment.statusTitle")}
          description={t("client.payment.statusSubtitle")}
        />
        <Card highlight>
          <Text style={{ color: colors.yellow, fontFamily: fonts.semiBold, marginBottom: 8 }}>
            {t(
              `client.payment.status.${status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending"}`
            )}
          </Text>
          <Muted>
            {t(
              `client.payment.status.${status === "approved" ? "approvedDesc" : status === "rejected" ? "rejectedDesc" : "pendingDesc"}`
            )}
          </Muted>
          <Muted>
            {packageName} · ${amount}
          </Muted>
          <Button
            label={t("client.payment.actions.backToSubscription")}
            onPress={() => router.push("/(app)/subscribe")}
            variant="ghost"
          />
        </Card>
      </ScrollScreen>
    );
  }

  const bank = info.data as {
    bankName?: string;
    accountName?: string;
    iban?: string;
    swiftCode?: string;
    note?: string;
    instapayLink?: string;
  } | null;

  return (
    <ScrollScreen>
      <PageHeader
        title={t("client.payment.completePayment.title")}
        description={t("client.payment.completePayment.subtitle")}
      />

      <Muted>{t("client.payment.steps.method")}</Muted>
      {methods.map((m) => {
        const available = m.available && !m.comingSoon;
        const selected = method === m.id;
        return (
          <Pressable
            key={m.id}
            disabled={!available}
            onPress={() => setMethod(m.id)}
            style={{
              padding: 12,
              borderRadius: 10,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: selected ? colors.yellow : colors.border,
              backgroundColor: selected ? "rgba(224,248,64,0.08)" : colors.card,
              opacity: available ? 1 : 0.45,
            }}
          >
            <Text style={{ color: colors.foreground, fontFamily: fonts.medium }}>
              {t(`client.payment.methods.items.${m.id}.name`)}
              {m.comingSoon ? ` · ${t("client.payment.methods.comingSoon")}` : ""}
            </Text>
            <Muted style={{ marginBottom: 0 }}>
              {t(`client.payment.methods.items.${m.id}.hint`)}
            </Muted>
          </Pressable>
        );
      })}

      <Muted style={{ marginTop: 8 }}>{t("client.payment.steps.pay")}</Muted>
      <Card highlight>
        <Muted>
          {packageName} · ${amount} · {subscription.package?.credits ?? "—"}{" "}
          {t("client.payment.badges.credits")}
        </Muted>
        {method === "instapay" ? (
          <>
            <Text style={{ color: colors.foreground, fontFamily: fonts.semiBold }}>
              {t("client.payment.bankDetails.instapayTitle")}
            </Text>
            <Muted>{bank?.instapayLink || t("client.payment.methods.unavailable")}</Muted>
            <Muted>{t("client.payment.bankDetails.instapayNote")}</Muted>
          </>
        ) : (
          <>
            <Text style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 8 }}>
              {t("client.payment.bankDetails.title")}
            </Text>
            <Muted>
              {t("client.payment.bankDetails.bankName")}: {bank?.bankName}
            </Muted>
            <Muted>
              {t("client.payment.bankDetails.accountName")}: {bank?.accountName}
            </Muted>
            <Muted>
              {t("client.payment.bankDetails.iban")}: {bank?.iban}
            </Muted>
            <Muted>
              {t("client.payment.bankDetails.swiftCode")}: {bank?.swiftCode}
            </Muted>
            <Muted style={{ marginBottom: 0 }}>
              {bank?.note || t("client.payment.bankDetails.note")}
            </Muted>
          </>
        )}
      </Card>

      <Muted style={{ marginTop: 8 }}>{t("client.payment.steps.proof")}</Muted>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {done ? (
        <Card>
          <Muted>{t("client.payment.toast.submitted")}</Muted>
          <Button
            label={t("common.back")}
            onPress={() => router.replace("/(app)")}
            variant="secondary"
          />
        </Card>
      ) : (
        <Card>
          <Text style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 6 }}>
            {t("client.payment.uploadProof.title")}
          </Text>
          <Muted>{t("client.payment.uploadProof.description")}</Muted>

          <Label>{t("client.payment.uploadProof.transferReceipt")}</Label>
          <Muted>{imageUrl ? "✓" : t("client.payment.uploadProof.uploadImage")}</Muted>
          <Button
            label={t("client.payment.uploadProof.transferReceipt")}
            onPress={() => void pickImage()}
            variant="ghost"
          />

          <Label>{t("client.payment.uploadProof.senderName")}</Label>
          <Field
            placeholder={t("client.payment.uploadProof.senderNamePlaceholder")}
            value={senderName}
            onChangeText={setSenderName}
          />
          <Label>{t("client.payment.uploadProof.senderBank")}</Label>
          <Field
            placeholder={t("client.payment.uploadProof.senderBankPlaceholder")}
            value={senderBank}
            onChangeText={setSenderBank}
          />
          <Label>{t("client.payment.uploadProof.senderCountry")}</Label>
          <Field
            placeholder={t("client.payment.uploadProof.senderCountryPlaceholder")}
            value={senderCountry}
            onChangeText={setSenderCountry}
          />
          <Label>{t("client.payment.uploadProof.transferDate")}</Label>
          <Muted>{t("client.payment.uploadProof.transferDateHint")}</Muted>
          <Field
            placeholder="YYYY-MM-DD"
            value={transferDate}
            onChangeText={setTransferDate}
            autoCapitalize="none"
          />
          <Label>{t("client.payment.uploadProof.referenceNumber")}</Label>
          <Field
            placeholder={t("client.payment.uploadProof.referenceNumberPlaceholder")}
            value={referenceNumber}
            onChangeText={setReferenceNumber}
          />
          <Label>{t("client.payment.uploadProof.notes")}</Label>
          <Field
            placeholder={t("client.payment.uploadProof.notesPlaceholder")}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <Button
            label={
              submit.isPending
                ? t("client.payment.uploadProof.submitting")
                : t("client.payment.uploadProof.submit")
            }
            variant="secondary"
            disabled={submit.isPending}
            onPress={() => {
              setError(null);
              if (!imageUrl) {
                setError(t("client.payment.validation.transferReceiptRequired"));
                return;
              }
              if (!senderName.trim()) {
                setError(t("client.payment.validation.senderNameMin"));
                return;
              }
              if (!senderBank.trim()) {
                setError(t("client.payment.validation.senderBankMin"));
                return;
              }
              if (!senderCountry.trim()) {
                setError(t("client.payment.validation.senderCountryMin"));
                return;
              }
              if (!transferDate) {
                setError(t("client.payment.validation.transferDateRequired"));
                return;
              }
              const d = new Date(transferDate);
              if (Number.isNaN(d.getTime())) {
                setError(t("client.payment.validation.transferDateRequired"));
                return;
              }
              if (d.getTime() > Date.now()) {
                setError(t("client.payment.validation.transferDateFuture"));
                return;
              }
              if (!subscriptionId || !amount) {
                setError(t("client.payment.validation.formErrors"));
                return;
              }
              submit.mutate();
            }}
          />
          <Button
            label={
              cancel.isPending
                ? t("client.payment.actions.cancelling")
                : t("client.payment.actions.cancelSubscription")
            }
            onPress={() => cancel.mutate()}
            variant="danger"
            disabled={cancel.isPending}
          />
        </Card>
      )}
    </ScrollScreen>
  );
}
