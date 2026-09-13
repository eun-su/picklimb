import { FieldValue } from 'firebase-admin/firestore'
import { adminServices } from '../_firebaseAdmin.js'

const cleanName = (value) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 40)

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ message: 'POST 요청만 허용됩니다.' })
  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const memberId = String(request.body?.memberId || '')
  const realName = cleanName(request.body?.realName)
  if (!token || !memberId) return response.status(400).json({ message: '회원 정보가 올바르지 않습니다.' })
  try {
    const { auth, db } = adminServices()
    const decoded = await auth.verifyIdToken(token)
    if (decoded.role !== 'admin') return response.status(403).json({ message: '관리자만 본명을 수정할 수 있습니다.' })
    const memberRef = db.collection('members').doc(memberId)
    const member = await memberRef.get()
    if (!member.exists) return response.status(404).json({ message: '카카오 로그인 이력이 없는 멤버입니다.' })
    const displayName = realName || String(member.data().name || '카카오 멤버')
    const records = await db.collection('attendance').where('memberId', '==', memberId).get()
    if (records.size > 490) return response.status(400).json({ message: '출석 기록이 많아 본명 변경을 처리할 수 없습니다.' })
    const batch = db.batch()
    batch.update(memberRef, { realName: realName || FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() })
    records.docs.forEach((record) => batch.update(record.ref, { memberName: displayName, updatedAt: FieldValue.serverTimestamp() }))
    await batch.commit()
    return response.status(200).json({ ok: true, displayName })
  } catch (reason) {
    console.error('member profile update failed', reason)
    return response.status(500).json({ message: '본명 저장 중 문제가 발생했습니다.' })
  }
}
