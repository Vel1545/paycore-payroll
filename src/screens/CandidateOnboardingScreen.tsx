import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
  Switch,
  useWindowDimensions 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { 
  User, FileText, Upload, Building2, MapPin, 
  CreditCard, Users, Briefcase, GraduationCap, Phone, CheckSquare, Square 
} from "lucide-react-native";

export default function CandidateOnboardingScreen({ route }: any) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const token = route?.params?.token || "sample-token-123";
  const mobile = route?.params?.mobile || "";

  const [loading, setLoading] = useState(false);
  
  // 1. General & Personal Information
  const [formData, setFormData] = useState({
    fullName: "",
    fathersName: "",
    designation: "",
    department: "",
    dateOfJoining: "",
    employmentType: "FULL-TIME",
    dateOfBirth: "",
    gender: "MALE",
    maritalStatus: "",
    nationality: "Indian",
    bloodGroup: "",
    religion: "",
    identificationMark: "",
    familyIncome: "",
    aadhaarNumber: "",
    panNumber: "",
    mobileNumber: mobile,
    emailAddress: "",
    permanentAddress: "",
    currentAddress: "",
    // Bank Details
    bankName: "",
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    branch: "",
    // Emergency Contact
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone1: "",
    emergencyPhone2: "",
    // Reference Details
    referenceName: "",
    referenceContact: "",
    referenceDepartment: "",
  });

  // Conditional Toggle for Work Experience
  const [hasExperience, setHasExperience] = useState(false);
  const [workExperience, setWorkExperience] = useState([
    { company: "", location: "", duration: "", role: "", salary: "", reason: "" }
  ]);

  // Education Rows
  const [education, setEducation] = useState({
    sslc: { institution: "", year: "", percentage: "" },
    hsc: { institution: "", year: "", percentage: "" },
    ug: { institution: "", year: "", percentage: "" },
    pg: { institution: "", year: "", percentage: "" },
  });

  // Family Information Table Rows
  const [familyMembers, setFamilyMembers] = useState([
    { name: "", relationship: "", occupation: "", contact: "" }
  ]);

  // Document Attachments
  const [files, setFiles] = useState({
    aadhaarFile: null,
    panFile: null,
    bankPassbookFile: null,
    resumeFile: null,
  });

  // Declaration Checkbox
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleFileUpload = (fileKey: string) => {
    setFiles({ ...files, [fileKey]: "Document_Attached.pdf" as any });
    Alert.alert("Success", "Document attached successfully.");
  };

  const addFamilyRow = () => {
    setFamilyMembers([...familyMembers, { name: "", relationship: "", occupation: "", contact: "" }]);
  };

  const handleSubmitForm = async () => {
    if (!declarationAccepted) {
      Alert.alert("Declaration Required", "Please review your details and check the declaration box before submitting.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        token,
        ...formData,
        hasExperience,
        workExperience: hasExperience ? workExperience : [],
        familyMembers,
        education,
      };

      console.log("Submitting Payload:", payload);
      Alert.alert("Submitted", "Your details have been securely staged for verification!");
    } catch (error) {
      Alert.alert("Error", "Failed to submit form. Please check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#4F46E5]" edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }} className="bg-[#F4F6F9]">
        
      {/* COMPANY HEADER */}
        <LinearGradient
          colors={["#4F46E5", "#6366F1", "#818CF8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="pt-10 pb-12 px-6 shadow-md w-full"
        >
          <View style={{ alignItems: "center", justifyContent: "center", width: "100%" }}>
            <View className="w-16 mt-5 h-16 rounded-2xl bg-white/20 border border-white/30 items-center justify-center mb-3 shadow-inner">
              <Building2 size={30} color="#FFFFFF" />
            </View>
            <Text className="text-2xl font-black text-white tracking-wide text-center">Femi 9</Text>
            <Text className="text-[11px] font-bold text-purple-200 uppercase tracking-widest mt-1 mb-1 text-center">
              Employee Onboarding Portal
            </Text>
          </View>
        </LinearGradient>

        {/* MAIN CONTAINER WITH RESPONSIVE CENTERING */}
        <View style={{ width: isDesktop ? "70%" : "100%", alignSelf: "center" }} className="px-4 md:px-6 pt-5 gap-5">
          
          {/* 1. EMPLOYEE DETAILS CARD */}
          <View className="bg-white rounded-[24px] p-5 md:p-6 shadow-sm border border-slate-100">
            <View className="flex-row items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
              <User size={18} color="#5B4FD1" />
              <Text className="text-xs md:text-sm font-black text-[#1F1B3D] uppercase tracking-wider">1. Employee Details</Text>
            </View>

            <View className="gap-4">
              <View>
                <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Full Name (As per ID)*</Text>
                <TextInput 
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                  placeholder="Enter full name"
                  placeholderTextColor="#94A3B8"
                  value={formData.fullName}
                  onChangeText={(val) => handleInputChange("fullName", val)}
                />
              </View>
              <View>
                <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Father's Name*</Text>
                <TextInput 
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                  placeholder="Enter father's name"
                  placeholderTextColor="#94A3B8"
                  value={formData.fathersName}
                  onChangeText={(val) => handleInputChange("fathersName", val)}
                />
              </View>
              <View className="flex-col md:flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Designation</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="e.g. Software Engineer"
                    placeholderTextColor="#94A3B8"
                    value={formData.designation}
                    onChangeText={(val) => handleInputChange("designation", val)}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Department</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="e.g. IT / Operations"
                    placeholderTextColor="#94A3B8"
                    value={formData.department}
                    onChangeText={(val) => handleInputChange("department", val)}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* 2. PERSONAL INFORMATION */}
          <View className="bg-white rounded-[24px] p-5 md:p-6 shadow-sm border border-slate-100">
            <View className="flex-row items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
              <User size={18} color="#5B4FD1" />
              <Text className="text-xs md:text-sm font-black text-[#1F1B3D] uppercase tracking-wider">2. Personal Information</Text>
            </View>

            <View className="gap-4">
              <View className="flex-col md:flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Date of Birth</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    value={formData.dateOfBirth}
                    onChangeText={(val) => handleInputChange("dateOfBirth", val)}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Gender</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="Male / Female / Other"
                    placeholderTextColor="#94A3B8"
                    value={formData.gender}
                    onChangeText={(val) => handleInputChange("gender", val)}
                  />
                </View>
              </View>

              <View className="flex-col md:flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Marital Status</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="Single / Married"
                    placeholderTextColor="#94A3B8"
                    value={formData.maritalStatus}
                    onChangeText={(val) => handleInputChange("maritalStatus", val)}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Blood Group</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="e.g. O+ve"
                    placeholderTextColor="#94A3B8"
                    value={formData.bloodGroup}
                    onChangeText={(val) => handleInputChange("bloodGroup", val)}
                  />
                </View>
              </View>

              <View className="flex-col md:flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Nationality & Religion</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="Nationality / Religion"
                    placeholderTextColor="#94A3B8"
                    value={formData.religion}
                    onChangeText={(val) => handleInputChange("religion", val)}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Family Income</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="Annual Income"
                    placeholderTextColor="#94A3B8"
                    value={formData.familyIncome}
                    onChangeText={(val) => handleInputChange("familyIncome", val)}
                  />
                </View>
              </View>

              <View>
                <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Identification Mark</Text>
                <TextInput 
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                  placeholder="e.g. Mole on right cheek"
                  placeholderTextColor="#94A3B8"
                  value={formData.identificationMark}
                  onChangeText={(val) => handleInputChange("identificationMark", val)}
                />
              </View>

              <View className="flex-col md:flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Aadhaar Number*</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="12-digit Aadhaar"
                    placeholderTextColor="#94A3B8"
                    maxLength={12}
                    keyboardType="numeric"
                    value={formData.aadhaarNumber}
                    onChangeText={(val) => handleInputChange("aadhaarNumber", val)}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">PAN Number*</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="10-digit PAN"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    maxLength={10}
                    value={formData.panNumber}
                    onChangeText={(val) => handleInputChange("panNumber", val)}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* 3. CONTACT DETAILS */}
          <View className="bg-white rounded-[24px] p-5 md:p-6 shadow-sm border border-slate-100">
            <View className="flex-row items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
              <MapPin size={18} color="#5B4FD1" />
              <Text className="text-xs md:text-sm font-black text-[#1F1B3D] uppercase tracking-wider">3. Contact Details</Text>
            </View>

            <View className="gap-4">
              <View className="flex-col md:flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Mobile Number*</Text>
                  <TextInput 
                    className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-sm text-slate-500"
                    value={formData.mobileNumber}
                    editable={false}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Email Address*</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="name@example.com"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    value={formData.emailAddress}
                    onChangeText={(val) => handleInputChange("emailAddress", val)}
                  />
                </View>
              </View>

              <View>
                <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Permanent Address*</Text>
                <TextInput 
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                  placeholder="Enter full permanent address"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={2}
                  value={formData.permanentAddress}
                  onChangeText={(val) => handleInputChange("permanentAddress", val)}
                />
              </View>

              <View>
                <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Current Address*</Text>
                <TextInput 
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                  placeholder="Enter full current address"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={2}
                  value={formData.currentAddress}
                  onChangeText={(val) => handleInputChange("currentAddress", val)}
                />
              </View>
            </View>
          </View>

          {/* 4. FAMILY INFORMATION (Fixed multi-column layout for mobile) */}
          <View className="bg-white rounded-[24px] p-5 md:p-6 shadow-sm border border-slate-100">
            <View className="flex-row items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <View className="flex-row items-center gap-2.5">
                <Users size={18} color="#5B4FD1" />
                <Text className="text-xs md:text-sm font-black text-[#1F1B3D] uppercase tracking-wider">4. Family Information</Text>
              </View>
              <TouchableOpacity onPress={addFamilyRow} className="bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                <Text className="text-xs font-black text-[#5B4FD1]">+ Add Row</Text>
              </TouchableOpacity>
            </View>

            <View className="gap-3">
              {familyMembers.map((member, index) => (
                <View key={index} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 gap-3">
                  <View className="flex-col md:flex-row gap-2.5">
                    <TextInput 
                      className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs text-[#1F1B3D]"
                      placeholder="Name"
                      placeholderTextColor="#94A3B8"
                      value={member.name}
                      onChangeText={(val) => {
                        const updated = [...familyMembers];
                        updated[index].name = val;
                        setFamilyMembers(updated);
                      }}
                    />
                    <TextInput 
                      className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs text-[#1F1B3D]"
                      placeholder="Relationship"
                      placeholderTextColor="#94A3B8"
                      value={member.relationship}
                      onChangeText={(val) => {
                        const updated = [...familyMembers];
                        updated[index].relationship = val;
                        setFamilyMembers(updated);
                      }}
                    />
                  </View>
                  <View className="flex-col md:flex-row gap-2.5">
                    <TextInput 
                      className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs text-[#1F1B3D]"
                      placeholder="Occupation"
                      placeholderTextColor="#94A3B8"
                      value={member.occupation}
                      onChangeText={(val) => {
                        const updated = [...familyMembers];
                        updated[index].occupation = val;
                        setFamilyMembers(updated);
                      }}
                    />
                    <TextInput 
                      className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs text-[#1F1B3D]"
                      placeholder="Contact No"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      value={member.contact}
                      onChangeText={(val) => {
                        const updated = [...familyMembers];
                        updated[index].contact = val;
                        setFamilyMembers(updated);
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* 5. EMERGENCY CONTACT */}
          <View className="bg-white rounded-[24px] p-5 md:p-6 shadow-sm border border-slate-100">
            <View className="flex-row items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
              <Phone size={18} color="#5B4FD1" />
              <Text className="text-xs md:text-sm font-black text-[#1F1B3D] uppercase tracking-wider">5. Emergency Contact</Text>
            </View>

            <View className="gap-4">
              <View className="flex-col md:flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Contact Name*</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="Name"
                    placeholderTextColor="#94A3B8"
                    value={formData.emergencyName}
                    onChangeText={(val) => handleInputChange("emergencyName", val)}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Relationship*</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="Relationship"
                    placeholderTextColor="#94A3B8"
                    value={formData.emergencyRelationship}
                    onChangeText={(val) => handleInputChange("emergencyRelationship", val)}
                  />
                </View>
              </View>

              <View className="flex-col md:flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Phone Num 1*</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="Primary Phone"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={formData.emergencyPhone1}
                    onChangeText={(val) => handleInputChange("emergencyPhone1", val)}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Phone Num 2 (Alt)</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="Alternate Phone"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={formData.emergencyPhone2}
                    onChangeText={(val) => handleInputChange("emergencyPhone2", val)}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* 6. BANK DETAILS */}
          <View className="bg-white rounded-[24px] p-5 md:p-6 shadow-sm border border-slate-100">
            <View className="flex-row items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
              <CreditCard size={18} color="#5B4FD1" />
              <Text className="text-xs md:text-sm font-black text-[#1F1B3D] uppercase tracking-wider">6. Bank Details (For Salary)</Text>
            </View>

            <View className="gap-4">
              <View className="flex-col md:flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Bank Name*</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="Bank Name"
                    placeholderTextColor="#94A3B8"
                    value={formData.bankName}
                    onChangeText={(val) => handleInputChange("bankName", val)}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Account Holder Name*</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="Holder Name"
                    placeholderTextColor="#94A3B8"
                    value={formData.accountHolderName}
                    onChangeText={(val) => handleInputChange("accountHolderName", val)}
                  />
                </View>
              </View>

              <View className="flex-col md:flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Account Number*</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="Account Number"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    value={formData.accountNumber}
                    onChangeText={(val) => handleInputChange("accountNumber", val)}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">IFSC Code*</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="IFSC Code"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    value={formData.ifscCode}
                    onChangeText={(val) => handleInputChange("ifscCode", val)}
                  />
                </View>
              </View>

              <View>
                <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Branch Name*</Text>
                <TextInput 
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                  placeholder="Branch location"
                  placeholderTextColor="#94A3B8"
                  value={formData.branch}
                  onChangeText={(val) => handleInputChange("branch", val)}
                />
              </View>
            </View>
          </View>

          {/* 7. WORK & EXPERIENCE SECTION */}
          <View className="bg-white rounded-[24px] p-5 md:p-6 shadow-sm border border-slate-100">
            <View className="flex-row items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                <Briefcase size={18} color="#5B4FD1" />
                <Text className="text-xs md:text-sm font-black text-[#1F1B3D] uppercase tracking-wider flex-1" numberOfLines={1}>
                  7. Work & Experience
                </Text>
              </View>
              <View className="flex-row items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shrink-0">
                <Text className="text-[11px] font-bold text-slate-600">Prior exp?</Text>
                <Switch 
                  value={hasExperience} 
                  onValueChange={setHasExperience}
                  trackColor={{ false: "#CBD5E1", true: "#5B4FD1" }}
                />
              </View>
            </View>

            {hasExperience && (
              <View className="gap-3">
                {workExperience.map((exp, index) => (
                  <View key={index} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 gap-2.5">
                    <View className="flex-col md:flex-row gap-2.5">
                      <TextInput 
                        className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs text-[#1F1B3D]"
                        placeholder="Company Name"
                        placeholderTextColor="#94A3B8"
                        value={exp.company}
                        onChangeText={(val) => {
                          const updated = [...workExperience];
                          updated[index].company = val;
                          setWorkExperience(updated);
                        }}
                      />
                      <TextInput 
                        className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs text-[#1F1B3D]"
                        placeholder="Location"
                        placeholderTextColor="#94A3B8"
                        value={exp.location}
                        onChangeText={(val) => {
                          const updated = [...workExperience];
                          updated[index].location = val;
                          setWorkExperience(updated);
                        }}
                      />
                    </View>
                    <View className="flex-col md:flex-row gap-2.5">
                      <TextInput 
                        className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs text-[#1F1B3D]"
                        placeholder="Duration (e.g., 2 Years)"
                        placeholderTextColor="#94A3B8"
                        value={exp.duration}
                        onChangeText={(val) => {
                          const updated = [...workExperience];
                          updated[index].duration = val;
                          setWorkExperience(updated);
                        }}
                      />
                      <TextInput 
                        className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs text-[#1F1B3D]"
                        placeholder="Role / Designation"
                        placeholderTextColor="#94A3B8"
                        value={exp.role}
                        onChangeText={(val) => {
                          const updated = [...workExperience];
                          updated[index].role = val;
                          setWorkExperience(updated);
                        }}
                      />
                    </View>
                  </View>
                ))}
                <TouchableOpacity 
                  onPress={() => setWorkExperience([...workExperience, { company: "", location: "", duration: "", role: "", salary: "", reason: "" }])}
                  className="bg-indigo-50 py-3 rounded-xl items-center border border-indigo-100"
                >
                  <Text className="text-xs font-black text-[#5B4FD1]">+ Add Another Experience</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

{/* 8. EDUCATIONAL QUALIFICATION */}
          <View className="bg-white rounded-[24px] p-5 md:p-6 shadow-sm border border-slate-100">
            <View className="flex-row items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
              <GraduationCap size={18} color="#5B4FD1" />
              <Text className="text-xs md:text-sm font-black text-[#1F1B3D] uppercase tracking-wider">8. Educational Qualification</Text>
            </View>

            <View className="gap-3">
              {[
                { key: "sslc", label: "SSLC (10th)" },
                { key: "hsc", label: "HSC (12th / Diploma)" },
                { key: "ug", label: "Under Graduate (UG)" },
                { key: "pg", label: "Post Graduate (PG)" },
              ].map((item) => (
                <View key={item.key} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 gap-2.5">
                  <Text className="text-xs font-black text-[#5B4FD1] uppercase">{item.label}</Text>
                  
                  {/* Institution Name Full Width */}
                  <TextInput 
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-[#1F1B3D]"
                    placeholder="Institution Name"
                    placeholderTextColor="#94A3B8"
                    value={(education as any)[item.key].institution}
                    onChangeText={(val) => setEducation({
                      ...education,
                      [item.key]: { ...(education as any)[item.key], institution: val }
                    })}
                  />

                  {/* Strictly Controlled Row using 48% width to prevent boundary bleeding */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
                    <TextInput 
                      style={{ width: "48%" }}
                      className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-[#1F1B3D]"
                      placeholder="Year of Passing"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={(education as any)[item.key].year}
                      onChangeText={(val) => setEducation({
                        ...education,
                        [item.key]: { ...(education as any)[item.key], year: val }
                      })}
                    />
                    <TextInput 
                      style={{ width: "48%" }}
                      className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-[#1F1B3D]"
                      placeholder="Percentage %"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={(education as any)[item.key].percentage}
                      onChangeText={(val) => setEducation({
                        ...education,
                        [item.key]: { ...(education as any)[item.key], percentage: val }
                      })}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* 9. DOCUMENTS SUBMITTED (Fixed button clipping & text wrapping) */}
          <View className="bg-white rounded-[24px] p-5 md:p-6 shadow-sm border border-slate-100">
            <View className="flex-row items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
              <Upload size={18} color="#5B4FD1" />
              <Text className="text-xs md:text-sm font-black text-[#1F1B3D] uppercase tracking-wider">9. Documents Submitted (Upload)</Text>
            </View>

            <View className="gap-3">
              {[
                { key: "aadhaarFile", label: "Aadhaar Card Copy" },
                { key: "panFile", label: "PAN Card Copy" },
                { key: "bankPassbookFile", label: "Bank Passbook / Cancelled Cheque" },
                { key: "resumeFile", label: "Resume & Certificates" },
              ].map((doc) => (
                <View key={doc.key} className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-3.5 gap-3">
                  <View className="flex-row items-center gap-2.5 flex-1 pr-1">
                    <FileText size={18} color="#5B4FD1" />
                    <Text className="text-xs font-bold text-[#1F1B3D] flex-1" numberOfLines={2}>{doc.label}</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => handleFileUpload(doc.key)}
                    className={`px-3.5 py-2 rounded-xl border shrink-0 ${(files as any)[doc.key] ? "bg-emerald-50 border-emerald-200" : "bg-[#EEECFA] border-[#5B4FD1]/30"}`}
                  >
                    <Text className={`text-[10px] font-black ${(files as any)[doc.key] ? "text-emerald-700" : "text-[#5B4FD1]"}`}>
                      {(files as any)[doc.key] ? "ATTACHED ✓" : "BROWSE"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          {/* 10. REFERENCE DETAILS (OPTIONAL) */}
          <View className="bg-white rounded-[24px] p-5 md:p-6 shadow-sm border border-slate-100">
            <View className="flex-row items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
              <User size={18} color="#5B4FD1" />
              <Text className="text-xs md:text-sm font-black text-[#1F1B3D] uppercase tracking-wider">10. Reference Details (Optional)</Text>
            </View>

            <View className="gap-4">
              <View className="flex-col md:flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Referred Person Name</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="Name"
                    placeholderTextColor="#94A3B8"
                    value={formData.referenceName}
                    onChangeText={(val) => handleInputChange("referenceName", val)}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Contact No</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                    placeholder="Phone No"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={formData.referenceContact}
                    onChangeText={(val) => handleInputChange("referenceContact", val)}
                  />
                </View>
              </View>
              <View>
                <Text className="text-[11px] font-bold text-[#7A76A6] uppercase mb-1">Department</Text>
                <TextInput 
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#1F1B3D]"
                  placeholder="Department"
                  placeholderTextColor="#94A3B8"
                  value={formData.referenceDepartment}
                  onChangeText={(val) => handleInputChange("referenceDepartment", val)}
                />
              </View>
            </View>
          </View>

          {/* 11. EMPLOYEE DECLARATION & SUBMISSION CHECKBOX */}
          <View className="bg-white rounded-[24px] p-5 md:p-6 shadow-sm border border-slate-100 gap-4">
            <View className="flex-row items-center gap-2.5 border-b border-slate-100 pb-3">
              <FileText size={18} color="#5B4FD1" />
              <Text className="text-xs md:text-sm font-black text-[#1F1B3D] uppercase tracking-wider">11. Employee Declaration</Text>
            </View>

            <Text className="text-xs text-slate-600 leading-relaxed">
              I hereby declare that the information provided by me is true and accurate to the best of my knowledge. Any false information may lead to termination of employment without notice.
            </Text>

            <TouchableOpacity 
              onPress={() => setDeclarationAccepted(!declarationAccepted)}
              className="flex-row items-center gap-3 bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100"
            >
              {declarationAccepted ? (
                <CheckSquare size={20} color="#5B4FD1" />
              ) : (
                <Square size={20} color="#94A3B8" />
              )}
              <Text className="text-xs font-bold text-[#1F1B3D] flex-1 leading-snug">
                I have checked all my details carefully and confirm they are correct.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleSubmitForm}
              activeOpacity={0.85}
              className={`rounded-2xl py-4 items-center shadow-lg mt-2 ${declarationAccepted ? "bg-[#5B4FD1] shadow-indigo-900/30" : "bg-slate-300 shadow-none"}`}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-xs md:text-sm font-black text-white uppercase tracking-widest">
                  Submit For Verification
                </Text>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}