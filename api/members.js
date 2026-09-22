import { adminServices } from './_firebaseAdmin.js'

const tokenFrom = (request) => String(request.headers.authorization || '').replace(/^Bearer\s+/i, '')
const activeRoles = new Set(['admin', 'staff', 'member', 'paused'])
const operatorRoles = new Set(['admin', 'staff'])
const timestampToIso = (value) => {
  if (!value) return ''
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  return typeof value === 'string' ? value : ''
}

async function authCreatedAt(auth, memberIds) {
  const result = new Map()
  for (let index = 0; index < memberIds.length; index += 100) {
    const batch = await auth.getUsers(memberIds.slice(index, index + 100).map((uid) => ({ uid })))
    batch.users.forEach((user) => result.set(user.uid, user.metadata.creationTime || ''))
  }
  return result
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ message: 'GET 요청만 허용됩니다.' })
  const token = tokenFrom(request)
  if (!token) return response.status(401).json({ message: '로그인 상태를 다시 확인해 주세요.' })

  try {
    const { auth, db } = adminServices()
    const decoded = await auth.verifyIdToken(token)
    const requester = await db.collection('members').doc(decoded.uid).get()
    const requesterRole = requester.exists ? requester.data().role || 'member' : 'member'
    if (!activeRoles.has(requesterRole)) return response.status(200).json({ members: [] })

    const snapshot = await db.collection('members').get()
    const includeDetails = operatorRoles.has(requesterRole)
    const joinedAt = includeDetails ? await authCreatedAt(auth, snapshot.docs.map((item) => item.id)) : new Map()
    const members = snapshot.docs
      .map((item) => {
        const data = item.data()
        return {
          id: item.id,
          name: String(data.name || '카카오 멤버'),
          realName: String(data.realName || ''),
          role: data.role || 'member',
          ...(includeDetails ? { joinedAt: timestampToIso(data.joinedAt) || timestampToIso(data.createdAt) || joinedAt.get(item.id) || timestampToIso(data.lastLoginAt) } : {}),
        }
      })
      .filter((item) => includeDetails || item.role !== 'withdrawn')

    return response.status(200).json({ members })
  } catch (reason) {
    console.error('member directory failed', reason)
    return response.status(500).json({ message: '멤버 목록을 불러오지 못했어요.' })
  }
}
