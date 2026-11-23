import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getClientInfo } from "../services/clientInfo";
import { setAuthToken } from "../services/apiAuth";
import {
  User,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  KeyRound,
  CheckCircle,
  Key,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react-native";

import { UserSession } from "../services/UserSession";
import { useAuth, UserDetails } from "../context/AuthContext";
import { BASE_HOST } from "../constants/config";

interface LoginScreenProps {
  onLoginSuccess: (userData: { empId: string; isAdmin: boolean }) => void;
}

const API_BASE_URL = `${BASE_HOST}/api/auth`;

type UserStatus =
  | "NO_RECORD"
  | "NEW_DEVICE"
  | "ALREADY_VERIFIED"
  | "OTP_PENDING"
  | "OTP_REQUIRED"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_INACTIVE"
  | "ERROR";

const INACTIVE_MESSAGE = "Your account is inactive. Login and OTP are disabled. Please contact HR.";

const isInactiveMessage = (msg?: string) =>
  !!msg && /inactive|deactivated/i.test(msg);

// Shown when the server cannot be reached (no internet, server down, proxy error page)
const OFFLINE_MESSAGE = "Can't reach the server. Check your internet connection.";
const OFFLINE_RETRY_MS = 5000;

// A reply we can trust as the server's answer: anything else (5xx, HTML error page) counts as "not reachable"
const readServerJson = async (res: Response): Promise<any> => {
  if (res.status >= 500) throw new Error(`server ${res.status}`);
  return res.json();
};

const clearRememberedEmpId = async () => {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.removeItem("paycore_remembered_emp_id");
    } else {
      await AsyncStorage.removeItem("paycore_remembered_emp_id");
    }
  } catch {}
};

const showUniversalAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    try {
      window.alert(`${title}\n\n${message}`);
    } catch (e) {
      console.log(`[ALERT] ${title}: ${message}`);
    }
  } else {
    Alert.alert(title, message, [{ text: "OK" }]);
  }
};


