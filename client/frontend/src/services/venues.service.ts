import api from '@/lib/api';

export const venuesService = {
  getVenues: () => api.get('/venues').then((r) => r.data),
};
