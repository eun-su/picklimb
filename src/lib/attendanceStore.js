import { initializeApp } from 'firebase/app'
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth'
import { collection, deleteDoc, doc, getDocs, getFirestore, query, serverTimestamp, setDoc, where } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
const enabled = Boolean(config.apiKey && config.projectId && config.appId)
let db
let auth

const demoMember = { id: 'demo-member', name: '김피클', isAdmin: false }
const demoAdmin = { id: 'demo-admin', name: '홍운영', isAdmin: true }
const memory = {
  members: [demoAdmin, demoMember, { id: 'demo-lee', name: '이운동', isAdmin: false }],
  records: [{ id: 'demo-member_2026-09-05', memberId: 'demo-member', memberName: '김피클', date: '2026-09-05', note: '한강 5km 러닝' }],
}

function firebase() {
  if (!enabled) return null
  if (!db) {
    const app = initializeApp(config)
    db = getFirestore(app)
    auth = getAuth(app)
  }
  return { db, auth }
}

export async function verifyMemberAccess(name, code) {
  if (!name.trim() || !code.trim()) throw new Error('성함과 참여코드를 모두 입력해 주세요.')
  const service = firebase()
  if (!service) {
    if (code === 'PICKLIMB_ADMIN') return demoAdmin
    if (code === 'PICKLIMB') return { ...demoMember, name: name.trim() }
    throw new Error('참여코드가 맞지 않아요.')
  }
  const response = await fetch('/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, code }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || '입장 확인에 실패했어요.')
  await signInWithCustomToken(service.auth, result.token)
  return result.member
}

export async function logout() {
  const service = firebase()
  if (service?.auth) await signOut(service.auth)
}

export async function getDashboard(member) {
  const service = firebase()
  if (!service) return structuredClone({
    members: member.isAdmin ? memory.members : memory.members.filter((item) => item.id === member.id),
    records: member.isAdmin ? memory.records : memory.records.filter((item) => item.memberId === member.id),
  })
  const ownRecords = getDocs(query(collection(service.db, 'attendance'), where('memberId', '==', member.id)))
  if (!member.isAdmin) {
    const records = (await ownRecords).docs.map((item) => ({ id: item.id, ...item.data() }))
    return { members: [member], records }
  }
  const [recordsSnapshot, membersSnapshot] = await Promise.all([getDocs(collection(service.db, 'attendance')), getDocs(collection(service.db, 'members'))])
  return {
    members: membersSnapshot.docs.map((item) => ({ id: item.id, ...item.data(), isAdmin: item.data().role === 'admin' })),
    records: recordsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
  }
}

export async function saveRecord(member, { date, note }) {
  const cleanNote = note.trim()
  if (!cleanNote) throw new Error('운동 내용을 입력해 주세요.')
  const service = firebase()
  const id = `${member.id}_${date}`
  if (!service) {
    const index = memory.records.findIndex((item) => item.id === id)
    const record = { id, memberId: member.id, memberName: member.name, date, note: cleanNote }
    if (index < 0) memory.records.push(record); else memory.records[index] = record
    return
  }
  await setDoc(doc(service.db, 'attendance', id), {
    memberId: member.id, memberName: member.name, date, note: cleanNote, updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function removeRecord(member, date) {
  const service = firebase()
  const id = `${member.id}_${date}`
  if (!service) { memory.records = memory.records.filter((item) => item.id !== id); return }
  await deleteDoc(doc(service.db, 'attendance', id))
}
