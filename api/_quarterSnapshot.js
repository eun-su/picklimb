const KST_OFFSET = 9 * 60 * 60 * 1000
const roleOrder = { admin: 0, staff: 1, member: 2, paused: 3, withdrawn: 4 }

export const operatorRoles = new Set(['admin', 'staff'])

function kstParts(now = new Date()) {
  const shifted = new Date(now.getTime() + KST_OFFSET)
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() }
}

export function previousQuarter(now = new Date()) {
  const { year: currentYear, month } = kstParts(now)
  const currentQuarter = Math.floor((month - 1) / 3) + 1
  const quarter = currentQuarter === 1 ? 4 : currentQuarter - 1
  const year = currentQuarter === 1 ? currentYear - 1 : currentYear
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 2
  const endDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate()
  return { key: `${year}-Q${quarter}`, label: `${year}년 ${quarter}분기`, from: `${year}-${String(startMonth).padStart(2, '0')}-01`, to: `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}` }
}

export function isQuarterTransitionDay(now = new Date()) {
  const { month, day } = kstParts(now)
  return day === 1 && [1, 4, 7, 10].includes(month)
}

export async function getOrCreateQuarterSnapshot(db, quarter) {
  const ref = db.collection('quarterSnapshots').doc(quarter.key)
  const existing = await ref.get()
  if (existing.exists) return existing.data()

  const [membersSnapshot, attendanceSnapshot] = await Promise.all([
    db.collection('members').get(),
    db.collection('attendance').where('date', '>=', quarter.from).where('date', '<=', quarter.to).get(),
  ])
  const attendance = new Map()
  attendanceSnapshot.docs.forEach((record) => {
    const data = record.data()
    const dates = attendance.get(data.memberId) || []
    dates.push(String(data.date || ''))
    attendance.set(data.memberId, dates)
  })
  const members = membersSnapshot.docs.map((member) => {
    const data = member.data()
    const dates = (attendance.get(member.id) || []).filter(Boolean).sort().reverse()
    return { id: member.id, name: String(data.name || '카카오 멤버'), realName: String(data.realName || ''), role: data.role || 'member', dates, count: dates.length, lastDate: dates[0] || '' }
  }).sort((left, right) => (roleOrder[left.role] ?? 99) - (roleOrder[right.role] ?? 99) || left.realName.localeCompare(right.realName, 'ko') || left.name.localeCompare(right.name, 'ko'))
  const stats = {
    total: members.length,
    active: members.filter((item) => ['admin', 'staff', 'member'].includes(item.role)).length,
    absent: members.filter((item) => item.role === 'member' && item.count === 0).length,
    paused: members.filter((item) => item.role === 'paused').length,
    withdrawn: members.filter((item) => item.role === 'withdrawn').length,
  }
  const snapshot = { quarter, stats, members, capturedAt: new Date().toISOString() }
  return db.runTransaction(async (transaction) => {
    const latest = await transaction.get(ref)
    if (latest.exists) return latest.data()
    transaction.set(ref, snapshot)
    return snapshot
  })
}
