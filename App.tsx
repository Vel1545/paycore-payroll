import "./global.css";
import "./src/components/web/webDesktopStyles";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState, useEffect } from "react";
import { View, Platform, ActivityIndicator, TouchableOpacity, AppState, Alert } from "react-native";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import * as Linking from "expo-linking";
import { NavigationContainer,useNavigation,type LinkingOptions } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatUnread, useOpenChatFromPush } from "./src/utils/Usechatunread";
import { useResponsive } from "./src/hooks/useResponsive";
import WebSidebar from "./src/components/WebSidebar";

// 1. Mandatory Headless Background Task Import (defines the shift-location and admin-ping background tasks)
import { registerPingListeners } from "./src/services/shiftTrackingManager";
import CheckoutApprovalsScreen from "./src/screens/Checkoutapprovalsscreen ";
import MyCheckoutRequestsScreen from "./src/screens/Mycheckoutrequestsscreen ";
import SalaryViewScreen from "./src/screens/Salaryviewscreen";

// Icons
import { FingerprintIcon } from "phosphor-react-native";
import { House, MessagesSquare, CalendarClock, UserRoundCog } from "lucide-react-native";

// Screens
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ApplyScreen from "./src/screens/ApplyScreen";
import MyHubScreen from "./src/screens/MyHubScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import ApprovalsScreen from "./src/screens/ApprovalsScreen";
import AttendanceScreen from "./src/screens/AttendanceScreen";
import CelebrationsScreen from "./src/screens/CelebrationsScreen";
import AdminHubScreen from "./src/screens/AdminHubScreen";
import AdminReportsScreen from "./src/screens/AdminReportsScreen";
import UserDirectoryScreen from "./src/screens/UserDirectoryScreen";
import HrPolicyScreen from "./src/screens/HrPolicyScreen";
import PunchClockScreen from "./src/screens/PunchClockScreen";
import ChatScreen from "./src/screens/ChatScreen";
import CandidateFormRoute from "./src/screens/CandidateFormRoute";
import AdminOnboardingSubmissionsScreen from "./src/screens/AdminOnboardingSubmissionsScreen";
import LiveTrackingScreen from "./src/screens/LiveTrackingScreen";
import AttendanceAuditTabsScreen from "./src/screens/AttendanceAuditTabsScreen";
import NotificationsScreen from "./src/screens/Notificationsscreen";
import AdminHolidaysScreen from "./src/screens/Adminholidaysscreen";

// Context & Storage
import { AuthProvider } from "./src/context/AuthContext";
import { getOfflineSession, saveOfflineSession, clearActiveSessionOnly } from "./src/utils/authStorage";
import { BASE_HOST } from "./src/constants/config";
import { UserSession } from "./src/services/UserSession";
import { installAuthFetch, loadAuthToken, onSessionExpired, setAuthToken } from "./src/services/apiAuth";
import { recheckDevice, applyServerUser } from "./src/services/deviceRecheck";
import AppUpdateGate from "./src/components/AppUpdateGate";
import BirthdayTodayPopup from "./src/components/BirthdayTodayPopup";

// Every fetch to our server now carries the login token (also inside background tasks)
installAuthFetch();
loadAuthToken();

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

// ==========================================
// NOTCHED CENTER BUTTON
// ==========================================
const NotchedCenterButton = ({ onPress }: any) => (
  <View style={{ width: 72, height: 64, alignItems: "center", justifyContent: "flex-start" }}>
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={{
        position: "absolute",
        top: -12,
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: "#150F38",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#5B4FD1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 12,
        borderWidth: 4,
        borderColor: "#FFFFFF",
      }}
    >
      <FingerprintIcon size={26} color="#FFFFFF" weight="bold" />
    </TouchableOpacity>
  </View>
);

