import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { addDoc, collection, doc, getDocs, getFirestore, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)
let db
let auth

const demoEvents = [
  { id: 'event-seoul-run', title: '한강 러닝', startsAt: '2026-09-14T10:00:00+09:00', place: '잠실 한강공원' },
  { id: 'event-climb', title: '클라이밍 데이', startsAt: '2026-09-20T14:00:00+09:00', place: '더클라임 신림점' },
  { id: 'event-hike', title: '북한산 하이킹', startsAt: '2026-09-27T09:00:00+09:00', place: '불광역 2번 출구' },
]
const demoMembers = [
  { id: 'demo-1', name: '김피클', attendanceCount: 8, lastAttendanceAt: '2026-09-07T10:00:00+09:00' },
  { id: 'demo-2', name: '이운동', attendanceCount: 6, lastAttendanceAt: '2026-08-30T10:00:00+09:00' },
  { id: 'demo-3', name: '박클라임', attendanceCount: 5, lastAttendanceAt: '2026-08-23T10:00:00+09:00' },
  { id: 'demo-4', name: '최러너', attendanceCount: 3, lastAttendanceAt: '2026-08-16T10:00:00+09:00' },
]
const demoAttendance = [
  { id: 'a-1', eventId: 'event-seoul-run', memberId: 'demo-1', memberName: '김피클', checkedAt: '2026-09-14T10:03:00+09:00' },
  { id: 'a-2', eventId: 'event-seoul-run', memberId: 'demo-2', memberName: '이운동', checkedAt: '2026-09-14T10:05:00+09:00' },
]
const memory = { events: [...demoEvents], members: [...demoMembers], attendance: [...demoAttendance] }

async function firebase() {
  if (!firebaseReady) return null
  if (!db) {
    const app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    auth = getAuth(app)
    if (!auth.currentUser) await signInAnonymously(auth)
  }
  return db
}

const safeId = (name) => `member-${name.trim().toLowerCase().replace(/[^a-z0-9가-힣]/g, '-')}`

export async function verifyMemberAccess(name, code) {
  const trimmedName = name.trim()
  if (!trimmedName || !code.trim()) throw new Error('성함과 참여코드를 모두 입력해 주세요.')
  // VITE_ACCESS_CODE is a convenience gate only. Firestore rules enforce real data access.
  const expectedCode = import.meta.env.VITE_ACCESS_CODE || 'PICKLIMB'
  const adminCode = import.meta.env.VITE_ADMIN_CODE || 'PICKLIMB_ADMIN'
  const isAdmin = code.trim() === adminCode
  if (code.trim() !== expectedCode && !isAdmin) throw new Error('참여코드가 맞지 않아요. 다시 확인해 주세요.')
  const member = { id: safeId(trimmedName), name: trimmedName, isAdmin }
  const database = await firebase()
  if (database) {
    const existing = await getDocs(collection(database, 'members'))
    const found = existing.docs.find((item) => item.id === member.id)
    await setDoc(doc(database, 'members', member.id), { ...found?.data(), ...member, updatedAt: new Date().toISOString() }, { merge: true })
  } else if (!memory.members.some((item) => item.id === member.id)) {
    memory.members.push({ ...member, attendanceCount: 0, lastAttendanceAt: null })
  }
  return member
}

export async function getDashboard() {
  const database = await firebase()
  if (!database) return structuredClone({
    events: [...memory.events].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)),
    members: [...memory.members].sort((a, b) => new Date(b.lastAttendanceAt || 0) - new Date(a.lastAttendanceAt || 0)),
    attendance: memory.attendance,
  })
  const [events, members, attendance] = await Promise.all(['events', 'members', 'attendance'].map(async (name) => {
    const snapshot = await getDocs(collection(database, name))
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
  }))
  return {
    events: events.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)),
    members: members.sort((a, b) => new Date(b.lastAttendanceAt || 0) - new Date(a.lastAttendanceAt || 0)),
    attendance,
  }
}

export async function markAttendance({ event, member }) {
  const database = await firebase()
  const checkedAt = new Date().toISOString()
  if (!database) {
    if (memory.attendance.some((item) => item.eventId === event.id && item.memberId === member.id)) return
    memory.attendance.push({ id: `${event.id}-${member.id}`, eventId: event.id, memberId: member.id, memberName: member.name, checkedAt })
    const index = memory.members.findIndex((item) => item.id === member.id)
    const current = memory.members[index] || { ...member, attendanceCount: 0 }
    memory.members[index] = { ...current, attendanceCount: (current.attendanceCount || 0) + 1, lastAttendanceAt: event.startsAt }
    return
  }
  const recordId = `${event.id}_${member.id}`
  await setDoc(doc(database, 'attendance', recordId), { eventId: event.id, memberId: member.id, memberName: member.name, checkedAt }, { merge: true })
  const all = await getDocs(collection(database, 'attendance'))
  const count = all.docs.filter((item) => item.data().memberId === member.id).length
  await setDoc(doc(database, 'members', member.id), { ...member, attendanceCount: count, lastAttendanceAt: event.startsAt, updatedAt: checkedAt }, { merge: true })
}

export async function saveEvent(event) {
  const database = await firebase()
  if (!database) { memory.events.push({ id: `event-${Date.now()}`, ...event }); return }
  await addDoc(collection(database, 'events'), { ...event, createdAt: new Date().toISOString() })
}
