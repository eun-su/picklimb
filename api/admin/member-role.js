import { FieldValue } from 'firebase-admin/firestore'
import { adminServices } from '../_firebaseAdmin.js'

const roles = new Set(['admin', 'staff', 'member', 'paused', 'withdrawn'])

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ message: 'POST 요청만 허용됩니다.' })
  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const { updates } = request.body || {}
  if (!token || !Array.isArray(updates) || !updates.length || updates.some((item) => typeof item?.memberId !== 'string' || !roles.has(item?.role))) return response.status(400).json({ message: '권한 변경 정보가 올바르지 않습니다.' })
  try {
    const { auth, db } = adminServices()
    const decoded = await auth.verifyIdToken(token)
    if (decoded.role !== 'admin') return response.status(403).json({ message: '관리자만 권한을 변경할 수 있습니다.' })
    const uniqueUpdates = [...new Map(updates.map((item) => [item.memberId, item])).values()]
    const refs = uniqueUpdates.map((item) => db.collection('members').doc(item.memberId))
    const snapshots = await db.getAll(...refs)
    if (snapshots.some((snapshot) => !snapshot.exists)) return response.status(404).json({ message: '카카오 로그인 이력이 없는 멤버가 포함되어 있습니다.' })
    const batch = db.batch()
    uniqueUpdates.forEach((item) => batch.update(db.collection('members').doc(item.memberId), { role: item.role, updatedAt: FieldValue.serverTimestamp() }))
    await batch.commit()
    return response.status(200).json({ ok: true })
  } catch (reason) {
    console.error('member role update failed', reason)
    return response.status(500).json({ message: '권한 변경 중 문제가 발생했습니다.' })
  }
}
