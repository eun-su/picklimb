import { FieldValue } from 'firebase-admin/firestore'
import { adminServices } from '../_firebaseAdmin.js'

const roles = new Set(['admin', 'staff', 'member'])

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ message: 'POST 요청만 허용됩니다.' })
  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const { memberId, role } = request.body || {}
  if (!token || typeof memberId !== 'string' || !roles.has(role)) return response.status(400).json({ message: '권한 변경 정보가 올바르지 않습니다.' })
  try {
    const { auth, db } = adminServices()
    const decoded = await auth.verifyIdToken(token)
    if (decoded.role !== 'admin') return response.status(403).json({ message: '관리자만 권한을 변경할 수 있습니다.' })
    const ref = db.collection('members').doc(memberId)
    if (!(await ref.get()).exists) return response.status(404).json({ message: '카카오 로그인 이력이 없는 멤버입니다.' })
    await ref.update({ role, updatedAt: FieldValue.serverTimestamp() })
    return response.status(200).json({ ok: true })
  } catch (reason) {
    console.error('member role update failed', reason)
    return response.status(500).json({ message: '권한 변경 중 문제가 발생했습니다.' })
  }
}
