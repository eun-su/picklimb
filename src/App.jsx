import { useCallback, useEffect, useMemo, useState } from 'react'
import { beginKakaoLogin, canOperate, changeMemberRole, checkIn, completeKakaoLogin, DEFAULT_NOTICE, getDashboard, isAdmin, logout, removeCheckIn, saveNotice } from './lib/attendanceStore'
import './App.css'

const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const dateFromKey = (key) => new Date(`${key}T12:00:00`)
const addDays = (date, amount) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
const addMonths = (date, amount) => new Date(date.getFullYear(), date.getMonth() + amount, 1)
const monthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const monthTitle = (date) => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(date)
const formatDate = (key) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(dateFromKey(key))
const roleLabel = (role) => ({ admin: '관리자', staff: '운영진', member: '정회원' }[role] || '정회원')
const currentQuarterStart = () => { const now = new Date(); return dayKey(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)) }

function Login({ error = '' }) {
  const params = new URLSearchParams(window.location.search)
  const cancelled = params.get('login_error') === 'kakao_cancelled'
  return <main className="login-page">
    <section className="login-intro"><div className="brand-mark">P</div><span className="eyebrow lime">PICKLIMB ATTENDANCE</span><h1>피리부는 출석체크</h1><div className="intro-line" /><p className="intro-note">카카오 계정으로 본인만 안전하게 출석을 남길 수 있습니다.</p></section>
    <section className="login-panel"><div className="login-card"><span className="eyebrow">KAKAO MEMBER ACCESS</span><h2>카카오톡 입장</h2><p className="muted">카카오 계정의 고유 회원번호로 본인 출석을 안전하게 연결합니다.</p>{(cancelled || error) && <p className="form-error">{error || '카카오 로그인이 취소되었어요. 다시 시도해 주세요.'}</p>}<button className="kakao-button" onClick={beginKakaoLogin}><b>k</b> 카카오로 시작하기</button><p className="help-text">처음 로그인한 카카오 계정은 정회원으로 시작합니다.</p></div></section>
  </main>
}

function DayModal({ date, records, member, onClose, onChanged }) {
  const [loading, setLoading] = useState(false)
  const today = dayKey(new Date())
  const mine = records.find((record) => record.memberId === member.id)
  const add = async () => { setLoading(true); try { await checkIn(member, date); await onChanged(); onClose() } finally { setLoading(false) } }
  const remove = async () => {
    if (!window.confirm('이 날짜의 내 출석을 취소할까요?')) return
    setLoading(true); try { await removeCheckIn(member, date); await onChanged(); onClose() } finally { setLoading(false) }
  }
  const pastOrToday = date <= today
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal day-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={onClose} aria-label="닫기">×</button><span className="eyebrow">DAILY CHECK-IN</span><h2>{formatDate(date)}</h2><p className="day-description">이 날짜에 출석을 남긴 멤버입니다.</p><div className="checked-members">{records.length ? records.map((record) => <span className={`checked-person ${record.memberId === member.id ? 'mine' : ''}`} key={record.id}><b>{record.memberName.slice(0, 1)}</b>{record.memberName}{record.memberId === member.id && <em>나</em>}</span>) : <p>아직 출석을 남긴 멤버가 없어요.</p>}</div>{mine ? <button className="button outline" disabled={loading} onClick={remove}>{loading ? '처리 중...' : '내 출석 취소하기'}</button> : pastOrToday ? <button className="button primary" disabled={loading} onClick={add}>{loading ? '반영 중...' : '이 날짜에 출석 체크'} <span>→</span></button> : <p className="field-note">미래 날짜에는 출석 체크를 할 수 없어요.</p>}<p className="field-note">다른 멤버의 출석은 확인만 가능하며 수정하거나 삭제할 수 없어요.</p></section></div>
}

