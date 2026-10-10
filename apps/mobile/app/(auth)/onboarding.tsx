import { useCallback, useEffect, useState } from "react";
import { Dimensions, Image, Linking, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInRight,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AuthBrand } from "../../src/components/AuthBrand";
import { AppText, colors } from "../../src/components/ui";
import { useLocale } from "../../src/providers/locale";
import { t } from "../../src/i18n";
import { fonts, typeScale, BRAND } from "../../src/theme/brand";
import { row } from "../../src/rtl";
import { markOnboardingComplete } from "../../src/lib/onboarding";

const { width: SCREEN_W } = Dimensions.get("window");

/** Featured work samples from the public landing gallery (`#gallery`). */
const WORK_IMAGES = [1, 2, 3, 4, 5, 6].map(
  (n) => `https://wengz.tech/images/landing/gallery/${n}.webp`
);

type SlideId = "credits" | "creators" | "works";

const SLIDES: SlideId[] = ["credits", "creators", "works"];

const SLIDE_META: Record<
  Exclude<SlideId, "works">,
  { icon: keyof typeof Ionicons.glyphMap; accent: string }
> = {
  credits: { icon: "diamond-outline", accent: BRAND.colors.yellow },
  creators: { icon: "people-outline", accent: "#C4B5FD" },
};

function Atmosphere() {
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <View
        style={{
          position: "absolute",
          top: -80,
          right: -60,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: "rgba(105,13,212,0.45)",
          opacity: 0.55,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 180,
          left: -90,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: "rgba(224,248,64,0.12)",
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 120,
          right: -40,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: "rgba(105,13,212,0.28)",
        }}
      />
    </View>
  );
}

function WorkGallery({ onOpenWeb }: { onOpenWeb: () => void }) {
  const hero = WORK_IMAGES[0]!;
  const rest = WORK_IMAGES.slice(1, 5);
  const tileW = (SCREEN_W - 48 - 10) / 2;

  return (
    <View style={{ width: "100%", gap: 10 }}>
      <View style={{ ...row(), gap: 10 }}>
        <Image
          source={{ uri: hero }}
          style={{
            width: tileW,
            height: tileW * 1.25,
            borderRadius: 16,
            backgroundColor: colors.muted,
          }}
          resizeMode="cover"
        />
        <View style={{ width: tileW, gap: 10 }}>
          {rest.slice(0, 2).map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={{
                width: tileW,
                height: (tileW * 1.25 - 10) / 2,
                borderRadius: 14,
                backgroundColor: colors.muted,
              }}
              resizeMode="cover"
            />
          ))}
        </View>
      </View>
      <View style={{ ...row(), gap: 10 }}>
        {rest.slice(2, 4).map((uri) => (
          <Image
            key={uri}
            source={{ uri }}
            style={{
              flex: 1,
              height: 72,
              borderRadius: 12,
              backgroundColor: colors.muted,
            }}
            resizeMode="cover"
          />
        ))}
      </View>
      <Pressable
        onPress={onOpenWeb}
        style={{
          ...row(),
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "rgba(224,248,64,0.35)",
          backgroundColor: "rgba(224,248,64,0.08)",
        }}
      >
        <Ionicons name="open-outline" size={16} color={BRAND.colors.yellow} />
        <AppText
          compact
          style={{
            color: BRAND.colors.yellow,
            fontFamily: fonts.medium,
            ...typeScale.md,
          }}
        >
          {t("auth.onboarding.works.seeGallery")}
        </AppText>
      </Pressable>
    </View>
  );
}

