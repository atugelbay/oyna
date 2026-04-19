import api from "@/lib/api";

export const settingsService = {
  // Price packages
  async getPricePackages(venueId?: string) {
    const { data } = await api.get("/settings/price-packages", {
      params: { venueId },
    });
    return data;
  },

  async createPricePackage(payload: {
    venueId: string;
    name: string;
    minutes: number;
    costTenge: number;
  }) {
    const { data } = await api.post("/settings/price-packages", payload);
    return data;
  },

  async updatePricePackage(
    id: string,
    payload: { name?: string; minutes?: number; costTenge?: number },
  ) {
    const { data } = await api.patch(`/settings/price-packages/${id}`, payload);
    return data;
  },

  async deletePricePackage(id: string) {
    const { data } = await api.delete(`/settings/price-packages/${id}`);
    return data;
  },

  // Loyalty levels
  async getLoyaltyLevels() {
    const { data } = await api.get("/settings/loyalty-levels");
    return data;
  },

  async createLoyaltyLevel(payload: {
    name: string;
    minPoints: number;
    bonusMinutes: number;
    colorGradient: string;
    colorBg: string;
  }) {
    const { data } = await api.post("/settings/loyalty-levels", payload);
    return data;
  },

  async updateLoyaltyLevel(
    id: string,
    payload: {
      name?: string;
      minPoints?: number;
      bonusMinutes?: number;
      colorGradient?: string;
      colorBg?: string;
    },
  ) {
    const { data } = await api.patch(
      `/settings/loyalty-levels/${id}`,
      payload,
    );
    return data;
  },

  async deleteLoyaltyLevel(id: string) {
    const { data } = await api.delete(`/settings/loyalty-levels/${id}`);
    return data;
  },

  // Roles & permissions
  async getRoles() {
    const { data } = await api.get("/settings/roles");
    return data;
  },

  async updateRolePermissions(
    role: string,
    permissions: { permissionKey: string; enabled: boolean }[],
  ) {
    const { data } = await api.patch(`/settings/roles/${role}`, {
      permissions,
    });
    return data;
  },

  async regenerateAccessCode(role: string, venueId: string) {
    const { data } = await api.post(
      `/settings/roles/${role}/regenerate-code`,
      { venueId },
    );
    return data;
  },

  async updateRoleLabel(role: string, label: string) {
    const { data } = await api.patch(`/settings/roles/${role}/label`, {
      label,
    });
    return data;
  },

  async clearRoleLabel(role: string) {
    const { data } = await api.delete(`/settings/roles/${role}/label`);
    return data;
  },

  async createCrmRole(label: string) {
    const { data } = await api.post("/settings/roles", { label });
    return data as { createdRole: string; roles: unknown[] };
  },

  async deleteCrmRole(role: string) {
    const { data } = await api.delete(`/settings/roles/${encodeURIComponent(role)}`);
    return data;
  },

  // Employees
  async getEmployees(venueId?: string) {
    const { data } = await api.get("/settings/employees", {
      params: { venueId },
    });
    return data;
  },

  async createEmployee(payload: {
    phone: string;
    name: string;
    role: string;
    venueId: string;
  }) {
    const { data } = await api.post("/settings/employees", payload);
    return data;
  },

  async updateEmployee(
    id: string,
    payload: { name?: string; role?: string },
  ) {
    const { data } = await api.patch(`/settings/employees/${id}`, payload);
    return data;
  },

  async deleteEmployee(id: string) {
    const { data } = await api.delete(`/settings/employees/${id}`);
    return data;
  },
};
