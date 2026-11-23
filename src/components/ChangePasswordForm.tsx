import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { BASE_HOST } from "../constants/config";
import { UserSession } from "../services/UserSession";

const notify = (title: string, msg: string) => (Platform.OS === "web" ? window.alert(`${title}\n\n${msg}`) : Alert.alert(title, msg));

// Settings > Change Password. Needs the current password. Forgot it? Log out and use "Forgot password?" on the login screen.
export default function ChangePasswordForm({ onDone, minLength = 6 }: { onDone: () => void; minLength?: number }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setMsg(null);
    if (!current) return setMsg("Enter your current password.");
    if (next.length < minLength) return setMsg(`The new password needs at least ${minLength} characters.`);
    if (next !== again) return setMsg("The two new passwords are not the same.");
    setBusy(true);
    try {
      const res = await fetch(`${BASE_HOST}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empId: UserSession.empId, currentPassword: current, newPassword: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) {
        setMsg(j?.message || "Could not change the password.");
        return;
      }
      notify("Password changed", "Use your new password the next time you sign in.");
      onDone();
    } catch {
      setMsg("No connection. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, ph: string) => (
    <View key={label} className="mb-3">
      <Text className="text-[11px] font-bold text-[#7A76A6] mb-1">{label}</Text>
      <View className="flex-row items-center bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3">
        <TextInput
          value={value}
          onChangeText={set}
          placeholder={ph}
          placeholderTextColor="#A6A2CE"
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          className="flex-1 py-2.5 text-sm font-bold text-[#1F1B3D]"
        />
        <TouchableOpacity onPress={() => setShow(!show)} className="pl-2">
          {show ? <EyeOff size={16} color="#7A76A6" /> : <Eye size={16} color="#7A76A6" />}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View>
      {field("Current password", current, setCurrent, "Your current password")}
      {field("New password", next, setNext, `At least ${minLength} characters`)}
      {field("New password again", again, setAgain, "Same new password")}
      {!!msg && <Text className="text-[11px] font-bold text-[#E4453C] mb-2">{msg}</Text>}
      <Text className="text-[10.5px] font-semibold text-[#7A76A6] mb-3">
        Forgot your current password? Log out, enter your Employee ID and tap "Forgot password?" - an OTP is sent to your
        e-mail.
      </Text>
      <TouchableOpacity
        onPress={save}
        disabled={busy}
        className="bg-[#5B4FD1] rounded-xl py-3 items-center active:opacity-90"
      >
        {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text className="text-white text-xs font-black uppercase">Change password</Text>}
      </TouchableOpacity>
    </View>
  );
}
