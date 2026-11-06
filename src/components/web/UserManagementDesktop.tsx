// Add / Edit Users page for the laptop/PC website. All data and saving stay in AdminHubScreen.
import React from "react";
import { Modal, Pressable, ScrollView, Switch, View, ActivityIndicator } from "react-native";
import { ChevronRight, Pencil, Search, UserPlus, Users, Wallet, X } from "lucide-react-native";
import UserConfigPanel from "../Userconfigpanel";
import { Avatar, Badge, Btn, Card, Detail, IconBtn, Input, Tabs, Txt, WebPageHeader, thinScrollbar, twoColumn, ui } from "./webUi";

const c = ui.color;
const ROLES = ["EMPLOYEE", "MANAGER", "ADMIN"];

// "SUPER_ADMIN" -> "Super admin"
const roleLabel = (r?: string) => {
  const s = String(r || "").replace(/_/g, " ").toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "No role";
};

interface Props {
  users: any[];
  allUsersCount: number;
  loading: boolean;
  search: string;
  onSearch: (q: string) => void;
  selected: any;
  onSelect: (empId: string) => void;
  subTab: "personal" | "work";
  onSubTab: (t: "personal" | "work") => void;
  canManageWork: boolean;
  adminEmpId: string;
  onBack: () => void;
  onAdd: () => void;
  onEdit: (user: any) => void;
  onOpenFullDetails: () => void;
  form: {
    visible: boolean;
    editing: boolean;
    saving: boolean;
    empId: string;
    fullName: string;
    email: string;
    mobile: string;
    role: string;
    active: boolean;
    setEmpId: (v: string) => void;
    setFullName: (v: string) => void;
    setEmail: (v: string) => void;
    setMobile: (v: string) => void;
    setRole: (v: any) => void;
    setActive: (v: boolean) => void;
    close: () => void;
    save: () => void;
  };
}

export default function UserManagementDesktop(p: Props) {
  const u = p.selected;

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <WebPageHeader title="Users" breadcrumb="Team Hub / Users" onBack={p.onBack}>
        <Btn label="Add employee" onPress={p.onAdd} icon={<UserPlus size={16} color="#FFFFFF" />} />
      </WebPageHeader>

      <View style={{ flex: 1, minHeight: 0, flexDirection: "row" }}>
        {/* Employee list: scrolls on its own */}
        <View style={{ width: 340, backgroundColor: c.surface, borderRightWidth: 1, borderRightColor: c.border }}>
          <View style={{ padding: 16, paddingBottom: 12, gap: 10 }}>
            <Input
              value={p.search}
              onChangeText={p.onSearch}
              placeholder="Search by name, ID or role"
              accessibilityLabel="Search employees"
              leading={<Search size={16} color={c.muted} />}
              trailing={
                p.search ? (
                  <IconBtn label="Clear search" onPress={() => p.onSearch("")}>
                    <X size={14} color={c.muted} />
                  </IconBtn>
                ) : null
              }
            />
            <Txt variant="caption">
              {p.search ? `${p.users.length} of ${p.allUsersCount} employees` : `${p.allUsersCount} employees`}
            </Txt>
          </View>

          {p.loading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 16 }}>
              <ActivityIndicator size="small" color={c.primary} />
              <Txt variant="label">Loading employees</Txt>
            </View>
          ) : p.users.length === 0 ? (
            <Txt variant="label" style={{ padding: 16 }}>No employees found.</Txt>
          ) : (
            <ScrollView style={[{ flex: 1 }, thinScrollbar]} contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 16 }}>
              {p.users.map((item) => {
                const on = u?.empId === item.empId;
                return (
                  <Pressable
                    key={item.empId}
                    onPress={() => p.onSelect(item.empId)}
                    accessibilityRole="button"
                    accessibilityLabel={item.fullName}
                    accessibilityState={{ selected: on }}
                    style={(s: any) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                      marginBottom: 2,
                      borderRadius: ui.radius.control,
                      backgroundColor: on ? c.primarySoft : s.hovered ? c.hover : "transparent",
                    })}
                  >
                    <Avatar name={item.fullName} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt variant="strong" numberOfLines={1} style={on ? { color: c.primary } : undefined}>
                        {item.fullName}
                      </Txt>
                      <Txt variant="caption" numberOfLines={1}>
                        {item.empId} · {roleLabel(item.role)}
                      </Txt>
                    </View>
                    {item.active === false ? <Badge label="Inactive" tone="danger" /> : null}
                    <ChevronRight size={16} color={on ? c.primary : c.placeholder} />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Selected employee */}
        <ScrollView style={[{ flex: 1 }, thinScrollbar]} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          {!u ? (
            <Card style={{ padding: 48, alignItems: "center", gap: 8 }}>
              <Users size={28} color={c.placeholder} />
              <Txt variant="section">No employee selected</Txt>
              <Txt variant="label">Choose an employee from the list, or add a new one.</Txt>
            </Card>
          ) : (
            <View style={{ width: "100%", maxWidth: 1080, alignSelf: "center", gap: 20 }}>
              <Card style={{ padding: 20, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 1 }}>
                  <Avatar name={u.fullName} size={56} />
                  <View style={{ flexShrink: 1, gap: 6 }}>
                    <Txt variant="heading" numberOfLines={1}>{u.fullName}</Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Txt variant="label">{u.empId}</Txt>
                      <Badge label={roleLabel(u.role)} tone="primary" />
                      <Badge label={u.active ? "Active" : "Inactive"} tone={u.active ? "success" : "danger"} />
                    </View>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Btn
                    label="Salary, bank & full details"
                    variant="secondary"
                    onPress={p.onOpenFullDetails}
                    icon={<Wallet size={16} color={c.ink} />}
                  />
                  <Btn label="Edit details" onPress={() => p.onEdit(u)} icon={<Pencil size={15} color="#FFFFFF" />} />
                </View>
              </Card>

              {p.canManageWork ? (
                <Tabs
                  items={[
                    { key: "personal", label: "Personal" },
                    { key: "work", label: "Work settings" },
                  ]}
                  active={p.subTab}
                  onChange={(k) => p.onSubTab(k as any)}
                />
              ) : null}

              {p.subTab === "personal" || !p.canManageWork ? (
                <Card style={{ padding: 24 }}>
                  <Txt variant="section" style={{ marginBottom: 20 }}>Personal and official details</Txt>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 24, rowGap: 20 }}>
                    <Detail style={twoColumn} label="Full name" value={u.fullName} />
                    <Detail style={twoColumn} label="Employee ID" value={u.empId} />
                    <Detail style={twoColumn} label="Official email" value={u.email} />
                    <Detail style={twoColumn} label="Mobile number" value={u.mobileNumber} />
                    <Detail style={twoColumn} label="Role" value={roleLabel(u.role)} />
                    <Detail style={twoColumn} label="Account status" value={u.active ? "Active" : "Inactive"} />
                  </View>
                </Card>
              ) : (
                <UserConfigPanel empId={u.empId} adminEmpId={p.adminEmpId} isDesktop webDesign />
              )}
            </View>
          )}
        </ScrollView>
      </View>

      <EmployeeFormDialog form={p.form} />
    </View>
  );
}

