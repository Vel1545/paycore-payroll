import { useWindowDimensions } from "react-native";

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
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