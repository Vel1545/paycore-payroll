import AsyncStorage from "@react-native-async-storage/async-storage";

export interface UserData {
  empId: string;
  name: string;
  email: string;
  role: string;
}

// In-memory constant reference
class SessionManager {
  private _empId: string = "";
  private _name: string = "";
  private _email: string = "";
  private _role: string = "";

  // Direct getters — access them like regular constants: UserSession.empId
  get empId(): string {
    return this._empId;
  }

  get name(): string {
    return this._name;
  }

  get email(): string {
    return this._email;
  }

  get role(): string {
    return this._role;
  }

  // Call once at login
  setUser(data: UserData) {
    this._empId = data.empId;
    this._name = data.name;
    this._email = data.email;
    this._role = data.role;
    AsyncStorage.setItem("@session_user", JSON.stringify(data));
  }

  // Call once on app startup (e.g. in App.tsx / splash screen)
  async init(): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem("@session_user");
      if (stored) {
        const data: UserData = JSON.parse(stored);
        this._empId = data.empId;
        this._name = data.name;
        this._email = data.email;
        this._role = data.role;
        return true;
      }
    } catch (e) {
      console.error("Session load error", e);
    }
    return false;
  }

  // Call on logout
  clear() {
    this._empId = "";
    this._name = "";
    this._email = "";
    this._role = "";
    AsyncStorage.removeItem("@session_user");
  }
}

export const UserSession = new SessionManager();