import api from '@/lib/api';

export const profileService = {
  getMe: () => api.get('/profile/me').then((r) => r.data),
  updateMe: (data: { name?: string; nickname?: string; birthDate?: string }) =>
    api.patch('/profile/me', data).then((r) => r.data),
};
