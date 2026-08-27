// import * as Notifications from "expo-notifications";
// import * as Device from "expo-device";
// import { Platform } from "react-native";

// // Configure how notifications appear when app is active
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowBanner: true, // Replaces deprecated shouldShowAlert
//     shouldShowList: true,   // Shows in system notification center
//     shouldPlaySound: true,
//     shouldSetBadge: false,
//   }),
// });

// export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
//   let token = null;

//   if (Device.isDevice) {
//     const { status: existingStatus } = await Notifications.getPermissionsAsync();
//     let finalStatus = existingStatus;

//     if (existingStatus !== "granted") {
//       const { status } = await Notifications.requestPermissionsAsync();
//       finalStatus = status;
//     }

//     if (finalStatus !== "granted") {
//       console.warn("Failed to get push token for push notification!");
//       return null;
//     }

//     token = (await Notifications.getExpoPushTokenAsync()).data;
//   } else {
//     // Simulator/Web fallback token
//     token = "SIMULATOR_EXP_TOKEN_" + Math.random().toString(36).substring(7);
//   }

//   if (Platform.OS === "android") {
//     Notifications.setNotificationChannelAsync("default", {
//       name: "default",
//       importance: Notifications.AndroidImportance.MAX,
//       vibrationPattern: [0, 250, 250, 250],
//       lightColor: "#0D9488",
//     });
//   }

//   return token;
// };