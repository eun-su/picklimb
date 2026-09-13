/* global process */
import { randomBytes } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { adminServices } from '../_firebaseAdmin.js'

const COOKIE = 'picklimb_kakao_oauth_state'
const ENTRY_COOKIE = 'picklimb_entry_verified'
const cookieValue = (request, name) => String(request.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1)
const escapedJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c')
const bootstrapAdmins = () => new Set(String(process.env.KAKAO_BOOTSTRAP_ADMIN_IDS || '').split(',').map((value) => value.trim()).filter(Boolean))

function callbackHtml(token, member) {
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>피클즈 로그인 중</title><body><p>피클즈 출석체크로 이동하고 있어요.</p><script>sessionStorage.setItem('picklimb-kakao-token', ${escapedJson(token)});sessionStorage.setItem('picklimb-kakao-member', ${escapedJson(JSON.stringify(member))});location.replace('/');</script></body></html>`
}

export default async function handler(request, response) {
  const redirectUri = process.env.KAKAO_REDIRECT_URI
  const restKey = process.env.KAKAO_REST_API_KEY
  if (!redirectUri || !restKey) return response.status(500).send('카카오 로그인 설정이 완료되지 않았습니다.')

  if (request.method === 'POST') {
    const configuredCode = String(process.env.PICKLIMB_ACCESS_CODE || '')
    const accessCode = String(request.body?.accessCode || '')
    if (!configuredCode) return response.status(500).json({ message: '참여코드 설정이 완료되지 않았습니다.' })
    if (!accessCode || accessCode !== configuredCode) return response.status(401).json({ message: '참여코드가 올바르지 않습니다.' })
    response.setHeader('Set-Cookie', `${ENTRY_COOKIE}=verified; HttpOnly; Secure; SameSite=Lax; Path=/api/kakao; Max-Age=600`)
    return response.status(204).end()
  }
  if (request.method !== 'GET') return response.status(405).send('허용되지 않은 요청입니다.')
  if (cookieValue(request, ENTRY_COOKIE) !== 'verified') return response.redirect(302, '/?login_error=entry_required')

  const { code, state, error } = request.query || {}
  if (error) return response.redirect(302, '/?login_error=kakao_cancelled')
  if (!code) {
    const csrfState = randomBytes(24).toString('hex')
    response.setHeader('Set-Cookie', `${COOKIE}=${csrfState}; HttpOnly; Secure; SameSite=Lax; Path=/api/kakao/login; Max-Age=600`)
    const url = new URL('https://kauth.kakao.com/oauth/authorize')
    url.searchParams.set('client_id', restKey)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('state', csrfState)
    return response.redirect(302, url.toString())
  }
  if (!state || state !== cookieValue(request, COOKIE)) return response.status(400).send('로그인 요청을 다시 시작해 주세요.')

  try {
    const form = new URLSearchParams({ grant_type: 'authorization_code', client_id: restKey, redirect_uri: redirectUri, code: String(code) })
    if (process.env.KAKAO_CLIENT_SECRET) form.set('client_secret', process.env.KAKAO_CLIENT_SECRET)
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: form })
    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error('카카오 토큰 발급 실패')
    const profileResponse = await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${tokenData.access_token}` } })
    const profile = await profileResponse.json()
    if (!profileResponse.ok || !profile.id) throw new Error('카카오 사용자 확인 실패')

    const { auth, db } = adminServices()
    const kakaoId = String(profile.id)
    const memberId = `kakao_${kakaoId}`
    const ref = db.collection('members').doc(memberId)
    const snapshot = await ref.get()
    const nickname = String(profile.properties?.nickname || profile.kakao_account?.profile?.nickname || '카카오 멤버').trim().slice(0, 40) || '카카오 멤버'
    const storedRole = snapshot.exists ? snapshot.data().role : 'member'
    const realName = snapshot.exists ? String(snapshot.data().realName || '').trim().slice(0, 40) : ''
    const role = bootstrapAdmins().has(kakaoId) ? 'admin' : ['admin', 'staff', 'member', 'paused', 'withdrawn'].includes(storedRole) ? storedRole : 'member'
    await ref.set({ name: nickname, role, provider: 'kakao', updatedAt: FieldValue.serverTimestamp(), lastLoginAt: FieldValue.serverTimestamp() }, { merge: true })
    const token = await auth.createCustomToken(memberId, { role })
    response.setHeader('Set-Cookie', [`${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/api/kakao/login; Max-Age=0`, `${ENTRY_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/api/kakao; Max-Age=0`])
    return response.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(callbackHtml(token, { id: memberId, name: nickname, realName, role }))
  } catch (reason) {
    console.error('kakao login failed', reason)
    return response.status(500).send('카카오 로그인 처리 중 문제가 발생했습니다. 다시 시도해 주세요.')
  }
}
