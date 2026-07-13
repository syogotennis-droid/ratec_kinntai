'use client'

import { createContext, useContext } from 'react'
import { Profile } from '@/lib/supabase/types'

export const ProfileContext = createContext<Profile | null>(null)

export function useProfile(): Profile {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within AppShell')
  return ctx
}