function CheckInPicker({ onClose, onPick }) {
  const [date, setDate] = useState(dayKey(new Date()))
  const submit = (event) => { event.preventDefault(); if (date) onPick(date) }
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal date-picker-modal" role="dialog" aria-modal="true" aria-labelledby="checkin-picker-title" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={onClose} aria-label="닫기">×</button><span className="eyebrow">CHECK-IN DATE</span><h2 id="checkin-picker-title">출석 날짜 선택</h2><p className="day-description">운동에 참여한 날짜를 선택해 출석을 남겨 주세요.</p><form onSubmit={submit}><label htmlFor="checkin-date">출석 날짜</label><input id="checkin-date" type="date" value={date} max={dayKey(new Date())} onChange={(event) => setDate(event.target.value)} required /><button className="button primary">선택한 날짜로 이동 <span>→</span></button></form></section></div>
}

function NoticeModal({ notice, onClose, onSaved }) {
  const [title, setTitle] = useState(notice.title)
  const [content, setContent] = useState(notice.content)
  const [loading, setLoading] = useState(false)
  const save = async (event) => { event.preventDefault(); setLoading(true); try { await saveNotice({ title: title.trim() || '피리부는 클라이머 이용가이드', content: content.trim() }); await onSaved(); onClose() } finally { setLoading(false) } }
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={onClose} aria-label="닫기">×</button><span className="eyebrow">ADMIN EDITOR</span><h2>공지사항 수정</h2><form onSubmit={save}><label htmlFor="notice-title">제목</label><input id="notice-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength="80" /><label htmlFor="notice-content">내용</label><textarea id="notice-content" value={content} onChange={(event) => setContent(event.target.value)} maxLength="1200" /><button className="button primary" disabled={loading}>{loading ? '저장 중...' : '저장하기'} <span>→</span></button></form></section></div>
}

function Calendar({ month, records, member, onMove, onOpen, onCheckIn }) {
  const today = dayKey(new Date())
  const first = monthStart(month)
  const offset = first.getDay()
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const grouped = new Map()
  records.forEach((record) => grouped.set(record.date, [...(grouped.get(record.date) || []), record]))
  const atCurrentMonth = first.getTime() === monthStart(new Date()).getTime()
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - offset + 1
    if (day < 1 || day > total) return null
    const key = dayKey(new Date(month.getFullYear(), month.getMonth(), day))
    return { day, key, entries: grouped.get(key) || [] }
  })
  return <section className="calendar-card"><div className="calendar-header"><div><span className="eyebrow">PICKLIMB CHECK-IN</span><h2>{monthTitle(month)}</h2></div><div className="calendar-actions"><button className="today-check" onClick={onCheckIn}>출석 체크 <span>→</span></button><div className="calendar-controls"><button onClick={() => onMove(-1)} aria-label="이전 달">←</button><button disabled={atCurrentMonth} onClick={() => onMove(1)} aria-label="다음 달">→</button></div></div></div><div className="weekdays">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((cell, index) => cell ? <button key={cell.key} onClick={() => onOpen(cell.key)} className={`calendar-day ${cell.entries.length ? 'recorded' : ''} ${cell.key === today ? 'today' : ''}`}><b>{cell.day}</b>{cell.entries.length > 0 && <small>{cell.entries.slice(0, 2).map((record) => record.memberName).join(' · ')}{cell.entries.length > 2 && ` 외 ${cell.entries.length - 2}`}</small>}<i>{cell.entries.length || '+'}</i></button> : <span className="calendar-blank" key={`blank-${index}`} />)}</div><p className="calendar-help">출석 체크 버튼에서 날짜를 선택할 수 있어요. 날짜를 누르면 그날 출석한 멤버를 볼 수 있습니다.</p></section>
}

