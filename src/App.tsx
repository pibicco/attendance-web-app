import { useState } from 'react';
import { Home } from './pages/Home';
import { History } from './pages/History';
import { Monthly } from './pages/Monthly';
import { Settings } from './pages/Settings';
import './App.css';

type Page = 'home' | 'history' | 'monthly' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home />;
      case 'history':
        return <History />;
      case 'monthly':
        return <Monthly />;
      case 'settings':
        return <Settings />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="app">
      <div className="app-content">{renderPage()}</div>
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
        <button
          className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentPage('settings')}
          title="設定"
        >
          <span className="nav-icon">⚙️</span>
          <span className="nav-label">設定</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
