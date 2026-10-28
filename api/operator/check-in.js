import { FieldValue } from 'firebase-admin/firestore'
import { adminServices } from '../_firebaseAdmin.js'

const tokenFrom = (request) => String(request.headers.authorization || '').replace(/^Bearer\s+/i, '')
const kstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ message: 'POST 요청만 허용됩니다.' })
  const token = tokenFrom(request)
  const { date, memberIds } = request.body || {}
  const uniqueMemberIds = [...new Set(Array.isArray(memberIds) ? memberIds.filter((id) => typeof id === 'string') : [])]
  if (!token || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date > kstToday() || !uniqueMemberIds.length || uniqueMemberIds.length > 450) return response.status(400).json({ message: '출석 정보가 올바르지 않습니다.' })
  try {
    const { auth, db } = adminServices()
    const decoded = await auth.verifyIdToken(token)
    const requester = await db.collection('members').doc(decoded.uid).get()
    const requesterRole = requester.exists ? requester.data().role : ''
    if (!['admin', 'staff'].includes(requesterRole)) return response.status(403).json({ message: '운영진과 관리자만 대신 출석 처리할 수 있습니다.' })
    const refs = uniqueMemberIds.map((id) => db.collection('members').doc(id))
    const members = await db.getAll(...refs)
    if (members.some((item) => !item.exists || !['staff', 'member'].includes(item.data().role))) return response.status(400).json({ message: '정회원 또는 운영진만 대신 출석 처리할 수 있습니다.' })
    const batch = db.batch()
    members.forEach((item) => {
      const data = item.data()
      batch.set(db.collection('attendance').doc(`${item.id}_${date}`), { memberId: item.id, memberName: String(data.realName || data.name || '카카오 멤버'), date, updatedAt: FieldValue.serverTimestamp() })
    })
    await batch.commit()
    return response.status(200).json({ ok: true, count: members.length })
  } catch (reason) {
    console.error('operator check-in failed', reason)
    return response.status(500).json({ message: '대신 출석 처리에 실패했습니다.' })
  }
}
