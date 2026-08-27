import React, { useState, useEffect, useRef } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Platform, 
  Alert,
  Modal,
  KeyboardAvoidingView
} from "react-native";
import * as Linking from "expo-linking";
import { 
  ArrowLeft, 
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
  Hash,
  Download
} from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import ScreenContainer from "../components/ScreenContainer";

interface ChatScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string) => void;
  };
  userSession?: {
    empId: string;
    isAdmin: boolean;
  };
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

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: "online" | "offline";
  unreadCount?: number;
  lastMessage?: string;
}

interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
  isCustom?: boolean;
  allowedMemberIds: string[];
}

const LOCAL_IP = "192.168.31.133";
const API_BASE_URL = Platform.OS === "web"
  ? "http://localhost:8080/api/workspace"
  : `http://${LOCAL_IP}:8080/api/workspace`;

const MAX_FILE_SIZE_MB = 10;

export default function ChatScreen({ navigation, userSession }: ChatScreenProps) {
  const isAdmin = userSession?.isAdmin ?? false;
  const currentEmpId = userSession?.empId || "EMP-1042";

  const [activeTab, setActiveTab] = useState<"channels" | "announcements">("channels");
  const [chatType, setChatType] = useState<"groups" | "direct">("groups");
  const [activeConversation, setActiveConversation] = useState<string>("general");
  const [activeDirectUser, setActiveDirectUser] = useState<TeamMember | null>(null);

  const [inputText, setInputText] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);

  // Channels / Groups
  const [channels, setChannels] = useState<Channel[]>([
    { 
      id: "general", 
      name: "all-hands", 
      isPrivate: false, 
      isCustom: false, 
      allowedMemberIds: ["EMP-1042", "EMP-2031", "EMP-4092", "EMP-3081", "EMP-5012"] 
    },
    { 
      id: "engineering", 
      name: "engineering", 
      isPrivate: false, 
      isCustom: false, 
      allowedMemberIds: ["EMP-1042", "EMP-2031", "EMP-3081", "EMP-5012"] 
    },
    { 
      id: "product", 
      name: "product-ops", 
      isPrivate: false, 
      isCustom: false, 
      allowedMemberIds: ["EMP-1042", "EMP-4092"] 
    },
    { 
      id: "leads", 
      name: "leads-private", 
      isPrivate: true, 
      isCustom: false, 
      allowedMemberIds: ["EMP-1042", "EMP-4092", "EMP-3081"] 
    },
  ]);

  // Company Colleague Directory (Direct Message Inbox)
  const [allTeamMembers] = useState<TeamMember[]>([
    { id: "EMP-2031", name: "Sarah Jenkins", role: "QA Engineer", status: "online", lastMessage: "Ready for review", unreadCount: 1 },
    { id: "EMP-4092", name: "David Miller", role: "Product Manager", status: "online", lastMessage: "Please check the sprint doc" },
    { id: "EMP-3081", name: "Elena Rostova", role: "Backend Architect", status: "offline", lastMessage: "API endpoint deployed" },
    { id: "EMP-5012", name: "Alex Chen", role: "DevOps Engineer", status: "online", lastMessage: "Build pipeline passed" },
  ]);

  const [messages, setMessages] = useState<Message[]>([]);
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

  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [isNewChannelPrivate, setIsNewChannelPrivate] = useState(false);
  const [selectedUserIdsForNewChannel, setSelectedUserIdsForNewChannel] = useState<string[]>([currentEmpId]);

  // Announcements
  const [showNewAnnouncementModal, setShowNewAnnouncementModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newPriority, setNewPriority] = useState<"Normal" | "High" | "Urgent">("Normal");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // 1. Initial Load & Background Polling
  useEffect(() => {
    fetchChannelsFromDb();
    fetchAnnouncementsFromDb();
    const interval = setInterval(() => {
      fetchAnnouncementsFromDb();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === "channels") {
      fetchChannelMessages(activeConversation);
      const interval = setInterval(() => fetchChannelMessages(activeConversation), 3000);
      return () => clearInterval(interval);
    }
  }, [activeConversation, activeTab]);

  useEffect(() => {
    if (activeTab === "channels") {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, activeTab]);

  // Fetch Channels
  const fetchChannelsFromDb = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/channels`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const formatted: Channel[] = data.map((c: any) => ({
          id: c.id,
          name: c.name.replace(/^[#🔒\s]+/, ""),
          isPrivate: c.isPrivate,
          isCustom: c.isCustom,
          allowedMemberIds: c.allowedMembers ? c.allowedMembers.split(",") : [],
        }));
        setChannels(formatted);
      }
    } catch (e) {
      console.log("Channels fetch failed");
    }
  };

  // Fetch Messages for Current Active Room
  const fetchChannelMessages = async (roomId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/${roomId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const formatted: Message[] = data.map((m: any) => ({
          id: m.id ? m.id.toString() : String(Math.random()),
          channelId: m.channelId || roomId,
          senderId: m.senderEmpId,
          senderName: m.senderName || m.senderEmpId,
          text: m.message || "",
          timestamp: m.createdAt 
            ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) 
            : "Just now",
          attachment: (m.attachmentName || m.attachment_name)
            ? {
                name: m.attachmentName || m.attachment_name,
                sizeMb: m.attachmentSize || m.attachment_size || 1.0,
                type: m.attachmentType || m.attachment_type || "application/pdf",
                url: m.attachmentUrl || m.attachment_url || undefined,
              }
            : undefined,
          isSelf: m.senderEmpId === currentEmpId,
        }));
        setMessages(formatted);
      }
    } catch (e) {
      console.log("Chat fetch error:", e);
    }
  };

  // Fetch Announcements
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
          date: (a.createdAt || a.created_at)
            ? new Date(a.createdAt || a.created_at).toLocaleDateString([], { 
                month: "short", 
                day: "numeric", 
                hour: "2-digit", 
                minute: "2-digit" 
              }) 
            : "Today",
          priority: (a.category === "URGENT") ? "Urgent" : (a.category === "POLICY") ? "High" : "Normal",
          pinned: a.pinned || a.is_pinned || false,
        }));
        setAnnouncements(formatted);
      }
    } catch (e) {
      console.log("Announcements fetch failed:", e);
    }
  };

  // Handle Switch to Direct Message with Colleague
  const handleSelectDirectUser = (member: TeamMember) => {
    setChatType("direct");
    setActiveDirectUser(member);
    // Unique deterministic 1-on-1 DM ID
    const dmRoomId = [currentEmpId, member.id].sort().join("_");
    setActiveConversation(dmRoomId);
  };

  // Handle Switch to Group Channel
  const handleSelectChannel = (channelId: string) => {
    setChatType("groups");
    setActiveDirectUser(null);
    setActiveConversation(channelId);
  };

  const currentChannelObj = channels.find((c) => c.id === activeConversation) || channels[0];
  const activeChannelMembers = allTeamMembers.filter((m) => 
    currentChannelObj?.allowedMemberIds?.includes(m.id) || m.id === currentEmpId
  );

  // Pick Document
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
        const msg = `File (${fileSizeMb.toFixed(1)} MB) exceeds allowed limit of ${MAX_FILE_SIZE_MB} MB.`;
        Platform.OS === "web" ? window.alert(msg) : Alert.alert("Upload Restricted", msg);
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
      Alert.alert("Picker Error", "Could not open storage.");
    }
  };

  // Send Message
  const handleSendMessage = async () => {
    if (!inputText.trim() && !pendingAttachment) return;

    const textPayload = inputText.trim();
    const filePayload = pendingAttachment;

    setInputText("");
    setPendingAttachment(null);
    setShowMentionSuggestions(false);

    try {
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

        const res = await fetch(`${API_BASE_URL}/chat/${activeConversation}/upload`, {
          method: "POST",
          body: formData,
          headers: { Accept: "application/json" },
        });

        const data = await res.json();
        if (data.success || res.ok) fetchChannelMessages(activeConversation);
      } else {
        const res = await fetch(`${API_BASE_URL}/chat/${activeConversation}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            empId: currentEmpId,
            message: textPayload,
          }),
        });

        const data = await res.json();
        if (data.success || res.ok) fetchChannelMessages(activeConversation);
      }
    } catch (error) {
      Alert.alert("Error", "Could not send message or upload file.");
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    const lastWord = text.split(" ").pop() || "";
    if (lastWord.startsWith("@")) {
      setMentionQuery(lastWord.substring(1).toLowerCase());
      setShowMentionSuggestions(true);
    } else {
      setShowMentionSuggestions(false);
    }
  };

  const handleSelectMention = (member: TeamMember) => {
    const words = inputText.split(" ");
    words.pop();
    words.push(`@${member.name}`);
    setInputText(words.join(" ") + " ");
    setShowMentionSuggestions(false);
  };

  const toggleUserSelection = (id: string) => {
    if (selectedUserIdsForNewChannel.includes(id)) {
      if (selectedUserIdsForNewChannel.length === 1) return;
      setSelectedUserIdsForNewChannel((prev) => prev.filter((userId) => userId !== id));
    } else {
      setSelectedUserIdsForNewChannel((prev) => [...prev, id]);
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      Alert.alert("Required", "Please enter a group name.");
      return;
    }

    const formattedId = newChannelName.trim().toLowerCase().replace(/\s+/g, "-");
    const allowedMembersStr = selectedUserIdsForNewChannel.join(",");

    try {
      const res = await fetch(`${API_BASE_URL}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: formattedId,
          name: formattedId,
          isPrivate: isNewChannelPrivate,
          isCustom: true,
          allowedMembers: allowedMembersStr,
        }),
      });

      const data = await res.json();
      if (data.success) {
        fetchChannelsFromDb();
        handleSelectChannel(formattedId);
        setNewChannelName("");
        setIsNewChannelPrivate(false);
        setSelectedUserIdsForNewChannel([currentEmpId]);
        setShowNewChannelModal(false);
      }
    } catch (e) {
      Alert.alert("Error", "Could not create channel.");
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!isAdmin) {
      Alert.alert("Denied", "Only Administrators can delete channels.");
      return;
    }

    const executeDelete = async () => {
      try {
        await fetch(`${API_BASE_URL}/channels/${channelId}`, { method: "DELETE" });
        fetchChannelsFromDb();
        handleSelectChannel("general");
      } catch (e) {
        Alert.alert("Error", "Failed to delete channel.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Permanently delete this team channel?")) executeDelete();
    } else {
      Alert.alert("Delete Channel", "Are you sure you want to permanently delete this channel?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: executeDelete },
      ]);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      const msg = "Please enter both title and description.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Incomplete Form", msg);
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
      Alert.alert("Error", "Failed to broadcast notice.");
    }
  };

  const handleDownloadAttachment = async (url?: string) => {
    if (!url) {
      Alert.alert("File Unavailable", "This document does not have a valid cloud URL.");
      return;
    }
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    }
  };

  return (
    <ScreenContainer scrollable={false}>
      <View className="flex-1 min-h-0 w-full flex-col justify-between">
        
        {/* Top Header */}
        <View className="flex-row items-center justify-between mb-2.5 shrink-0">
          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              className="w-9 h-9 bg-brand-card border border-brand-border rounded-xl items-center justify-center mr-2.5 shadow-xs"
            >
              <ArrowLeft size={16} color="#0F172A" />
            </TouchableOpacity>
            <View>
              <Text className="text-xl font-black text-brand-dark tracking-tight">Workplace Chat</Text>
              <Text className="text-[11px] font-bold text-brand-muted">Internal Corporate Messaging</Text>
            </View>
          </View>

          <View className="flex-row items-center space-x-2">
            {isAdmin && activeTab === "announcements" && (
              <TouchableOpacity
                onPress={() => setShowNewAnnouncementModal(true)}
                className="bg-brand-hero px-3 py-1.5 rounded-xl flex-row items-center shadow-xs"
              >
                <PlusCircle size={13} color="#FFFFFF" />
                <Text className="text-white text-xs font-bold ml-1">Post Notice</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Mode Switch (Chats vs Announcements) */}
        <View className="flex-row bg-brand-hero/10 p-1 rounded-2xl mb-2.5 border border-brand-border shrink-0">
          <TouchableOpacity
            onPress={() => setActiveTab("channels")}
            className={`flex-1 py-2 rounded-xl items-center flex-row justify-center ${
              activeTab === "channels" ? "bg-brand-hero shadow-xs" : ""
            }`}
          >
            <MessageSquare size={13} color={activeTab === "channels" ? "#FFFFFF" : "#0F172A"} />
            <Text className={`text-xs font-black ml-1.5 ${activeTab === "channels" ? "text-white" : "text-brand-dark"}`}>
              Chats & Groups
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("announcements")}
            className={`flex-1 py-2 rounded-xl items-center flex-row justify-center ${
              activeTab === "announcements" ? "bg-brand-hero shadow-xs" : ""
            }`}
          >
            <Megaphone size={13} color={activeTab === "announcements" ? "#FFFFFF" : "#0F172A"} />
            <Text className={`text-xs font-black ml-1.5 ${activeTab === "announcements" ? "text-white" : "text-brand-dark"}`}>
              Broadcasts ({announcements.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* CHAT TAB (WhatsApp Inbox + Chat Room) */}
        {activeTab === "channels" && (
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1 min-h-0 flex-col"
          >
            {/* 1. TOP INBOX BAR: Direct Colleague Messages (WhatsApp Story/Inbox Style) */}
            <View className="mb-2 shrink-0">
              <View className="flex-row items-center justify-between mb-1.5 px-0.5">
                <Text className="text-[10px] font-black text-brand-dark uppercase tracking-wider">
                  Direct Messages (Inbox)
                </Text>
                <Text className="text-[9px] font-bold text-brand-muted">Tap coworker to chat 1-on-1</Text>
              </View>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-2">
                {allTeamMembers.map((member) => {
                  const isSelected = chatType === "direct" && activeDirectUser?.id === member.id;
                  return (
                    <TouchableOpacity
                      key={member.id}
                      onPress={() => handleSelectDirectUser(member)}
                      className={`flex-row items-center px-2.5 py-1.5 rounded-xl border ${
                        isSelected 
                          ? "bg-[#005C4B] border-[#005C4B]" 
                          : "bg-brand-card border-brand-border"
                      }`}
                    >
                      <View className="relative mr-2">
                        <View className="w-6 h-6 rounded-full bg-teal-100 items-center justify-center">
                          <Text className="text-[10px] font-black text-teal-900">{member.name.charAt(0)}</Text>
                        </View>
                        <View className={`w-2 h-2 rounded-full absolute -bottom-0.5 -right-0.5 border border-white ${
                          member.status === "online" ? "bg-emerald-500" : "bg-slate-400"
                        }`} />
                      </View>
                      
                      <View>
                        <Text className={`text-[11px] font-black ${isSelected ? "text-white" : "text-brand-dark"}`}>
                          {member.name.split(" ")[0]}
                        </Text>
                      </View>
                      {member.unreadCount && !isSelected ? (
                        <View className="ml-1.5 bg-emerald-500 px-1 rounded-full items-center justify-center">
                          <Text className="text-[8px] font-black text-white">{member.unreadCount}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 2. GROUP CHANNELS SELECTOR BAR */}
            <View className="flex-row items-center justify-between mb-2 shrink-0">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-1.5 flex-1 mr-2">
                {channels.map((ch) => {
                  const isSelected = chatType === "groups" && activeConversation === ch.id;
                  return (
                    <TouchableOpacity
                      key={ch.id}
                      onPress={() => handleSelectChannel(ch.id)}
                      className={`px-3 py-1 rounded-xl border flex-row items-center ${
                        isSelected 
                          ? "bg-brand-hero border-brand-hero" 
                          : "bg-brand-cardTint border-brand-border"
                      }`}
                    >
                      <Hash size={11} color={isSelected ? "#FFFFFF" : "#5C4D41"} />
                      <Text className={`text-[11px] font-bold ml-0.5 ${isSelected ? "text-white" : "text-brand-dark"}`}>
                        {ch.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View className="flex-row items-center space-x-1 shrink-0">
                {isAdmin && currentChannelObj?.isCustom && chatType === "groups" && (
                  <TouchableOpacity
                    onPress={() => handleDeleteChannel(currentChannelObj.id)}
                    className="w-7 h-7 bg-rose-50 border border-rose-200 rounded-lg items-center justify-center"
                  >
                    <Trash2 size={13} color="#E11D48" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setShowNewChannelModal(true)}
                  className="w-7 h-7 bg-brand-hero rounded-lg items-center justify-center shadow-xs"
                >
                  <Plus size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. ACTIVE CONVERSATION BANNER (WhatsApp Header Style) */}
            <View className="bg-[#005C4B] px-3 py-2 rounded-t-2xl flex-row items-center justify-between shrink-0 shadow-xs">
              <View className="flex-row items-center">
                <View className="w-7 h-7 rounded-full bg-white/20 items-center justify-center mr-2">
                  {chatType === "direct" ? (
                    <User size={14} color="#FFFFFF" />
                  ) : (
                    <Hash size={14} color="#FFFFFF" />
                  )}
                </View>
                <View>
                  <Text className="text-xs font-black text-white">
                    {chatType === "direct" ? activeDirectUser?.name : `# ${currentChannelObj?.name}`}
                  </Text>
                  <Text className="text-[9px] text-teal-200 font-medium">
                    {chatType === "direct" 
                      ? `${activeDirectUser?.role} • ${activeDirectUser?.status}` 
                      : `${activeChannelMembers.length} team members`}
                  </Text>
                </View>
              </View>

              {chatType === "groups" && (
                <TouchableOpacity 
                  onPress={() => setShowMemberList(!showMemberList)}
                  className="bg-white/10 px-2 py-1 rounded-lg flex-row items-center"
                >
                  <Users size={12} color="#FFFFFF" />
                  <Text className="text-[9px] text-white font-bold ml-1">Members</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Member Dropdown Drawer */}
            {showMemberList && chatType === "groups" && (
              <View className="bg-brand-card border-x border-b border-brand-border p-2 mb-1 shrink-0">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-2">
                  {activeChannelMembers.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => setInputText((prev) => `${prev}@${m.name} `)}
                      className="bg-brand-cardTint px-2 py-1 rounded-lg border border-brand-border flex-row items-center"
                    >
                      <Text className="text-[10px] font-bold text-brand-dark">@{m.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* 4. WHATSAPP CHAT STREAM CONTAINER */}
            <View className="flex-1 min-h-0 bg-[#EFEAE2] border-x border-b border-brand-border rounded-b-3xl p-3 flex-col justify-between overflow-hidden shadow-xs">
              
              {/* Messages Stream */}
              <ScrollView 
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false} 
                className="flex-1 min-h-0"
                contentContainerStyle={{ paddingBottom: 10, flexGrow: 1 }}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              >
                {messages.length === 0 ? (
                  <View className="flex-1 py-14 items-center justify-center">
                    <MessageSquare size={28} color="#8C7A6B" />
                    <Text className="text-xs font-bold text-brand-muted mt-2">
                      No messages yet in this conversation.
                    </Text>
                  </View>
                ) : (
                  messages.map((m) => (
                    <View 
                      key={m.id} 
                      className={`flex-row mb-2 ${m.isSelf ? "justify-end" : "justify-start"}`}
                    >
                      <View 
                        className={`rounded-2xl px-3 py-2 max-w-[82%] shadow-xs ${
                          m.isSelf 
                            ? "bg-[#DCF8C6] rounded-tr-none" 
                            : "bg-white rounded-tl-none border border-slate-100"
                        }`}
                      >
                        {/* Sender Label in Group Chat */}
                        {!m.isSelf && chatType === "groups" && (
                          <Text className="text-[10px] font-black text-teal-800 mb-0.5">
                            {m.senderName}
                          </Text>
                        )}

                        {/* Text Message */}
                        {m.text ? (
                          <Text className="text-xs text-slate-800 font-medium leading-relaxed">
                            {m.text}
                          </Text>
                        ) : null}

                        {/* Attachment Box */}
                        {m.attachment && (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => handleDownloadAttachment(m.attachment?.url)}
                            className="w-full mt-1.5 pt-1.5 border-t border-black/10 flex-row items-center justify-between bg-black/5 p-2 rounded-xl"
                          >
                            <View className="flex-row items-center flex-1 mr-2 min-w-0">
                              <FileText size={16} color="#075E54" />
                              <View className="ml-2 flex-1 justify-center min-w-0">
                                <Text className="text-[11px] font-black text-slate-800" numberOfLines={1} ellipsizeMode="middle">
                                  {m.attachment.name}
                                </Text>
                                <Text className="text-[8px] font-bold text-slate-500">
                                  {m.attachment.sizeMb} MB • Tap to open
                                </Text>
                              </View>
                            </View>
                            <Download size={13} color="#075E54" />
                          </TouchableOpacity>
                        )}

                        {/* Time & Double Tick */}
                        <View className="flex-row items-center justify-end mt-1 space-x-1">
                          <Text className="text-[8px] font-bold text-slate-400">
                            {m.timestamp}
                          </Text>
                          {m.isSelf && (
                            <CheckCheck size={11} color="#34B7F1" />
                          )}
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              {/* Mention Autocomplete List */}
              {showMentionSuggestions && (
                <View className="bg-white border border-slate-200 rounded-xl p-2 mb-2 shadow-lg max-h-28 shrink-0">
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {activeChannelMembers
                      .filter((m) => m.name.toLowerCase().includes(mentionQuery))
                      .map((member) => (
                        <TouchableOpacity
                          key={member.id}
                          onPress={() => handleSelectMention(member)}
                          className="flex-row items-center justify-between p-1.5 rounded-lg hover:bg-slate-50"
                        >
                          <Text className="text-xs font-bold text-slate-800">@{member.name}</Text>
                          <Text className="text-[9px] text-slate-400">{member.role}</Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              )}

              {/* Pending File Preview Chip */}
              {pendingAttachment && (
                <View className="bg-white border border-teal-200 rounded-xl p-2 mb-2 flex-row items-center justify-between shrink-0">
                  <View className="flex-row items-center flex-1 mr-2 min-w-0">
                    <FileText size={15} color="#0D9488" />
                    <Text className="text-xs font-bold text-slate-800 ml-1.5 flex-1" numberOfLines={1}>
                      {pendingAttachment.name} ({pendingAttachment.sizeMb} MB)
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setPendingAttachment(null)}>
                    <X size={15} color="#5C4D41" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Bottom WhatsApp Input Bar */}
              <View className="flex-row items-center pt-2 shrink-0">
                <TouchableOpacity 
                  onPress={handlePickDeviceDocument}
                  className={`w-9 h-9 border rounded-full items-center justify-center mr-1.5 active:opacity-80 bg-white ${
                    pendingAttachment ? "border-teal-500" : "border-slate-300"
                  }`}
                >
                  <Paperclip size={16} color="#075E54" />
                </TouchableOpacity>

                <TextInput
                  value={inputText}
                  onChangeText={handleInputChange}
                  placeholder={`Message ${chatType === "direct" ? activeDirectUser?.name?.split(" ")[0] : "#" + currentChannelObj?.name}...`}
                  placeholderTextColor="#8C7A6B"
                  className="flex-1 bg-white border border-slate-300 rounded-full px-4 py-2 text-xs font-semibold text-slate-900 mr-1.5"
                  onSubmitEditing={handleSendMessage}
                />

                <TouchableOpacity 
                  onPress={handleSendMessage}
                  className="w-9 h-9 bg-[#005C4B] rounded-full items-center justify-center active:opacity-90 shadow-xs"
                >
                  <Send size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

            </View>
          </KeyboardAvoidingView>
        )}

        {/* ANNOUNCEMENTS TAB */}
        {activeTab === "announcements" && (
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1 min-h-0 space-y-3">
            {showNewAnnouncementModal && isAdmin && (
              <View className="bg-brand-card border-2 border-brand-primary rounded-3xl p-4 mb-2 shadow-md space-y-2.5">
                <View className="flex-row items-center justify-between pb-1 border-b border-slate-100">
                  <Text className="text-xs font-black text-brand-dark uppercase tracking-wider">
                    Create Corporate Notice
                  </Text>
                  <TouchableOpacity onPress={() => setShowNewAnnouncementModal(false)}>
                    <X size={16} color="#5C4D41" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="Notice Title"
                  placeholderTextColor="#8C7A6B"
                  className="bg-brand-cardTint border border-brand-border rounded-xl p-2.5 text-xs font-bold text-brand-dark"
                />

                <TextInput
                  value={newContent}
                  onChangeText={setNewContent}
                  multiline
                  numberOfLines={3}
                  placeholder="Detailed announcement content..."
                  placeholderTextColor="#8C7A6B"
                  className="bg-brand-cardTint border border-brand-border rounded-xl p-2.5 text-xs font-medium text-brand-dark"
                />

                <View className="flex-row items-center justify-between">
                  <Text className="text-[10px] font-bold text-brand-muted uppercase">Priority</Text>
                  <View className="flex-row space-x-1">
                    {(["Normal", "High", "Urgent"] as const).map((p) => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setNewPriority(p)}
                        className={`px-2.5 py-1 rounded-lg border ${
                          newPriority === p ? "bg-brand-hero border-brand-hero" : "bg-brand-cardTint border-brand-border"
                        }`}
                      >
                        <Text className={`text-[9px] font-black ${newPriority === p ? "text-white" : "text-brand-dark"}`}>
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleCreateAnnouncement}
                  className="bg-brand-hero py-2.5 rounded-xl items-center shadow-xs"
                >
                  <Text className="text-white font-black text-xs uppercase tracking-wider">
                    Broadcast to All Employees
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {announcements.length === 0 ? (
              <View className="py-14 items-center justify-center bg-brand-card border border-brand-border rounded-3xl p-6">
                <Megaphone size={32} color="#8C7A6B" />
                <Text className="text-xs font-bold text-brand-muted mt-2">No corporate broadcasts found.</Text>
              </View>
            ) : (
              announcements.map((item) => (
                <View 
                  key={item.id}
                  className={`bg-brand-card border rounded-2xl p-4 shadow-xs mb-2.5 ${
                    item.pinned ? "border-amber-400 bg-amber-50/20" : "border-brand-border"
                  }`}
                >
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center">
                      <View className="bg-teal-100 px-2 py-0.5 rounded-full mr-2">
                        <Text className="text-[8px] font-black text-teal-800">{item.priority.toUpperCase()}</Text>
                      </View>
                      {item.pinned && (
                        <View className="flex-row items-center bg-amber-100 px-1.5 py-0.5 rounded-md">
                          <Pin size={9} color="#B45309" />
                          <Text className="text-[8px] font-black text-amber-900 ml-1">PINNED</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-[9px] font-bold text-brand-muted">{item.date}</Text>
                  </View>

                  <Text className="text-xs font-black text-brand-dark mb-1">{item.title}</Text>
                  <Text className="text-[11px] font-medium text-brand-muted leading-relaxed mb-2">
                    {item.content}
                  </Text>
                  <Text className="text-[9px] font-bold text-brand-dark border-t border-slate-100 pt-1.5">
                    Posted by: {item.postedBy}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        )}

      </View>

      {/* CREATE CHANNEL MODAL */}
      <Modal visible={showNewChannelModal} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-center items-center p-4">
          <View className="w-full max-w-md bg-brand-card border border-brand-border rounded-3xl p-5 shadow-xl space-y-3">
            <View className="flex-row items-center justify-between pb-1 border-b border-slate-100">
              <Text className="text-xs font-black text-brand-dark uppercase tracking-wider">
                Create Team Group
              </Text>
              <TouchableOpacity onPress={() => setShowNewChannelModal(false)}>
                <X size={16} color="#5C4D41" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={newChannelName}
              onChangeText={setNewChannelName}
              placeholder="Group name (e.g. mobile-sprint)"
              placeholderTextColor="#8C7A6B"
              autoCapitalize="none"
              className="bg-brand-cardTint border border-brand-border rounded-xl p-2.5 text-xs font-bold text-brand-dark"
            />

            <Text className="text-[10px] font-bold text-brand-muted uppercase">Assign Members</Text>
            <ScrollView className="max-h-32 bg-brand-cardTint border border-brand-border rounded-xl p-2">
              {allTeamMembers.map((member) => {
                const isChecked = selectedUserIdsForNewChannel.includes(member.id);
                return (
                  <TouchableOpacity
                    key={member.id}
                    onPress={() => toggleUserSelection(member.id)}
                    className="flex-row items-center justify-between p-1.5 rounded-lg"
                  >
                    <View className="flex-row items-center">
                      <View className={`w-3.5 h-3.5 rounded border mr-2 items-center justify-center ${
                        isChecked ? "bg-brand-hero border-brand-hero" : "border-slate-400 bg-white"
                      }`}>
                        {isChecked && <Check size={8} color="#FFFFFF" />}
                      </View>
                      <Text className="text-xs font-bold text-brand-dark">{member.name}</Text>
                    </View>
                    <Text className="text-[9px] text-brand-muted">{member.role}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View className="flex-row space-x-2 pt-1">
              <TouchableOpacity
                onPress={() => setShowNewChannelModal(false)}
                className="flex-1 bg-brand-cardTint border border-brand-border py-2.5 rounded-xl items-center"
              >
                <Text className="text-xs font-black text-brand-dark">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateChannel}
                className="flex-1 bg-brand-hero py-2.5 rounded-xl items-center shadow-xs"
              >
                <Text className="text-xs font-black text-white">Create Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}