function MobileTimeline({ records, member, onOpen, onCheckIn }) {
  const [before, setBefore] = useState(3)
  const [after, setAfter] = useState(3)
  const today = new Date()
  const days = Array.from({ length: before + after + 1 }, (_, index) => addDays(today, index - before))
  const grouped = new Map()
  records.forEach((record) => grouped.set(record.date, [...(grouped.get(record.date) || []), record]))
  return <section className="mobile-timeline"><div className="mobile-list-head"><span className="eyebrow">DAILY CHECK-IN</span><h2>날짜별 출석</h2></div><button className="mobile-check-in-button" onClick={onCheckIn}>출석 체크 <span>날짜 선택 →</span></button><button className="load-more" onClick={() => setBefore((value) => value + 7)}>이전 7일 더 보기</button>{days.map((date) => { const key = dayKey(date); const entries = grouped.get(key) || []; const mine = entries.some((record) => record.memberId === member.id); return <button className={`timeline-row ${key === dayKey(today) ? 'today' : ''}`} onClick={() => onOpen(key)} key={key}><span className="timeline-date">{new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' }).format(date)}</span><span className="timeline-members">{entries.length ? `${entries.map((item) => item.memberName).join(' · ')}${mine ? ' · 나' : ''}` : '출석 기록 없음'}</span><b>{entries.length}명</b></button> })}<button className="load-more" onClick={() => setAfter((value) => value + 7)}>다음 7일 더 보기</button></section>
}

function OperatorPanel({ data, member, onRoleChanged }) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const from = currentQuarterStart()
  const rows = data.members.map((item) => { const dates = data.records.filter((record) => record.memberId === item.id && record.date >= from).map((record) => record.date).sort().reverse(); return { ...item, dates, count: dates.length, lastDate: dates[0] } }).filter((item) => item.name.includes(search.trim())).sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''))
  const updateRole = async (event, target) => { event.stopPropagation(); await changeMemberRole(target.id, event.target.value); await onRoleChanged() }
  return <section className="admin-section" id="operations"><div className="section-head"><div><span className="eyebrow">OPERATOR VIEW</span><h2>이번 분기 참여 현황</h2><p>운영진은 전체 멤버의 출석 횟수와 참여 날짜를 확인할 수 있습니다.</p></div><label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름으로 찾기" /></label></div><div className="member-table"><div className="member-row table-label"><span>멤버</span><span>이번 분기</span><span>마지막 참여일</span><span>권한</span></div>{rows.map((item) => <div key={item.id}><div className="member-row member-button" role="button" tabIndex="0" onClick={() => setExpanded(expanded === item.id ? null : item.id)} onKeyDown={(event) => { if (event.key === 'Enter') setExpanded(expanded === item.id ? null : item.id) }}><span className="member-name"><b className="avatar large">{item.name.slice(0, 1)}</b><b>{item.name}</b></span><span><b>{item.count}회</b></span><span>{item.lastDate ? formatDate(item.lastDate) : '아직 없음'}</span><span>{isAdmin(member) ? <select className="role-select" value={item.role} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => updateRole(event, item)}><option value="member">정회원</option><option value="staff">운영진</option><option value="admin">관리자</option></select> : <em className={`role ${item.role}`}>{roleLabel(item.role)}</em>}</span></div>{expanded === item.id && <div className="member-dates">{item.dates.length ? item.dates.map((date) => <span key={date}>{formatDate(date)}</span>) : '이번 분기 출석 기록이 없습니다.'}</div>}</div>)}</div></section>
}

function Dashboard({ member, onExit }) {
  const [data, setData] = useState({ members: [], records: [], notice: DEFAULT_NOTICE })
  const [month, setMonth] = useState(monthStart(new Date()))
  const [selectedDate, setSelectedDate] = useState(null)
  const [checkInPickerOpen, setCheckInPickerOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => { setLoading(true); try { setData(await getDashboard(member)) } finally { setLoading(false) } }, [member])
  useEffect(() => { refresh() }, [refresh])
  const quarterStart = currentQuarterStart()
  const ownCount = useMemo(() => data.records.filter((record) => record.memberId === member.id && record.date >= quarterStart).length, [data.records, member.id, quarterStart])
  const totalCount = useMemo(() => data.records.filter((record) => record.date >= quarterStart).length, [data.records, quarterStart])
  const entriesForSelectedDate = data.records.filter((record) => record.date === selectedDate)
  const openCheckInDate = (date) => { setCheckInPickerOpen(false); setSelectedDate(date) }
  const notice = data.notice || DEFAULT_NOTICE
  return <div className="dashboard"><header className="topbar"><a className="wordmark" href="#top"><span>P</span> PICKLIMB</a><nav><a href="#calendar">출석 현황</a>{canOperate(member) && <a href="#operations">운영 현황</a>}<a href="#guide">공지사항 · 이용가이드</a></nav><div className="profile"><span className="avatar">{member.name.slice(0, 1)}</span><span>{member.name} · {roleLabel(member.role)}</span><button onClick={onExit}>나가기</button></div></header><main id="top" className="content"><section className="hero activity-hero"><div><span className="eyebrow lime">PICKLIMB ACTIVITY</span><h1>안전하고 행복한<br /><i>운동 라이프</i></h1><p>실제 운동 후 서로의 신뢰를 바탕으로 출석을 남겨 주세요.</p></div><div className="hero-stats"><span>이번 분기</span><strong>{ownCount}<small>회</small></strong><p>내 출석 현황</p><em>전체 {totalCount}회</em></div></section>{loading ? <div className="empty">출석 현황을 불러오는 중이에요.</div> : <><div id="calendar" className="desktop-calendar"><Calendar month={month} records={data.records} member={member} onMove={(amount) => setMonth((current) => addMonths(current, amount))} onOpen={setSelectedDate} onCheckIn={() => setCheckInPickerOpen(true)} /></div><MobileTimeline records={data.records} member={member} onOpen={setSelectedDate} onCheckIn={() => setCheckInPickerOpen(true)} /><section className="my-quarter"><span className="eyebrow">MY QUARTER</span><h2>이번 분기, <b>{ownCount}회</b> 함께했어요.</h2><p>출석 체크는 운동에 참여한 날만 남겨 주세요.</p></section><section className="connection-card"><span>내 카카오 연결 ID</span><code>{member.connectionId || member.id.replace('kakao_', '')}</code><p>처음 관리자 권한을 연결할 때만 이 값을 사용합니다.</p></section><section id="guide" className="guide-card"><div className="guide-summary"><div><span className="eyebrow">NOTICE · GUIDE</span><h2>{notice.title}</h2></div><button className="guide-toggle" onClick={() => setGuideOpen((open) => !open)} aria-expanded={guideOpen}>{guideOpen ? '접기 ▲' : '자세히 보기 ▼'}</button></div>{guideOpen && <div className="guide-body"><p>{notice.content}</p>{isAdmin(member) && <button className="text-button" onClick={() => setNoticeOpen(true)}>관리자 수정</button>}</div>}</section>{canOperate(member) && <OperatorPanel data={data} member={member} onRoleChanged={refresh} />}</>}</main><footer>© PICKLIMB · 함께, 꾸준히.</footer>{selectedDate && <DayModal date={selectedDate} records={entriesForSelectedDate} member={member} onClose={() => setSelectedDate(null)} onChanged={refresh} />}{checkInPickerOpen && <CheckInPicker onClose={() => setCheckInPickerOpen(false)} onPick={openCheckInDate} />}{noticeOpen && <NoticeModal notice={notice} onClose={() => setNoticeOpen(false)} onSaved={refresh} />}</div>
}

export default function App() {
  const [member, setMember] = useState(() => { try { return JSON.parse(sessionStorage.getItem('picklimb-kakao-member')) } catch { return null } })
  const [booting, setBooting] = useState(true)
  const [loginError, setLoginError] = useState('')
  useEffect(() => {
    const finishLogin = async () => {
      const token = sessionStorage.getItem('picklimb-kakao-token')
      if (!token) { setBooting(false); return }
      try { await completeKakaoLogin(token); setMember(JSON.parse(sessionStorage.getItem('picklimb-kakao-member'))) } catch (reason) { console.error('Firebase custom-token login failed', reason); sessionStorage.removeItem('picklimb-kakao-member'); setMember(null); setLoginError(reason?.code === 'auth/custom-token-mismatch' ? 'Firebase 서비스 계정과 웹 앱이 서로 다른 프로젝트입니다. 운영진에게 Firebase 설정 확인을 요청해 주세요.' : `카카오 계정 연결에 실패했어요. ${reason?.message || `(${reason?.code || 'unknown'})`}`) } finally { sessionStorage.removeItem('picklimb-kakao-token'); setBooting(false) }
    }
    finishLogin()
  }, [])
  const exit = async () => { await logout(); sessionStorage.removeItem('picklimb-kakao-member'); setMember(null) }
  if (booting) return <main className="boot-screen">카카오 로그인 상태를 확인하고 있어요.</main>
  return member ? <Dashboard member={member} onExit={exit} /> : <Login error={loginError} />
}
