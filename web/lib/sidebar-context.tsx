'use client'

import { createContext, useContext } from 'react'

export const SidebarContext = createContext<() => void>(() => {})
export const useSidebar = () => useContext(SidebarContext)
