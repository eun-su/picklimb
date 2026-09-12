import { initializeApp } from 'firebase/app'
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
const enabled = Boolean(config.apiKey && config.projectId && config.appId)
const demoEnabled = import.meta.env.DEV && !enabled
let db
let auth

const demoMembers = [
  { id: 'admin-kim', name: '김은수', role: 'admin' }, { id: 'staff-lee', name: '이하은', role: 'staff' }, { id: 'member-kang', name: '강바른', role: 'member' },
]
const memory = {
  records: [{ id: 'member-kang_2026-09-11', memberId: 'member-kang', memberName: '강바른', date: '2026-09-11' }, { id: 'staff-lee_2026-09-11', memberId: 'staff-lee', memberName: '이하은', date: '2026-09-11' }],
  notice: { title: '피리부는 클라이머 이용가이드', content: '출석 체크는 실제 운동 후, 서로의 신뢰를 바탕으로 남겨 주세요.' },
}

function firebase() {
  if (!enabled) return null
  if (!db) { const app = initializeApp(config); db = getFirestore(app); auth = getAuth(app) }
  return { db, auth }
}
export const canOperate = (member) => ['admin', 'staff'].includes(member.role)
export const isAdmin = (member) => member.role === 'admin'

export async function verifyMemberAccess(name, code) {
  if (!name.trim() || !code.trim()) throw new Error('성함과 참여코드를 모두 입력해 주세요.')
  const service = firebase()
  if (!service) {
    if (!demoEnabled) throw new Error('서비스 설정이 완료되지 않았어요. 운영진에게 문의해 주세요.')
    const found = demoMembers.find((member) => member.name === name.trim())
    if (!found || code !== 'PICKLIMB') throw new Error('등록된 멤버 정보와 일치하지 않습니다.')
    return found
  }
  const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, code }) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || '입장 확인에 실패했어요.')
  await signInWithCustomToken(service.auth, result.token)
  return result.member
}

export async function logout() { const service = firebase(); if (service) await signOut(service.auth) }

export async function getDashboard(member) {
  const service = firebase()
  if (!service) {
    if (!demoEnabled) throw new Error('서비스 설정이 완료되지 않았어요.')
    return structuredClone({ members: demoMembers, records: memory.records, notice: memory.notice })
  }
  const tasks = [getDocs(collection(service.db, 'attendance')), getDoc(doc(service.db, 'notices', 'guide'))]
  if (canOperate(member)) tasks.push(getDocs(collection(service.db, 'members')))
  const [recordsSnapshot, noticeSnapshot, membersSnapshot] = await Promise.all(tasks)
  return {
    records: recordsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
    members: membersSnapshot ? membersSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })) : [],
    notice: noticeSnapshot.exists() ? noticeSnapshot.data() : { title: '피리부는 클라이머 이용가이드', content: '출석 체크는 실제 운동 후, 서로의 신뢰를 바탕으로 남겨 주세요.' },
  }
}

export async function checkIn(member, date) {
  const service = firebase(); const id = `${member.id}_${date}`
  if (!service) {
    if (!demoEnabled) throw new Error('서비스 설정이 완료되지 않았어요.')
    if (!memory.records.some((item) => item.id === id)) memory.records.push({ id, memberId: member.id, memberName: member.name, date }); return
  }
  await setDoc(doc(service.db, 'attendance', id), { memberId: member.id, memberName: member.name, date, updatedAt: serverTimestamp() })
}

export async function removeCheckIn(member, date) {
  const service = firebase(); const id = `${member.id}_${date}`
  if (!service) {
    if (!demoEnabled) throw new Error('서비스 설정이 완료되지 않았어요.')
    memory.records = memory.records.filter((item) => item.id !== id); return
  }
  await deleteDoc(doc(service.db, 'attendance', id))
}

export async function saveNotice(notice) {
  const service = firebase()
  if (!service) {
    if (!demoEnabled) throw new Error('서비스 설정이 완료되지 않았어요.')
    memory.notice = notice; return
  }
  await setDoc(doc(service.db, 'notices', 'guide'), { ...notice, updatedAt: serverTimestamp() })
}
