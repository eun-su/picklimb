import { useEffect, useMemo, useState } from 'react'
import {
  getDashboard,
  markAttendance,
  saveEvent,
  verifyMemberAccess,
} from './lib/attendanceStore'
import './App.css'

const formatDate = (value, options = { month: 'long', day: 'numeric', weekday: 'short' }) =>
  new Intl.DateTimeFormat('ko-KR', options).format(new Date(value))

const toDateTimeLocal = (value) => {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date - offset).toISOString().slice(0, 16)
}

function Login({ onEnter }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const member = await verifyMemberAccess(name, code)
      onEnter(member)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="brand-mark">P</div>
        <span className="eyebrow lime">PICKLIMB ATTENDANCE</span>
        <h1>같이 움직인<br />순간을 기록해요.</h1>
        <p>피클즈 운동 일정의 참석 현황을 한눈에 확인하세요.</p>
        <div className="intro-line" />
        <p className="intro-note">이 페이지는 피클즈 멤버 전용입니다.</p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <span className="eyebrow">MEMBER ACCESS</span>
          <h2>출석 현황 입장</h2>
          <p className="muted">성함과 참여코드를 입력해 주세요.</p>
          <form onSubmit={submit}>
            <label htmlFor="name">성함</label>
            <input id="name" autoComplete="name" placeholder="예: 김피클" value={name} onChange={(event) => setName(event.target.value)} />
            <label htmlFor="code">참여코드</label>
            <input id="code" type="password" placeholder="참여코드 입력" value={code} onChange={(event) => setCode(event.target.value)} />
            {error && <p className="form-error">{error}</p>}
            <button className="button primary" disabled={submitting} type="submit">
              {submitting ? '확인 중...' : '입장하기'} <span>→</span>
            </button>
          </form>
          <p className="help-text">참여코드를 모르겠다면 운영진에게 문의해 주세요.</p>
        </div>
      </section>
    </main>
  )
}

function EventForm({ onClose, onSaved }) {
  const [title, setTitle] = useState('피클즈 운동')
  const [startsAt, setStartsAt] = useState(toDateTimeLocal(new Date(Date.now() + 86_400_000)))
  const [place, setPlace] = useState('')
  const [kakaoUrl, setKakaoUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    await saveEvent({ title, startsAt: new Date(startsAt).toISOString(), place, kakaoUrl })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label="일정 추가" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="닫기">×</button>
        <span className="eyebrow">NEW EVENT</span>
        <h2>운동 일정 만들기</h2>
        <form onSubmit={submit}>
          <label htmlFor="eventTitle">일정 이름</label>
          <input id="eventTitle" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <label htmlFor="eventDate">일시</label>
          <input id="eventDate" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
          <label htmlFor="place">장소</label>
          <input id="place" value={place} onChange={(event) => setPlace(event.target.value)} placeholder="예: 잠실 한강공원" />
          <label htmlFor="kakaoUrl">카카오톡 캘린더 링크 <em>(선택)</em></label>
          <input id="kakaoUrl" type="url" value={kakaoUrl} onChange={(event) => setKakaoUrl(event.target.value)} placeholder="https://calendar.kakao.com/..." />
          <button className="button primary" disabled={saving}>{saving ? '저장 중...' : '일정 저장하기'}</button>
        </form>
      </section>
    </div>
  )
}

