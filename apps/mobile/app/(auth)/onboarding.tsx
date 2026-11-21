import { useCallback, useEffect, useState } from "react";
import { Image, Linking, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInRight,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AppText } from "../../src/components/ui";
import { BrandLogo } from "../../src/components/BrandLogo";
import { CreditIcon } from "../../src/components/CreditIcon";
import { CreatorsIcon } from "../../src/components/CreatorsIcon";
import { ThemeToggle } from "../../src/components/ThemeToggle";
import { useLocale } from "../../src/providers/locale";
import { useTheme } from "../../src/providers/theme";
import { t, type AppLocale } from "../../src/i18n";
import { fonts, typeScale } from "../../src/theme/brand";
import { row } from "../../src/rtl";
import { consumeForceOnboarding, markOnboardingComplete } from "../../src/lib/onboarding";

/** Bundled featured works — reliable vs remote URLs in Expo. */
const WORK_IMAGES = [
  require("../../assets/gallery/1.png"),
  require("../../assets/gallery/2.png"),
  require("../../assets/gallery/3.png"),
  require("../../assets/gallery/4.png"),
  require("../../assets/gallery/5.png"),
  require("../../assets/gallery/6.png"),
  require("../../assets/gallery/7.png"),
  require("../../assets/gallery/8.png"),
] as const;

const CARD_W = 132;
const CARD_H = Math.round(CARD_W * (4 / 3)); // portrait
const CARD_GAP = 12;
const LOOP_WIDTH = WORK_IMAGES.length * (CARD_W + CARD_GAP);
/** ~px/sec — smooth continuous drift, no pause between loops. */
const MARQUEE_SPEED = 38;

type SlideId = "credits" | "creators" | "works";

const SLIDES: SlideId[] = ["credits", "creators", "works"];

/** Theme-aware onboarding tokens (same keys as the old light UI map). */
function useOnboardingUi() {
  const { colors, isDark } = useTheme();
  return {
    bg: colors.background,
    ink: colors.foreground,
    muted: colors.mutedForeground,
    card: colors.card,
    track: colors.track,
    skipBg: colors.chip,
    border: colors.border,
    purple: colors.purple,
    lime: colors.yellow,
    isDark,
  };
}

/** Feature chips — icons mirror the product mockups. */
const SLIDE_FEATURES: Record<
  Exclude<SlideId, "works">,
  { key: "a" | "b" | "c"; icon: keyof typeof Ionicons.glyphMap }[]
> = {
  credits: [
    { key: "a", icon: "grid-outline" },
    { key: "b", icon: "videocam-outline" },
    { key: "c", icon: "stats-chart-outline" },
  ],
  creators: [
    { key: "a", icon: "people-outline" },
    { key: "b", icon: "stats-chart-outline" },
    { key: "c", icon: "create-outline" },
  ],
};

function AccentTitle({ slide }: { slide: SlideId }) {
  const UI = useOnboardingUi();
  const lead = t(`auth.onboarding.${slide}.titleLead`);
  const accent = t(`auth.onboarding.${slide}.titleAccent`);
  const trail = slide === "works" ? t("auth.onboarding.works.titleTrail") : "";

  return (
    <AppText
      align="center"
      style={{
        color: UI.ink,
        fontFamily: fonts.bold,
        fontSize: 28,
        lineHeight: 36,
        marginTop: 8,
        marginBottom: 10,
      }}
    >
      {lead}
      {lead ? " " : ""}
      <AppText
        compact
        style={{
          color: UI.purple,
          fontFamily: fonts.bold,
          fontSize: 28,
          lineHeight: 36,
        }}
      >
        {accent}
      </AppText>
      {trail ? ` ${trail}` : ""}
    </AppText>
  );
}

/** Step heroes — solid brand marks, no plate/BG. */
function HeroVisual({ slide }: { slide: Exclude<SlideId, "works"> }) {
  const { isDark } = useOnboardingUi();
  const tone = isDark ? "yellow" : "purple";
  return (
    <View style={{ marginTop: 10, marginBottom: 10 }}>
      {slide === "credits" ? (
        <CreditIcon size={112} tone={tone} />
      ) : (
        <CreatorsIcon size={112} tone={tone} />
      )}
    </View>
  );
}

