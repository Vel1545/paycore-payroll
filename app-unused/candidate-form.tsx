import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import * as Linking from "expo-linking";
import CandidateOnboardingScreen from "../src/screens/CandidateOnboardingScreen";

const LOCAL_IP = "192.168.31.133";
const API_BASE_URL = Platform.OS === "web"
  ? `http://${LOCAL_IP}:8080/api/onboarding`
  : `http://${LOCAL_IP}:8080/api/onboarding`;

export default function CandidateFormRoute() {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [mobile, setMobile] = useState<string | undefined>(undefined);
  const [paramsReady, setParamsReady] = useState(false);

  const [verifying, setVerifying] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Parse token/mobile from whatever URL opened this screen
  useEffect(() => {
    const extractParams = (url: string | null) => {
      if (!url) return;
      const { queryParams } = Linking.parse(url);
      setToken(queryParams?.token as string | undefined);
      setMobile(queryParams?.mobile as string | undefined);
      setParamsReady(true);
    };

    // Case 1: app opened cold, directly via this link
    Linking.getInitialURL().then(extractParams);

    // Case 2: app was already running, link tapped while foregrounded
    const subscription = Linking.addEventListener("url", ({ url }) => extractParams(url));

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!paramsReady) return; // wait until we've actually tried to read the URL

    const verifyAccess = async () => {
      try {
        const res = await fetch(`http://${LOCAL_IP}:8080/api/admin/verify-access?token=${token}&mobile=${mobile}`);
        if (res.ok) {
          setIsAuthorized(true);
        } else {
          setErrorMessage("This link is unauthorized, invalid, or expired.");
        }
      } catch (err) {
        if (token && mobile) {
          setIsAuthorized(true);
        } else {
          setErrorMessage("Missing security credentials in the link.");
        }
      } finally {
        setVerifying(false);
      }
    };

    if (token && mobile) {
      verifyAccess();
    } else {
      setVerifying(false);
      setErrorMessage("Invalid link structure. Missing parameters.");
    }
  }, [paramsReady, token, mobile]);

  if (verifying) {
    return (
      <View className="flex-1 justify-center items-center bg-[#F6F5FC]">
        <ActivityIndicator size="large" color="#5B4FD1" />
        <Text className="text-xs font-bold text-slate-500 mt-3">Verifying secure onboarding link...</Text>
      </View>
    );
  }

  if (!isAuthorized) {
    return (
      <View className="flex-1 justify-center items-center bg-[#F6F5FC] p-6">
        <View className="bg-white rounded-3xl p-8 shadow-sm border border-rose-100 items-center max-w-md w-full">
          <Text className="text-base font-black text-rose-600 mb-2">Access Denied</Text>
          <Text className="text-xs text-center text-slate-600 leading-relaxed">{errorMessage}</Text>
        </View>
      </View>
    );
  }

  return <CandidateOnboardingScreen route={{ params: { token, mobile } }} />;
}