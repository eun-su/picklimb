import { FieldValue } from 'firebase-admin/firestore'
import { adminServices } from '../_firebaseAdmin.js'

const cleanName = (value) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 40)
const cleanEmail = (value) => String(value || '').trim().toLowerCase().slice(0, 120)
const emailValid = (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const tokenFrom = (request) => String(request.headers.authorization || '').replace(/^Bearer\s+/i, '')

export default async function handler(request, response) {
  const token = tokenFrom(request)
  if (!token) return response.status(401).json({ message: '로그인 상태를 다시 확인해 주세요.' })
  try {
    const { auth, db } = adminServices()
    const decoded = await auth.verifyIdToken(token)
    const memberRef = db.collection('members').doc(decoded.uid)
    const privateRef = db.collection('memberPrivate').doc(decoded.uid)
    if (request.method === 'GET') {
      const [member, privateProfile] = await Promise.all([memberRef.get(), privateRef.get()])
      if (!member.exists) return response.status(404).json({ message: '회원 정보를 찾을 수 없습니다.' })
      const data = member.data()
      return response.status(200).json({ name: data.name || '', realName: data.realName || '', email: privateProfile.exists ? privateProfile.data().email || '' : '', role: data.role || 'member' })
    }
    if (request.method !== 'POST') return response.status(405).json({ message: 'GET 또는 POST 요청만 허용됩니다.' })
    const realName = cleanName(request.body?.realName)
    const email = cleanEmail(request.body?.email)
    if (!emailValid(email)) return response.status(400).json({ message: '이메일 형식을 확인해 주세요.' })
    const member = await memberRef.get()
    if (!member.exists) return response.status(404).json({ message: '회원 정보를 찾을 수 없습니다.' })
    const displayName = realName || String(member.data().name || '카카오 멤버')
    const records = await db.collection('attendance').where('memberId', '==', decoded.uid).get()
    if (records.size > 490) return response.status(400).json({ message: '출석 기록이 많아 이름 변경을 처리할 수 없습니다.' })
    const batch = db.batch()
    batch.update(memberRef, { realName: realName || FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() })
    batch.set(privateRef, { email, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    records.docs.forEach((record) => batch.update(record.ref, { memberName: displayName, updatedAt: FieldValue.serverTimestamp() }))
    await batch.commit()
    return response.status(200).json({ ok: true, name: member.data().name || '', realName, email, role: member.data().role || 'member' })
  } catch (reason) {
    console.error('self profile update failed', reason)
    return response.status(500).json({ message: '회원정보 저장 중 문제가 발생했습니다.' })
  }
}
