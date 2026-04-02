'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Login is now handled on the /welcome page (unified phone entry flow)
export default function LoginPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/welcome'); }, [router]);
  return null;
}
