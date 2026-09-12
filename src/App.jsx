import { useCallback, useEffect, useState } from 'react'
import { getDashboard, logout, removeRecord, saveRecord, verifyMemberAccess } from './lib/attendanceStore'
import './App.css'

const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const dateFromKey = (key) => new Date(`${key}T12:00:00`)
const monthTitle = (date) => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(date)
const formatDate = (key) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(dateFromKey(key))
const monthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const addMonths = (date, amount) => new Date(date.getFullYear(), date.getMonth() + amount, 1)

function Login({ onEnter }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true)
    try { onEnter(await verifyMemberAccess(name, code)) } catch (reason) { setError(reason.message) } finally { setLoading(false) }
  }
  return <main className="login-page"><section className="login-intro"><div className="brand-mark">P</div><span className="eyebrow lime">PICKLIMB ATTENDANCE</span><h1>같이 움직인<br />순간을 기록해요.</h1><p>내 운동 기록을 남기고, 함께한 시간을 확인하세요.</p><div className="intro-line" /><p className="intro-note">승인된 피클즈 멤버만 입장할 수 있습니다.</p></section><section className="login-panel"><div className="login-card"><span className="eyebrow">MEMBER ACCESS</span><h2>출석 기록 입장</h2><p className="muted">등록된 성함과 개인 참여코드를 입력해 주세요.</p><form onSubmit={submit}><label htmlFor="name">성함</label><input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김피클" /><label htmlFor="code">개인 참여코드</label><input id="code" type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="참여코드 입력" />{error && <p className="form-error">{error}</p>}<button className="button primary" disabled={loading}>{loading ? '확인 중...' : '입장하기'} <span>→</span></button></form><p className="help-text">반복된 로그인 실패 시 잠시 입장이 제한됩니다.</p></div></section></main>
}

function RecordModal({ date, record, member, onClose, onSaved }) {
  const [note, setNote] = useState(record?.note || '')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const save = async (event) => { event.preventDefault(); setLoading(true); try { await saveRecord(member, { date, note }); setSuccess(true); await onSaved() } finally { setLoading(false) } }
  const remove = async () => { if (!window.confirm('이 날짜의 운동 기록을 삭제할까요?')) return; setLoading(true); try { await removeRecord(member, date); await onSaved(); onClose() } finally { setLoading(false) } }
  if (success) return <div className="modal-backdrop"><section className="modal success-modal"><div className="success-check">✓</div><span className="eyebrow">RECORD SAVED</span><h2>참여해 주셔서<br />감사합니다!</h2><p>출석 체크에 반영되었어요.<br />운영진이 3개월 활동 기록을 확인합니다.</p><button className="button primary" onClick={onClose}>확인했어요</button></section></div>
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><button className="close" onClick={onClose}>×</button><span className="eyebrow">{record ? 'EDIT RECORD' : 'NEW RECORD'}</span><h2>{formatDate(date)}<br />운동 기록</h2><form onSubmit={save}><label htmlFor="note">오늘 어떤 운동을 했나요?</label><textarea id="note" maxLength="240" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 클라이밍 2시간, 러닝 5km" /><p className="field-note">기록은 나중에 수정하거나 삭제할 수 있어요.</p><button className="button primary" disabled={loading}>{loading ? '저장 중...' : '저장하기'}</button></form>{record && <button className="delete-button" disabled={loading} onClick={remove}>이 기록 삭제하기</button>}</section></div>
}

function Calendar({ month, records, onMove, onOpen }) {
  const today = dayKey(new Date())
  const first = monthStart(month)
  const startOffset = first.getDay()
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const recordByDate = new Map(records.map((item) => [item.date, item]))
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - startOffset + 1
    if (day < 1 || day > total) return null
    const date = new Date(month.getFullYear(), month.getMonth(), day)
    return { key: dayKey(date), day, record: recordByDate.get(dayKey(date)) }
  })
  const atCurrentMonth = monthStart(month).getTime() === monthStart(new Date()).getTime()
  return <section className="calendar-card"><div className="calendar-header"><div><span className="eyebrow">MY ACTIVITY CALENDAR</span><h2>{monthTitle(month)}</h2></div><div className="calendar-controls"><button onClick={() => onMove(-1)} aria-label="이전 달">←</button><button disabled={atCurrentMonth} onClick={() => onMove(1)} aria-label="다음 달">→</button></div></div><div className="weekdays">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((cell, index) => cell ? <button key={cell.key} disabled={cell.key > today} onClick={() => onOpen(cell.key, cell.record)} className={`calendar-day ${cell.record ? 'recorded' : ''} ${cell.key === today ? 'today' : ''}`}><b>{cell.day}</b>{cell.record ? <small>{cell.record.note}</small> : <i>+</i>}</button> : <span className="calendar-blank" key={`blank-${index}`} />)}</div><p className="calendar-help">날짜를 눌러 운동 기록을 남겨 주세요. 기록한 날짜는 다시 눌러 수정하거나 삭제할 수 있습니다.</p></section>
}

