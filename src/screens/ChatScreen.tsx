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
  KeyboardAvoidingView,
  useWindowDimensions
} from "react-native";
import * as Linking from "expo-linking";
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
  Hash,
  Download,
  Sparkles
} from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import ScreenContainer from "../components/ScreenContainer";

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
  ? "http://192.168.31.133:8080/api/workspace"
  : `http://${LOCAL_IP}:8080/api/workspace`;

const MAX_FILE_SIZE_MB = 10;

export default function ChatScreen({ navigation, userSession }: ChatScreenProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

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

  // Colleague Directory
  const [allTeamMembers] = useState<TeamMember[]>([
    { id: "EMP-2031", name: "Sarah Jenkins", role: "QA Lead", status: "online", lastMessage: "Ready for review", unreadCount: 1 },
    { id: "EMP-4092", name: "David Miller", role: "Product Manager", status: "online", lastMessage: "Please check sprint doc" },
    { id: "EMP-3081", name: "Elena Rostova", role: "Backend Lead", status: "offline", lastMessage: "API deployed" },
    { id: "EMP-5012", name: "Alex Chen", role: "DevOps Lead", status: "online", lastMessage: "Pipeline passed" },
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

  const handleSelectDirectUser = (member: TeamMember) => {
    setChatType("direct");
    setActiveDirectUser(member);
    const dmRoomId = [currentEmpId, member.id].sort().join("_");
    setActiveConversation(dmRoomId);
  };

  const handleSelectChannel = (channelId: string) => {
    setChatType("groups");
    setActiveDirectUser(null);
    setActiveConversation(channelId);
  };

  const currentChannelObj = channels.find((c) => c.id === activeConversation) || channels[0];
  const activeChannelMembers = allTeamMembers.filter((m) => 
    currentChannelObj?.allowedMemberIds?.includes(m.id) || m.id === currentEmpId
  );

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
    <ScreenContainer scrollable={false} fullWidth={true}>
      {/* Outer Flex Container: Holds bottom space so bottom navigation bar does not cover composer */}
      <View 
        style={{ 
          paddingBottom: Platform.OS === "web" ? 40 : 30
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
              <Text className="text-base md:text-lg font-black text-white tracking-tight">
                Workplace Chat
              </Text>
              <Text className="text-[10px] font-bold text-white/80">
                PAYCORE • Workspace Real-Time Comms
              </Text>
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
              <Text className="text-[10px] font-black text-white uppercase">{currentEmpId}</Text>
            </View>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 2. MODE SWITCH: CHATS vs ANNOUNCEMENTS                                    */}
        {/* ========================================================================= */}
        <View className="flex-row bg-white p-1 rounded-2xl mb-3 border border-[#E7E4F5] shadow-xs shrink-0">
          <TouchableOpacity
            onPress={() => setActiveTab("channels")}
            className={`flex-1 py-2 rounded-xl items-center flex-row justify-center transition-all ${
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
            className={`flex-1 py-2 rounded-xl items-center flex-row justify-center transition-all ${
              activeTab === "announcements" ? "bg-[#5B4FD1] shadow-xs" : ""
            }`}
          >
            <Megaphone size={13} color={activeTab === "announcements" ? "#FFFFFF" : "#7A76A6"} />
            <Text className={`text-xs font-black ml-1.5 ${activeTab === "announcements" ? "text-white" : "text-[#7A76A6]"}`}>
              Broadcasts ({announcements.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================================= */}
        {/* TAB 1: CHAT & DIRECT INBOX                                                */}
        {/* ========================================================================= */}
        {activeTab === "channels" && (
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1 min-h-0 flex-col"
          >
            {/* Direct Colleague Horizontal Carousel */}
            <View className="mb-2 shrink-0">
              <View className="flex-row items-center justify-between mb-1.5 px-1">
                <Text className="text-[10px] font-black text-[#1F1B3D] uppercase tracking-wider">
                  Direct Messages
                </Text>
                <Text className="text-[9px] font-bold text-[#7A76A6]">Tap colleague to message</Text>
              </View>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-2 gap-2">
                {allTeamMembers.map((member) => {
                  const isSelected = chatType === "direct" && activeDirectUser?.id === member.id;
                  return (
                    <TouchableOpacity
                      key={member.id}
                      onPress={() => handleSelectDirectUser(member)}
                      className={`flex-row items-center px-3 py-1.5 rounded-2xl border transition-all ${
                        isSelected 
                          ? "bg-[#5B4FD1] border-[#5B4FD1] shadow-xs" 
                          : "bg-white border-[#E7E4F5]"
                      }`}
                    >
                      <View className="relative mr-2">
                        <View className={`w-7 h-7 rounded-full items-center justify-center ${isSelected ? "bg-white/20" : "bg-[#EEECFA]"}`}>
                          <Text className={`text-[10px] font-black ${isSelected ? "text-white" : "text-[#5B4FD1]"}`}>
                            {member.name.charAt(0)}
                          </Text>
                        </View>
                        <View className={`w-2.5 h-2.5 rounded-full absolute -bottom-0.5 -right-0.5 border border-white ${
                          member.status === "online" ? "bg-emerald-500" : "bg-slate-300"
                        }`} />
                      </View>
                      
                      <View>
                        <Text className={`text-xs font-black ${isSelected ? "text-white" : "text-[#1F1B3D]"}`}>
                          {member.name.split(" ")[0]}
                        </Text>
                        <Text className={`text-[9px] font-medium ${isSelected ? "text-purple-200" : "text-[#7A76A6]"}`}>
                          {member.role}
                        </Text>
                      </View>

                      {member.unreadCount && !isSelected ? (
                        <View className="ml-2 bg-[#5B4FD1] px-1.5 py-0.5 rounded-full items-center justify-center">
                          <Text className="text-[8px] font-black text-white">{member.unreadCount}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Channels List Strip */}
            <View className="flex-row items-center justify-between mb-2 shrink-0">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-1.5 gap-1.5 flex-1 mr-2">
                {channels.map((ch) => {
                  const isSelected = chatType === "groups" && activeConversation === ch.id;
                  return (
                    <TouchableOpacity
                      key={ch.id}
                      onPress={() => handleSelectChannel(ch.id)}
                      className={`px-3 py-1.5 rounded-xl border flex-row items-center transition-all ${
                        isSelected 
                          ? "bg-[#5B4FD1] border-[#5B4FD1] shadow-xs" 
                          : "bg-white border-[#E7E4F5]"
                      }`}
                    >
                      <Hash size={12} color={isSelected ? "#FFFFFF" : "#7A76A6"} />
                      <Text className={`text-xs font-bold ml-1 ${isSelected ? "text-white" : "text-[#1F1B3D]"}`}>
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
                    className="w-7 h-7 bg-rose-50 border border-rose-200 rounded-xl items-center justify-center mr-1"
                  >
                    <Trash2 size={13} color="#E11D48" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setShowNewChannelModal(true)}
                  className="w-8 h-8 bg-[#5B4FD1] rounded-xl items-center justify-center shadow-xs active:opacity-90"
                >
                  <Plus size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Active Conversation Sub-Header */}
            <View className="bg-white border-t border-x border-[#E7E4F5] px-4 py-2.5 rounded-t-3xl flex-row items-center justify-between shrink-0 shadow-xs">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-[#EEECFA] items-center justify-center mr-2.5">
                  {chatType === "direct" ? (
                    <User size={15} color="#5B4FD1" />
                  ) : (
                    <Hash size={15} color="#5B4FD1" />
                  )}
                </View>
                <View>
                  <Text className="text-xs font-black text-[#1F1B3D]">
                    {chatType === "direct" ? activeDirectUser?.name : `#${currentChannelObj?.name}`}
                  </Text>
                  <Text className="text-[10px] text-[#7A76A6] font-semibold">
                    {chatType === "direct" 
                      ? `${activeDirectUser?.role} • ${activeDirectUser?.status}` 
                      : `${activeChannelMembers.length} team members`}
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

            {/* Member Dropdown Drawer */}
            {showMemberList && chatType === "groups" && (
              <View className="bg-white border-x border-b border-[#E7E4F5] p-2.5 shrink-0">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-2 gap-2">
                  {activeChannelMembers.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => setInputText((prev) => `${prev}@${m.name} `)}
                      className="bg-[#EEECFA] px-2.5 py-1 rounded-lg border border-[#5B4FD1]/20 flex-row items-center"
                    >
                      <Text className="text-[10px] font-bold text-[#5B4FD1]">@{m.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Main Chat Stream Container */}
            <View className="flex-1 min-h-0 bg-[#F6F5FC] border-x border-b border-[#E7E4F5] rounded-b-3xl p-3 flex-col justify-between overflow-hidden shadow-xs">
              
              {/* Message Feed */}
              <ScrollView 
                ref={scrollViewRef}
                showsVerticalScrollIndicator={true} 
                className="flex-1 min-h-0"
                contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              >
                {messages.length === 0 ? (
                  <View className="flex-1 py-14 items-center justify-center">
                    <View className="w-12 h-12 rounded-full bg-white border border-[#E7E4F5] items-center justify-center mb-2 shadow-xs">
                      <MessageSquare size={22} color="#A6A2CE" />
                    </View>
                    <Text className="text-xs font-black text-[#1F1B3D]">Start the conversation</Text>
                    <Text className="text-[11px] font-semibold text-[#7A76A6] mt-0.5">
                      Messages sent here are encrypted & workspace verified.
                    </Text>
                  </View>
                ) : (
                  messages.map((m) => (
                    <View 
                      key={m.id} 
                      className={`flex-row mb-2.5 ${m.isSelf ? "justify-end" : "justify-start"}`}
                    >
                      <View 
                        className={`rounded-2xl px-3.5 py-2.5 max-w-[84%] shadow-xs ${
                          m.isSelf 
                            ? "bg-[#5B4FD1] rounded-tr-none" 
                            : "bg-white rounded-tl-none border border-slate-100"
                        }`}
                      >
                        {/* Sender Label */}
                        {!m.isSelf && chatType === "groups" && (
                          <Text className="text-[10px] font-black text-[#5B4FD1] mb-0.5">
                            {m.senderName}
                          </Text>
                        )}

                        {/* Text */}
                        {m.text ? (
                          <Text className={`text-xs font-medium leading-relaxed ${m.isSelf ? "text-white" : "text-[#1F1B3D]"}`}>
                            {m.text}
                          </Text>
                        ) : null}

                        {/* Attachment Box */}
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
                                <Text className={`text-[11px] font-black ${m.isSelf ? "text-white" : "text-[#1F1B3D]"}`} numberOfLines={1}>
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

                        {/* Timestamp & Double Tick */}
                        <View className="flex-row items-center justify-end mt-1 space-x-1 gap-1">
                          <Text className={`text-[8.5px] font-bold ${m.isSelf ? "text-white/70" : "text-slate-400"}`}>
                            {m.timestamp}
                          </Text>
                          {m.isSelf && (
                            <CheckCheck size={12} color="#A5B4FC" />
                          )}
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              {/* Mention Suggestion List */}
              {showMentionSuggestions && (
                <View className="bg-white border border-[#E7E4F5] rounded-2xl p-2 mb-2 shadow-lg max-h-28 shrink-0">
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {activeChannelMembers
                      .filter((m) => m.name.toLowerCase().includes(mentionQuery))
                      .map((member) => (
                        <TouchableOpacity
                          key={member.id}
                          onPress={() => handleSelectMention(member)}
                          className="flex-row items-center justify-between p-2 rounded-xl hover:bg-slate-50"
                        >
                          <Text className="text-xs font-bold text-[#1F1B3D]">@{member.name}</Text>
                          <Text className="text-[9px] font-medium text-[#7A76A6]">{member.role}</Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              )}

              {/* Attachment Preview Strip */}
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

              {/* Floating Pill Input Bar */}
              <View className="flex-row items-center pt-2 shrink-0">
                <TouchableOpacity 
                  onPress={handlePickDeviceDocument}
                  className={`w-10 h-10 border rounded-2xl items-center justify-center mr-2 active:opacity-80 bg-white shadow-xs ${
                    pendingAttachment ? "border-[#5B4FD1] bg-[#EEECFA]" : "border-[#E7E4F5]"
                  }`}
                >
                  <Paperclip size={18} color="#5B4FD1" />
                </TouchableOpacity>

                <TextInput
                  value={inputText}
                  onChangeText={handleInputChange}
                  placeholder={`Message ${chatType === "direct" ? activeDirectUser?.name?.split(" ")[0] : "#" + currentChannelObj?.name}...`}
                  placeholderTextColor="#A6A2CE"
                  className="flex-1 bg-white border border-[#E7E4F5] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1F1B3D] mr-2 shadow-xs"
                  onSubmitEditing={handleSendMessage}
                />

                <TouchableOpacity 
                  onPress={handleSendMessage}
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
            {/* Admin Notice Composer */}
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
                  <View className="flex-row space-x-1.5 gap-1.5">
                    {(["Normal", "High", "Urgent"] as const).map((p) => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setNewPriority(p)}
                        className={`px-3 py-1 rounded-lg border ${
                          newPriority === p 
                            ? "bg-[#5B4FD1] border-[#5B4FD1]" 
                            : "bg-[#F6F5FC] border-[#E7E4F5]"
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
                  <Text className="text-white font-black text-xs uppercase tracking-wider">
                    Broadcast to All Employees
                  </Text>
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
                      <View className={`px-2.5 py-0.5 rounded-full ${
                        item.priority === "Urgent" 
                          ? "bg-rose-100" 
                          : item.priority === "High" 
                          ? "bg-amber-100" 
                          : "bg-purple-100"
                      }`}>
                        <Text className={`text-[9px] font-black uppercase ${
                          item.priority === "Urgent" 
                            ? "text-rose-700" 
                            : item.priority === "High" 
                            ? "text-amber-700" 
                            : "text-[#5B4FD1]"
                        }`}>
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
                  <Text className="text-xs font-medium text-[#7A76A6] leading-relaxed mb-2.5">
                    {item.content}
                  </Text>
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
      {/* MODAL: CREATE CHANNEL / GROUP                                             */}
      {/* ========================================================================= */}
      <Modal visible={showNewChannelModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="w-full max-w-md bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-2xl space-y-3">
            <View className="flex-row items-center justify-between pb-2 border-b border-slate-100">
              <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
                Create Team Group
              </Text>
              <TouchableOpacity onPress={() => setShowNewChannelModal(false)}>
                <X size={18} color="#7A76A6" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={newChannelName}
              onChangeText={setNewChannelName}
              placeholder="Group name (e.g. mobile-sprint)"
              placeholderTextColor="#A6A2CE"
              autoCapitalize="none"
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]"
            />

            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase">Assign Members</Text>
            <ScrollView className="max-h-36 bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-2 space-y-1">
              {allTeamMembers.map((member) => {
                const isChecked = selectedUserIdsForNewChannel.includes(member.id);
                return (
                  <TouchableOpacity
                    key={member.id}
                    onPress={() => toggleUserSelection(member.id)}
                    className="flex-row items-center justify-between p-2 rounded-lg"
                  >
                    <View className="flex-row items-center">
                      <View className={`w-4 h-4 rounded border mr-2 items-center justify-center ${
                        isChecked ? "bg-[#5B4FD1] border-[#5B4FD1]" : "border-slate-300 bg-white"
                      }`}>
                        {isChecked && <Check size={10} color="#FFFFFF" />}
                      </View>
                      <Text className="text-xs font-bold text-[#1F1B3D]">{member.name}</Text>
                    </View>
                    <Text className="text-[10px] font-medium text-[#7A76A6]">{member.role}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View className="flex-row space-x-2 gap-2 pt-2">
              <TouchableOpacity
                onPress={() => setShowNewChannelModal(false)}
                className="flex-1 bg-[#F6F5FC] border border-[#E7E4F5] py-3 rounded-xl items-center"
              >
                <Text className="text-xs font-black text-[#1F1B3D]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateChannel}
                className="flex-1 bg-[#5B4FD1] py-3 rounded-xl items-center shadow-md active:opacity-90"
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