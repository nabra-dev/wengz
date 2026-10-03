import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { FlatList, Text, View } from "react-native";
import {
  addComment,
  approveRequest,
  getRequest,
  rateRequest,
  requestRevision,
  uploadFile,
} from "../../../src/lib/api";
import { t } from "../../../src/i18n";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  Loading,
  Muted,
  Screen,
  StatusBadge,
  colors,
} from "../../../src/components/ui";
import { fonts } from "../../../src/theme/brand";

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState("5");
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["request", id],
    queryFn: () => getRequest(String(id)),
    refetchInterval: 30_000,
    enabled: Boolean(id),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["request", id] });
    void qc.invalidateQueries({ queryKey: ["requests"] });
  };

  const send = useMutation({
    mutationFn: async (files: string[] = []) => {
      await addComment(String(id), message.trim(), files);
    },
    onSuccess: () => {
      setMessage("");
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const revise = useMutation({
    mutationFn: () => requestRevision(String(id), feedback.trim()),
    onSuccess: () => {
      setFeedback("");
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const approve = useMutation({
    mutationFn: () => approveRequest(String(id)),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  const rate = useMutation({
    mutationFn: () => rateRequest(String(id), Number(rating) || 5, feedback.trim() || undefined),
    onSuccess: () => {
      setFeedback("");
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  async function attachAndSend() {
    setError(null);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const url = await uploadFile(
      asset.uri,
      asset.fileName ?? "attach.jpg",
      asset.mimeType ?? "image/jpeg"
    );
    await send.mutateAsync([url]);
  }

  if (q.isLoading) return <Loading />;
  if (!q.data) {
    return (
      <Screen>
        <ErrorText>{t("common.error")}</ErrorText>
      </Screen>
    );
  }

  const request = q.data as {
    title?: string;
    status?: string;
    needsManualApproval?: boolean;
    comments?: Array<{
      id: string;
      content: string;
      user?: { name?: string | null; role?: string };
    }>;
  };

  return (
    <Screen>
      <Card>
        <Text
          style={{
            color: colors.foreground,
            fontFamily: fonts.semiBold,
            fontSize: 18,
            marginBottom: 10,
          }}
        >
          {request.title ?? t("requests.detail")}
        </Text>
        <StatusBadge status={String(request.status)} />
        {request.needsManualApproval ? (
          <Muted style={{ marginTop: 10 }}>{t("requests.needsManualApproval")}</Muted>
        ) : null}
      </Card>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <FlatList
        style={{ flex: 1 }}
        data={request.comments ?? []}
        keyExtractor={(cmt) => cmt.id}
        ListHeaderComponent={<Muted style={{ marginTop: 4 }}>Messages</Muted>}
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              padding: 12,
              borderRadius: 10,
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                color: colors.yellow,
                fontSize: 11,
                fontFamily: fonts.medium,
                marginBottom: 4,
              }}
            >
              {item.user?.name ?? "User"}
            </Text>
            <Text style={{ color: colors.foreground, fontFamily: fonts.regular, lineHeight: 20 }}>
              {item.content}
            </Text>
          </View>
        )}
      />

      <Label>{t("requests.messagePlaceholder")}</Label>
      <Field
        placeholder={t("requests.messagePlaceholder")}
        value={message}
        onChangeText={setMessage}
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            label={t("common.send")}
            onPress={() => {
              setError(null);
              if (message.trim()) send.mutate([]);
            }}
            disabled={send.isPending || !message.trim()}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={t("requests.attach")}
            onPress={() => void attachAndSend()}
            variant="ghost"
          />
        </View>
      </View>

      {request.status === "DELIVERED" ? (
        <Card style={{ marginTop: 12 }}>
          <Field
            placeholder={t("requests.revisionFeedback")}
            value={feedback}
            onChangeText={setFeedback}
            multiline
          />
          <Button
            label={t("requests.revise")}
            onPress={() => revise.mutate()}
            disabled={!feedback.trim() || revise.isPending}
            variant="ghost"
          />
          <Button
            label={t("requests.approve")}
            onPress={() => approve.mutate()}
            disabled={approve.isPending}
            variant="secondary"
          />
        </Card>
      ) : null}

      {request.status === "COMPLETED" ? (
        <Card style={{ marginTop: 12 }}>
          <Label>{t("requests.rate")}</Label>
          <Field
            keyboardType="number-pad"
            value={rating}
            onChangeText={setRating}
            placeholder="1-5"
          />
          <Field
            placeholder={t("requests.ratingReview")}
            value={feedback}
            onChangeText={setFeedback}
            multiline
          />
          <Button
            label={t("requests.rate")}
            onPress={() => rate.mutate()}
            disabled={rate.isPending}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
