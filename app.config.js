// Extends app.json with values that differ per build and must not be hard-coded.
//
// App variants (set APP_VARIANT in eas.json):
//   (none) / "production" -> "PayCore",      package com.femi9.payroll       (Play Store)
//   "test"                -> "PayCore Test", package com.femi.payroll.test  (testers; installs next to the real app)
//
// Firebase (needed for push notifications on Android):
//   google-services.json must contain BOTH Android apps (com.femi9.payroll and com.femi.payroll.test):
//   add both apps in the same Firebase project, then download google-services.json again.
//   Either put it in the project root, or upload it to EAS as a "file" environment variable:
//     eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production --environment preview
//   Until it exists, the app still builds - only Android push is unavailable.
//
// Google Maps (admin Live Tracking map on Android). The key must allow both package names:
//     eas env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value <key> --environment production --environment preview
const fs = require("fs");
const path = require("path");

const VARIANTS = {
  production: { name: "PayCore", package: "com.femi9.payroll", scheme: "paycore" },
  test: { name: "PayCore Test", package: "com.femi.payroll.test", scheme: "paycore-test" },
};

module.exports = ({ config }) => {
  const variantName = (process.env.APP_VARIANT || "production").trim().toLowerCase();
  const variant = VARIANTS[variantName] || VARIANTS.production;

  const localGoogleServices = path.join(__dirname, "google-services.json");
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ||
    (fs.existsSync(localGoogleServices) ? "./google-services.json" : undefined);

  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

  return {
    ...config,
    name: variant.name,
    scheme: variant.scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: variant.package,
    },
    android: {
      ...config.android,
      package: variant.package,
      ...(googleServicesFile ? { googleServicesFile } : {}),
      config: {
        ...config.android?.config,
        ...(mapsKey ? { googleMaps: { apiKey: mapsKey } } : {}),
      },
    },
    extra: {
      ...config.extra,
      appVariant: variantName in VARIANTS ? variantName : "production",
    },
  };
};
