import { Pressable, View } from "react-native";
import { Field, Label, Muted, colors } from "./ui";
import { fonts } from "../theme/brand";
import { t, i18n } from "../i18n";
import { AttachmentPicker } from "./AttachmentPicker";
import { SelectDropdown } from "./SelectDropdown";
import { VoiceRecorder } from "./VoiceRecorder";
import { AppText } from "./typography";
import {
  localizedAttrText,
  type AttributeResponse,
  type ServiceAttribute,
} from "../types/service-attributes";

type Props = {
  attributes: ServiceAttribute[];
  responses: AttributeResponse[];
  onChange: (next: AttributeResponse[]) => void;
  disabled?: boolean;
};

function upsert(
  responses: AttributeResponse[],
  question: string,
  answer: string | string[]
): AttributeResponse[] {
  const idx = responses.findIndex((r) => r.question === question);
  if (idx === -1) return [...responses, { question, answer }];
  const next = [...responses];
  next[idx] = { question, answer };
  return next;
}

export function ServiceAttributesForm({ attributes, responses, onChange, disabled }: Props) {
  if (!attributes.length) return null;

  return (
    <View style={{ marginTop: 8 }}>
      <Label>{t("client.newRequest.serviceQuestions.title")}</Label>

      {attributes.map((attr) => {
        const q = localizedAttrText(attr.question, attr.questionI18n, i18n.locale);
        const placeholder = localizedAttrText(attr.placeholder, attr.placeholderI18n, i18n.locale);
        const help = localizedAttrText(attr.helpText, attr.helpTextI18n, i18n.locale);
        const current = responses.find((r) => r.question === attr.question)?.answer;
        const options = attr.optionsWithCost?.map((o) => o.value) || attr.options || [];
        const fileUrls = Array.isArray(current)
          ? current.map(String)
          : current
            ? [String(current)]
            : [];

        return (
          <View key={attr.question} style={{ marginBottom: 14 }}>
            <Label required={attr.required}>{q}</Label>
            {help ? <Muted style={{ marginBottom: 6 }}>{help}</Muted> : null}

            {(attr.type === "text" || attr.type === "number") && (
              <Field
                editable={!disabled}
                keyboardType={attr.type === "number" ? "numeric" : "default"}
                placeholder={placeholder || q}
                value={typeof current === "string" ? current : ""}
                onChangeText={(v) => onChange(upsert(responses, attr.question, v))}
              />
            )}

            {attr.type === "textarea" && (
              <Field
                editable={!disabled}
                multiline
                placeholder={placeholder || q}
                value={typeof current === "string" ? current : ""}
                onChangeText={(v) => onChange(upsert(responses, attr.question, v))}
              />
            )}

            {attr.type === "select" ? (
              <SelectDropdown
                value={typeof current === "string" ? current : ""}
                options={options.map((opt) => ({ value: opt, label: opt }))}
                onChange={(v) => onChange(upsert(responses, attr.question, v))}
                placeholder={placeholder || q}
                disabled={disabled}
              />
            ) : null}

            {attr.type === "multiselect"
              ? options.map((opt) => {
                  const selected = Array.isArray(current) && current.includes(opt);
                  return (
                    <Pressable
                      key={opt}
                      disabled={disabled}
                      onPress={() => {
                        const arr = Array.isArray(current) ? [...current] : [];
                        const next = selected ? arr.filter((x) => x !== opt) : [...arr, opt];
                        onChange(upsert(responses, attr.question, next));
                      }}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 6,
                        borderWidth: 1,
                        borderColor: selected ? colors.yellow : colors.border,
                        backgroundColor: selected ? "rgba(224,248,64,0.1)" : colors.card,
                      }}
                    >
                      <AppText
                        style={{
                          color: selected ? colors.yellow : colors.foreground,
                          fontFamily: fonts.regular,
                        }}
                      >
                        {opt}
                      </AppText>
                    </Pressable>
                  );
                })
              : null}

            {attr.type === "file" && (
              <AttachmentPicker
                value={fileUrls}
                onChange={(next) => onChange(upsert(responses, attr.question, next))}
                max={attr.maxFiles ?? 3}
                disabled={disabled}
                hint={t("profile.editProfile.helperText.maxFileSize")}
              />
            )}

            {attr.type === "voice" && (
              <VoiceRecorder
                value={fileUrls}
                onChange={(next) => onChange(upsert(responses, attr.question, next))}
                maxFiles={attr.maxFiles ?? 1}
                maxSizeMB={attr.maxSizeMB ?? 25}
                disabled={disabled}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
