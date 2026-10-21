import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Alert,
  Modal,
  KeyboardAvoidingView,
  AppState,
} from "react-native";
import * as Linking from "expo-linking";
import { useIsFocused } from "@react-navigation/native";
import {
  ChevronLeft,
  Send,
  Paperclip,
  Megaphone,
  MessageSquare,
  FileText,
  CheckCheck,
  PlusCircle,
  Plus,
  Users,
  Trash2,
  Check,
  Pin,
  X,
  User,
  Download,
  Globe,
  Building2,
  Lock,
  AtSign,
  Search,
} from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import ScreenContainer from "../components/ScreenContainer";
import { BASE_HOST } from "../constants/config";
import { useChatUnread } from "../utils/Usechatunread";
import { playChatSound } from "../utils/chatSound";
import { setActiveChatRoom } from "../constants/Notifications";

interface ChatScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string) => void;
    canGoBack?: () => boolean;
  };
  userSession?: {
    empId: string;
    isAdmin: boolean;
  };
  route?: { params?: { roomId?: string } }; // set when the user taps a chat push notification
}

interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  attachment?: {
    name: string;
    sizeMb: number;
    type: string;
    url?: string;
  };
  isSelf: boolean;
}

interface Announcement {
  id: string | number;
  title: string;
  content: string;
  postedBy: string;
  date: string;
  priority: "High" | "Normal" | "Urgent";
  pinned?: boolean;
}

// A real employee, loaded from the server (user_configs)
interface Person {
  empId: string;
  name: string;
  department?: string | null;
}

// GENERAL = everyone, DEPARTMENT = that department, CUSTOM = private group made by an admin
interface Channel {
  id: string;
  name: string;
  type: "GENERAL" | "DEPARTMENT" | "CUSTOM";
  isPrivate: boolean;
  isCustom: boolean;
  memberCount: number;
  canDelete: boolean;
}

interface InboxItem {
  roomId: string;
  partner: Person;
  lastMessage: string;
}

const API_BASE_URL = `${BASE_HOST}/api/workspace`;

const MAX_FILE_SIZE_MB = 10;
const POLL_MESSAGES_MS = 5000; // open chat refreshes every 5 seconds
const POLL_LISTS_MS = 60000; // groups, people, inbox and notices refresh every minute

const notify = (title: string, msg: string) =>
  Platform.OS === "web" ? window.alert(`${title}\n${msg}`) : Alert.alert(title, msg);

const dmRoomId = (a: string, b: string) => [a, b].sort().join("_");

const readError = async (res: Response, fallback: string) => {
  try {
    const j = await res.json();
    return j?.error || fallback;
  } catch {
    return fallback;
  }
};

