import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyCq5KasyG-KPS4imTlQ0AIdptn0ptmw_Ko',
  authDomain: 'ratec-kinntai.firebaseapp.com',
  projectId: 'ratec-kinntai',
  storageBucket: 'ratec-kinntai.firebasestorage.app',
  messagingSenderId: '175997526975',
  appId: '1:175997526975:web:a7660d97a1e7d1dfe3b70a',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
