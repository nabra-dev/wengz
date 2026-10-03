import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ScrollView } from "react-native";
import { getPaymentInfo, submitPaymentProof, uploadFile } from "../../src/lib/api";
import { t } from "../../src/i18n";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  Loading,
  Muted,
  PageHeader,
  Screen,
} from "../../src/components/ui";

export default function PaymentScreen() {
  const { subscriptionId, amount: amountParam } = useLocalSearchParams<{
    subscriptionId?: string;
    amount?: string;
  }>();
  const info = useQuery({ queryKey: ["payment-info"], queryFn: getPaymentInfo });
  const [senderName, setSenderName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [senderCountry, setSenderCountry] = useState("");
  const [amount, setAmount] = useState(amountParam ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: () =>
      submitPaymentProof({
        subscriptionId: String(subscriptionId),
        transferImage: imageUrl!,
        senderName: senderName.trim(),
        senderBank: senderBank.trim(),
        senderCountry: senderCountry.trim(),
        amount: Number(amount),
        currency: "USD",
        transferDate: new Date().toISOString(),
      }),
    onSuccess: () => setDone(true),
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

  if (info.isLoading) return <Loading />;

  const bankName = String((info.data as { bankName?: string } | null)?.bankName ?? "");
  const iban = String((info.data as { iban?: string } | null)?.iban ?? "");

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageHeader title={t("subscribe.paymentTitle")} />
        {(bankName || iban) && (
          <Card highlight>
            {bankName ? <Muted style={{ marginBottom: 4 }}>{bankName}</Muted> : null}
            {iban ? <Muted style={{ marginBottom: 0 }}>{iban}</Muted> : null}
          </Card>
        )}
        {error ? <ErrorText>{error}</ErrorText> : null}
        {done ? (
          <Card>
            <Muted>{t("subscribe.submitted")}</Muted>
            <Button
              label={t("common.back")}
              onPress={() => router.replace("/(app)")}
              variant="secondary"
            />
          </Card>
        ) : (
          <Card>
            <Label>{t("subscribe.senderName")}</Label>
            <Field value={senderName} onChangeText={setSenderName} />
            <Label>{t("subscribe.senderBank")}</Label>
            <Field value={senderBank} onChangeText={setSenderBank} />
            <Label>{t("subscribe.senderCountry")}</Label>
            <Field value={senderCountry} onChangeText={setSenderCountry} />
            <Label>{t("subscribe.amount")}</Label>
            <Field keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
            <Muted>
              {t("subscribe.transferImage")}: {imageUrl ? "✓" : "—"}
            </Muted>
            <Button
              label={t("subscribe.pickImage")}
              onPress={() => void pickImage()}
              variant="ghost"
            />
            <Button
              label={submit.isPending ? t("common.loading") : t("common.submit")}
              onPress={() => {
                setError(null);
                if (!subscriptionId || !imageUrl) {
                  setError(t("common.error"));
                  return;
                }
                submit.mutate();
              }}
              disabled={submit.isPending}
              variant="secondary"
            />
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
