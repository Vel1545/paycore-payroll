import { Platform } from "react-native";

const LOCAL_IP = process.env.EXPO_PUBLIC_LOCAL_IP || "scholarships-exterior-transcript-tractor.trycloudflare.com";
const BACKEND_PORT = process.env.EXPO_PUBLIC_API_PORT || "8080";

//const BASE_HOST = Platform.OS === "web" ? "localhost" : LOCAL_IP;
//Production
export const BASE_HOST = "https://payroll.brainmarq.com";
//Mobile
// export const BASE_HOST = "http://10.211.186.167:8080";
//Local IP Adress
// export const BASE_HOST = "http://192.168.31.228:8080";
//Development Testing
// export const BASE_HOST = "https://test.brainmarq.com";
// export const WORKFLOW_API_URL = `${API_BASE_URL}/admin/workflow`;