function FeatureCards({ id }: { id: Exclude<SlideId, "works"> }) {
  const UI = useOnboardingUi();
  const items = SLIDE_FEATURES[id];

  return (
    <View style={{ ...row(), gap: 10, marginTop: 22, width: "100%" }}>
      {items.map((item) => (
        <View
          key={item.key}
          style={{
            flex: 1,
            aspectRatio: 1,
            borderRadius: 22,
            backgroundColor: UI.card,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 8,
            gap: 8,
          }}
        >
          <Ionicons name={item.icon} size={26} color={UI.purple} />
          <AppText
            align="center"
            compact
            style={{
              color: UI.purple,
              fontFamily: fonts.semiBold,
              fontSize: 11,
              lineHeight: 14,
            }}
          >
            {t(`auth.onboarding.${id}.highlights.${item.key}`)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** Infinite autoplay marquee — portrait tiles, no arrows/dots/pause. */
function WorkGallery({ onOpenWeb }: { onOpenWeb: () => void }) {
  const UI = useOnboardingUi();
  const offset = useSharedValue(0);
  // Two identical sets so when we jump back by LOOP_WIDTH the frame looks continuous.
  const track = [...WORK_IMAGES, ...WORK_IMAGES];

  useEffect(() => {
    const duration = Math.round((LOOP_WIDTH / MARQUEE_SPEED) * 1000);
    offset.value = 0;
    offset.value = withRepeat(
      withTiming(-LOOP_WIDTH, { duration, easing: Easing.linear }),
      -1,
      false
    );
    return () => {
      cancelAnimation(offset);
    };
  }, [offset]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <View style={{ width: "100%", marginTop: 2, marginBottom: 2 }}>
      <View style={{ width: "100%", overflow: "hidden" }} pointerEvents="none">
        <Animated.View
          style={[
            {
              flexDirection: "row",
              gap: CARD_GAP,
              height: CARD_H,
            },
            trackStyle,
          ]}
        >
          {track.map((source, i) => (
            <View
              key={`work-${i}`}
              style={{
                width: CARD_W,
                height: CARD_H,
                borderRadius: 18,
                overflow: "hidden",
                backgroundColor: UI.card,
                borderWidth: 1,
                borderColor: "rgba(105,13,212,0.08)",
              }}
            >
              <Image source={source} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            </View>
          ))}
        </Animated.View>
      </View>

      <GalleryCta onOpenWeb={onOpenWeb} />
    </View>
  );
}

function GalleryCta({ onOpenWeb }: { onOpenWeb: () => void }) {
  const UI = useOnboardingUi();
  return (
    <Pressable
      onPress={onOpenWeb}
      style={({ pressed }) => ({
        marginTop: 12,
        ...row(),
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: UI.lime,
        backgroundColor: pressed ? "rgba(224,248,64,0.12)" : "transparent",
        width: "100%",
      })}
    >
      <AppText
        compact
        style={{
          color: UI.purple,
          fontFamily: fonts.semiBold,
          ...typeScale.md,
        }}
      >
        {t("auth.onboarding.works.seeGallery")}
      </AppText>
      <Ionicons name="open-outline" size={16} color={UI.purple} />
    </Pressable>
  );
}

function ProgressTrack({ index, total }: { index: number; total: number }) {
  const UI = useOnboardingUi();
  const progress = useSharedValue((index + 1) / total);

  useEffect(() => {
    progress.value = withTiming((index + 1) / total, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [index, progress, total]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View
      style={{
        height: 5,
        borderRadius: 999,
        backgroundColor: UI.track,
        overflow: "hidden",
        marginBottom: 20,
      }}
    >
      <Animated.View
        style={[
          {
            height: "100%",
            borderRadius: 999,
            backgroundColor: UI.lime,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}

function LanguageToggle({
  locale,
  onChange,
}: {
  locale: AppLocale;
  onChange: (next: AppLocale) => void;
}) {
  const UI = useOnboardingUi();
  return (
    <View
      style={{
        ...row(),
        backgroundColor: UI.skipBg,
        borderRadius: 12,
        padding: 3,
        gap: 2,
      }}
    >
      {(
        [
          { key: "en" as AppLocale, label: "EN" },
          { key: "ar" as AppLocale, label: "ع" },
        ] as const
      ).map((opt) => {
        const active = locale === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t("common.language")}
            accessibilityState={{ selected: active }}
            style={{
              minWidth: 36,
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 10,
              backgroundColor: active ? UI.purple : "transparent",
              alignItems: "center",
            }}
          >
            <AppText
              compact
              style={{
                color: active ? "#FFFFFF" : UI.muted,
                fontFamily: fonts.semiBold,
                ...typeScale.sm,
              }}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { locale, direction, setLocale } = useLocale();
  const UI = useOnboardingUi();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index]!;
  const isFirst = index === 0;
  const isLast = index === SLIDES.length - 1;
  const backIcon = direction === "rtl" ? "chevron-forward" : "chevron-back";
  const nextIcon = direction === "rtl" ? "chevron-back" : "chevron-forward";
  const logoTone = UI.isDark ? "yellow" : "purple";

  useEffect(() => {
    consumeForceOnboarding();
  }, []);

  const finish = useCallback(async () => {
    await markOnboardingComplete();
    router.replace("/(auth)/welcome");
  }, []);

  const openGallery = useCallback(() => {
    void Linking.openURL(`https://wengz.tech/${locale}#gallery`);
  }, [locale]);

  const goNext = useCallback(() => {
    if (isLast) {
      void finish();
      return;
    }
    setIndex((i) => Math.min(i + 1, SLIDES.length - 1));
  }, [finish, isLast]);

  const goBack = useCallback(() => {
    if (isFirst) return;
    setIndex((i) => Math.max(i - 1, 0));
  }, [isFirst]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: UI.bg,
        paddingTop: insets.top + 10,
        paddingBottom: Math.max(insets.bottom, 16),
        paddingHorizontal: 22,
      }}
    >
      <View
        style={{
          ...row(),
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <View style={{ ...row(), alignItems: "center", gap: 8 }}>
          <LanguageToggle locale={locale} onChange={(next) => void setLocale(next)} />
          <ThemeToggle />
        </View>
        <Pressable
          onPress={() => void finish()}
          hitSlop={8}
          style={({ pressed }) => ({
            ...row(),
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 999,
            backgroundColor: UI.skipBg,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <AppText
            compact
            style={{
              color: UI.muted,
              fontFamily: fonts.medium,
              ...typeScale.md,
            }}
          >
            {t("auth.onboarding.skip")}
          </AppText>
          <Ionicons name={nextIcon} size={14} color={UI.muted} />
        </Pressable>
      </View>

      <ProgressTrack index={index} total={SLIDES.length} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingBottom: 8,
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View key={slide} entering={FadeIn.duration(240)} exiting={FadeOut.duration(120)}>
          <Animated.View entering={SlideInRight.duration(280).easing(Easing.out(Easing.cubic))}>
            <View style={{ alignItems: "center", width: "100%" }}>
              <BrandLogo height={52} tone={logoTone} style={{ marginBottom: 22 }} />

              {slide === "works" ? null : <HeroVisual slide={slide} />}

              <AccentTitle slide={slide} />

              <AppText
                align="center"
                style={{
                  color: UI.muted,
                  fontFamily: fonts.regular,
                  ...typeScale.md,
                  lineHeight: 22,
                  paddingHorizontal: 6,
                  marginBottom: slide === "works" ? 16 : 0,
                }}
              >
                {t(`auth.onboarding.${slide}.body`)}
              </AppText>

              {slide === "works" ? <WorkGallery onOpenWeb={openGallery} /> : null}
              {slide !== "works" ? <FeatureCards id={slide} /> : null}
            </View>
          </Animated.View>
        </Animated.View>
      </ScrollView>

      <View style={{ ...row(), gap: 10 }}>
        <Pressable
          onPress={goBack}
          disabled={isFirst}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 52,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: isFirst ? UI.skipBg : UI.border,
            backgroundColor: UI.bg,
            ...row(),
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            opacity: isFirst ? 0.4 : pressed ? 0.8 : 1,
          })}
        >
          <Ionicons name={backIcon} size={18} color={UI.ink} />
          <AppText
            compact
            style={{
              color: UI.ink,
              fontFamily: fonts.semiBold,
              ...typeScale.md,
            }}
          >
            {t("common.back")}
          </AppText>
        </Pressable>

        <Pressable
          onPress={goNext}
          style={({ pressed }) => ({
            flex: 1.25,
            minHeight: 52,
            borderRadius: 16,
            backgroundColor: UI.purple,
            ...row(),
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity: pressed ? 0.88 : 1,
            shadowColor: UI.purple,
            shadowOpacity: 0.28,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
          })}
        >
          <AppText
            compact
            style={{
              color: "#FFFFFF",
              fontFamily: fonts.semiBold,
              ...typeScale.md,
            }}
          >
            {isLast ? t("auth.onboarding.getStarted") : t("auth.onboarding.next")}
          </AppText>
          <Ionicons name={nextIcon} size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}
