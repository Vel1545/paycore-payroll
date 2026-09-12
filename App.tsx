import "./global.css";
import React, { useState, useEffect } from "react";
import { View, Platform, ActivityIndicator, TouchableOpacity } from "react-native";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import * as Linking from "expo-linking";
import { 
  HouseLineIcon, 
  HouseIcon,
  ChatsIcon, 
  CalendarIcon, 
  FingerprintIcon,
  ScanIcon,
  UserIcon
} from "phosphor-react-native";

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckSquare, User, House, UserRoundCog, MessagesSquare, CalendarCog, CalendarClock } from "lucide-react-native";

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
import CandidateFormRoute from "./src/screens/CandidateOnboardingScreen"; 
import AdminOnboardingSubmissionsScreen from "./src/screens/AdminOnboardingSubmissionsScreen";
import { getSavedSession, clearActiveSessionOnly } from "./src/utils/authStorage";
import { AuthProvider } from "./src/context/AuthContext";

const Tab = createBottomTabNavigator();

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

// React Navigation Deep Linking Configuration
const linking = {
  prefixes: [
    Linking.createURL("/"),
    "paycore://",
    "http://192.168.31.133:8080",
  ],
  config: {
    screens: {
      CandidateForm: "candidate-form",
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
    },
  },
};

function MainNavigator({ userSession, onLogout }: { userSession: any; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, Platform.OS === "android" ? 50 : 16);

  return (
    <NavigationContainer linking={linking}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
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
            ) 
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
            tabBarIcon: ({ color, focused }) => (
              <MessagesSquare color={focused ? "#5B4FD1" : color} size={20} />
            ) 
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
            tabBarButton: (props) => (
              <NotchedCenterButton {...props} />
            )
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
            ) 
          }} 
        />

        {/* TAB 5: PROFILE */}
        <Tab.Screen 
          name="Profile" 
          component={ProfileScreen} 
          options={{ 
            tabBarLabel: "Settings",
            tabBarIcon: ({ color, focused }) => (
              <UserRoundCog color={focused ? "#5B4FD1" : color} size={20} />
            ) 
          }} 
        />

        {/* Hidden Sub-screens & Onboarding Route */}
        <Tab.Screen name="Apply" component={ApplyScreen} options={{ tabBarItemStyle: { display: "none" } }} />
        <Tab.Screen name="Approvals" component={ApprovalsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
        <Tab.Screen name="CandidateForm" component={CandidateFormRoute} options={{ tabBarItemStyle: { display: "none" } }} />
        <Tab.Screen name="Celebrations" component={CelebrationsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
        <Tab.Screen name="AdminHub" component={AdminHubScreen} options={{ tabBarItemStyle: { display: "none" } }} />
        <Tab.Screen name="AdminOnboardingSubmissions" component={AdminOnboardingSubmissionsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
        <Tab.Screen name="AdminReports" component={AdminReportsScreen} options={{ tabBarItemStyle: { display: "none" } }} />
        <Tab.Screen name="MyHub" component={MyHubScreen} options={{ tabBarItemStyle: { display: "none" } }} />
        <Tab.Screen name="UserDirectory" component={UserDirectoryScreen} options={{ tabBarItemStyle: { display: "none" } }} />
        <Tab.Screen name="HrPolicy" component={HrPolicyScreen} options={{ tabBarItemStyle: { display: "none" } }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
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

  useEffect(() => {
    const restoreSessionAndCheckLink = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && (initialUrl.includes("candidate-form") || initialUrl.includes("token="))) {
          setInitialDeepLinkRoute(initialUrl);
        }

        const { sessionToken, verifiedEmpId } = await getSavedSession();
        if (sessionToken && verifiedEmpId) {
          const isAdmin = verifiedEmpId.startsWith("ADM") || verifiedEmpId.includes("ADMIN");
          setUserSession({
            isAuthenticated: true,
            empId: verifiedEmpId,
            isAdmin: isAdmin,
          });
        }
      } catch (err) {
        console.log("Session restore check failed.");
      } finally {
        setInitialLoading(false);
      }
    };

    restoreSessionAndCheckLink();
  }, []);

  const handleLogout = async () => {
    await clearActiveSessionOnly();
    setUserSession({
      isAuthenticated: false,
      empId: "",
      isAdmin: false,
    });
  };

  if (initialLoading) {
    return (
      <SafeAreaProvider className="flex-1 bg-[#F6F5FC]">
        <View className="flex-1 justify-center items-center bg-[#F6F5FC]">
          <ActivityIndicator size="large" color="#5B4FD1" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <AuthProvider>
      <SafeAreaProvider className="flex-1 bg-[#F6F5FC]">
        <View className="flex-1 bg-[#F6F5FC]">
          {initialDeepLinkRoute || userSession.isAuthenticated ? (
            <MainNavigator userSession={userSession} onLogout={handleLogout} />
          ) : (
            <LoginScreen
              onLoginSuccess={(authData) =>
                setUserSession({
                  isAuthenticated: true,
                  empId: authData.empId,
                  isAdmin: authData.isAdmin,
                })
              }
            />
          )}
        </View>
      </SafeAreaProvider>
    </AuthProvider>
  );
}