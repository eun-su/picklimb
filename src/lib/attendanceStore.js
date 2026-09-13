import { initializeApp } from 'firebase/app'
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
const requiredFirebaseSettings = {
  VITE_FIREBASE_API_KEY: config.apiKey,
  VITE_FIREBASE_PROJECT_ID: config.projectId,
  VITE_FIREBASE_APP_ID: config.appId,
}
const missingFirebaseSettings = Object.entries(requiredFirebaseSettings).filter(([, value]) => !value).map(([key]) => key)
const enabled = missingFirebaseSettings.length === 0
const demoEnabled = import.meta.env.DEV && !enabled
let db
let auth

const demoMembers = [
  { id: 'admin-kim', name: '김은수', role: 'admin' }, { id: 'staff-lee', name: '이하은', role: 'staff' }, { id: 'member-kang', name: '강바른', role: 'member' },
]
export const DEFAULT_NOTICE = {
  title: '[피리부는 클라이머 피클즈] 모임 운영가이드 & 사용 설명서',
  content: `클라이밍과 함께 러닝, 등산, 문화생활, 피크닉 등 다양한 취미 생활과 액티비티 관련 축제, 대회, 이벤트 정보를 자유롭게 공유하는 클럽입니다

실력 상관없이 운동 플랫폼 커뮤니티 참여하고 싶은 일정을 공유하고 함께 참여하는 모임!

운동 좋아하는 친구, 지인, 다른 크루 게스트 등 누구나 환영! 초보자 환영! 고수도 당연히 환영!

피클즈에서 바라는 4가지
① 안전 최우선! 모든 활동을 안전하게 진행해 주세요
② 활발한 소통! 적극적인 번개, 일정공유 부탁드립니다
③ 기본 예의 준수! 시간 약속, 존댓말, 인사 등 기본적인 예의를 지켜 주세요
④ 모두가 함께하는 모임 분위기!

처음 오신 분들도 편안하게 인사 나누고 자연스럽게 함께할 수 있도록 따뜻한 분위기를 함께 만들어가요

〰〰〰〰〰〰〰〰

■ 회원 & 운영진

▷ 회원 유지 방법
분기(3개월) 중 1회 이상 '일정 참여' OR '일정 생성' 후 엑셀(출첵 시스템) 체크까지 완료 시 유지 가능!
(1분기 : 1-3월)(2분기 : 4-6월)(3분기 : 7-9월)(4분기 : 10-12월) 분기 마지막 달 출석 확인 진행 후 운영진이 돌아가면서 체크요청 멘션(태그)

▷ 운영진
운영진은 일정 관리, 출석 확인 및 관리, 신규 인원 초대, 모임 내 문의 및 클레임 확인 등의 권한이 있습니다. 운영진 선정은 모임장과 운영진 확인 후 진행됩니다.

운영진도 함께 운동하는 회원이므로, 모임이 원활하게 운영될 수 있도록 회원분들의 협조 부탁드립니다.

〰〰〰〰〰〰〰〰

■ 이용 방법

▷ 일정 생성
모임에 참여중인 누구나 생성 및 참여 가능
우측 상단 ☰ 메뉴 → 투표'(톡게시판)' OR '일정(톡캘린더)' 을 통해서 생성 및 공유
(사람 챙기고 사진찍는 것은 필수가 아닙니다. 개인 운동일정 공유하여 일정 참여자 서로 인사하고 몇 문제 같이 풀어요 정도이니 부담 없이 열어주세요)

▷ 날짜 시간과 장소 기재
(00/00 [요일] + 시간 + 집결장소 등을 기입하여 공유)
투표에서 '기간' 은 일정 당일까지 설정 부탁드립니다 (당일 추가 인원 투표를 위함)
보통 최소 3일~일주일 정도 모집 기간을 두고 미리 생성해야 참석률이 올라갑니다

▷ 일정 참석
일정/투표 내용 확인 후 참석 + 댓글에 도착 예정 시간 기재 (서로 인원파악할 수 있도록 참석을 꼭 표시해주세요)

▷ 미정 표시
개인 사정으로 미정 선택은 가능하지만, 최소 하루 전까지 참석 여부를 확정하여 혼선을 줄일 수 있도록 협조 부탁드립니다

갑작스러운 불참의 경우 일정 생성자에게(개인 톡을 통해서라도) 미리 취소 사유를 확실하게 전달해주세요

▷ 불참 표시
투표 시 불참은 표시하거나 선택하지 않아도 됩니다
(다른 회원 참여 여부에 영향이 있습니다)

▷ 게스트 초대
자유롭게 지인 참석 가능 (뉴비 · 초보자의 경우 미리 전달해주세요)
게스트 참여 전 미리 단톡 혹은 투표 댓글에 방문 인원 표시 : 게스트 1명 예정

▷ 플랫폼 소셜링 생성 및 게스트 요청
구체적인 계획 장소, 날짜, 모집 인원을 요청해 주세요
플랫폼에 기재하여 진행을 도와드릴 수 있습니다
(외부 플랫폼 게스트 모집 일정의 경우 사전에 일정 생성자에게 가능여부를 확인하고 진행)

▷ 다른 운동
운동 이벤트와 계절에 따라 클라이밍이 아닌 다른 액티비티 혹은 관람형 활동도 가능
EX) 등산(페플셔틀), 계절스포츠, (크루)러닝, 볼링, 피크닉, 영화, 방탈출 등 자유롭게 번개 가능

▷ 크루 단위 신청
SNS 단체전 이벤트, 크루단위로 할인하는 프로모션에 참여하는 경우 [피클즈] 로 이용/신청하시면 됩니다

〰〰〰〰〰〰〰〰

■ 운동 주의 사항

개인 뿐만 아니라 같이 운동하는 사람들에게 곤란한 상황이 될 수 있으니 하단 내용 확인 부탁드립니다

▷ 평가성 발언 주의
(ex. 쉬운데 왜 못하지, 그거 아닌데, 댑인데, 발 걸어, 뭐가 힘들어 등 훈수를 두는 행위 금지)

▷ 다른 크루에 게스트로 참여하거나 다른 크루와 다같이 쓰는 공간에서 상호간의 기본 예절을 지켜주세요

(ex. 한 문제를 과도하게 독차지하는 행동, 순서를 지키지 않는 비매너 행동, 통행 방해, 반말 등)

타인의 안전 (경로 겹침 등) 혹은 실수에 대해 지적하기 전 상대방이 불쾌감을 느낄 수 있는 표현인지 한 번 더 생각해주세요
타모임 간 불화, 플랫폼 사용중지까지 야기할 수 있는 중요한 사항이니 확인 및 언행에 주의 부탁드립니다 😌

〰〰〰〰〰〰〰〰

■ 모임 초대 (톡방 초대)

▷ 게스트(지인으로) 1회 참여 혹은 운동 커뮤니티를 통해서 1회 이상 참여 후 → 운영진에게 모임 초대 가능 여부 확인 요청 → 초대

▷ 분기별로 (참여가능) 인원 조정 중
▷ 타 크루 기회원의 경우 모임장과 상담 후 초대

〰〰〰〰〰〰〰〰

■ 사진 & 영상 공유

▷ 운동 사진과 영상은 해당 모임 톡방에 전달 (촬영한 단체샷 혹은 개인샷 공유 부탁드립니다)

▷ 영상이 연속적으로 업로드 될 수 있으니 알림 해제하는 것을 추천합니다.

▷ SNS 게시글 OR 스토리에 사용될 경우 사진에 포함된 회원 아이디 혹은 피클즈 태그 및 좋아요 부탁드립니다

▷ 단체 사진은 공식 계정 혹은 개인 계정 게시물에 태그 및 게시될 수 있습니다 (원치 않으신 분은 사진 찍기 전 편하게 말씀 주세요)

〰〰〰〰〰〰〰〰

■ 차량이용과 장소 선정

↓ 차량지원 혜택 ↓

▷ 단거리 서울 → 탑승자 인당 2천원 운전자에게 지불 OR 지도앱에 표시된 (연료비 + 통행료) 1/N

▷ 장거리 & 1박 이상 → 기름, 톨비 정확하게 탑승자별로 1/N (운전자 포함 계산), 운전자에게 한끼 밥값 전액 감면 (운전비용)

※ 지방 여행 혹은 스키장 이동에 서로 불편한 상황을 줄이고자 정했습니다 (예외 없이 정산합니다)
※ 차량지원은 택시가 아닙니다 한 곳에 승하차하기를 권장드리며 차량지원자에게 감사인사 부탁드립니다 😉

〰〰〰〰〰〰〰〰

■ 클레임 & 문의 & 주의사항

▷ 본 모임은 일반 크루처럼 개별 관리 체계가 존재하진 않지만 기본적인 예의 (인사, 존댓말, 시간약속 등)을 지켜주세요

▷ 일정 변경하거나 참여불가 시 일정 생성자/참여자에게 공유톡방 OR 개인톡으로 미리 말씀주세요

▷ [크루 + 지인]만 참여하는 일정의 경우 일정에 표시하며 모임 플랫폼 게스트를 받지 않습니다

※ 사전 통보 없이 노쇼(불참)은 불참사유 확인 후 경고하거나 내보내기 처리.

※ (일정 관련 없는 사적인 질문) 한쪽에서 거절/불편함에 대한 의사를 표현했음에도 불구하고 지속적으로 개인카톡 연락 & 행동하는 상황 적발시 사실확인 + 경고와 함께 클럽장과 10km 러닝 + 상담 ^^

※ 활동 중 (고의적 피해를 주는 언행) 클레임이 발생할 경우 사실 여부를 확인 후 강퇴 처리되며 강퇴 사유는 온 세상에 투명하게 공개됩니다 양해 부탁드립니다 ^^

※ 위와 같은 불편한 상황을 제보하고싶다면 상담센터 ⓒ 김은수으로 편하게 카톡주세요 (자세하지 않더라도 알려주셔야 조치가 가능합니다)

(@picklimb - 피클즈 인스타그램 계정 ID)

SINCE 2023
ver 2026.07`,
}
const memory = {
  records: [{ id: 'member-kang_2026-09-11', memberId: 'member-kang', memberName: '강바른', date: '2026-09-11' }, { id: 'staff-lee_2026-09-11', memberId: 'staff-lee', memberName: '이하은', date: '2026-09-11' }],
  notice: DEFAULT_NOTICE,
}

