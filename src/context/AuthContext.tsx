import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Replace with your Spring Boot server base URL
const BASE_API_URL = "http://192.168.31.133:8080/api";

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface BankDetails {
  accountHolderName?: string;
  accountNumber?: string;
  bankName?: string;
  ifscOrRoutingCode?: string;
  branchName?: string;
}

export interface UserDetails {
  userId: string | number;
  empId: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  role?: string;
  isAdmin: boolean;
  token?: string;
  permanentAddress?: Address;
  currentAddress?: Address;
  bankDetails?: BankDetails;
  [key: string]: any; // Allows dynamic backend properties
}

interface AuthContextType {
  user: UserDetails | null;
  loading: boolean;
  fetchUserByEmpId: (empId: string) => Promise<UserDetails | null>;
  saveUserSession: (userPayload: UserDetails) => Promise<void>; // Added function type
  logout: () => Promise<void>;
  buildUserParams: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore stored session on app start
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("@current_user_details");
        if (stored) {
          setUser(JSON.parse(stored));
        }
      } catch (e) {
        console.error("Error restoring session:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Centralized function: Directly save user payload upon successful login
  const saveUserSession = async (userPayload: UserDetails) => {
    setUser(userPayload);
    await AsyncStorage.setItem("@current_user_details", JSON.stringify(userPayload));
  };

  // Centralized function: Takes EMP.ID, hits Spring Boot API, stores response
  const fetchUserByEmpId = async (empId: string): Promise<UserDetails | null> => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_API_URL}/user/details?empId=${encodeURIComponent(empId)}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok && data) {
        const userPayload: UserDetails = data.user || data; 
        await saveUserSession(userPayload);
        return userPayload;
      } else {
        throw new Error(data.message || "Failed to fetch user details");
      }
    } catch (error) {
      console.error("Fetch user error:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem("@current_user_details");
  };

  // Helper utility to inject user fields as query params anywhere
  const buildUserParams = (): Record<string, string> => {
    if (!user) return {};
    return {
      empId: String(user.empId ?? ""),
      userId: String(user.userId ?? ""),
      email: String(user.email ?? ""),
      name: String(user.name ?? ""),
    };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        fetchUserByEmpId,
        saveUserSession, // Provided to the rest of the app
        logout,
        buildUserParams,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}