export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;
  const { saveUserSession } = useAuth();

  const [empId, setEmpId] = useState("");
  const [status, setStatus] = useState<UserStatus>("NO_RECORD");
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverNotice, setServerNotice] = useState("");
  const [activeDevOtp, setActiveDevOtp] = useState<string | null>(null);
  // true = the last call could not reach the server: show the "check your internet" message + Retry, never the OTP button
  const [offline, setOffline] = useState(false);
  const rememberedIdRef = useRef<string | null>(null);
  const checkBusy = useRef(false);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpInputs = useRef<Array<TextInput | null>>([]);
  const debounceTimer = useRef<any>(null);

  // ---- Password login (server auth.password-mode OPTIONAL / REQUIRED). "OFF" = the old OTP-only login below.
  const [pwMode, setPwMode] = useState<string>("OFF");
  const [pwSet, setPwSet] = useState(false);
  const [minPwLen, setMinPwLen] = useState(6);
  const [statusReady, setStatusReady] = useState(false); // the server answered for the typed ID
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  // what the OTP is for: LEGACY = old OTP login, DEVICE = new device after the password, SET = first login / forgot password
  const [otpPurpose, setOtpPurpose] = useState<"LEGACY" | "DEVICE" | "SET">("LEGACY");
  const [otpValidMin, setOtpValidMin] = useState(10);
  const pwFlow = pwMode === "OPTIONAL" || pwMode === "REQUIRED";
  const debounceIdRef = useRef<string | null>(null); // the ID whose status check is the latest

  const applyPasswordInfo = (data: any) => {
    if (data && typeof data.passwordMode === "string") {
      setPwMode(data.passwordMode);
      setPwSet(!!data.passwordSet);
      if (Number(data.minPasswordLength) > 0) setMinPwLen(Number(data.minPasswordLength));
    }
    setStatusReady(true);
  };

  const resetPasswordFields = () => {
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setOtp(["", "", "", "", "", ""]);
    setOtpPurpose("LEGACY");
  };

  // Helper to structure and save user payload to both Context and UserSession
  const handleSuccessfulAuthentication = async (backendUser: any, token?: string) => {
    const resolvedEmpId = backendUser.empId || empId.trim().toUpperCase();
    const resolvedName = backendUser.fullName || backendUser.name || "";
    const resolvedEmail = backendUser.email || "";
    const resolvedRole = backendUser.role || "EMPLOYEE";
    const resolvedDesignation = backendUser.designation || "Femi9 Employee";

    // 1. Persist the employee ID so future launches auto-login silently
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("paycore_remembered_emp_id", resolvedEmpId);
      }
    } else {
      await AsyncStorage.setItem("paycore_remembered_emp_id", resolvedEmpId);
    }

    // 1b. The login token: sent with every API call from now on (services/apiAuth)
    await setAuthToken(token || null);

    // 2. Store in the UserSession singleton
    UserSession.setUser({
      empId: resolvedEmpId,
      name: resolvedName,
      email: resolvedEmail,
      role: resolvedRole,
      designation: resolvedDesignation,
    });

    // 3. Save globally into AuthContext
    const formattedUser: UserDetails = {
      userId: resolvedEmpId,
      empId: resolvedEmpId,
      name: resolvedName,
      email: resolvedEmail,
      isAdmin: !!backendUser.isAdmin,
      token: token,
      role: resolvedRole,
      designation: resolvedDesignation,
    };

    await saveUserSession(formattedUser);

    // 4. Route to dashboard
    onLoginSuccess({
      empId: formattedUser.empId,
      isAdmin: formattedUser.isAdmin,
    });
  };

  // Silent auto-login with the remembered Employee ID: on mount, and again (automatically) while the
  // server is not reachable - every 5 s and when the app comes back to the front.
  const attemptSilentAutoLogin = async (savedEmpId: string) => {
    if (checkBusy.current) return;
    checkBusy.current = true;
    try {
        setLoading(true);

        const client = await getClientInfo(savedEmpId);

        const statusRes = await fetch(`${API_BASE_URL}/check-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            empId: savedEmpId,
            deviceId: client.deviceId,
            platform: client.platform,
          }),
        });

        const statusData = await readServerJson(statusRes);
        // the server answered: whatever it says below is a real answer, not a network problem
        setOffline(false);

        // Inactive account: never auto-login, forget the remembered ID
        if (statusData.status === "ACCOUNT_INACTIVE" || isInactiveMessage(statusData.message)) {
          await clearRememberedEmpId();
          setStatus("ACCOUNT_INACTIVE");
          setOtpSent(false);
          setIsFirstTime(false);
          setActiveDevOtp(null);
          setServerNotice(statusData.message || INACTIVE_MESSAGE);
          return;
        }

        if (statusData.status === "ALREADY_VERIFIED") {
          const loginRes = await fetch(`${API_BASE_URL}/direct-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              empId: savedEmpId,
              deviceId: client.deviceId,
              platform: client.platform,
            }),
          });

          const loginData = await readServerJson(loginRes);
          if (loginData.success && loginData.user) {
            await handleSuccessfulAuthentication(loginData.user, loginData.token);
            return;
          }
        }

        // If revoked or new device detected, stop silent login and prompt user
        applyPasswordInfo(statusData);
        const pwOn = statusData.passwordMode === "OPTIONAL" || statusData.passwordMode === "REQUIRED";
        if (pwOn && statusData.status === "OTP_PENDING") {
          // password login: a waiting OTP is only used for the first-login / forgot-password screen
          setStatus("NEW_DEVICE");
          if (!statusData.passwordSet) {
            setOtpPurpose("SET");
            setOtpSent(true);
            if (statusData.devOtp) setActiveDevOtp(statusData.devOtp);
          }
        } else {
          setStatus(statusData.status || "NO_RECORD");
        }
        setServerNotice(statusData.message || "");
      } catch (err) {
        // No network / server down: say so (and keep retrying) instead of looking like a new device
        console.warn("Silent auto-login: server not reachable", err);
        setOffline(true);
        setOtpSent(false);
        setActiveDevOtp(null);
        setServerNotice(OFFLINE_MESSAGE);
      } finally {
        checkBusy.current = false;
        setLoading(false);
      }
  };

  // On mount: auto-login with the remembered Employee ID
  useEffect(() => {
    (async () => {
      let savedEmpId: string | null = null;
      try {
        savedEmpId = Platform.OS === "web"
          ? (typeof window !== "undefined" ? window.localStorage.getItem("paycore_remembered_emp_id") : null)
          : await AsyncStorage.getItem("paycore_remembered_emp_id");
      } catch {
        savedEmpId = null;
      }
      if (!savedEmpId) return;
      rememberedIdRef.current = savedEmpId;
      setEmpId(savedEmpId);
      attemptSilentAutoLogin(savedEmpId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retry: the remembered ID signs in by itself once the server answers; a typed ID is checked again
  const retryAfterOffline = () => {
    const id = empId.trim().toUpperCase();
    const remembered = (rememberedIdRef.current || "").trim().toUpperCase();
    if (remembered && (!id || id === remembered)) attemptSilentAutoLogin(rememberedIdRef.current as string);
    else if (id.length >= 3) checkUserStatusInDb(id);
  };
  const retryRef = useRef(retryAfterOffline);
  retryRef.current = retryAfterOffline;

  // While the server is not reachable: retry every 5 s and when the app comes back to the front
  useEffect(() => {
    if (!offline) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") retryRef.current();
    }, OFFLINE_RETRY_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") retryRef.current();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [offline]);

  const handleEmpIdChange = (text: string) => {
    const cleanId = text.trim().toUpperCase();
    setEmpId(cleanId);
    setActiveDevOtp(null);
    setStatusReady(false);
    setPwSet(false);
    setOtpSent(false);
    resetPasswordFields();
    debounceIdRef.current = cleanId;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (cleanId.length >= 3) {
      debounceTimer.current = setTimeout(() => {
        checkUserStatusInDb(cleanId);
      }, 400);
    } else {
      setStatus("NO_RECORD");
      setServerNotice("");
      setOtpSent(false);
      setIsFirstTime(false);
      setOffline(false);
    }
  };

  const checkUserStatusInDb = async (id: string) => {
    try {
      const client = await getClientInfo(id);

      const res = await fetch(`${API_BASE_URL}/check-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: id,
          deviceId: client.deviceId,
          platform: client.platform,
        }),
      });

      const data = await readServerJson(res);
      setOffline(false);
      if (id !== (debounceIdRef.current || id)) return; // the user typed another ID meanwhile
      applyPasswordInfo(data);
      const pwOn = data.passwordMode === "OPTIONAL" || data.passwordMode === "REQUIRED";

      if (pwOn && data.status === "OTP_PENDING") {
        // password login: show the password (or, with no password yet, the OTP + new password screen)
        setStatus("NEW_DEVICE");
        if (data.passwordSet) {
          setOtpSent(false);
          setActiveDevOtp(null);
          setServerNotice("");
        } else {
          setOtpPurpose("SET");
          setOtpSent(true);
          setServerNotice(data.message || "Enter the OTP and choose your password.");
          if (data.devOtp) setActiveDevOtp(data.devOtp);
        }
        return;
      }
      if (pwOn && data.status !== "ALREADY_VERIFIED" && data.status !== "ACCOUNT_INACTIVE"
          && data.status !== "ACCOUNT_LOCKED" && !isInactiveMessage(data.message)) {
        setStatus(data.status === "OTP_REQUIRED" || data.status === "NEW_DEVICE" ? data.status : "NO_RECORD");
        setOtpSent(false);
        setIsFirstTime(false);
        setActiveDevOtp(null);
        setServerNotice(
          data.passwordSet
            ? "Enter your password to sign in."
            : "First login: we will send an OTP to your e-mail (also shown here), then you choose your password."
        );
        return;
      }

      if (data.status === "ACCOUNT_INACTIVE" || isInactiveMessage(data.message)) {
        setStatus("ACCOUNT_INACTIVE");
        setOtpSent(false);
        setIsFirstTime(false);
        setActiveDevOtp(null);
        setServerNotice(data.message || INACTIVE_MESSAGE);
      } else if (data.status === "ALREADY_VERIFIED") {
        setStatus("ALREADY_VERIFIED");
        setOtpSent(false);
        setIsFirstTime(false);
        setActiveDevOtp(null);
        setServerNotice(data.message || "Device Verified • Direct Access Enabled");
            } else if (data.status === "NEW_DEVICE") {
        setStatus("NEW_DEVICE");
        setOtpSent(false);
        setIsFirstTime(true);
        setActiveDevOtp(null);
        setServerNotice(data.message || "New device detected. OTP verification required.");
      } else if (data.status === "OTP_REQUIRED") {
        // Device matches, but no verified OTP record exists on file — treat
        // like a device that needs (re-)verification, not a first-time login.
        setStatus("OTP_REQUIRED");
        setOtpSent(false);
        setIsFirstTime(true);
        setActiveDevOtp(null);
        setServerNotice(data.message || "Security re-verification required for this device.");
      } else if (data.status === "ACCOUNT_LOCKED") {
        setStatus("ACCOUNT_LOCKED");
        setServerNotice(data.message);
        setActiveDevOtp(null);
        showUniversalAlert("Account Locked", data.message);
      } else if (data.status === "OTP_PENDING") {
        setStatus("OTP_PENDING");
        setOtpSent(true);
        setServerNotice(data.message || `Enter 6-digit code for ${id}`);

        if (data.devOtp) { // shown only while the server has app.security.otp.expose-dev-otp=true
          setActiveDevOtp(data.devOtp);
          showUniversalAlert("Pending Security OTP", `Your verification code is: ${data.devOtp}`);
        }
      } else {
        setStatus("NO_RECORD");
        setOtpSent(false);
        setActiveDevOtp(null);
        setServerNotice("First time login for this device. Please verify with OTP.");
      }
    } catch (e) {
      // not reachable: show it (and retry), never pretend this is a new device
      setOffline(true);
      setOtpSent(false);
      setActiveDevOtp(null);
      setServerNotice(OFFLINE_MESSAGE);
    }
  };

  const handleDirectLogin = async () => {
    setLoading(true);
    try {
      const client = await getClientInfo(empId);

      const res = await fetch(`${API_BASE_URL}/direct-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: empId.trim().toUpperCase(),
          deviceId: client.deviceId,
          platform: client.platform,
        }),
      });

      const data = await readServerJson(res);
      if (data.success && data.user) {
        await handleSuccessfulAuthentication(data.user, data.token);
      } else if (isInactiveMessage(data.message)) {
        await clearRememberedEmpId();
        setStatus("ACCOUNT_INACTIVE");
        setServerNotice(data.message);
        showUniversalAlert("Account Inactive", data.message);
      } else {
        showUniversalAlert(
          "Verification Required",
          data.message || "No verification record found. Please verify with OTP."
        );
        setStatus("NEW_DEVICE");
        setOtpSent(false);
        setIsFirstTime(false);
        setActiveDevOtp(null);
      }
    } catch (err) {
      setOffline(true);
      setServerNotice(OFFLINE_MESSAGE);
      showUniversalAlert("No connection", OFFLINE_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (purpose?: "LEGACY" | "DEVICE" | "SET") => {
    const usePurpose = purpose ?? otpPurpose;
    setOtpPurpose(usePurpose);
    const cleanId = empId.trim().toUpperCase();
    if (!cleanId) {
      showUniversalAlert("Missing ID", "Please enter your Employee ID.");
      return;
    }
    if (status === "ACCOUNT_INACTIVE") {
      showUniversalAlert("Account Inactive", serverNotice || INACTIVE_MESSAGE);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empId: cleanId }),
      });

      const data = await readServerJson(res);

      if (data.success) {
        setServerNotice(data.message);
        setOtpSent(true);
        setOtp(["", "", "", "", "", ""]);
        if (Number(data.validityMinutes) > 0) setOtpValidMin(Number(data.validityMinutes));
        // password login keeps its own screens; the old login switches to its OTP screen
        if (!pwFlow) setStatus("OTP_PENDING");

        if (data.devOtp) { // shown only while the server has app.security.otp.expose-dev-otp=true
          setActiveDevOtp(data.devOtp);
          if (!pwFlow) showUniversalAlert("One-Time Password", `Your verification OTP is: ${data.devOtp}`);
        }
      } else if (isInactiveMessage(data.message)) {
        setStatus("ACCOUNT_INACTIVE");
        setOtpSent(false);
        setActiveDevOtp(null);
        setServerNotice(data.message);
        showUniversalAlert("Account Inactive", data.message);
      } else {
        showUniversalAlert("Failed", data.message || "Failed to generate OTP.");
      }
    } catch (err) {
      showUniversalAlert("No connection", OFFLINE_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const fullOtp = otp.join("");
    if (fullOtp.length !== 6) {
      showUniversalAlert("Incomplete Code", "Please enter all 6 digits.");
      return;
    }

    setLoading(true);
    try {
      const client = await getClientInfo(empId);

      const res = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: empId.trim().toUpperCase(),
          otp: fullOtp,
          deviceId: client.deviceId,
          deviceModel: client.deviceModel,
          platform: client.platform,
        }),
      });

      const data = await readServerJson(res);
      if (data.success && data.user) {
        await handleSuccessfulAuthentication(data.user, data.token);
      } else {
        showUniversalAlert("Invalid OTP", data.message || "OTP is wrong. Enter the correct OTP.");

        setOtp(["", "", "", "", "", ""]);
        otpInputs.current[0]?.focus();

        if (data.message && data.message.includes("limit exceeded")) {
          setStatus("ACCOUNT_LOCKED");
          setActiveDevOtp(null);
        }
      }
    } catch (err) {
      // the OTP stays on screen: the user can tap again once the connection is back
      showUniversalAlert("No connection", `${OFFLINE_MESSAGE} Your OTP was not checked - try again.`);
    } finally {
      setLoading(false);
    }
  };

  // ---- Password login handlers -----------------------------------------------------------------
  const isLockMessage = (msg?: string) => !!msg && /limit exceeded/i.test(msg);

  const handlePasswordLogin = async () => {
    const cleanId = empId.trim().toUpperCase();
    if (!password) {
      showUniversalAlert("Password needed", "Please enter your password.");
      return;
    }
    setLoading(true);
    try {
      const client = await getClientInfo(cleanId);
      const res = await fetch(`${API_BASE_URL}/password-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: cleanId,
          password,
          deviceId: client.deviceId,
          deviceModel: client.deviceModel,
          platform: client.platform,
        }),
      });
      const data = await readServerJson(res);
      if (data.success && data.user) {
        await handleSuccessfulAuthentication(data.user, data.token);
        return;
      }
      if (data.status === "PASSWORD_NOT_SET") {
        setPwSet(false);
        setPassword("");
        setServerNotice(data.message);
        return;
      }
      if (data.status === "OTP_REQUIRED") {
        setOtpPurpose("DEVICE");
        setOtpSent(true);
        setOtp(["", "", "", "", "", ""]);
        setServerNotice(data.message || "New device: enter the OTP.");
        if (Number(data.validityMinutes) > 0) setOtpValidMin(Number(data.validityMinutes));
        setActiveDevOtp(data.devOtp || null);
        return;
      }
      if (isInactiveMessage(data.message)) {
        await clearRememberedEmpId();
        setStatus("ACCOUNT_INACTIVE");
        setServerNotice(data.message);
        showUniversalAlert("Account Inactive", data.message);
        return;
      }
      showUniversalAlert("Sign in failed", data.message || "Could not sign in.");
      setPassword("");
    } catch {
      showUniversalAlert("No connection", OFFLINE_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  // first login / forgot password: OTP + new password
  const handleSetPassword = async () => {
    const fullOtp = otp.join("");
    if (fullOtp.length !== 6) {
      showUniversalAlert("Incomplete Code", "Please enter all 6 digits of the OTP.");
      return;
    }
    if (newPassword.length < minPwLen) {
      showUniversalAlert("Password too short", `Your password needs at least ${minPwLen} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      showUniversalAlert("Passwords differ", "The two passwords are not the same. Please type them again.");
      return;
    }
    setLoading(true);
    try {
      const cleanId = empId.trim().toUpperCase();
      const client = await getClientInfo(cleanId);
      const res = await fetch(`${API_BASE_URL}/otp-set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: cleanId,
          otp: fullOtp,
          newPassword,
          deviceId: client.deviceId,
          deviceModel: client.deviceModel,
          platform: client.platform,
        }),
      });
      const data = await readServerJson(res);
      if (data.success && data.user) {
        await handleSuccessfulAuthentication(data.user, data.token);
        return;
      }
      showUniversalAlert("Could not set the password", data.message || "Please try again.");
      setOtp(["", "", "", "", "", ""]);
      if (isLockMessage(data.message)) {
        setStatus("ACCOUNT_LOCKED");
        setServerNotice(data.message);
        setActiveDevOtp(null);
      }
    } catch {
      showUniversalAlert("No connection", `${OFFLINE_MESSAGE} Nothing was saved - try again.`);
    } finally {
      setLoading(false);
    }
  };

  // new device: the OTP after the correct password
  const handleVerifyDeviceOtp = async () => {
    const fullOtp = otp.join("");
    if (fullOtp.length !== 6) {
      showUniversalAlert("Incomplete Code", "Please enter all 6 digits.");
      return;
    }
    setLoading(true);
    try {
      const cleanId = empId.trim().toUpperCase();
      const client = await getClientInfo(cleanId);
      const res = await fetch(`${API_BASE_URL}/password-otp-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: cleanId,
          otp: fullOtp,
          deviceId: client.deviceId,
          deviceModel: client.deviceModel,
          platform: client.platform,
        }),
      });
      const data = await readServerJson(res);
      if (data.success && data.user) {
        await handleSuccessfulAuthentication(data.user, data.token);
        return;
      }
      setOtp(["", "", "", "", "", ""]);
      if (data.message && /password again/i.test(data.message)) {
        // too much time since the password: start again from the password
        setOtpSent(false);
        setOtpPurpose("LEGACY");
        setActiveDevOtp(null);
        setPassword("");
      }
      if (isLockMessage(data.message)) {
        setStatus("ACCOUNT_LOCKED");
        setServerNotice(data.message);
        setActiveDevOtp(null);
      }
      showUniversalAlert("Invalid OTP", data.message || "OTP is wrong. Enter the correct OTP.");
    } catch {
      showUniversalAlert("No connection", `${OFFLINE_MESSAGE} Your OTP was not checked - try again.`);
    } finally {
      setLoading(false);
    }
  };

  const backToId = () => {
    setOtpSent(false);
    setStatus("NO_RECORD");
    setActiveDevOtp(null);
    resetPasswordFields();
  };

  const handleOtpChange = (value: string, index: number) => {
    const clean = value.replace(/[^0-9]/g, "");
    const updatedOtp = [...otp];
    updatedOtp[index] = clean ? clean[clean.length - 1] : "";
    setOtp(updatedOtp);

    if (clean && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = () => {
    // Server not reachable: the button is "Retry" - never send an OTP because of a network problem
    if (offline && !otpSent && status !== "OTP_PENDING") {
      retryAfterOffline();
      return;
    }
    if (status === "ACCOUNT_INACTIVE") {
      showUniversalAlert("Account Inactive", serverNotice || INACTIVE_MESSAGE);
      return;
    }
    if (status === "ACCOUNT_LOCKED") {
      showUniversalAlert("Access Locked", serverNotice);
      return;
    }
    if (status === "ALREADY_VERIFIED") {
      handleDirectLogin();
      return;
    }
    if (pwFlow) {
      if (!statusReady && !otpSent) return; // still checking the typed Employee ID
      if (otpSent) {
        if (otpPurpose === "DEVICE") handleVerifyDeviceOtp();
        else handleSetPassword();
        return;
      }
      if (pwSet) handlePasswordLogin();
      else handleRequestOtp("SET");
      return;
    }
    if (otpSent || status === "OTP_PENDING") {
      handleVerifyOtp();
      return;
    }
    if (isFirstTime || status === "NO_RECORD" || status === "NEW_DEVICE"|| status === "OTP_REQUIRED") {
      handleRequestOtp();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-canvas">
      <View className="flex-1 flex-row">
        {isDesktop && (
          <View className="w-[45%] h-full bg-brand-hero relative overflow-hidden">
            <ImageBackground
              source={{
                uri: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1600&auto=format&fit=crop",
              }}
              resizeMode="cover"
              className="flex-1 justify-between p-10 lg:p-14"
            >
              <View className="absolute inset-0 bg-brand-hero/85" />
              <View className="relative z-10 flex-row items-center">
                <View className="w-11 h-11 bg-brand-primary rounded-xl items-center justify-center mr-3.5 shadow-md">
                  <ShieldCheck size={24} color="#FFFFFF" />
                </View>
                <Text className="text-2xl font-black text-white">PayCore Global</Text>
              </View>
              <View className="relative z-10 my-auto">
                <Text className="text-3xl lg:text-4xl font-black text-white leading-tight mb-5">
                  Streamlined Payroll, Attendance & Culture for Modern Teams.
                </Text>
                <View className="space-y-3.5">
                  <View className="flex-row items-center">
                    <CheckCircle size={18} color="#34D399" />
                    <Text className="text-slate-100 text-sm ml-3 font-semibold">
                      Instant Verified Access
                    </Text>
                  </View>
                </View>
              </View>
            </ImageBackground>
          </View>
        )}

        <View
          className={`${isDesktop ? "w-[55%]" : "w-full"
            } h-full bg-brand-canvas justify-center items-center px-4 md:px-8 py-8`}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="w-full max-w-xl"
          >
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
              showsVerticalScrollIndicator={false}
            >
              <View className="bg-brand-card border border-brand-border rounded-3xl p-8 md:p-10 shadow-sm">
                <Text className="text-2xl font-black text-brand-dark tracking-tight mb-1">
                  {pwFlow && otpSent
                    ? otpPurpose === "DEVICE"
                      ? "Verify New Device"
                      : "Set Your Password"
                    : otpSent || status === "OTP_PENDING"
                    ? "Verify Security OTP"
                    : "Sign In to Workspace"}
                </Text>
 <Text className="text-sm font-semibold text-brand-muted mb-6">
                  {pwFlow && otpSent
                    ? otpPurpose === "DEVICE"
                      ? `Enter the 6-digit OTP for ${empId.toUpperCase()}`
                      : `Enter the OTP for ${empId.toUpperCase()} and choose a password (at least ${minPwLen} characters)`
                    : pwFlow && statusReady && !offline && status !== "ALREADY_VERIFIED"
                        && status !== "ACCOUNT_INACTIVE" && status !== "ACCOUNT_LOCKED"
                    ? pwSet
                      ? "Enter your Employee ID and password"
                      : "First login • Verify with OTP and set your password"
                    : otpSent || status === "OTP_PENDING"
                    ? `Enter 6-digit code for ${empId.toUpperCase()}`
                    : offline
                      ? "No connection • Signing you in automatically when you're back online"
                    : status === "ACCOUNT_INACTIVE"
                      ? "Account Inactive • Access Disabled"
                    : status === "ALREADY_VERIFIED"
                      ? "Verified Employee Recognized • Direct Access Ready"
                      : status === "NEW_DEVICE"
                        ? "New Device Detected • Verification Required"
                        : status === "OTP_REQUIRED"
                          ? "Security Re-Verification Required • Please Confirm OTP"
                          : "Enter your Employee ID to continue"}
                </Text>

                {offline && !otpSent && status !== "OTP_PENDING" ? (
                  <View className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4">
                    <Text className="text-[11px] font-bold text-amber-900">
                      📶 {OFFLINE_MESSAGE} Retrying automatically…
                    </Text>
                  </View>
                ) : serverNotice ? (
                  <View className="bg-brand-cardTint border border-brand-border rounded-xl p-3 mb-4">
                    <Text className="text-[11px] font-bold text-brand-dark">
                      💡 {serverNotice}
                    </Text>
                  </View>
                ) : null}

                {activeDevOtp && (
                  <View className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 mb-5 shadow-xs flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Key size={20} color="#B45309" />
                      <View className="ml-3">
                        <Text className="text-[10px] uppercase font-black text-amber-800 tracking-wider">
                          Active Security OTP
                        </Text>
                        <Text className="text-2xl font-black text-amber-950 tracking-widest">
                          {activeDevOtp}
                        </Text>
                      </View>
                    </View>
                    <View className="bg-amber-200 px-2.5 py-1 rounded-lg">
                      <Text className="text-[10px] font-bold text-amber-900">Valid {otpValidMin}m</Text>
                    </View>
                  </View>
                )}

                {!otpSent && status !== "OTP_PENDING" && (
                  <View className="mb-5">
                    <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-2">
                      Employee ID
                    </Text>
                    <View className="flex-row items-center bg-brand-cardTint border border-brand-border rounded-2xl px-4 py-3.5">
                      <User size={20} color="#5C4D41" />
                      <TextInput
                        value={empId}
                        onChangeText={handleEmpIdChange}
                        placeholder="e.g. EMP-1042"
                        placeholderTextColor="#8C7A6B"
                        autoCapitalize="characters"
                        className="flex-1 ml-3 text-sm font-bold text-brand-dark"
                      />
                    </View>
                  </View>
                )}

                {/* Password login: the password field (the ID is already recognised and has a password) */}
                {pwFlow && statusReady && pwSet && !otpSent && !offline && status !== "ALREADY_VERIFIED"
                  && status !== "ACCOUNT_INACTIVE" && status !== "ACCOUNT_LOCKED" && (
                  <View className="mb-6">
                    <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-2">Password</Text>
                    <View className="flex-row items-center bg-brand-cardTint border border-brand-border rounded-2xl px-4 py-3.5">
                      <Lock size={20} color="#5C4D41" />
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Your password"
                        placeholderTextColor="#8C7A6B"
                        secureTextEntry={!showPw}
                        autoCapitalize="none"
                        autoCorrect={false}
                        onSubmitEditing={handleSubmit}
                        className="flex-1 ml-3 text-sm font-bold text-brand-dark"
                      />
                      <TouchableOpacity onPress={() => setShowPw(!showPw)} className="pl-2">
                        {showPw ? <EyeOff size={18} color="#5C4D41" /> : <Eye size={18} color="#5C4D41" />}
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => handleRequestOtp("SET")} disabled={loading} className="self-end mt-2.5 py-1">
                      <Text className="text-xs font-extrabold text-brand-primary underline">Forgot password?</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!pwFlow && status === "NO_RECORD" && !otpSent && !offline && (
                  <TouchableOpacity
                    onPress={() => setIsFirstTime(!isFirstTime)}
                    className="flex-row items-center mb-7 py-1"
                  >
                    <View
                      className={`w-5 h-5 rounded-md border justify-center items-center mr-2.5 ${isFirstTime
                          ? "bg-brand-hero border-brand-hero"
                          : "border-slate-400 bg-white"
                        }`}
                    >
                      {isFirstTime && <Text className="text-white text-xs font-black">✓</Text>}
                    </View>
                    <Text className="text-xs md:text-sm font-semibold text-brand-dark">
                      First time logging in?{" "}
                      <Text className="text-brand-primary font-extrabold underline">
                        Verify with OTP
                      </Text>
                    </Text>
                  </TouchableOpacity>
                )}

                {(otpSent || status === "OTP_PENDING") && (
                  <View className="mb-7">
                    <View className="flex-row justify-between mb-5">
                      {otp.map((digit, index) => (
                        <TextInput
                          key={index}
                          ref={(ref) => {
                            otpInputs.current[index] = ref;
                          }}
                          value={digit}
                          onChangeText={(val) => handleOtpChange(val, index)}
                          onKeyPress={(e) => handleOtpKeyPress(e, index)}
                          keyboardType="number-pad"
                          maxLength={1}
                          className={`w-12 h-14 text-center text-lg font-black border-2 rounded-2xl bg-brand-cardTint ${digit
                              ? "border-brand-primary text-brand-primary bg-white"
                              : "border-brand-border text-brand-dark"
                            }`}
                        />
                      ))}
                    </View>

                    {/* First login / forgot password: the new password under the OTP */}
                    {pwFlow && otpPurpose === "SET" && (
                      <View className="mb-5 gap-3">
                        {[
                          { label: "New password", value: newPassword, set: setNewPassword, ph: `At least ${minPwLen} characters` },
                          { label: "Type it again", value: confirmPassword, set: setConfirmPassword, ph: "Same password again" },
                        ].map((f) => (
                          <View key={f.label}>
                            <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-2">{f.label}</Text>
                            <View className="flex-row items-center bg-brand-cardTint border border-brand-border rounded-2xl px-4 py-3.5">
                              <Lock size={18} color="#5C4D41" />
                              <TextInput
                                value={f.value}
                                onChangeText={f.set}
                                placeholder={f.ph}
                                placeholderTextColor="#8C7A6B"
                                secureTextEntry={!showPw}
                                autoCapitalize="none"
                                autoCorrect={false}
                                className="flex-1 ml-3 text-sm font-bold text-brand-dark"
                              />
                              <TouchableOpacity onPress={() => setShowPw(!showPw)} className="pl-2">
                                {showPw ? <EyeOff size={18} color="#5C4D41" /> : <Eye size={18} color="#5C4D41" />}
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                        {!!confirmPassword && confirmPassword !== newPassword && (
                          <Text className="text-[11px] font-bold text-red-600">The two passwords are not the same.</Text>
                        )}
                      </View>
                    )}

                    <View className="flex-row items-center justify-between">
                      <TouchableOpacity
                        onPress={backToId}
                        className="flex-row items-center py-1"
                      >
                        <KeyRound size={15} color="#5C4D41" />
                        <Text className="text-xs text-brand-muted font-bold ml-1.5">
                          Change ID
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRequestOtp()}
                        className="flex-row items-center py-1"
                      >
                        <RefreshCw size={15} color="#0D9488" />
                        <Text className="text-xs font-extrabold text-brand-primary ml-1.5">
                          Resend OTP
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading || status === "ACCOUNT_LOCKED" || status === "ACCOUNT_INACTIVE"}
                  className={`rounded-2xl py-4 flex-row items-center justify-center shadow-sm active:opacity-90 ${status === "ACCOUNT_LOCKED" || status === "ACCOUNT_INACTIVE" ? "bg-gray-400" : "bg-brand-hero"
                    }`}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text className="text-white font-black text-sm uppercase tracking-wider mr-2">
                        {offline && !otpSent && status !== "OTP_PENDING"
                          ? "RETRY"
                          : status === "ACCOUNT_INACTIVE"
                          ? "ACCOUNT INACTIVE"
                          : status === "ACCOUNT_LOCKED"
                          ? "ACCOUNT LOCKED (24 HRS)"
                          : status === "ALREADY_VERIFIED"
                            ? "SIGN IN"
                            : pwFlow && otpSent
                              ? otpPurpose === "DEVICE" ? "VERIFY & SIGN IN" : "SET PASSWORD & SIGN IN"
                            : pwFlow && !statusReady
                              ? "ENTER YOUR EMPLOYEE ID"
                            : pwFlow
                              ? pwSet ? "SIGN IN" : "SEND OTP"
                            : otpSent || status === "OTP_PENDING"
                              ? "AUTHENTICATE SESSION"
                              : status === "NEW_DEVICE"
                                ? "VERIFY NEW DEVICE"
                                : status === "OTP_REQUIRED"
                                  ? "RE-VERIFY DEVICE"
                                  : "SEND VERIFICATION CODE"}
                      </Text>
                      <ArrowRight size={18} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
    </SafeAreaView>
  );
}