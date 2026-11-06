import { Platform, useWindowDimensions } from "react-native";

// Laptop/PC layout starts here. Keep in step with the "lg" Tailwind breakpoint.
export const DESKTOP_MIN_WIDTH = 1024;
// Pages use the full window, up to this width (keeps very wide monitors readable).
// Keep in step with maxWidth.page in tailwind.config.js.
export const PAGE_MAX_WIDTH = 1600;
export const SIDEBAR_WIDTH = 232;

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < DESKTOP_MIN_WIDTH;
  const isDesktop = width >= DESKTOP_MIN_WIDTH;
  // The website on a laptop/PC. Always false in the Android and iOS apps.
  const isWebDesktop = Platform.OS === "web" && isDesktop;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    isWebDesktop,
    // Enterprise typography scale
    fontSize: {
      title: isDesktop ? 26 : 20,
      subTitle: isDesktop ? 15 : 12,
      body: isDesktop ? 14 : 12,
      caption: isDesktop ? 12 : 10,
      badge: isDesktop ? 11 : 9,
    },
    // Standard pane widths
    sidebarWidth: isDesktop ? 380 : "100%",
  };
}