function FeatureVisual({ id }: { id: Exclude<SlideId, "works"> }) {
  const meta = SLIDE_META[id];
  const pulse = useSharedValue(0);
  const chips = ["a", "b", "c"] as const;

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.08]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.35, 0.7]),
  }));

  return (
    <View
      style={{
        width: "100%",
        aspectRatio: 1.05,
        borderRadius: 28,
        overflow: "hidden",
        backgroundColor: "rgba(21,16,31,0.95)",
        borderWidth: 1,
        borderColor: "rgba(224,248,64,0.16)",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: "rgba(105,13,212,0.22)",
        }}
      />
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 160,
            height: 160,
            borderRadius: 80,
            borderWidth: 1,
            borderColor: "rgba(224,248,64,0.25)",
          },
          ringStyle,
        ]}
      />
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 32,
          backgroundColor: "rgba(224,248,64,0.12)",
          borderWidth: 1,
          borderColor: "rgba(224,248,64,0.35)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        <Ionicons name={meta.icon} size={42} color={meta.accent} />
      </View>
      <AuthBrand height={28} />
      <View style={{ ...row(), flexWrap: "wrap", gap: 8, marginTop: 20, justifyContent: "center" }}>
        {chips.map((key) => (
          <View
            key={key}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
            }}
          >
            <AppText
              compact
              style={{
                color: colors.foreground,
                fontFamily: fonts.medium,
                ...typeScale.sm,
              }}
            >
              {t(`auth.onboarding.${id}.highlights.${key}`)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function SlideVisual({ id, onOpenWeb }: { id: SlideId; onOpenWeb: () => void }) {
  if (id === "works") return <WorkGallery onOpenWeb={onOpenWeb} />;
  return <FeatureVisual id={id} />;
}

function ProgressTrack({ index, total }: { index: number; total: number }) {
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
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.1)",
        overflow: "hidden",
        marginBottom: 8,
      }}
    >
      <Animated.View
        style={[
          {
            height: "100%",
            borderRadius: 2,
            backgroundColor: BRAND.colors.yellow,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { locale, direction } = useLocale();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index]!;
  const isFirst = index === 0;
  const isLast = index === SLIDES.length - 1;
  const backIcon = direction === "rtl" ? "chevron-forward" : "chevron-back";
  const nextIcon = direction === "rtl" ? "chevron-back" : "chevron-forward";

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
        backgroundColor: colors.background,
        paddingTop: insets.top + 8,
        paddingBottom: Math.max(insets.bottom, 16),
        paddingHorizontal: 24,
      }}
    >
      <Atmosphere />

      <View
        style={{
          ...row(),
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          zIndex: 1,
        }}
      >
        <AppText
          compact
          style={{
            color: colors.mutedForeground,
            fontFamily: fonts.medium,
            ...typeScale.sm,
          }}
        >
          {index + 1} / {SLIDES.length}
        </AppText>
        <Pressable onPress={() => void finish()} hitSlop={12}>
          <AppText
            compact
            style={{
              color: colors.mutedForeground,
              fontFamily: fonts.medium,
              ...typeScale.md,
            }}
          >
            {t("auth.onboarding.skip")}
          </AppText>
        </Pressable>
      </View>

      <ProgressTrack index={index} total={SLIDES.length} />

      <View style={{ flex: 1, justifyContent: "center", zIndex: 1 }}>
        <Animated.View key={slide} entering={FadeIn.duration(260)} exiting={FadeOut.duration(140)}>
          <Animated.View entering={SlideInRight.duration(300).easing(Easing.out(Easing.cubic))}>
            <SlideVisual id={slide} onOpenWeb={openGallery} />
          </Animated.View>

          <AppText
            align="center"
            style={{
              color: colors.foreground,
              fontFamily: fonts.semiBold,
              ...typeScale.display,
              fontSize: 26,
              lineHeight: 32,
              marginTop: 26,
              marginBottom: 10,
            }}
          >
            {t(`auth.onboarding.${slide}.title`)}
          </AppText>
          <AppText
            align="center"
            style={{
              color: colors.mutedForeground,
              fontFamily: fonts.regular,
              ...typeScale.md,
              lineHeight: 22,
              paddingHorizontal: 4,
            }}
          >
            {t(`auth.onboarding.${slide}.body`)}
          </AppText>
        </Animated.View>
      </View>

      <View style={{ ...row(), gap: 10, zIndex: 1 }}>
        <Pressable
          onPress={goBack}
          disabled={isFirst}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 48,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isFirst ? "rgba(255,255,255,0.06)" : colors.border,
            backgroundColor: isFirst ? "transparent" : "rgba(255,255,255,0.05)",
            ...row(),
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            opacity: isFirst ? 0.35 : pressed ? 0.8 : 1,
          })}
        >
          <Ionicons name={backIcon} size={18} color={colors.foreground} />
          <AppText
            compact
            style={{
              color: colors.foreground,
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
            flex: 1.35,
            minHeight: 48,
            borderRadius: 12,
            backgroundColor: BRAND.colors.purple,
            ...row(),
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity: pressed ? 0.85 : 1,
            shadowColor: BRAND.colors.purple,
            shadowOpacity: 0.45,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
          })}
        >
          <AppText
            compact
            style={{
              color: colors.foreground,
              fontFamily: fonts.semiBold,
              ...typeScale.md,
            }}
          >
            {isLast ? t("auth.onboarding.getStarted") : t("auth.onboarding.next")}
          </AppText>
          <Ionicons
            name={isLast ? "arrow-forward" : nextIcon}
            size={18}
            color={isLast ? BRAND.colors.yellow : colors.foreground}
          />
        </Pressable>
      </View>
    </View>
  );
}
