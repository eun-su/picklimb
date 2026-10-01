/* global process */
import { adminServices } from '../_firebaseAdmin.js'
import { getOrCreateQuarterSnapshot, isQuarterTransitionDay, previousQuarter } from '../_quarterSnapshot.js'

export default async function handler(request, response) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.authorization !== `Bearer ${secret}`) return response.status(401).json({ message: '권한이 없습니다.' })
  if (!isQuarterTransitionDay()) return response.status(204).end()
  try {
    const { db } = adminServices()
    const snapshot = await getOrCreateQuarterSnapshot(db, previousQuarter())
    return response.status(200).json({ ok: true, quarter: snapshot.quarter.key })
  } catch (reason) {
    console.error('scheduled quarter snapshot failed', reason)
    return response.status(500).json({ message: '분기 스냅샷 저장에 실패했습니다.' })
  }
}
