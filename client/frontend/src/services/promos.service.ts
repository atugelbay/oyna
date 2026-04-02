import api from '@/lib/api';

export const promosService = {
  getActivePromos: (venueId?: string) =>
    api.get('/promos', { params: venueId ? { venueId } : {} }).then((r) => r.data),
  getPromoById: (id: string) =>
    api.get(`/promos/${id}`).then((r) => r.data),
};
