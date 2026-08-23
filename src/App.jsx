import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div>
          <span className="brand-label">PICKLIMB</span>
          <h1>피클즈 활동 관리</h1>
          <p>함께 움직이고, 꾸준히 기록합니다.</p>
        </div>
      </header>

      <main className="app-main">
        <section className="quarter-card">
          <div className="quarter-heading">
            <div>
              <span className="section-label">CURRENT QUARTER</span>
              <h2>2026년 3분기</h2>
            </div>

            <span className="status-badge success">
              기준 충족
            </span>
          </div>

          <p className="quarter-period">
            2026.07.01 — 2026.09.30
          </p>

          <div className="activity-summary">
            <div>
              <span>현재 활동</span>
              <strong>0회</strong>
            </div>

            <div>
              <span>분기 기준</span>
              <strong>1회 이상</strong>
            </div>
          </div>

          <button type="button" className="primary-button">
            + 출석 기록
          </button>
        </section>

        <section className="info-card">
          <span className="section-label">PICKLIMB RULE</span>
          <h2>분기별 활동 기준</h2>
          <p>
            매 분기 동안 피클즈 일정을 최소 1회 이상 생성하거나
            참여하면 활동 기준을 충족합니다.
          </p>
        </section>
      </main>
    </div>
  )
}

export default App