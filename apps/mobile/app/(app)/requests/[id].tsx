import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import {
  addComment,
  approveRequest,
  getRequest,
  rateRequest,
  requestRevision,
} from "../../../src/lib/api";
import { t, i18n } from "../../../src/i18n";
import { AttachmentPicker } from "../../../src/components/AttachmentPicker";
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
  ScrollScreen,
  SegmentedTabs,
  StatusBadge,
  colors,
  listContentDefaults,
  listFillStyle,
} from "../../../src/components/ui";
import { fonts } from "../../../src/theme/brand";

type Tab = "messages" | "details";

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("messages");
  const [message, setMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(0);
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
    mutationFn: async (files: string[] = []) =>
      addComment(String(id), message.trim() || (files.length ? " " : ""), files),
    onSuccess: () => {
      setMessage("");
      setPendingFiles([]);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const revise = useMutation({
    mutationFn: () => requestRevision(String(id), feedback.trim()),
    onSuccess: () => {
      setFeedback("");
      setError(null);
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
    mutationFn: () => rateRequest(String(id), rating, feedback.trim() || undefined),
    onSuccess: () => {
      setFeedback("");
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  if (q.isLoading) return <Loading />;
  if (!q.data) {
    return (
      <ScrollScreen keyboard={false}>
        <ErrorText>{t("client.requestDetail.notFound")}</ErrorText>
      </ScrollScreen>
    );
  }

  const request = q.data as {
    title?: string;
    status?: string;
    description?: string;
    needsManualApproval?: boolean;
    providerId?: string | null;
    rating?: { rating?: number; reviewText?: string | null } | null;
    revisionInfo?: { freeRevisionsRemaining?: number; paidRevisionCost?: number };
    comments?: Array<{ id: string; content: string; user?: { name?: string | null } }>;
    serviceType?: { name?: string; nameI18n?: Record<string, string> };
  };

  const serviceName =
    request.serviceType?.nameI18n?.[i18n.locale] ||
    request.serviceType?.nameI18n?.en ||
    request.serviceType?.name;

  const header = (
    <View>
      <PageHeader
        title={String(request.title || t("client.requests.title"))}
        description={
          [serviceName, request.needsManualApproval ? t("requests.card.needsManualApproval") : null]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        right={<StatusBadge status={String(request.status)} />}
      />

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { key: "messages", label: t("client.requestDetail.messagesTitle") },
          { key: "details", label: t("requests.workspace.details") || "Details" },
        ]}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );

  if (tab === "details") {
    return (
      <ScrollScreen>
        {header}
        <Card>
          <Label>{t("client.newRequest.fields.description")}</Label>
          <Muted style={{ marginBottom: 0 }}>{request.description}</Muted>
        </Card>

        {request.status === "DELIVERED" ? (
          <Card highlight>
            <Text style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 6 }}>
              {t("client.requestDetail.deliverableReady.title")}
            </Text>
            <Muted>{t("client.requestDetail.deliverableReady.description")}</Muted>
            <Label>{t("client.requestDetail.requestRevision.title")}</Label>
            <Muted>
              {typeof request.revisionInfo?.freeRevisionsRemaining === "number"
                ? t("client.requestDetail.requestRevision.freeRemaining", {
                    count: request.revisionInfo.freeRevisionsRemaining,
                    revision: t("client.requestDetail.requestRevision.revision"),
                  })
                : null}
            </Muted>
            <Field
              placeholder={t("client.requestDetail.requestRevision.placeholder")}
              value={feedback}
              onChangeText={setFeedback}
              multiline
            />
            <Button
              label={
                revise.isPending
                  ? t("client.requestDetail.requestRevision.requesting")
                  : t("client.requestDetail.requestRevision.button")
              }
              onPress={() => {
                if (!feedback.trim()) {
                  setError(t("client.requestDetail.toast.invalidFeedbackDesc"));
                  return;
                }
                revise.mutate();
              }}
              variant="ghost"
              disabled={revise.isPending}
            />
            <Button
              label={
                approve.isPending
                  ? t("client.requestDetail.deliverableReady.approving")
                  : t("client.requestDetail.deliverableReady.approve")
              }
              onPress={() => approve.mutate()}
              variant="secondary"
              disabled={approve.isPending}
            />
          </Card>
        ) : null}

        {request.status === "COMPLETED" && !request.rating ? (
          <Card>
            <Text style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 6 }}>
              {t("client.requestDetail.rateService.title")}
            </Text>
            <Muted>{t("client.requestDetail.rateService.description")}</Muted>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setRating(n)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: rating >= n ? colors.yellow : colors.muted,
                  }}
                >
                  <Text
                    style={{
                      color: rating >= n ? "#2A0A55" : colors.foreground,
                      fontFamily: fonts.bold,
                    }}
                  >
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Field
              placeholder={t("client.requestDetail.rateService.reviewPlaceholder")}
              value={feedback}
              onChangeText={setFeedback}
              multiline
            />
            <Button
              label={
                rate.isPending
                  ? t("client.requestDetail.rateService.submitting")
                  : t("client.requestDetail.rateService.submit")
              }
              onPress={() => rate.mutate()}
              disabled={rate.isPending || rating < 1}
            />
          </Card>
        ) : null}

        {request.rating ? (
          <Card>
            <Text style={{ color: colors.foreground, fontFamily: fonts.semiBold }}>
              {t("client.requestDetail.yourRating.title")}: {request.rating.rating}/5
            </Text>
            {request.rating.reviewText ? <Muted>{request.rating.reviewText}</Muted> : null}
          </Card>
        ) : null}
      </ScrollScreen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        {header}
        {!request.providerId ? (
          <Card>
            <Muted>{t("client.requestDetail.messagingAfterClaim")}</Muted>
          </Card>
        ) : (
          <FlatList
            style={listFillStyle}
            contentContainerStyle={listContentDefaults}
            data={request.comments ?? []}
            keyExtractor={(cmt) => cmt.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            alwaysBounceVertical
            ListEmptyComponent={
              <Card>
                <Muted style={{ marginBottom: 0 }}>
                  {t("client.requestDetail.messagesPlaceholder")}
                </Muted>
              </Card>
            }
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  padding: 12,
                  borderRadius: 8,
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
                <Text
                  style={{ color: colors.foreground, fontFamily: fonts.regular, lineHeight: 20 }}
                >
                  {item.content}
                </Text>
              </View>
            )}
          />
        )}

        {request.providerId && request.status !== "COMPLETED" ? (
          <View
            style={{
              paddingTop: 10,
              paddingBottom: 8,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            }}
          >
            <AttachmentPicker
              urls={pendingFiles}
              onChange={setPendingFiles}
              max={3}
              hint={
                pendingFiles.length
                  ? t("requests.workspace.attachmentsSendHint")
                  : t("requests.workspace.attach")
              }
            />
            <Field
              placeholder={t("client.requestDetail.messagesPlaceholder")}
              value={message}
              onChangeText={setMessage}
            />
            <Button
              label={t("common.send")}
              onPress={() => {
                setError(null);
                if (!message.trim() && pendingFiles.length === 0) return;
                send.mutate(pendingFiles);
              }}
              disabled={send.isPending || (!message.trim() && pendingFiles.length === 0)}
              variant="secondary"
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}