function EmployeeFormDialog({ form: f }: { form: Props["form"] }) {
  return (
    <Modal visible={f.visible} transparent animationType="fade" onRequestClose={f.close}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Pressable
          accessibilityLabel="Close dialog"
          onPress={f.close}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(31,27,61,0.45)" }}
        />
        <View
          accessibilityRole={"dialog" as any}
          style={{
            width: "100%",
            maxWidth: 620,
            maxHeight: "90%",
            backgroundColor: c.surface,
            borderRadius: ui.radius.card,
            ...({ boxShadow: "0 20px 50px rgba(31,27,61,0.25)" } as any),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <View>
              <Txt variant="heading">{f.editing ? "Edit employee" : "Add employee"}</Txt>
              <Txt variant="label" style={{ fontWeight: "400", marginTop: 2 }}>
                {f.editing ? "Update this employee's official details." : "Create an account for a new employee."}
              </Txt>
            </View>
            <IconBtn label="Close" onPress={f.close}>
              <X size={18} color={c.muted} />
            </IconBtn>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, flexDirection: "row", flexWrap: "wrap", columnGap: 24, rowGap: 16 }}>
            <Input
              style={twoColumn}
              label="Employee ID"
              value={f.empId}
              onChangeText={f.setEmpId}
              editable={!f.editing}
              placeholder="e.g. EMP-1050"
              autoCapitalize="characters"
            />
            <Input style={twoColumn} label="Full name" value={f.fullName} onChangeText={f.setFullName} placeholder="e.g. Alex Sterling" />
            <Input
              style={twoColumn}
              label="Official email"
              value={f.email}
              onChangeText={f.setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="alex@paycore.io"
            />
            <Input
              style={twoColumn}
              label="Mobile number"
              value={f.mobile}
              onChangeText={f.setMobile}
              keyboardType="phone-pad"
              placeholder="+91 9876543210"
            />

            <View style={{ width: "100%" }}>
              <Txt variant="label" style={{ marginBottom: 6 }}>System role</Txt>
              <View style={{ flexDirection: "row", alignSelf: "flex-start", borderWidth: 1, borderColor: c.borderStrong, borderRadius: ui.radius.control, overflow: "hidden" }}>
                {ROLES.map((r, i) => {
                  const on = f.role === r;
                  return (
                    <Pressable
                      key={r}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => f.setRole(r)}
                      style={(s: any) => ({
                        paddingHorizontal: 18,
                        height: 38,
                        justifyContent: "center",
                        borderLeftWidth: i === 0 ? 0 : 1,
                        borderLeftColor: c.borderStrong,
                        backgroundColor: on ? c.primarySoft : s.hovered ? c.hover : c.surface,
                      })}
                    >
                      <Txt variant="strong" style={on ? { color: c.primary } : undefined}>{roleLabel(r)}</Txt>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {f.editing ? (
              <View style={{ width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View>
                  <Txt variant="strong">Account active</Txt>
                  <Txt variant="caption">Allow this employee to log in</Txt>
                </View>
                <Switch
                  value={f.active}
                  onValueChange={f.setActive}
                  accessibilityLabel="Account active"
                  trackColor={{ false: c.borderStrong, true: c.primary }}
                  thumbColor="#FFFFFF"
                  {...({ activeThumbColor: "#FFFFFF" } as any)}
                />
              </View>
            ) : null}
          </ScrollView>

          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 16, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: c.border }}>
            <Btn label="Cancel" variant="secondary" onPress={f.close} />
            <Btn label={f.saving ? "Saving" : f.editing ? "Save changes" : "Create employee"} onPress={f.save} busy={f.saving} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
