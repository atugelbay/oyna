'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

/**
 * This page handles invite links: /tournaments/[id]/join/[teamId]
 * It redirects to the participate page with the teamId pre-filled.
 */
export default function JoinRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id as string;
  const teamId = params.teamId as string;

  useEffect(() => {
    router.replace(`/tournaments/${tournamentId}/participate?teamId=${teamId}`);
  }, [tournamentId, teamId]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
