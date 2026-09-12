/* global process */
import { compare } from 'bcryptjs'
import { createHash } from 'node:crypto'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminServices } from './_firebaseAdmin.js'

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const BLOCK_MS = 30 * 60 * 1000

const keyForName = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase()
const toAttemptId = (ip, name) => createHash('sha256')
  .update(`${process.env.LOGIN_RATE_LIMIT_SECRET}:${ip}:${keyForName(name)}`)
  .digest('hex')

async function consumeAttempt(db, attemptId) {
  const ref = db.collection('loginAttempts').doc(attemptId)
  return db.runTransaction(async (transaction) => {
    const now = Date.now()
    const snapshot = await transaction.get(ref)
    const previous = snapshot.exists ? snapshot.data() : {}
    const blockedUntil = previous.blockedUntil?.toMillis?.() || 0
    if (blockedUntil > now) return { blocked: true, retryAfter: Math.ceil((blockedUntil - now) / 60_000) }

    const startedAt = previous.windowStartedAt?.toMillis?.() || now
    const inWindow = now - startedAt < WINDOW_MS
    const attempts = (inWindow ? previous.attempts || 0 : 0) + 1
    const block = attempts > MAX_ATTEMPTS
    transaction.set(ref, {
      attempts,
      windowStartedAt: Timestamp.fromMillis(inWindow ? startedAt : now),
      blockedUntil: block ? Timestamp.fromMillis(now + BLOCK_MS) : null,
      updatedAt: FieldValue.serverTimestamp(),
    })
    return { blocked: block, retryAfter: block ? 30 : 0 }
  })
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ message: 'POST 요청만 허용됩니다.' })
  const { name, code } = request.body || {}
  if (typeof name !== 'string' || typeof code !== 'string' || !name.trim() || !code.trim()) {
    return response.status(400).json({ message: '성함과 참여코드를 입력해 주세요.' })
  }

  try {
    const { auth, db } = adminServices()
    const ip = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim()
    const attempt = await consumeAttempt(db, toAttemptId(ip, name))
    if (attempt.blocked) return response.status(429).json({ message: `로그인 시도가 많아요. ${attempt.retryAfter}분 후 다시 시도해 주세요.` })

    const found = await db.collection('allowedMembers').where('nameKey', '==', keyForName(name)).limit(1).get()
    const member = found.docs[0]
    if (!member || !(await compare(code, member.data().codeHash))) {
      return response.status(401).json({ message: '등록된 멤버 정보와 일치하지 않습니다.' })
    }

    const data = member.data()
    const isAdmin = data.role === 'admin'
    await db.collection('loginAttempts').doc(toAttemptId(ip, name)).delete()
    await db.collection('members').doc(member.id).set({
      name: data.name,
      role: isAdmin ? 'admin' : 'member',
      updatedAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    const token = await auth.createCustomToken(member.id, { admin: isAdmin })
    return response.status(200).json({ token, member: { id: member.id, name: data.name, isAdmin } })
  } catch (error) {
    console.error('login failed', error)
    return response.status(500).json({ message: '입장 확인 중 문제가 발생했어요. 운영진에게 문의해 주세요.' })
  }
}
