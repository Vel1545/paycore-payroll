// Shared design for the laptop/PC website: colours, text styles and basic components.
// Change a value here and every page built from this file follows.
import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft } from "lucide-react-native";

export const ui = {
  color: {
    primary: "#5B4FD1",
    primaryHover: "#4C41BD",
    primarySoft: "#F1EFFC",
    ink: "#1F1B3D",
    text: "#3D3960",
    muted: "#6E6A94",
    placeholder: "#9C98BC",
    border: "#E4E2F0",
    borderStrong: "#CFCCE3",
    canvas: "#F7F7FB",
    surface: "#FFFFFF",
    hover: "#F6F5FC",
    neutralSoft: "#F0EFF6",
    success: "#15803D",
    successSoft: "#E8F7EE",
    danger: "#C2352C",
    dangerSoft: "#FDECEB",
  },
  radius: { control: 8, card: 12 },
  font: "Inter, 'Segoe UI', system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif",
};

const c = ui.color;

const TEXT: Record<string, TextStyle> = {
  title: { fontSize: 22, lineHeight: 28, fontWeight: "600", color: c.ink },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: "600", color: c.ink },
  section: { fontSize: 15, lineHeight: 22, fontWeight: "600", color: c.ink },
  body: { fontSize: 14, lineHeight: 20, fontWeight: "400", color: c.text },
  strong: { fontSize: 14, lineHeight: 20, fontWeight: "500", color: c.ink },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "500", color: c.muted },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400", color: c.muted },
};

export function Txt({
  variant = "body",
  style,
  numberOfLines,
  children,
}: {
  variant?: keyof typeof TEXT | string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  children: React.ReactNode;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: ui.font }, TEXT[variant], style]}>
      {children}
    </Text>
  );
}

export function Btn({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  icon?: React.ReactNode;
  disabled?: boolean;
  busy?: boolean;
}) {
  const primary = variant === "primary";
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={off}
      style={(state: any) => ({
        height: 38,
        paddingHorizontal: 16,
        borderRadius: ui.radius.control,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderWidth: 1,
        opacity: off ? 0.6 : 1,
        borderColor: primary ? c.primary : c.borderStrong,
        backgroundColor: primary ? (state.hovered ? c.primaryHover : c.primary) : state.hovered ? c.hover : c.surface,
      })}
    >
      {busy ? <ActivityIndicator size="small" color={primary ? "#FFFFFF" : c.primary} /> : icon}
      <Text style={{ fontFamily: ui.font, fontSize: 14, fontWeight: "500", color: primary ? "#FFFFFF" : c.ink }}>{label}</Text>
    </Pressable>
  );
}

export function IconBtn({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(state: any) => ({
        width: 36,
        height: 36,
        borderRadius: ui.radius.control,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: state.hovered ? c.neutralSoft : "transparent",
      })}
    >
      {children}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: ui.radius.card }, style]}>
      {children}
    </View>
  );
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "primary" | "success" | "danger" }) {
  const tones = {
    neutral: [c.neutralSoft, c.text],
    primary: [c.primarySoft, c.primary],
    success: [c.successSoft, c.success],
    danger: [c.dangerSoft, c.danger],
  }[tone];
  return (
    <View style={{ backgroundColor: tones[0], borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
      <Text style={{ fontFamily: ui.font, fontSize: 12, lineHeight: 18, fontWeight: "500", color: tones[1] }}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 36 }: { name?: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.primarySoft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontFamily: ui.font, fontSize: Math.round(size * 0.4), fontWeight: "600", color: c.primary }}>
        {name?.trim()?.charAt(0)?.toUpperCase() || "U"}
      </Text>
    </View>
  );
}

export function Tabs({
  items,
  active,
  onChange,
}: {
  items: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 24, borderBottomWidth: 1, borderBottomColor: c.border }}>
      {items.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.key)}
            style={{ paddingVertical: 10, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: on ? c.primary : "transparent" }}
          >
            <Text style={{ fontFamily: ui.font, fontSize: 14, fontWeight: on ? "600" : "500", color: on ? c.primary : c.muted }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A value shown for reading only: plain text, so it does not look like an editable box
export function Detail({ label, value, style }: { label: string; value?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <View style={style}>
      <Txt variant="label" style={{ marginBottom: 4 }}>{label}</Txt>
      {typeof value === "string" || typeof value === "number" || empty ? (
        <Txt variant="strong" style={empty ? { color: c.placeholder, fontWeight: "400" } : undefined}>
          {empty ? "Not provided" : value}
        </Txt>
      ) : (
        value
      )}
    </View>
  );
}

// Text box with a focus ring. Pass label for a form field, or leading for an icon inside the box.
export function Input({
  label,
  leading,
  trailing,
  style,
  ...rest
}: TextInputProps & { label?: string; leading?: React.ReactNode; trailing?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const [focused, setFocused] = useState(false);
  const disabled = rest.editable === false;
  return (
    <View style={style}>
      {label ? <Txt variant="label" style={{ marginBottom: 6 }}>{label}</Txt> : null}
      <View
        style={{
          minHeight: 40,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: rest.multiline ? "flex-start" : "center",
          gap: 8,
          borderWidth: 1,
          borderRadius: ui.radius.control,
          borderColor: focused ? c.primary : c.borderStrong,
          backgroundColor: disabled ? c.neutralSoft : c.surface,
          ...(focused ? ({ boxShadow: `0 0 0 3px ${c.primarySoft}` } as any) : null),
        }}
      >
        {leading}
        <TextInput
          {...rest}
          placeholderTextColor={c.placeholder}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={
            {
              flex: 1,
              minWidth: 0,
              paddingVertical: 9,
              fontFamily: ui.font,
              fontSize: 14,
              color: disabled ? c.muted : c.ink,
              outlineStyle: "none",
            } as any
          }
        />
        {trailing}
      </View>
    </View>
  );
}

// Standard top bar of a page: back, title, then the page's own actions on the right.
export function WebPageHeader({
  title,
  subtitle,
  breadcrumb,
  onBack,
  leading,
  children,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  onBack?: () => void;
  leading?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const navigation = useNavigation<any>();
  const back = onBack ?? (() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home")));
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        minHeight: 72,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: c.surface,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
        <IconBtn label="Go back" onPress={back}>
          <ChevronLeft size={20} color={c.ink} />
        </IconBtn>
        {leading}
        <View style={{ flexShrink: 1, marginLeft: leading ? 4 : 0 }}>
          {breadcrumb ? <Txt variant="caption">{breadcrumb}</Txt> : null}
          <Txt variant="title" numberOfLines={1}>{title}</Txt>
          {subtitle ? <Txt variant="caption" numberOfLines={1}>{subtitle}</Txt> : null}
        </View>
      </View>
      {children ? <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 }}>{children}</View> : null}
    </View>
  );
}

// Two equal columns on a card or form
export const twoColumn: any = { width: "calc(50% - 12px)" };

// Slim scrollbar for panels that scroll on their own
export const thinScrollbar: any = { scrollbarWidth: "thin", scrollbarColor: `${c.borderStrong} transparent` };