// Website addresses for every page, so refresh and the browser's back button keep the page
const webLinkingConfig = {
  screens: {
    Login: "login",
    MainTabs: {
      path: "",
      screens: {
        Home: "home",
        Chat: "chat",
        PunchClock: "punch-clock",
        Attendance: "attendance",
        Profile: "settings",
        Apply: "apply",
        Approvals: "approvals",
        Celebrations: "celebrations",
        AdminHub: "admin-hub",
        AdminOnboardingSubmissions: "admin-onboarding-submissions",
        AdminReports: "admin-reports",
        MyHub: "my-hub",
        UserDirectory: "user-directory",
        HrPolicy: "hr-policy",
        CheckoutApprovals: "checkout-approvals",
        MyCheckoutRequests: "my-checkout-requests",
        SalaryView: "salary-view",
        Notifications: "notifications",
        AdminHolidays: "admin-holidays",
        LiveTracking: "live-tracking",
        AttendanceAuditTabs: "attendance-audit",
      },
    },
  },
};

// React Navigation Deep Linking Configuration
const linking: LinkingOptions<any> = {
  prefixes: [
    Linking.createURL("/"),
    "paycore://",
    `${BASE_HOST}`,
  ],
  config: Platform.OS === "web" ? webLinkingConfig : {
    screens: {
      Home: "home",
      Chat: "chat",
      PunchClock: "punch-clock",
      Attendance: "attendance",
      Profile: "profile",
      Apply: "apply",
      Approvals: "approvals",
      Celebrations: "celebrations",
      AdminHub: "admin-hub",
      AdminOnboardingSubmissions: "admin-onboarding-submissions",
      AdminReports: "admin-reports",
      MyHub: "my-hub",
      UserDirectory: "user-directory",
      LiveTracking: "live-tracking",
      AttendanceAuditTabs: "attendance-audit",
    },
  },
};

