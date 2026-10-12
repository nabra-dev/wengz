import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  addComment,
  approveRequest,
  getRequest,
  markCommentsRead,
  rateRequest,
  requestRevision,
} from "../../../src/lib/api";
import { t, i18n } from "../../../src/i18n";
import { MediaImage } from "../../../src/components/MediaImage";
import { RequestChat, type ChatComment } from "../../../src/components/RequestChat";
import { VoiceNotePreview } from "../../../src/components/VoiceNotePreview";
import { physicalRow, row } from "../../../src/rtl";
import { fileNameFromUrl, isLikelyImageUrl } from "../../../src/lib/media";
import { useAuth } from "../../../src/providers/auth";
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
  AppText,
} from "../../../src/components/ui";
import { fonts, typeScale } from "../../../src/theme/brand";
import type { AttributeResponse, ServiceAttribute } from "../../../src/types/service-attributes";

type Tab = "messages" | "details";

type Comment = ChatComment;

function asAttributeResponses(raw: unknown): AttributeResponse[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is AttributeResponse =>
      Boolean(r) && typeof r === "object" && typeof (r as AttributeResponse).question === "string"
  );
}

function answerUrls(answer: string | string[]): string[] {
  const parts = Array.isArray(answer) ? answer : [answer];
  return parts
    .flatMap((p) => String(p).split(","))
    .map((s) => s.trim())
    .filter((s) => s.includes("/api/files/") || s.startsWith("http"));
}

function isAudioUrl(url: string) {
  return /\.(webm|m4a|mp3|ogg|wav|aac|mp4|caf|3gp)$/i.test(url.split("?")[0] ?? "");
}