function AdminPanel({ data }) {
  const [search, setSearch] = useState('')
  const threeMonthsAgo = dayKey(addMonths(new Date(), -2))
  const summary = data.members.map((member) => {
    const records = data.records.filter((record) => record.memberId === member.id && record.date >= threeMonthsAgo)
    return { ...member, count: records.length, lastDate: records.map((item) => item.date).sort().at(-1) }
  }).filter((member) => member.name.includes(search.trim())).sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''))
  return <section className="admin-section"><div className="section-head"><div><span className="eyebrow">ADMIN ONLY</span><h2>3개월 활동 현황</h2><p>멤버가 직접 저장한 운동 기록을 기준으로 집계됩니다.</p></div><label className="search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름으로 찾기" /></label></div><div className="member-table"><div className="member-row table-label"><span>멤버</span><span>3개월 기록</span><span>마지막 기록일</span><span>권한</span></div>{summary.map((member) => <div className="member-row" key={member.id}><span className="member-name"><b className="avatar large">{member.name.slice(0, 1)}</b><b>{member.name}</b></span><span><b>{member.count}회</b></span><span>{member.lastDate || '아직 없음'}</span><span><em className={member.isAdmin ? 'present' : 'role'}>{member.isAdmin ? '운영진' : '멤버'}</em></span></div>)}</div></section>
}

function Dashboard({ member, onExit }) {
  const [data, setData] = useState({ members: [], records: [] })
  const [month, setMonth] = useState(monthStart(new Date()))
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => { setLoading(true); try { setData(await getDashboard(member)) } finally { setLoading(false) } }, [member])
  useEffect(() => { refresh() }, [refresh])
  const ownRecords = data.records.filter((record) => record.memberId === member.id)
  const threeMonthsAgo = dayKey(addMonths(new Date(), -2))
  const count = ownRecords.filter((record) => record.date >= threeMonthsAgo).length
  return <div className="dashboard"><header className="topbar"><a className="wordmark" href="#top"><span>P</span> PICKLIMB</a><nav><a href="#calendar">내 기록</a>{member.isAdmin && <a href="#admin">운영 현황</a>}</nav><div className="profile"><span className="avatar">{member.name.slice(0, 1)}</span><span>{member.name}{member.isAdmin && ' · 운영진'}</span><button onClick={onExit}>나가기</button></div></header><main id="top" className="content"><section className="hero activity-hero"><div><span className="eyebrow lime">PICKLIMB ACTIVITY</span><h1>움직인 오늘을,<br /><i>기록</i>해요.</h1><p>실제 참여 확인은 서로의 신뢰로, 기록은 투명하게 남겨요.</p></div><div className="hero-stats"><span>최근 3개월</span><strong>{count}<small>회</small></strong><p>내 운동 기록</p></div></section>{loading ? <div className="empty">기록을 불러오는 중이에요.</div> : <div id="calendar"><Calendar month={month} records={ownRecords} onMove={(amount) => setMonth((current) => addMonths(current, amount))} onOpen={(date, record) => setModal({ date, record })} /></div>}{member.isAdmin && !loading && <div id="admin"><AdminPanel data={data} /></div>}</main><footer>© PICKLIMB · 함께, 꾸준히.</footer>{modal && <RecordModal {...modal} member={member} onClose={() => setModal(null)} onSaved={refresh} />}</div>
}

export default function App() {
  const [member, setMember] = useState(() => { try { return JSON.parse(sessionStorage.getItem('picklimb-member-v2')) } catch { return null } })
  const enter = (next) => { sessionStorage.setItem('picklimb-member-v2', JSON.stringify(next)); setMember(next) }
  const exit = async () => { await logout(); sessionStorage.removeItem('picklimb-member-v2'); setMember(null) }
  return member ? <Dashboard member={member} onExit={exit} /> : <Login onEnter={enter} />
}
