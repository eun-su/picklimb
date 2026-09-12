import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { hash } from 'bcryptjs'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const filePath = resolve(process.cwd(), 'members.private.json')
const config = JSON.parse(await readFile(filePath, 'utf8'))
const serviceAccount = JSON.parse(await readFile(resolve(process.cwd(), config.serviceAccountPath), 'utf8'))
const app = initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore(app)

const nameKey = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase()
for (const member of config.members) {
  if (!member.id || !member.name || !member.code || !['member', 'admin'].includes(member.role)) {
    throw new Error(`멤버 정보가 올바르지 않습니다: ${JSON.stringify(member)}`)
  }
  const codeHash = await hash(member.code, 12)
  await db.collection('allowedMembers').doc(member.id).set({
    name: member.name.trim(), nameKey: nameKey(member.name), role: member.role, codeHash, updatedAt: FieldValue.serverTimestamp(),
  })
  await db.collection('members').doc(member.id).set({
    name: member.name.trim(), role: member.role, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
  console.log(`등록 완료: ${member.name} (${member.role})`)
}