export default function ChatScreen({ navigation, userSession, route }: ChatScreenProps) {
  const isFocused = useIsFocused();

  const isAdmin = userSession?.isAdmin ?? false;
  const currentEmpId = (userSession?.empId || "").trim();
  const empQuery = encodeURIComponent(currentEmpId);

  // unread numbers per room (also the Chats icon and the phone's app icon)
  const { rooms: unreadRooms, refresh: refreshUnread } = useChatUnread(currentEmpId, isFocused);
  const lastMsgId = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<"channels" | "announcements">("channels");
  const [chatType, setChatType] = useState<"groups" | "direct">("groups");
  const [activeConversation, setActiveConversation] = useState<string>("general");
  const [activeDirectUser, setActiveDirectUser] = useState<Person | null>(null);

  const [inputText, setInputText] = useState("");
  const [inputHeight, setInputHeight] = useState(40); // grows with the lines typed, up to 5 lines
  const scrollViewRef = useRef<ScrollView>(null);

  // Real data from the server
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [directory, setDirectory] = useState<Person[]>([]);
  const [roomMembers, setRoomMembers] = useState<Person[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [extraDmPartners, setExtraDmPartners] = useState<Person[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [roomError, setRoomError] = useState<string | null>(null);

  const [pendingAttachment, setPendingAttachment] = useState<{
    name: string;
    sizeMb: number;
    type: string;
    uri?: string;
    rawFile?: any;
  } | null>(null);

  const [showMemberList, setShowMemberList] = useState(false);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  // Admin: create group
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  // New direct message
  const [showDmModal, setShowDmModal] = useState(false);
  const [dmSearch, setDmSearch] = useState("");

  // Announcements
  const [showNewAnnouncementModal, setShowNewAnnouncementModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newPriority, setNewPriority] = useState<"Normal" | "High" | "Urgent">("Normal");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Newest request wins: an older, slower response can never replace the room that is open now
  const roomSeq = useRef(0);
  const membersSeq = useRef(0);

  const me = directory.find((p) => p.empId === currentEmpId) || null;
  const myName = me?.name || "";
  const currentChannel = channels.find((c) => c.id === activeConversation) || null;

  // ----------------------------- data loading -----------------------------
  const loadDirectory = async () => {
    if (!currentEmpId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/directory?empId=${empQuery}`, { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) setDirectory(data as Person[]);
    } catch {
      console.log("Directory fetch failed");
    }
  };

  const loadChannels = async () => {
    if (!currentEmpId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/channels?empId=${empQuery}`, { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) {
        setChannels(data as Channel[]);
        setChannelsLoaded(true);
      }
    } catch {
      console.log("Channels fetch failed");
    }
  };

  const loadInbox = async () => {
    if (!currentEmpId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/inbox?empId=${empQuery}`, { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) {
        setInbox(
          data.map((d: any) => ({
            roomId: d.roomId,
            partner: { empId: d.empId, name: d.name, department: d.department },
            lastMessage: d.lastMessage || "",
          }))
        );
      }
    } catch {
      console.log("Inbox fetch failed");
    }
  };

  const loadRoomMembers = async (roomId: string) => {
    const seq = ++membersSeq.current;
    try {
      const res = await fetch(`${API_BASE_URL}/channels/${encodeURIComponent(roomId)}/members?empId=${empQuery}`, {
        cache: "no-store",
      });
      if (seq !== membersSeq.current) return;
      if (!res.ok) {
        setRoomMembers([]);
        return;
      }
      const data = await res.json();
      if (seq === membersSeq.current && Array.isArray(data)) setRoomMembers(data as Person[]);
    } catch {
      console.log("Members fetch failed");
    }
  };

  const fetchRoomMessages = async (roomId: string) => {
    if (!currentEmpId) return;
    const seq = ++roomSeq.current;
    try {
      const res = await fetch(`${API_BASE_URL}/chat/${encodeURIComponent(roomId)}?empId=${empQuery}`, {
        cache: "no-store",
      });
      if (seq !== roomSeq.current) return;
      if (res.status === 403) {
        setRoomError("You are not a member of this group.");
        setMessages([]);
        return;
      }
      const data = await res.json();
      if (seq !== roomSeq.current) return;
      if (!Array.isArray(data)) return;

      const formatted: Message[] = data.map((m: any) => ({
        id: m.id ? m.id.toString() : `${roomId}-${m.createdAt}-${m.senderEmpId}`,
        channelId: m.channelId || roomId,
        senderId: m.senderEmpId,
        senderName: m.senderName || m.senderEmpId,
        text: m.message || "",
        timestamp: m.createdAt
          ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "Just now",
        attachment:
          m.attachmentName || m.attachment_name
            ? {
                name: m.attachmentName || m.attachment_name,
                sizeMb: m.attachmentSize || m.attachment_size || 1.0,
                type: m.attachmentType || m.attachment_type || "application/pdf",
                url: m.attachmentUrl || m.attachment_url || undefined,
              }
            : undefined,
        isSelf: m.senderEmpId === currentEmpId,
      }));

      setRoomError(null);
      // a new message from someone else in the open room: soft sound
      const newest = formatted[formatted.length - 1];
      if (newest && lastMsgId.current !== null && newest.id !== lastMsgId.current && !newest.isSelf) playChatSound();
      lastMsgId.current = newest ? newest.id : null;
      refreshUnread(); // this room is now read
      // keep the same array when nothing is new, so the screen does not jump every 5 seconds
      setMessages((prev) =>
        prev.length === formatted.length && prev[prev.length - 1]?.id === formatted[formatted.length - 1]?.id
          ? prev
          : formatted
      );
    } catch (e) {
      console.log("Chat fetch error:", e);
    }
  };

  const fetchAnnouncementsFromDb = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/announcements`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const formatted: Announcement[] = data.map((a: any) => ({
          id: a.id,
          title: a.title,
          content: a.content,
          postedBy: a.postedByName || a.posted_by_name || a.postedByEmpId || "System Administrator",
          date:
            a.createdAt || a.created_at
              ? new Date(a.createdAt || a.created_at).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Today",
          priority: a.category === "URGENT" ? "Urgent" : a.category === "POLICY" ? "High" : "Normal",
          pinned: a.pinned || a.is_pinned || false,
        }));
        setAnnouncements(formatted);
      }
    } catch (e) {
      console.log("Announcements fetch failed:", e);
    }
  };

  // ----------------------------- effects -----------------------------
  // Initial load and one-minute refresh of the lists
  useEffect(() => {
    if (!currentEmpId) return;
    loadDirectory();
    loadChannels();
    loadInbox();
    fetchAnnouncementsFromDb();
    if (!isFocused) return;
    const id = setInterval(() => {
      if (AppState.currentState !== "active") return;
      loadChannels();
      loadInbox();
      fetchAnnouncementsFromDb();
    }, POLL_LISTS_MS);
    return () => clearInterval(id);
  }, [currentEmpId, isFocused]);

  // The open group was deleted or is no longer visible: move to the first group that is
  useEffect(() => {
    if (!channelsLoaded || chatType !== "groups" || channels.length === 0) return;
    if (!channels.some((c) => c.id === activeConversation)) setActiveConversation(channels[0].id);
  }, [channels, channelsLoaded, chatType, activeConversation]);

  // Switching room: clear the old room at once (never show the previous room's messages) and load the new one
  useEffect(() => {
    if (activeTab !== "channels" || !currentEmpId) return;
    setMessages([]);
    lastMsgId.current = null;
    setRoomError(null);
    setShowMemberList(false);
    setShowMentionSuggestions(false);
    fetchRoomMessages(activeConversation);
    if (chatType === "groups") {
      setRoomMembers([]);
      loadRoomMembers(activeConversation);
    } else {
      setRoomMembers([]);
    }
  }, [activeConversation, activeTab, currentEmpId]);

  // tell the push handler which room is open (no banner for it); cleared when leaving
  useEffect(() => {
    setActiveChatRoom(isFocused && activeTab === "channels" ? activeConversation : "");
    return () => setActiveChatRoom("");
  }, [activeConversation, activeTab, isFocused]);

  // opened from a chat push notification: go straight to that room
  useEffect(() => {
    const id = route?.params?.roomId;
    if (!id || !currentEmpId) return;
    setActiveTab("channels");
    if (id.includes("_")) {
      const other = id.split("_").find((x) => x !== currentEmpId) || "";
      const person = directory.find((p) => p.empId === other);
      if (person) handleSelectDirectUser(person);
    } else {
      handleSelectChannel(id);
    }
  }, [route?.params?.roomId, currentEmpId, directory.length]);

  // Live refresh of the open chat
  useEffect(() => {
    if (activeTab !== "channels" || !currentEmpId || !isFocused) return;
    const id = setInterval(() => {
      if (AppState.currentState === "active") fetchRoomMessages(activeConversation);
    }, POLL_MESSAGES_MS);
    return () => clearInterval(id);
  }, [activeConversation, activeTab, currentEmpId, isFocused]);

  useEffect(() => {
    if (activeTab === "channels") {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, activeTab]);

  // ----------------------------- derived data -----------------------------
  const otherDirectory = useMemo(() => directory.filter((p) => p.empId !== currentEmpId), [directory, currentEmpId]);

  const departments = useMemo(
    () =>
      Array.from(new Set(otherDirectory.map((p) => (p.department || "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [otherDirectory]
  );

  // People shown as direct-message chips: everyone with a conversation, plus ones started this session
  const dmPartners = useMemo(() => {
    const list: { person: Person; last: string }[] = inbox.map((i) => ({ person: i.partner, last: i.lastMessage }));
    for (const p of extraDmPartners) {
      if (!list.some((x) => x.person.empId === p.empId)) list.unshift({ person: p, last: "" });
    }
    return list;
  }, [inbox, extraDmPartners]);

  // Tag suggestions: members of the open group (not yourself)
  const mentionCandidates = useMemo(
    () => (chatType === "groups" ? roomMembers.filter((m) => m.empId !== currentEmpId) : []),
    [roomMembers, chatType, currentEmpId]
  );

  // One pattern for every employee name, used to highlight @Name in messages
  const mentionRegex = useMemo(() => {
    const names = directory
      .map((p) => (p.name || "").trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    if (!names.length) return null;
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`(@(?:${escaped.join("|")}))`, "g");
  }, [directory]);

  // ----------------------------- actions -----------------------------
  const handleSelectDirectUser = (person: Person) => {
    setChatType("direct");
    setActiveDirectUser(person);
    setExtraDmPartners((prev) => (prev.some((x) => x.empId === person.empId) ? prev : [person, ...prev]));
    setActiveConversation(dmRoomId(currentEmpId, person.empId));
    setShowDmModal(false);
    setDmSearch("");
  };

  const handleSelectChannel = (channelId: string) => {
    setChatType("groups");
    setActiveDirectUser(null);
    setActiveConversation(channelId);
  };

  const handlePickDeviceDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const file = result.assets[0];
      const fileSizeMb = file.size ? file.size / (1024 * 1024) : 0.5;

      if (fileSizeMb > MAX_FILE_SIZE_MB) {
        notify("Upload Restricted", `File (${fileSizeMb.toFixed(1)} MB) exceeds allowed limit of ${MAX_FILE_SIZE_MB} MB.`);
        return;
      }

      setPendingAttachment({
        name: file.name,
        sizeMb: parseFloat(fileSizeMb.toFixed(1)),
        type: file.mimeType || "application/octet-stream",
        uri: file.uri,
        rawFile: (file as any).file || null,
      });
    } catch (err) {
      notify("Picker Error", "Could not open storage.");
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && !pendingAttachment) return;
    if (roomError || !currentEmpId) return;

    const textPayload = inputText.trim();
    const filePayload = pendingAttachment;
    const room = activeConversation;

    setInputText("");
    setInputHeight(40);
    setPendingAttachment(null);
    setShowMentionSuggestions(false);

    try {
      let res: Response;
      if (filePayload) {
        const formData = new FormData();
        formData.append("empId", currentEmpId);
        formData.append("message", textPayload);

        if (Platform.OS === "web") {
          if (filePayload.rawFile) {
            formData.append("file", filePayload.rawFile, filePayload.name);
          } else if (filePayload.uri) {
            const response = await fetch(filePayload.uri);
            const blob = await response.blob();
            formData.append("file", blob, filePayload.name);
          }
        } else {
          formData.append("file", {
            uri: Platform.OS === "ios" ? filePayload.uri?.replace("file://", "") : filePayload.uri,
            name: filePayload.name,
            type: filePayload.type || "application/octet-stream",
          } as any);
        }

        res = await fetch(`${API_BASE_URL}/chat/${encodeURIComponent(room)}/upload`, {
          method: "POST",
          body: formData,
          headers: { Accept: "application/json" },
        });
      } else {
        res = await fetch(`${API_BASE_URL}/chat/${encodeURIComponent(room)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empId: currentEmpId, message: textPayload }),
        });
      }

      if (!res.ok) {
        notify("Not sent", await readError(res, "Could not send the message."));
        return;
      }
      fetchRoomMessages(room);
      if (chatType === "direct") loadInbox();
    } catch (error) {
      notify("Error", "Could not send message or upload file.");
    }
  };

  // ----------------------------- @tagging -----------------------------
  const handleInputChange = (text: string) => {
    setInputText(text);
    const match = text.match(/(?:^|\s)@([^\s@]*)$/);
    if (match && mentionCandidates.length > 0) {
      setMentionQuery(match[1].toLowerCase());
      setShowMentionSuggestions(true);
    } else {
      setShowMentionSuggestions(false);
    }
  };

  const handleSelectMention = (member: Person) => {
    setInputText((prev) => prev.replace(/(^|\s)@[^\s@]*$/, `$1@${member.name} `));
    setShowMentionSuggestions(false);
  };

  const filteredMentions = mentionCandidates
    .filter(
      (m) =>
        m.name.toLowerCase().includes(mentionQuery) || m.empId.toLowerCase().includes(mentionQuery)
    )
    .slice(0, 6);

  // ----------------------------- groups (admin) -----------------------------
  const openCreateGroup = () => {
    setNewChannelName("");
    setSelectedIds([]);
    setMemberSearch("");
    setShowNewChannelModal(true);
  };

  const toggleUserSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const addWholeDepartment = (dept: string) => {
    const ids = otherDirectory.filter((p) => (p.department || "").trim() === dept).map((p) => p.empId);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleCreateChannel = async () => {
    if (!isAdmin) return;
    if (!newChannelName.trim()) {
      notify("Required", "Please enter a group name.");
      return;
    }
    if (selectedIds.length === 0) {
      notify("Required", "Please add at least one member.");
      return;
    }
    setCreatingGroup(true);
    try {
      const res = await fetch(`${API_BASE_URL}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: currentEmpId,
          name: newChannelName.trim(),
          memberIds: selectedIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.channel?.id) {
        await loadChannels();
        handleSelectChannel(data.channel.id);
        setShowNewChannelModal(false);
      } else {
        notify("Could not create group", data?.error || "Please try again.");
      }
    } catch (e) {
      notify("Error", "Could not create the group.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!isAdmin) {
      notify("Denied", "Only Administrators can delete groups.");
      return;
    }

    const executeDelete = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/channels/${encodeURIComponent(channelId)}?empId=${empQuery}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          notify("Could not delete", await readError(res, "Failed to delete the group."));
          return;
        }
        await loadChannels();
        handleSelectChannel("general");
      } catch (e) {
        notify("Error", "Failed to delete the group.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Permanently delete this group and its messages?")) executeDelete();
    } else {
      Alert.alert("Delete Group", "Permanently delete this group and all its messages?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: executeDelete },
      ]);
    }
  };

  // ----------------------------- announcements -----------------------------
  const handleCreateAnnouncement = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      notify("Incomplete Form", "Please enter both title and description.");
      return;
    }

    try {
      const categoryPayload = newPriority === "Urgent" ? "URGENT" : newPriority === "High" ? "POLICY" : "GENERAL";
      const res = await fetch(`${API_BASE_URL}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: currentEmpId,
          title: newTitle.trim(),
          content: newContent.trim(),
          category: categoryPayload,
          isPinned: newPriority === "Urgent",
        }),
      });

      const data = await res.json();
      if (data.success || res.ok) {
        setNewTitle("");
        setNewContent("");
        setNewPriority("Normal");
        setShowNewAnnouncementModal(false);
        fetchAnnouncementsFromDb();
      }
    } catch (e) {
      notify("Error", "Failed to broadcast notice.");
    }
  };

  const handleDownloadAttachment = async (url?: string) => {
    if (!url) {
      notify("File Unavailable", "This document does not have a valid cloud URL.");
      return;
    }
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    }
  };

  // ----------------------------- small renderers -----------------------------
  const channelIcon = (c: Channel, active: boolean) => {
    const color = active ? "#FFFFFF" : "#7A76A6";
    if (c.type === "GENERAL") return <Globe size={12} color={color} />;
    if (c.type === "DEPARTMENT") return <Building2 size={12} color={color} />;
    return <Lock size={12} color={color} />;
  };

  const channelSubtitle = (c: Channel | null, count: number) => {
    if (!c) return `${count} members`;
    const kind = c.type === "GENERAL" ? "All employees" : c.type === "DEPARTMENT" ? "Department group" : "Private group";
    return `${kind} • ${count} member${count === 1 ? "" : "s"}`;
  };

  const renderMessageText = (text: string, isSelf: boolean) => {
    const base = `text-xs font-medium leading-relaxed ${isSelf ? "text-white" : "text-[#1F1B3D]"}`;
    if (!mentionRegex || !text.includes("@")) return <Text className={base}>{text}</Text>;
    const parts = text.split(mentionRegex); // odd positions are the @Name pieces
    return (
      <Text className={base}>
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <Text key={i} className={isSelf ? "font-black underline text-white" : "font-black text-[#5B4FD1]"}>
              {part}
            </Text>
          ) : (
            part
          )
        )}
      </Text>
    );
  };

  const initial = (name?: string) => (name || "?").trim().charAt(0).toUpperCase();

  // ----------------------------- no login -----------------------------
  if (!currentEmpId) {
    return (
      <ScreenContainer scrollable={false} fullWidth={true}>
        <View className="flex-1 items-center justify-center p-8">
          <MessageSquare size={36} color="#A6A2CE" />
          <Text className="text-sm font-black text-[#1F1B3D] mt-3 text-center">Please sign in again</Text>
          <Text className="text-xs text-[#7A76A6] text-center mt-1">Your employee ID is missing, so chat cannot open.</Text>
        </View>
      </ScreenContainer>
    );
  }

  // ----------------------------- render -----------------------------
  const memberCount = currentChannel?.memberCount ?? roomMembers.length;

  const memberSearchLower = memberSearch.trim().toLowerCase();
  const pickList = otherDirectory.filter(
    (p) =>
      !memberSearchLower ||
      p.name.toLowerCase().includes(memberSearchLower) ||
      p.empId.toLowerCase().includes(memberSearchLower) ||
      (p.department || "").toLowerCase().includes(memberSearchLower)
  );

  const dmSearchLower = dmSearch.trim().toLowerCase();
  const dmList = otherDirectory.filter(
    (p) =>
      !dmSearchLower ||
      p.name.toLowerCase().includes(dmSearchLower) ||
      p.empId.toLowerCase().includes(dmSearchLower) ||
      (p.department || "").toLowerCase().includes(dmSearchLower)
  );

  return (
    <ScreenContainer scrollable={false} fullWidth={true}>
      <View
        style={{
          paddingBottom: Platform.OS === "web" ? 40 : 30,
        }}
        className="flex-1 min-h-0 w-full flex-col justify-between"
      >
        {/* ========================================================================= */}
        {/* 1. TOP PURPLE BANNER HEADER                                               */}
        {/* ========================================================================= */}
        <View className="bg-[#5B4FD1] rounded-3xl p-4 mb-3 shadow-xs flex-row items-center justify-between shrink-0">
          <View className="flex-row items-center gap-2.5">
            <TouchableOpacity
              onPress={() => (navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate("Home"))}
              className="w-9 h-9 bg-white/20 rounded-2xl items-center justify-center active:opacity-80"
            >
              <ChevronLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text className="text-base md:text-lg font-black text-white tracking-tight">Workplace Chat</Text>
              <Text className="text-[10px] font-bold text-white/80">PAYCORE • Workspace Real-Time Comms</Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {isAdmin && activeTab === "announcements" && (
              <TouchableOpacity
                onPress={() => setShowNewAnnouncementModal(true)}
                className="bg-white px-3 py-1.5 rounded-full flex-row items-center shadow-xs active:opacity-90"
              >
                <PlusCircle size={13} color="#5B4FD1" />
                <Text className="text-[#5B4FD1] text-xs font-black ml-1">Post Notice</Text>
              </TouchableOpacity>
            )}
            <View className="bg-white/15 border border-white/25 px-2.5 py-1 rounded-full">
              <Text className="text-[10px] font-black text-white uppercase">{myName || currentEmpId}</Text>
            </View>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 2. MODE SWITCH: CHATS vs ANNOUNCEMENTS                                    */}
        {/* ========================================================================= */}
        <View className="flex-row bg-white p-1 rounded-2xl mb-3 border border-[#E7E4F5] shadow-xs shrink-0">
          <TouchableOpacity
            onPress={() => setActiveTab("channels")}
            className={`flex-1 py-2 rounded-xl items-center flex-row justify-center ${
              activeTab === "channels" ? "bg-[#5B4FD1] shadow-xs" : ""
            }`}
          >
            <MessageSquare size={13} color={activeTab === "channels" ? "#FFFFFF" : "#7A76A6"} />
            <Text className={`text-xs font-black ml-1.5 ${activeTab === "channels" ? "text-white" : "text-[#7A76A6]"}`}>
              Chats & Groups
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("announcements")}
            className={`flex-1 py-2 rounded-xl items-center flex-row justify-center ${
              activeTab === "announcements" ? "bg-[#5B4FD1] shadow-xs" : ""
            }`}
          >
            <Megaphone size={13} color={activeTab === "announcements" ? "#FFFFFF" : "#7A76A6"} />
            <Text
              className={`text-xs font-black ml-1.5 ${activeTab === "announcements" ? "text-white" : "text-[#7A76A6]"}`}
            >
              Broadcasts ({announcements.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================================= */}
        {/* TAB 1: GROUPS + DIRECT MESSAGES                                           */}
        {/* ========================================================================= */}
        {activeTab === "channels" && (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1 min-h-0 flex-col"
          >
            {/* Direct messages: people you chat with + New chat */}
            <View className="mb-2 shrink-0">
              <View className="flex-row items-center justify-between mb-1.5 px-1">
                <Text className="text-[10px] font-black text-[#1F1B3D] uppercase tracking-wider">Direct Messages</Text>
                <Text className="text-[9px] font-bold text-[#7A76A6]">{directory.length} colleagues</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setShowDmModal(true)}
                  className="flex-row items-center px-3 py-1.5 rounded-2xl border border-[#5B4FD1] bg-[#EEECFA] mr-2"
                >
                  <Search size={13} color="#5B4FD1" />
                  <Text className="text-xs font-black text-[#5B4FD1] ml-1.5">New chat</Text>
                </TouchableOpacity>

                {dmPartners.map(({ person, last }) => {
                  const isSelected = chatType === "direct" && activeDirectUser?.empId === person.empId;
                  return (
                    <TouchableOpacity
                      key={person.empId}
                      onPress={() => handleSelectDirectUser(person)}
                      className={`flex-row items-center px-3 py-1.5 rounded-2xl border mr-2 ${
                        isSelected ? "bg-[#5B4FD1] border-[#5B4FD1] shadow-xs" : "bg-white border-[#E7E4F5]"
                      }`}
                    >
                      <View
                        className={`w-7 h-7 rounded-full items-center justify-center mr-2 ${
                          isSelected ? "bg-white/20" : "bg-[#EEECFA]"
                        }`}
                      >
                        <Text className={`text-[10px] font-black ${isSelected ? "text-white" : "text-[#5B4FD1]"}`}>
                          {initial(person.name)}
                        </Text>
                      </View>
                      <View style={{ maxWidth: 120 }}>
                        <Text
                          className={`text-xs font-black ${isSelected ? "text-white" : "text-[#1F1B3D]"}`}
                          numberOfLines={1}
                        >
                          {person.name.split(" ")[0]}
                        </Text>
                        <Text
                          className={`text-[9px] font-medium ${isSelected ? "text-purple-200" : "text-[#7A76A6]"}`}
                          numberOfLines={1}
                        >
                          {last || person.department || person.empId}
                        </Text>
                      </View>
                      {(unreadRooms[dmRoomId(currentEmpId, person.empId)] || 0) > 0 && !isSelected && (
                        <View
                          style={{ backgroundColor: "#16A34A", minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5 }}
                          className="items-center justify-center ml-2"
                        >
                          <Text className="text-[9px] font-black text-white">{(unreadRooms[dmRoomId(currentEmpId, person.empId)] || 0) > 99 ? "99+" : (unreadRooms[dmRoomId(currentEmpId, person.empId)] || 0)}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Groups: general, department and private groups this person belongs to */}
            <View className="flex-row items-center justify-between mb-2 shrink-0">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-1.5 flex-1 mr-2">
                {channels.map((ch) => {
                  const isSelected = chatType === "groups" && activeConversation === ch.id;
                  return (
                    <TouchableOpacity
                      key={ch.id}
                      onPress={() => handleSelectChannel(ch.id)}
                      className={`px-3 py-1.5 rounded-xl border flex-row items-center mr-1.5 ${
                        isSelected ? "bg-[#5B4FD1] border-[#5B4FD1] shadow-xs" : "bg-white border-[#E7E4F5]"
                      }`}
                    >
                      {channelIcon(ch, isSelected)}
                      <Text className={`text-xs font-bold ml-1 ${isSelected ? "text-white" : "text-[#1F1B3D]"}`}>
                        {ch.name}
                      </Text>
                      {(unreadRooms[ch.id] || 0) > 0 && !isSelected && (
                        <View
                          style={{ backgroundColor: "#16A34A", minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5 }}
                          className="items-center justify-center ml-2"
                        >
                          <Text className="text-[9px] font-black text-white">{(unreadRooms[ch.id] || 0) > 99 ? "99+" : (unreadRooms[ch.id] || 0)}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                {channelsLoaded && channels.length === 0 && (
                  <Text className="text-xs font-semibold text-[#7A76A6] py-2">No groups yet</Text>
                )}
              </ScrollView>

              <View className="flex-row items-center shrink-0">
                {isAdmin && currentChannel?.canDelete && chatType === "groups" && (
                  <TouchableOpacity
                    onPress={() => handleDeleteChannel(currentChannel.id)}
                    className="w-7 h-7 bg-rose-50 border border-rose-200 rounded-xl items-center justify-center mr-1"
                  >
                    <Trash2 size={13} color="#E11D48" />
                  </TouchableOpacity>
                )}
                {isAdmin && (
                  <TouchableOpacity
                    onPress={openCreateGroup}
                    className="w-8 h-8 bg-[#5B4FD1] rounded-xl items-center justify-center shadow-xs active:opacity-90"
                  >
                    <Plus size={15} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Active conversation sub-header */}
            <View className="bg-white border-t border-x border-[#E7E4F5] px-4 py-2.5 rounded-t-3xl flex-row items-center justify-between shrink-0 shadow-xs">
              <View className="flex-row items-center flex-1 mr-2">
                <View className="w-8 h-8 rounded-full bg-[#EEECFA] items-center justify-center mr-2.5">
                  {chatType === "direct" ? (
                    <User size={15} color="#5B4FD1" />
                  ) : currentChannel?.type === "GENERAL" ? (
                    <Globe size={15} color="#5B4FD1" />
                  ) : currentChannel?.type === "DEPARTMENT" ? (
                    <Building2 size={15} color="#5B4FD1" />
                  ) : (
                    <Lock size={15} color="#5B4FD1" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>
                    {chatType === "direct" ? activeDirectUser?.name : currentChannel?.name || "Loading..."}
                  </Text>
                  <Text className="text-[10px] text-[#7A76A6] font-semibold" numberOfLines={1}>
                    {chatType === "direct"
                      ? `${activeDirectUser?.department || "Employee"} • ${activeDirectUser?.empId}`
                      : channelSubtitle(currentChannel, memberCount)}
                  </Text>
                </View>
              </View>

              {chatType === "groups" && (
                <TouchableOpacity
                  onPress={() => setShowMemberList(!showMemberList)}
                  className="bg-[#F6F5FC] border border-[#E7E4F5] px-2.5 py-1 rounded-xl flex-row items-center"
                >
                  <Users size={12} color="#5B4FD1" />
                  <Text className="text-[10px] text-[#5B4FD1] font-black ml-1">Members</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Member drawer: tap a person to tag them */}
            {showMemberList && chatType === "groups" && (
              <View className="bg-white border-x border-b border-[#E7E4F5] p-2.5 shrink-0">
                <Text className="text-[9px] font-bold text-[#7A76A6] mb-1.5">Tap a name to tag them</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                  {mentionCandidates.map((m) => (
                    <TouchableOpacity
                      key={m.empId}
                      onPress={() => setInputText((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}@${m.name} `)}
                      className="bg-[#EEECFA] px-2.5 py-1 rounded-lg border border-[#5B4FD1]/20 flex-row items-center mr-2"
                    >
                      <Text className="text-[10px] font-bold text-[#5B4FD1]">@{m.name}</Text>
                    </TouchableOpacity>
                  ))}
                  {mentionCandidates.length === 0 && (
                    <Text className="text-[10px] font-semibold text-[#7A76A6]">No other members yet</Text>
                  )}
                </ScrollView>
              </View>
            )}

            {/* Main chat stream */}
            <View className="flex-1 min-h-0 bg-[#F6F5FC] border-x border-b border-[#E7E4F5] rounded-b-3xl p-3 flex-col justify-between overflow-hidden shadow-xs">
              <ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={true}
                className="flex-1 min-h-0"
                contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              >
                {roomError ? (
                  <View className="flex-1 py-14 items-center justify-center">
                    <Lock size={22} color="#A6A2CE" />
                    <Text className="text-xs font-black text-[#1F1B3D] mt-2">{roomError}</Text>
                    <Text className="text-[11px] font-semibold text-[#7A76A6] mt-0.5">
                      Ask an administrator to add you.
                    </Text>
                  </View>
                ) : messages.length === 0 ? (
                  <View className="flex-1 py-14 items-center justify-center">
                    <View className="w-12 h-12 rounded-full bg-white border border-[#E7E4F5] items-center justify-center mb-2 shadow-xs">
                      <MessageSquare size={22} color="#A6A2CE" />
                    </View>
                    <Text className="text-xs font-black text-[#1F1B3D]">Start the conversation</Text>
                    <Text className="text-[11px] font-semibold text-[#7A76A6] mt-0.5">
                      {chatType === "groups" ? "Type @ to tag a teammate." : "Only you two can see this chat."}
                    </Text>
                  </View>
                ) : (
                  messages.map((m) => {
                    const mentionsMe = !m.isSelf && !!myName && m.text.includes(`@${myName}`);
                    return (
                      <View key={m.id} className={`flex-row mb-2.5 ${m.isSelf ? "justify-end" : "justify-start"}`}>
                        <View
                          className={`rounded-2xl px-3.5 py-2.5 max-w-[84%] shadow-xs ${
                            m.isSelf
                              ? "bg-[#5B4FD1] rounded-tr-none"
                              : mentionsMe
                              ? "bg-amber-50 rounded-tl-none border border-amber-300"
                              : "bg-white rounded-tl-none border border-slate-100"
                          }`}
                        >
                          {!m.isSelf && chatType === "groups" && (
                            <Text className="text-[10px] font-black text-[#5B4FD1] mb-0.5">{m.senderName}</Text>
                          )}

                          {mentionsMe && (
                            <View className="flex-row items-center mb-0.5">
                              <AtSign size={10} color="#B45309" />
                              <Text className="text-[9px] font-black text-amber-700 ml-0.5">Mentioned you</Text>
                            </View>
                          )}

                          {m.text ? renderMessageText(m.text, m.isSelf) : null}

                          {m.attachment && (
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() => handleDownloadAttachment(m.attachment?.url)}
                              className={`w-full mt-2 pt-2 border-t flex-row items-center justify-between p-2 rounded-xl ${
                                m.isSelf ? "border-white/20 bg-white/10" : "border-slate-100 bg-slate-50"
                              }`}
                            >
                              <View className="flex-row items-center flex-1 mr-2 min-w-0">
                                <FileText size={16} color={m.isSelf ? "#FFFFFF" : "#5B4FD1"} />
                                <View className="ml-2 flex-1 justify-center min-w-0">
                                  <Text
                                    className={`text-[11px] font-black ${m.isSelf ? "text-white" : "text-[#1F1B3D]"}`}
                                    numberOfLines={1}
                                  >
                                    {m.attachment.name}
                                  </Text>
                                  <Text className={`text-[9px] font-bold ${m.isSelf ? "text-purple-200" : "text-[#7A76A6]"}`}>
                                    {m.attachment.sizeMb} MB • Tap to open
                                  </Text>
                                </View>
                              </View>
                              <Download size={13} color={m.isSelf ? "#FFFFFF" : "#5B4FD1"} />
                            </TouchableOpacity>
                          )}

                          <View className="flex-row items-center justify-end mt-1 gap-1">
                            <Text className={`text-[8.5px] font-bold ${m.isSelf ? "text-white/70" : "text-slate-400"}`}>
                              {m.timestamp}
                            </Text>
                            {m.isSelf && <CheckCheck size={12} color="#A5B4FC" />}
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {/* @tag suggestions: real members of this group */}
              {showMentionSuggestions && filteredMentions.length > 0 && (
                <View className="bg-white border border-[#E7E4F5] rounded-2xl p-2 mb-2 shadow-lg max-h-40 shrink-0">
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {filteredMentions.map((member) => (
                      <TouchableOpacity
                        key={member.empId}
                        onPress={() => handleSelectMention(member)}
                        className="flex-row items-center justify-between p-2 rounded-xl"
                      >
                        <Text className="text-xs font-bold text-[#1F1B3D]">@{member.name}</Text>
                        <Text className="text-[9px] font-medium text-[#7A76A6]">
                          {member.department || member.empId}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {pendingAttachment && (
                <View className="bg-white border border-[#5B4FD1]/30 rounded-2xl p-2.5 mb-2 flex-row items-center justify-between shrink-0 shadow-xs">
                  <View className="flex-row items-center flex-1 mr-2 min-w-0">
                    <FileText size={16} color="#5B4FD1" />
                    <Text className="text-xs font-bold text-[#1F1B3D] ml-2 flex-1" numberOfLines={1}>
                      {pendingAttachment.name} ({pendingAttachment.sizeMb} MB)
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setPendingAttachment(null)}>
                    <X size={16} color="#E4453C" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Composer */}
              <View className="flex-row items-end pt-2 shrink-0">
                <TouchableOpacity
                  onPress={handlePickDeviceDocument}
                  disabled={!!roomError}
                  className={`w-10 h-10 border rounded-2xl items-center justify-center mr-2 active:opacity-80 bg-white shadow-xs ${
                    pendingAttachment ? "border-[#5B4FD1] bg-[#EEECFA]" : "border-[#E7E4F5]"
                  }`}
                >
                  <Paperclip size={18} color="#5B4FD1" />
                </TouchableOpacity>

                <TextInput
                  value={inputText}
                  onChangeText={handleInputChange}
                  editable={!roomError}
                  placeholder={
                    roomError
                      ? "You cannot write here"
                      : `Message ${
                          chatType === "direct" ? activeDirectUser?.name?.split(" ")[0] : currentChannel?.name || "..."
                        }${chatType === "groups" ? "  (type @ to tag)" : ""}`
                  }
                  placeholderTextColor="#A6A2CE"
                  className="flex-1 bg-white border border-[#E7E4F5] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1F1B3D] mr-2 shadow-xs"
                  multiline
                  blurOnSubmit={false}
                  style={{ height: inputHeight, maxHeight: 120, ...(Platform.OS === "web" ? ({ resize: "none" } as any) : {}) }}
                  onContentSizeChange={(e) =>
                    setInputHeight(Math.min(120, Math.max(40, Math.ceil(e.nativeEvent.contentSize.height) + 20)))
                  }
                  // web / keyboard: Enter sends, Shift+Enter makes a new line. On a phone the Enter key makes a new line and the send button sends.
                  onKeyPress={(e: any) => {
                    if (Platform.OS === "web" && e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
                      e.preventDefault?.();
                      handleSendMessage();
                    }
                  }}
                />

                <TouchableOpacity
                  onPress={handleSendMessage}
                  disabled={!!roomError}
                  className="w-10 h-10 bg-[#5B4FD1] rounded-2xl items-center justify-center active:opacity-90 shadow-md shadow-purple-600/20"
                >
                  <Send size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ANNOUNCEMENTS / BROADCASTS                                         */}
        {/* ========================================================================= */}
        {activeTab === "announcements" && (
          <ScrollView
            showsVerticalScrollIndicator={true}
            className="flex-1 min-h-0"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {showNewAnnouncementModal && isAdmin && (
              <View className="bg-white border border-[#5B4FD1]/30 rounded-3xl p-4 mb-3 shadow-xs space-y-3">
                <View className="flex-row items-center justify-between pb-2 border-b border-slate-100">
                  <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
                    Create Corporate Notice
                  </Text>
                  <TouchableOpacity onPress={() => setShowNewAnnouncementModal(false)}>
                    <X size={18} color="#7A76A6" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="Notice Title"
                  placeholderTextColor="#A6A2CE"
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]"
                />

                <TextInput
                  value={newContent}
                  onChangeText={setNewContent}
                  multiline
                  numberOfLines={3}
                  placeholder="Detailed announcement content..."
                  placeholderTextColor="#A6A2CE"
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-medium text-[#1F1B3D] min-h-[75px]"
                />

                <View className="flex-row items-center justify-between">
                  <Text className="text-[10px] font-bold text-[#7A76A6] uppercase">Priority Level</Text>
                  <View className="flex-row gap-1.5">
                    {(["Normal", "High", "Urgent"] as const).map((p) => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setNewPriority(p)}
                        className={`px-3 py-1 rounded-lg border ${
                          newPriority === p ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"
                        }`}
                      >
                        <Text className={`text-[10px] font-black ${newPriority === p ? "text-white" : "text-[#1F1B3D]"}`}>
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleCreateAnnouncement}
                  className="bg-[#5B4FD1] py-3 rounded-2xl items-center shadow-md active:opacity-90"
                >
                  <Text className="text-white font-black text-xs uppercase tracking-wider">Broadcast to All Employees</Text>
                </TouchableOpacity>
              </View>
            )}

            {announcements.length === 0 ? (
              <View className="py-16 items-center justify-center bg-white border border-[#E7E4F5] rounded-3xl p-6 shadow-xs">
                <Megaphone size={34} color="#A6A2CE" />
                <Text className="text-xs font-black text-[#1F1B3D] mt-2">No corporate broadcasts yet</Text>
                <Text className="text-[10px] text-[#7A76A6] mt-0.5">Notices posted by Admins will appear here.</Text>
              </View>
            ) : (
              announcements.map((item) => (
                <View
                  key={item.id}
                  className={`bg-white border rounded-2xl p-4 shadow-xs mb-3 ${
                    item.pinned ? "border-amber-300 bg-amber-50/20" : "border-[#E7E4F5]"
                  }`}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-1.5">
                      <View
                        className={`px-2.5 py-0.5 rounded-full ${
                          item.priority === "Urgent"
                            ? "bg-rose-100"
                            : item.priority === "High"
                            ? "bg-amber-100"
                            : "bg-purple-100"
                        }`}
                      >
                        <Text
                          className={`text-[9px] font-black uppercase ${
                            item.priority === "Urgent"
                              ? "text-rose-700"
                              : item.priority === "High"
                              ? "text-amber-700"
                              : "text-[#5B4FD1]"
                          }`}
                        >
                          {item.priority}
                        </Text>
                      </View>
                      {item.pinned && (
                        <View className="flex-row items-center bg-amber-100 px-2 py-0.5 rounded-md">
                          <Pin size={10} color="#B45309" />
                          <Text className="text-[9px] font-black text-amber-900 ml-1">PINNED</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-[10px] font-semibold text-[#7A76A6]">{item.date}</Text>
                  </View>

                  <Text className="text-sm font-black text-[#1F1B3D] mb-1">{item.title}</Text>
                  <Text className="text-xs font-medium text-[#7A76A6] leading-relaxed mb-2.5">{item.content}</Text>
                  <Text className="text-[10px] font-bold text-[#1F1B3D] border-t border-slate-100 pt-2">
                    Posted by: {item.postedBy}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* ========================================================================= */}
      {/* MODAL: CREATE GROUP (admin only)                                          */}
      {/* ========================================================================= */}
      <Modal visible={showNewChannelModal && isAdmin} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="w-full max-w-md bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-2xl">
            <View className="flex-row items-center justify-between pb-2 border-b border-slate-100 mb-3">
              <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">Create Private Group</Text>
              <TouchableOpacity onPress={() => setShowNewChannelModal(false)}>
                <X size={18} color="#7A76A6" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={newChannelName}
              onChangeText={setNewChannelName}
              placeholder="Group name (e.g. Mobile Sprint)"
              placeholderTextColor="#A6A2CE"
              maxLength={40}
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D] mb-3"
            />

            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-[10px] font-bold text-[#7A76A6] uppercase">Add members</Text>
              <TouchableOpacity onPress={() => setSelectedIds([])}>
                <Text className="text-[10px] font-black text-[#5B4FD1]">Clear</Text>
              </TouchableOpacity>
            </View>

            {departments.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2 flex-grow-0">
                {departments.map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => addWholeDepartment(d)}
                    className="bg-[#EEECFA] border border-[#5B4FD1]/20 px-2.5 py-1 rounded-lg mr-1.5"
                  >
                    <Text className="text-[10px] font-bold text-[#5B4FD1]">+ {d}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TextInput
              value={memberSearch}
              onChangeText={setMemberSearch}
              placeholder="Search by name, ID or department"
              placeholderTextColor="#A6A2CE"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-2 text-xs font-semibold text-[#1F1B3D] mb-2"
            />

            <ScrollView className="max-h-56 bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-2">
              <View className="flex-row items-center justify-between p-2 rounded-lg opacity-70">
                <View className="flex-row items-center">
                  <View className="w-4 h-4 rounded border mr-2 items-center justify-center bg-[#5B4FD1] border-[#5B4FD1]">
                    <Check size={10} color="#FFFFFF" />
                  </View>
                  <Text className="text-xs font-bold text-[#1F1B3D]">{myName || currentEmpId} (you)</Text>
                </View>
                <Text className="text-[10px] font-medium text-[#7A76A6]">Admin</Text>
              </View>
              {pickList.map((member) => {
                const isChecked = selectedIds.includes(member.empId);
                return (
                  <TouchableOpacity
                    key={member.empId}
                    onPress={() => toggleUserSelection(member.empId)}
                    className="flex-row items-center justify-between p-2 rounded-lg"
                  >
                    <View className="flex-row items-center flex-1 mr-2">
                      <View
                        className={`w-4 h-4 rounded border mr-2 items-center justify-center ${
                          isChecked ? "bg-[#5B4FD1] border-[#5B4FD1]" : "border-slate-300 bg-white"
                        }`}
                      >
                        {isChecked && <Check size={10} color="#FFFFFF" />}
                      </View>
                      <Text className="text-xs font-bold text-[#1F1B3D]" numberOfLines={1}>
                        {member.name}
                      </Text>
                    </View>
                    <Text className="text-[10px] font-medium text-[#7A76A6]" numberOfLines={1}>
                      {member.department || member.empId}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {pickList.length === 0 && (
                <Text className="text-[11px] font-semibold text-[#7A76A6] p-2">No employee matches.</Text>
              )}
            </ScrollView>

            <Text className="text-[10px] font-bold text-[#7A76A6] mt-2">
              {selectedIds.length + 1} member{selectedIds.length === 0 ? "" : "s"} including you. Only they can see this
              group.
            </Text>

            <View className="flex-row gap-2 pt-3">
              <TouchableOpacity
                onPress={() => setShowNewChannelModal(false)}
                className="flex-1 bg-[#F6F5FC] border border-[#E7E4F5] py-3 rounded-xl items-center"
              >
                <Text className="text-xs font-black text-[#1F1B3D]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateChannel}
                disabled={creatingGroup}
                className="flex-1 bg-[#5B4FD1] py-3 rounded-xl items-center shadow-md active:opacity-90"
                style={{ opacity: creatingGroup ? 0.6 : 1 }}
              >
                <Text className="text-xs font-black text-white">{creatingGroup ? "Creating..." : "Create Group"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: NEW DIRECT MESSAGE                                                 */}
      {/* ========================================================================= */}
      <Modal visible={showDmModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="w-full max-w-md bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-2xl">
            <View className="flex-row items-center justify-between pb-2 border-b border-slate-100 mb-3">
              <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">New Chat</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDmModal(false);
                  setDmSearch("");
                }}
              >
                <X size={18} color="#7A76A6" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={dmSearch}
              onChangeText={setDmSearch}
              placeholder="Search by name, ID or department"
              placeholderTextColor="#A6A2CE"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-2.5 text-xs font-semibold text-[#1F1B3D] mb-2"
            />

            <ScrollView className="max-h-80" keyboardShouldPersistTaps="handled">
              {dmList.map((person) => (
                <TouchableOpacity
                  key={person.empId}
                  onPress={() => handleSelectDirectUser(person)}
                  className="flex-row items-center p-2.5 rounded-xl border-b border-[#F1EFFB]"
                >
                  <View className="w-8 h-8 rounded-full bg-[#EEECFA] items-center justify-center mr-3">
                    <Text className="text-[11px] font-black text-[#5B4FD1]">{initial(person.name)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>
                      {person.name}
                    </Text>
                    <Text className="text-[10px] font-semibold text-[#7A76A6]" numberOfLines={1}>
                      {person.empId}
                      {person.department ? `  •  ${person.department}` : ""}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {dmList.length === 0 && (
                <Text className="text-[11px] font-semibold text-[#7A76A6] p-3">No employee matches.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}