function FileChip({ url }: { url: string }) {
  if (isAudioUrl(url)) {
    return (
      <View style={{ width: "100%", maxWidth: 360 }}>
        <VoiceNotePreview url={url} variant="card" />
      </View>
    );
  }
  if (isLikelyImageUrl(url)) {
    return (
      <MediaImage
        uri={url}
        zoomable
        style={{
          width: 88,
          height: 88,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.muted,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: 88,
        minHeight: 88,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.muted,
        padding: 8,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
      }}
    >
      <Ionicons name="document-outline" size={24} color={colors.mutedForeground} />
      <AppText
        compact
        align="center"
        numberOfLines={2}
        style={{ ...typeScale.xs, color: colors.mutedForeground }}
      >
        {fileNameFromUrl(url)}
      </AppText>
    </View>
  );
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("messages");
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

  const canMarkPeerRead = user?.role === "CLIENT" || user?.role === "PROVIDER";
  const myUserId = user?.id;

  useEffect(() => {
    if (!id || !canMarkPeerRead || !myUserId || !q.data) return;
    const comments = (q.data as { comments?: Comment[] }).comments ?? [];
    const hasUnreadFromOthers = comments.some(
      (c) => c.type !== "SYSTEM" && c.user?.id && c.user.id !== myUserId && c.isRead !== true
    );
    if (!hasUnreadFromOthers) return;

    void markCommentsRead(String(id))
      .then((res) => {
        if (res.updated > 0) invalidate();
      })
      .catch(() => {
        /* non-blocking read receipt */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark once when unread peers appear
  }, [id, canMarkPeerRead, myUserId, q.data]);

  const send = useMutation({
    mutationFn: async (payload: { content: string; files: string[] }) =>
      addComment(String(id), payload.content, payload.files),
    onSuccess: () => {
      setError(null);
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
    attachments?: string[];
    attributeResponses?: unknown;
    needsManualApproval?: boolean;
    providerId?: string | null;
    provider?: { name?: string | null; image?: string | null };
    rating?: { rating?: number; reviewText?: string | null } | null;
    revisionInfo?: { freeRevisionsRemaining?: number; paidRevisionCost?: number };
    comments?: Comment[];
    serviceType?: {
      name?: string;
      nameI18n?: Record<string, string>;
      attributes?: ServiceAttribute[];
    };
  };

  const serviceName =
    request.serviceType?.nameI18n?.[i18n.locale] ||
    request.serviceType?.nameI18n?.en ||
    request.serviceType?.name;

  const attachments = request.attachments ?? [];
  const attributeResponses = asAttributeResponses(request.attributeResponses);
  const comments = request.comments ?? [];
  const canSendMessages = Boolean(request.providerId) && request.status !== "COMPLETED";

  const chatActions =
    request.status === "DELIVERED" ||
    (request.status === "COMPLETED" && !request.rating) ||
    request.rating ? (
      <Card highlight={request.status === "DELIVERED"}>
        {request.status === "DELIVERED" ? (
          <>
            <AppText
              style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 6 }}
            >
              {t("client.requestDetail.deliverableReady.title")}
            </AppText>
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
          </>
        ) : null}

        {request.status === "COMPLETED" && !request.rating ? (
          <>
            <AppText
              style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 6 }}
            >
              {t("client.requestDetail.rateService.title")}
            </AppText>
            <Muted>{t("client.requestDetail.rateService.description")}</Muted>
            <View style={{ ...physicalRow(), gap: 8, marginBottom: 10 }}>
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
                  <AppText
                    style={{
                      color: rating >= n ? "#2A0A55" : colors.foreground,
                      fontFamily: fonts.bold,
                    }}
                  >
                    {n}
                  </AppText>
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
          </>
        ) : null}

        {request.rating ? (
          <>
            <AppText style={{ color: colors.foreground, fontFamily: fonts.semiBold }}>
              {t("client.requestDetail.yourRating.title")}: {request.rating.rating}/5
            </AppText>
            {request.rating.reviewText ? <Muted>{request.rating.reviewText}</Muted> : null}
          </>
        ) : null}
      </Card>
    ) : null;

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
          <Muted style={{ marginBottom: attachments.length ? 12 : 0 }}>
            {request.description || "—"}
          </Muted>
          {attachments.length > 0 ? (
            <>
              <Label>
                {t("client.requestDetail.attachmentsTitle", { count: attachments.length })}
              </Label>
              <View style={{ ...row(), flexWrap: "wrap", gap: 8 }}>
                {attachments.map((url, i) => (
                  <FileChip key={`${url}-${i}`} url={url} />
                ))}
              </View>
            </>
          ) : null}
        </Card>

        {attributeResponses.length > 0 ? (
          <Card>
            <AppText
              style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 10 }}
            >
              {t("client.requestDetail.questionsTitle")}
            </AppText>
            {attributeResponses.map((resp, index) => {
              const attr = request.serviceType?.attributes?.find(
                (a) => a.question === resp.question
              );
              const question =
                attr?.questionI18n?.[i18n.locale] || attr?.questionI18n?.en || resp.question;
              const urls = answerUrls(resp.answer);
              const textAnswer =
                urls.length === 0
                  ? Array.isArray(resp.answer)
                    ? resp.answer.join(", ")
                    : String(resp.answer || "")
                  : null;
              return (
                <View
                  key={`${resp.question}-${index}`}
                  style={{
                    marginBottom: index < attributeResponses.length - 1 ? 14 : 0,
                    paddingBottom: index < attributeResponses.length - 1 ? 14 : 0,
                    borderBottomWidth: index < attributeResponses.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <AppText
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: fonts.medium,
                      ...typeScale.sm,
                      marginBottom: 4,
                    }}
                  >
                    {question}
                  </AppText>
                  {textAnswer ? (
                    <AppText
                      style={{
                        color: colors.foreground,
                        fontFamily: fonts.regular,
                        lineHeight: 20,
                      }}
                    >
                      {textAnswer}
                    </AppText>
                  ) : null}
                  {urls.length > 0 ? (
                    <View style={{ ...row(), flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                      {urls.map((url, i) => (
                        <FileChip key={`${url}-${i}`} url={url} />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
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
          <RequestChat
            comments={comments}
            canSend={canSendMessages}
            sending={send.isPending}
            maskProviderNames
            threadFooter={chatActions}
            onError={setError}
            onSend={async ({ content, files }) => {
              setError(null);
              await send.mutateAsync({ content, files });
            }}
          />
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
