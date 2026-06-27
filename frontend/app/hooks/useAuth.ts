'use client';

import { useUser } from '@/app/context/UserContext';

export function useAuth() {
  return useUser();
}
