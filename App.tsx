import "./global.css";
import React, { useState, useEffect } from "react";
import { View, Platform, ActivityIndicator } from "react-native";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

import { NavigationContainer, NavigationIndependentTree } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, FileText, CreditCard, User, CalendarDays, CheckSquare } from "lucide-react-native";

import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ApplyScreen from "./src/screens/ApplyScreen";
import MyHubScreen from "./src/screens/MyHubScreen";
import ApprovalsScreen from "./src/screens/ApprovalsScreen";
import AttendanceScreen from "./src/screens/AttendanceScreen";
import CelebrationsScreen from "./src/screens/CelebrationsScreen";
import AdminHubScreen from "./src/screens/AdminHubScreen";
import AdminReportsScreen from "./src/screens/AdminReportsScreen";
import UserDirectoryScreen from "./src/screens/UserDirectoryScreen";
import PunchClockScreen from "./src/screens/PunchClockScreen";
import ChatScreen from "./src/screens/ChatScreen";
import { getSavedSession, clearActiveSessionOnly } from "./src/utils/authStorage";

const Tab = createBottomTabNavigator();

function MainNavigator({ userSession, onLogout }: { userSession: any; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === "android" ? 10 : 8);

  return (
    <NavigationIndependentTree>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: true,
            tabBarLabelPosition: "below-icon",
            tabBarActiveTintColor: "#20150F",
            tabBarInactiveTintColor: "#5C4D41",
            tabBarItemStyle: {
              justifyContent: "center",
              alignItems: "center",
              paddingVertical: 2,
            },
            tabBarStyle: {
              backgroundColor: "#FFFFFF",
              borderTopColor: "#E5B583",
              borderTopWidth: 1,
              height: 60 + bottomPadding,
              paddingBottom: Math.max(bottomPadding, 6),
              paddingTop: 6,
              elevation: 8,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.06,
              shadowRadius: 4,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: "700",
              lineHeight: 14,
              marginTop: 2,
            },
          }}
        >
          {/* TAB 1: HOME */}
          <Tab.Screen 
            name="Home" 
            options={{ 
              tabBarLabel: "Home",
              tabBarIcon: ({ color }) => <Home color={color} size={20} /> 
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

          {/* TAB 2: APPLY */}
          <Tab.Screen 
            name="Apply" 
            component={ApplyScreen} 
            options={{ 
              tabBarLabel: "Apply",
              tabBarIcon: ({ color }) => <FileText color={color} size={20} /> 
            }} 
          />

          {/* TAB 3: MY HUB */}
          <Tab.Screen 
            name="MyHub" 
            component={MyHubScreen} 
            options={{ 
              tabBarLabel: "My Hub",
              tabBarIcon: ({ color }) => <User color={color} size={20} /> 
            }} 
          />

          {/* TAB 4: APPROVALS (Admins Only) */}
          {userSession.isAdmin && (
            <Tab.Screen 
              name="Approvals" 
              component={ApprovalsScreen} 
              options={{ 
                tabBarLabel: "Approvals",
                tabBarIcon: ({ color }) => <CheckSquare color={color} size={20} /> 
              }} 
            />
          )}

          {/* TAB 5: ATTENDANCE */}
          <Tab.Screen 
            name="Attendance" 
            component={AttendanceScreen} 
            options={{ 
              tabBarLabel: "Time",
              tabBarIcon: ({ color }) => <CalendarDays color={color} size={20} /> 
            }} 
          />
          
          {/* Hidden Sub-screens */}
          <Tab.Screen 
            name="Celebrations" 
            component={CelebrationsScreen} 
            options={{ tabBarItemStyle: { display: "none" } }} 
          />
          <Tab.Screen 
            name="AdminHub" 
            component={AdminHubScreen} 
            options={{ tabBarItemStyle: { display: "none" } }} 
          />
          <Tab.Screen 
            name="AdminReports" 
            component={AdminReportsScreen} 
            options={{ tabBarItemStyle: { display: "none" } }} 
          />
          <Tab.Screen 
            name="UserDirectory" 
            component={UserDirectoryScreen} 
            options={{ tabBarItemStyle: { display: "none" } }} 
          />
          <Tab.Screen 
            name="PunchClock" 
            component={PunchClockScreen} 
            options={{ tabBarItemStyle: { display: "none" } }} 
          />
          <Tab.Screen 
            name="Chat" 
            options={{ tabBarItemStyle: { display: "none" } }}
          >
            {(props) => <ChatScreen {...props} userSession={userSession} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
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

  // Check saved device session on cold start
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { sessionToken, verifiedEmpId } = await getSavedSession();
        // If a session exists, keep verified ID handy for quick login
        if (sessionToken && verifiedEmpId) {
          const isAdmin = verifiedEmpId.startsWith("ADM") || verifiedEmpId.includes("ADMIN");
          setUserSession({
            isAuthenticated: true,
            empId: verifiedEmpId,
            isAdmin: isAdmin,
          });
        }
      } catch (err) {
        console.log("No previous session found.");
      } finally {
        setInitialLoading(false);
      }
    };

    restoreSession();
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
      <SafeAreaProvider className="flex-1 bg-brand-canvas">
        <View className="flex-1 justify-center items-center bg-brand-canvas">
          <ActivityIndicator size="large" color="#0D9488" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider className="flex-1 bg-brand-canvas">
      <View className="flex-1 bg-brand-canvas">
        {!userSession.isAuthenticated ? (
          <LoginScreen
            onLoginSuccess={(authData) =>
              setUserSession({
                isAuthenticated: true,
                empId: authData.empId,
                isAdmin: authData.isAdmin,
              })
            }
          />
        ) : (
          <MainNavigator 
            userSession={userSession}
            onLogout={handleLogout}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}