function firebase() {
  if (!enabled) return null
  if (!db) { const app = initializeApp(config); db = getFirestore(app); auth = getAuth(app) }
  return { db, auth }
}
export const canOperate = (member) => ['admin', 'staff'].includes(member.role)
export const isAdmin = (member) => member.role === 'admin'

export function beginKakaoLogin() { window.location.assign('/api/kakao/login') }

export async function completeKakaoLogin(token) {
  const service = firebase()
  if (!service) throw new Error(`Firebase 웹 설정이 배포에 포함되지 않았어요: ${missingFirebaseSettings.join(', ')}`)
  await signInWithCustomToken(service.auth, token)
}

export async function logout() { const service = firebase(); if (service) await signOut(service.auth) }

export async function getDashboard(member) {
  const service = firebase()
  if (!service) {
    if (!demoEnabled) throw new Error('서비스 설정이 완료되지 않았어요.')
    return structuredClone({ members: demoMembers, records: memory.records, notice: memory.notice })
  }
  const tasks = [getDocs(collection(service.db, 'attendance')), getDoc(doc(service.db, 'notices', 'guide'))]
  if (canOperate(member)) tasks.push(getDocs(collection(service.db, 'members')))
  const [recordsSnapshot, noticeSnapshot, membersSnapshot] = await Promise.all(tasks)
  return {
    records: recordsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
    members: membersSnapshot ? membersSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })) : [],
    notice: noticeSnapshot.exists() ? noticeSnapshot.data() : DEFAULT_NOTICE,
  }
}

