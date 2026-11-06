import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import * as Linking from "expo-linking";
import CandidateOnboardingScreen from "./CandidateOnboardingScreen";
import { BASE_HOST } from "../constants/config";4

// A repeated query key parses to string[]; only the first value is used
const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

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
      if (url) {
        const { queryParams } = Linking.parse(url);
        setToken(firstParam(queryParams?.token));
        setMobile(firstParam(queryParams?.mobile));
      }
      // Set even without a URL, so the screen shows an error instead of spinning forever
      setParamsReady(true);
    };

    Linking.getInitialURL().then(extractParams);
    const subscription = Linking.addEventListener("url", ({ url }) => extractParams(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!paramsReady) return;

    const verifyAccess = async () => {
      try {
        // BASE_HOST already holds http(s)://host, so no extra "http://" in front
        const res = await fetch(
          `${BASE_HOST}/api/admin/verify-access?token=${encodeURIComponent(token || "")}&mobile=${encodeURIComponent(mobile || "")}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          setIsAuthorized(true);
        } else {
          const j = await res.json().catch(() => ({}));
          setErrorMessage(j?.error || "This link is unauthorized, invalid, or expired.");
        }
      } catch {
        // No fallback to "allowed": if the server cannot be reached the form must not open
        setErrorMessage("Could not reach the server. Please check your internet connection and try again.");
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
