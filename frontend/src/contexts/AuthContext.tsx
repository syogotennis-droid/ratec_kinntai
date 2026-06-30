import React, { createContext, useContext, useState, useEffect } from 'react'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'
import { firestoreGetUserByUid } from '../firebase/firestore'
import { User } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (employee_id: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken()
          setToken(idToken)
          const userData = await firestoreGetUserByUid(firebaseUser.uid)
          if (userData) {
            setUser(userData as unknown as User)
          } else {
            setUser(null)
          }
        } catch {
          setUser(null)
          setToken(null)
        }
      } else {
        setUser(null)
        setToken(null)
      }
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  const login = async (employee_id: string, password: string) => {
    const email = `${employee_id}@ratec.local`
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const idToken = await cred.user.getIdToken()
    setToken(idToken)
    const userData = await firestoreGetUserByUid(cred.user.uid)
    if (userData) {
      setUser(userData as unknown as User)
    }
  }

  const logout = async () => {
    await signOut(auth)
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
