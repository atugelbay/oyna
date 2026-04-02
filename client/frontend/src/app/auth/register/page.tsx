'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Registration flow: welcome → verify OTP → /auth/profile
export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/welcome'); }, [router]);
  return null;
}