function MainTabs({ userSession, onLogout }: { userSession: any; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, Platform.OS === "android" ? 50 : 16);

  // unread chat number on the Chats tab; tapping a chat push opens that room
  const { total: chatUnread } = useChatUnread(userSession?.empId);
  const navigation = useNavigation<any>();
  useOpenChatFromPush(navigation);

  // Admin "Ping now" / "Phone status" requests arrive as silent pushes (Android)
  useEffect(() => registerPingListeners(), []);

  // Laptop/PC website: left menu instead of the floating bottom bar. Phones keep the bottom bar.
  const { isWebDesktop } = useResponsive();

  return (
    <>
    {/* Once a day: "Today is Raju's birthday!" popup (opens Celebrations) */}
    <BirthdayTodayPopup empId={userSession?.empId} navigation={navigation} />
    <Tab.Navigator
      // Website: back returns to the page you came from. The phone apps keep their current back behaviour.
      {...(Platform.OS === "web" ? { backBehavior: "history" as const } : {})}
      {...(isWebDesktop ? { tabBar: (props: any) => <WebSidebar {...props} /> } : {})}
      screenOptions={{
        ...(isWebDesktop ? { tabBarPosition: "left" as const } : {}),
        headerShown: false,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true, 
        tabBarLabelPosition: "below-icon",
        tabBarActiveTintColor: "#5B4FD1",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarItemStyle: {
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 2,
        },
        tabBarStyle: {
          position: "absolute",
          marginHorizontal: 8,
          bottom: bottomOffset,
          height: 64,
          backgroundColor: "#FFFFFF",
          borderRadius: 18,
          borderTopWidth: 0,
          paddingBottom: 8,
          paddingTop: 4,
          shadowColor: "#5B4FD1",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 18,
          elevation: 10,
          borderWidth: 1,
          borderColor: "#F1EFFB",
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          marginTop: 2,
        },
      }}
    >
      {/* TAB 1: HOME */}
      <Tab.Screen
        name="Home"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, focused }) => (
            <House color={focused ? "#5B4FD1" : color} size={20} />
          ),
        }}
      >
        {(props) => (
          <HomeScreen
            {...props}
            userSession={userSession}
            onLogout={onLogout}
          />
        )}
      </Tab.Screen>

      {/* TAB 2: CHATS */}
      <Tab.Screen
        name="Chat"
        options={{
          tabBarLabel: "Chats",
          tabBarBadge: chatUnread > 0 ? (chatUnread > 99 ? "99+" : chatUnread) : undefined,
tabBarBadgeStyle: { backgroundColor: "#16A34A", color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
          tabBarIcon: ({ color, focused }) => (
            <MessagesSquare color={focused ? "#5B4FD1" : color} size={20} />
          ),
        }}
      >
        {(props) => <ChatScreen {...props} userSession={userSession} />}
      </Tab.Screen>

      {/* TAB 3: CENTER NOTCHED SCANNER */}
      <Tab.Screen
        name="PunchClock"
        component={PunchClockScreen}
        options={{
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: (props) => <NotchedCenterButton {...props} />,
        }}
      />

      {/* TAB 4: ATTENDANCE */}
      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{
          tabBarLabel: "Attendance",
          tabBarIcon: ({ color, focused }) => (
            <CalendarClock color={focused ? "#5B4FD1" : color} size={20} />
          ),
        }}
      />

      {/* TAB 5: PROFILE / SETTINGS */}
      <Tab.Screen
        name="Profile"
        options={{
          tabBarLabel: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <UserRoundCog color={focused ? "#5B4FD1" : color} size={20} />
          ),
        }}
      >
        {(props) => <ProfileScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>

      {/* Hidden Operational Routes */}
      <Tab.Screen name="Apply" component={ApplyScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tab.Screen name="Approvals" component={ApprovalsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tab.Screen name="Celebrations" component={CelebrationsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tab.Screen name="AdminHub" component={AdminHubScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tab.Screen name="AdminOnboardingSubmissions" component={AdminOnboardingSubmissionsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tab.Screen name="AdminReports" component={AdminReportsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tab.Screen name="MyHub" component={MyHubScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tab.Screen name="UserDirectory" component={UserDirectoryScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tab.Screen name="HrPolicy" component={HrPolicyScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tab.Screen name="CheckoutApprovals" component={CheckoutApprovalsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tab.Screen name="MyCheckoutRequests" component={MyCheckoutRequestsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
        <Tab.Screen name="SalaryView" component={SalaryViewScreen} options={{ tabBarItemStyle: { display: "none" } }}/>
        <Tab.Screen name="Notifications" options={{ tabBarItemStyle: { display: "none" } }}>
  {(props) => <NotificationsScreen {...props} userSession={userSession} />}</Tab.Screen>
  <Tab.Screen name="AdminHolidays" component={AdminHolidaysScreen} options={{ tabBarItemStyle: { display: "none" } }} />

      {/* Live Fleet Tracking & Route Polyline Maps */}
      <Tab.Screen name="LiveTracking" component={LiveTrackingScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      <Tab.Screen name="AttendanceAuditTabs" component={AttendanceAuditTabsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
    </Tab.Navigator>
    </>
  );
}

// ---- Security: deactivated users (users.is_active = false) are force-logged-out ----
const ACCOUNT_CHECK_INTERVAL_MS = 2 * 60 * 1000;

// Returns { active:false, message } only when the server CONFIRMS the account is inactive.
// Network/server errors return active:true so a bad connection never logs anyone out.
const fetchAccountStatus = async (empId: string): Promise<{ active: boolean; message?: string }> => {
  try {
    const res = await fetch(`${BASE_HOST}/api/auth/account-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empId }),
    });
    if (!res.ok) return { active: true };
    const data = await res.json();
    return data && data.active === false ? { active: false, message: data.message } : { active: true };
  } catch {
    return { active: true };
  }
};

const showDeactivatedAlert = (message?: string) => {
  const msg = message || "Your account has been deactivated. Please contact HR.";
  if (Platform.OS === "web") {
    try { window.alert(`Account Inactive\n\n${msg}`); } catch {}
  } else {
    Alert.alert("Account Inactive", msg, [{ text: "OK" }]);
  }
};

const rememberedEmpId = async (): Promise<string | null> => {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") return window.localStorage.getItem("paycore_remembered_emp_id");
    return await AsyncStorage.getItem("paycore_remembered_emp_id");
  } catch {
    return null;
  }
};

const showDeviceVerifyAlert = (message?: string) => {
  const msg = message || "This device needs to be verified again. Please sign in with your Employee ID and OTP.";
  if (Platform.OS === "web") {
    try { window.alert(`Verification required\n\n${msg}`); } catch {}
  } else {
    Alert.alert("Verification required", msg, [{ text: "OK" }]);
  }
};

// While a restored session's device check has not got a server answer yet (offline), try again this often
const DEVICE_RECHECK_RETRY_MS = 15 * 1000;

const clearRememberedLogin = async () => {
  try {
    await AsyncStorage.multiRemove(["paycore_remembered_emp_id", "@current_user_details"]);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.localStorage.removeItem("paycore_remembered_emp_id");
    }
  } catch {}
};

// Update gate first: an outdated phone app shows the update screen instead of the app
export default function App() {
  return (
    <AppUpdateGate>
      <AppRoot />
    </AppUpdateGate>
  );
}

function AppRoot() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [userSession, setUserSession] = useState<{
    isAuthenticated: boolean;
    empId: string;
    isAdmin: boolean;
  }>({
    isAuthenticated: false,
    empId: "",
    isAdmin: false,
  });

  const [initialDeepLinkRoute, setInitialDeepLinkRoute] = useState<string | null>(null);
  // true when the session was restored at start (no server call yet): the device is checked in the background
  const deviceCheckPending = React.useRef(false);

  useEffect(() => {
    const restoreSessionAndCheckLink = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && initialUrl.includes("candidate-form")) {
          setInitialDeepLinkRoute(initialUrl);
        }

        // Offline start: the last successful login opens Home straight away, without waiting for the server.
        // Needs all three: the saved session, the remembered ID (cleared by logout) and the login token.
        // The device, the account and the role are then checked with the server in the background (below);
        // a refusal logs the user out exactly as before.
        const saved = await getOfflineSession();
        const remembered = await rememberedEmpId();
        const token = await loadAuthToken();
        if (saved && token && remembered && remembered.trim().toUpperCase() === saved.empId) {
          // name / role / designation saved at login (the screens read them from UserSession)
          await UserSession.init();
          deviceCheckPending.current = true;
          setUserSession({
            isAuthenticated: true,
            empId: saved.empId,
            isAdmin: saved.isAdmin,
          });
        }
      } catch (err) {
        console.log("Session restore check failed:", err);
      } finally {
        setInitialLoading(false);
      }
    };

    restoreSessionAndCheckLink();

    // An onboarding link opened while the app is already running
    const urlSub = Linking.addEventListener("url", ({ url }) => {
      if (url && url.includes("candidate-form")) setInitialDeepLinkRoute(url);
    });
    return () => urlSub.remove();
  }, []);

  const handleLogout = async () => {
    await clearActiveSessionOnly();
    setUserSession({
      isAuthenticated: false,
      empId: "",
      isAdmin: false,
    });
  };

  // While logged in: re-check account status on app resume and every 2 minutes.
  // If HR sets is_active = false, the user is logged out immediately.
  useEffect(() => {
    if (!userSession.isAuthenticated || !userSession.empId) return;
    const empId = userSession.empId;
    let cancelled = false;

    const verify = async () => {
      const acct = await fetchAccountStatus(empId);
      if (!cancelled && !acct.active) {
        cancelled = true;
        await clearRememberedLogin();
        await handleLogout();
        showDeactivatedAlert(acct.message);
      }
    };

    // The server refused the login token and its silent renewal: back to the login screen
    const unsubscribeExpired = onSessionExpired(async (reason) => {
      if (cancelled) return;
      cancelled = true;
      if (reason === "ACCOUNT_INACTIVE") {
        await clearRememberedLogin();
        await handleLogout();
        showDeactivatedAlert();
        return;
      }
      await handleLogout();
      const msg = "Your session has expired. Please log in again.";
      if (Platform.OS === "web") {
        try { window.alert(msg); } catch {}
      } else {
        Alert.alert("Session expired", msg, [{ text: "OK" }]);
      }
    });

    // Restored (offline) start: the same device check the login screen's auto-login does, in the background.
    // Offline / server error -> keep the user in and try again (every 15 s, on resume, with the 2-minute check).
    let rechecking = false;
    const recheck = async () => {
      if (!deviceCheckPending.current || rechecking || cancelled) return;
      rechecking = true;
      try {
        const r = await recheckDevice(empId);
        if (cancelled || r.kind === "OFFLINE") return;
        deviceCheckPending.current = false;
        if (r.kind === "OK") {
          if (r.token) await setAuthToken(r.token);
          const isAdmin = await applyServerUser(empId, r.user);
          await saveOfflineSession(empId, isAdmin);
          if (!cancelled) setUserSession((prev) => (prev.isAdmin === isAdmin ? prev : { ...prev, isAdmin }));
        } else if (r.kind === "INACTIVE") {
          cancelled = true;
          await clearRememberedLogin();
          await handleLogout();
          showDeactivatedAlert(r.message);
        } else {
          cancelled = true;
          await handleLogout();
          showDeviceVerifyAlert(r.message);
        }
      } finally {
        rechecking = false;
      }
    };

    verify();
    recheck();
    const timer = setInterval(verify, ACCOUNT_CHECK_INTERVAL_MS);
    const recheckTimer = setInterval(recheck, DEVICE_RECHECK_RETRY_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        verify();
        recheck();
      }
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      clearInterval(recheckTimer);
      sub.remove();
      unsubscribeExpired();
    };
  }, [userSession.isAuthenticated, userSession.empId]);

  if (initialLoading) {
    return (
      <SafeAreaProvider className="flex-1 bg-[#F6F5FC]">
        <View className="flex-1 justify-center items-center bg-[#F6F5FC]">
          <ActivityIndicator size="large" color="#5B4FD1" />
        </View>
      </SafeAreaProvider>
    );
  }

  // A candidate opening the onboarding link sees ONLY the form: no login, no tabs, no employee screens.
  if (initialDeepLinkRoute) {
    return (
      <SafeAreaProvider className="flex-1 bg-[#F6F5FC]">
        <CandidateFormRoute />
      </SafeAreaProvider>
    );
  }

  const isUserAllowedIn = userSession.isAuthenticated;

  return (
    <AuthProvider>
      <SafeAreaProvider className="flex-1 bg-[#F6F5FC]">
        <View className="flex-1 bg-[#F6F5FC]">
          {/* Top-level NavigationContainer wraps all routes */}
          <NavigationContainer linking={linking}>
            <RootStack.Navigator screenOptions={{ headerShown: false }}>
              {!isUserAllowedIn ? (
                <RootStack.Screen name="Login">
                  {(props) => (
                    <LoginScreen
                      {...props}
                      onLoginSuccess={(authData: any) => {
                        // the server just accepted this login: no background device check needed
                        deviceCheckPending.current = false;
                        // remember it for the next (possibly offline) start
                        saveOfflineSession(authData.empId, !!authData.isAdmin);
                        setUserSession({
                          isAuthenticated: true,
                          empId: authData.empId,
                          isAdmin: authData.isAdmin,
                        });
                      }}
                    />
                  )}
                </RootStack.Screen>
              ) : (
                <RootStack.Screen name="MainTabs">
                  {() => (
                    <MainTabs
                      userSession={userSession}
                      onLogout={handleLogout}
                    />
                  )}
                </RootStack.Screen>
              )}
            </RootStack.Navigator>
          </NavigationContainer>
        </View>
      </SafeAreaProvider>
    </AuthProvider>
  );
}