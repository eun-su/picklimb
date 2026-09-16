import { FieldValue } from 'firebase-admin/firestore'
import { adminServices } from '../_firebaseAdmin.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ message: 'POST 요청만 허용됩니다.' })
  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return response.status(401).json({ message: '로그인 상태를 다시 확인해 주세요.' })
  try {
    const { auth, db } = adminServices()
    const decoded = await auth.verifyIdToken(token)
    const memberRef = db.collection('members').doc(decoded.uid)
    const member = await memberRef.get()
    if (!member.exists) return response.status(404).json({ message: '회원 정보를 찾을 수 없습니다.' })
    await memberRef.update({ role: 'withdrawn', withdrawnAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    return response.status(200).json({ ok: true })
  } catch (reason) {
    console.error('member withdrawal failed', reason)
    return response.status(500).json({ message: '탈퇴 처리 중 문제가 발생했습니다.' })
  }
}
