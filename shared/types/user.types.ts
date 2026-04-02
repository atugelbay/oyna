export type Role = 'USER' | 'OPERATOR' | 'MANAGER' | 'ADMIN';
export type LoyaltyStatus = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface UserProfile {
  id: string;
  phone: string;
  nickname: string;
  name: string;
  birthDate: string | null;
  role: Role;
  loyaltyStatus: LoyaltyStatus;
  totalScore: number;
  balanceSeconds: number;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: Omit<UserProfile, 'birthDate' | 'createdAt'>;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterRequest {
  phone: string;
  name: string;
  nickname: string;
  birthDate?: string;
}

export interface LoginRequest {
  phone: string;
  code: string;
}

export interface RequestOtpRequest {
  phone: string;
}
