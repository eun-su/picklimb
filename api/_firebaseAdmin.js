/* global process */
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('서버 인증 설정이 없습니다.')
  return JSON.parse(raw)
}

export function adminServices() {
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount()) })
  return { auth: getAuth(app), db: getFirestore(app) }
}
