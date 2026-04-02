export interface Promo {
  id: string;
  title: string;
  headline: string | null;
  description: string | null;
  type: string;
  reward: string | null;
  dateStart: string;
  dateEnd: string | null;
  venue: { id: string; name: string; city: string } | null;
}