function Dashboard({ member, onExit }) {
  const [data, setData] = useState({ events: [], members: [], attendance: [] })
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [search, setSearch] = useState('')
  const [showEventForm, setShowEventForm] = useState(false)
  const [toast, setToast] = useState('')

  const refresh = async () => {
    setLoading(true)
    const dashboard = await getDashboard()
    setData(dashboard)
    setSelectedEvent((current) => dashboard.events.find((item) => item.id === current?.id) || dashboard.events[0] || null)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  const eventAttendance = useMemo(
    () => data.attendance.filter((item) => item.eventId === selectedEvent?.id),
    [data.attendance, selectedEvent],
  )
  const attendedIds = new Set(eventAttendance.map((item) => item.memberId))
  const visibleMembers = data.members.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()))
  const alreadyCheckedIn = selectedEvent && attendedIds.has(member.id)

  const checkIn = async (targetMember = member) => {
    if (!selectedEvent) return
    await markAttendance({ event: selectedEvent, member: targetMember })
    setToast(`${targetMember.name} 님의 출석을 기록했어요.`)
    await refresh()
    window.setTimeout(() => setToast(''), 2500)
  }

  const attendanceRate = data.members.length ? Math.round((eventAttendance.length / data.members.length) * 100) : 0

  return (
    <div className="dashboard">
      <header className="topbar">
        <a className="wordmark" href="#top"><span>P</span> PICKLIMB</a>
        <nav><a href="#attendance">출석 현황</a><a href="#members">멤버</a></nav>
        <div className="profile"><span className="avatar">{member.name.slice(0, 1)}</span><span>{member.name}</span><button onClick={onExit}>나가기</button></div>
      </header>

      <main id="top" className="content">
        <section className="hero">
          <div>
            <span className="eyebrow lime">PICKLIMB ATTENDANCE</span>
            <h1>오늘의 움직임,<br /><i>함께</i> 남겨요.</h1>
            <p>참석을 확인하고, 피클즈의 운동 기록을 쌓아보세요.</p>
          </div>
          <div className="hero-stats">
            <span>이번 일정</span>
            <strong>{eventAttendance.length}<small>명</small></strong>
            <p>참석 완료</p>
          </div>
        </section>

        <section className="section-head" id="attendance">
          <div><span className="eyebrow">SCHEDULE</span><h2>운동 일정</h2></div>
          {member.isAdmin && <button className="button dark" onClick={() => setShowEventForm(true)}>+ 일정 추가</button>}
        </section>

        <div className="schedule-layout">
          <div className="event-list">
            {loading && <div className="empty">일정을 불러오는 중이에요.</div>}
            {!loading && data.events.map((event) => {
              const count = data.attendance.filter((entry) => entry.eventId === event.id).length
              return <button key={event.id} className={`event-item ${event.id === selectedEvent?.id ? 'selected' : ''}`} onClick={() => setSelectedEvent(event)}>
                <time><b>{new Date(event.startsAt).getDate()}</b><span>{formatDate(event.startsAt, { month: 'short' }).replace('.', '')}</span></time>
                <span className="event-info"><b>{event.title}</b><small>{formatDate(event.startsAt, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · {event.place || '장소 미정'}</small></span>
                <span className="count-bubble">{count}</span>
              </button>
            })}
            {!loading && !data.events.length && <div className="empty">아직 등록된 일정이 없어요.<br />첫 운동 일정을 추가해 보세요.</div>}
          </div>

          {selectedEvent && <aside className="event-detail">
            <span className="eyebrow">SELECTED EVENT</span>
            <h3>{selectedEvent.title}</h3>
            <p className="event-when">{formatDate(selectedEvent.startsAt, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: 'numeric', minute: '2-digit' })}</p>
            <p className="event-place">⌖ {selectedEvent.place || '장소 미정'}</p>
            {selectedEvent.kakaoUrl && <a className="kakao-link" target="_blank" rel="noreferrer" href={selectedEvent.kakaoUrl}>카카오 캘린더에서 보기 ↗</a>}
            <div className="attendance-total"><span>현재 참석</span><strong>{eventAttendance.length}<small>명</small></strong><div><i style={{ width: `${attendanceRate}%` }} /></div><small>전체 멤버 {data.members.length}명 중 {attendanceRate}%</small></div>
            <button className={`button ${alreadyCheckedIn ? 'confirmed' : 'primary'}`} onClick={() => checkIn()} disabled={alreadyCheckedIn}>{alreadyCheckedIn ? '✓ 출석 확인 완료' : '내 출석 확인하기'}</button>
          </aside>}
        </div>

        <section className="members-section" id="members">
          <div className="section-head">
            <div><span className="eyebrow">MEMBERS</span><h2>멤버 출석 현황</h2><p>마지막 참여일 기준으로 정렬됩니다.</p></div>
            <label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름으로 찾기" /></label>
          </div>
          <div className="member-table">
            <div className="member-row table-label"><span>멤버</span><span>운동 참여</span><span>마지막 참여일</span><span>선택 일정</span></div>
            {visibleMembers.map((item) => {
              const inSelected = attendedIds.has(item.id)
              return <div className="member-row" key={item.id}>
                <span className="member-name"><b className="avatar large">{item.name.slice(0, 1)}</b><b>{item.name}</b></span>
                <span><b>{item.attendanceCount || 0}회</b></span>
                <span>{item.lastAttendanceAt ? formatDate(item.lastAttendanceAt, { year: 'numeric', month: 'short', day: 'numeric' }) : '아직 없음'}</span>
                <span>{inSelected ? <em className="present">참석</em> : member.isAdmin ? <button className="attendance-action" onClick={() => checkIn(item)}>출석 처리</button> : <em className="absent">미확인</em>}</span>
              </div>
            })}
            {!visibleMembers.length && <div className="empty">검색 결과가 없어요.</div>}
          </div>
        </section>
      </main>
      <footer>© PICKLIMB · 함께, 꾸준히.</footer>
      {showEventForm && <EventForm onClose={() => setShowEventForm(false)} onSaved={refresh} />}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}

function App() {
  const [member, setMember] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('picklimb-member')) } catch { return null }
  })
  const enter = (nextMember) => { sessionStorage.setItem('picklimb-member', JSON.stringify(nextMember)); setMember(nextMember) }
  const exit = () => { sessionStorage.removeItem('picklimb-member'); setMember(null) }
  return member ? <Dashboard member={member} onExit={exit} /> : <Login onEnter={enter} />
}

export default App
