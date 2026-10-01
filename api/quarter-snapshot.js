import { adminServices } from './_firebaseAdmin.js'
import { getOrCreateQuarterSnapshot, operatorRoles, previousQuarter } from './_quarterSnapshot.js'

const tokenFrom = (request) => String(request.headers.authorization || '').replace(/^Bearer\s+/i, '')

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ message: 'GET 요청만 허용됩니다.' })
  const token = tokenFrom(request)
  if (!token) return response.status(401).json({ message: '로그인 상태를 다시 확인해 주세요.' })
  try {
    const { auth, db } = adminServices()
    const decoded = await auth.verifyIdToken(token)
    const requester = await db.collection('members').doc(decoded.uid).get()
    const role = requester.exists ? requester.data().role || 'member' : 'member'
    if (!operatorRoles.has(role)) return response.status(403).json({ message: '운영진과 관리자만 이전 분기 현황을 볼 수 있습니다.' })
    const snapshot = await getOrCreateQuarterSnapshot(db, previousQuarter())
    return response.status(200).json({ snapshot })
  } catch (reason) {
    console.error('quarter snapshot failed', reason)
    return response.status(500).json({ message: '이전 분기 현황을 불러오지 못했어요.' })
  }
}
