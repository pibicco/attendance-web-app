import { useState } from 'react';
import { Home } from './pages/Home';
import { History } from './pages/History';
import { Monthly } from './pages/Monthly';
import './App.css';

type Page = 'home' | 'history' | 'monthly';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  return (
    <div className="app">
      <div className="app-content">
        <div style={{ display: currentPage === 'home' ? 'block' : 'none' }}>
          <Home />
        </div>
        <div style={{ display: currentPage === 'history' ? 'block' : 'none' }}>
          <History />
        </div>
        <div style={{ display: currentPage === 'monthly' ? 'block' : 'none' }}>
          <Monthly />
        </div>
      </div>
      <nav className="app-nav">
        <button
          className={`nav-item ${currentPage === 'home' ? 'active' : ''}`}
          onClick={() => setCurrentPage('home')}
          title="ホーム"
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-label">ホーム</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'history' ? 'active' : ''}`}
          onClick={() => setCurrentPage('history')}
          title="履歴"
        >
          <span className="nav-icon">📋</span>
          <span className="nav-label">履歴</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'monthly' ? 'active' : ''}`}
          onClick={() => setCurrentPage('monthly')}
          title="月間集計"
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">集計</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
