/**
 * Формат хранения в БД и поиска при логине: +7 и 10 цифр абонента (KZ/RU).
 */
export function normalizeKzPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const ten = digits.length >= 10 ? digits.slice(-10) : digits;
  return ten ? `+7${ten}` : phone.trim();
}

export function isKzPhoneE164(phone: string): boolean {
  return /^\+7\d{10}$/.test(phone);
}