export async function checkIn(member, date) {
  const service = firebase(); const id = `${member.id}_${date}`
  if (!service) {
    if (!demoEnabled) throw new Error('서비스 설정이 완료되지 않았어요.')
    if (!memory.records.some((item) => item.id === id)) memory.records.push({ id, memberId: member.id, memberName: member.name, date }); return
  }
  await setDoc(doc(service.db, 'attendance', id), { memberId: member.id, memberName: member.name, date, updatedAt: serverTimestamp() })
}

export async function removeCheckIn(member, date) {
  const service = firebase(); const id = `${member.id}_${date}`
  if (!service) {
    if (!demoEnabled) throw new Error('서비스 설정이 완료되지 않았어요.')
    memory.records = memory.records.filter((item) => item.id !== id); return
  }
  await deleteDoc(doc(service.db, 'attendance', id))
}

export async function saveNotice(notice) {
  const service = firebase()
  if (!service) {
    if (!demoEnabled) throw new Error('서비스 설정이 완료되지 않았어요.')
    memory.notice = notice; return
  }
  await setDoc(doc(service.db, 'notices', 'guide'), { ...notice, updatedAt: serverTimestamp() })
}

export async function changeMemberRole(memberId, role) {
  const service = firebase()
  if (!service || !service.auth.currentUser) throw new Error('로그인 상태를 다시 확인해 주세요.')
  const token = await service.auth.currentUser.getIdToken()
  const response = await fetch('/api/admin/member-role', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ memberId, role }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || '권한 변경에 실패했어요.')
}
