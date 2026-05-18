import { useState } from 'react';
import { Home } from './pages/Home';
import { Monthly } from './pages/Monthly';
import './App.css';

type Page = 'home' | 'monthly';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  return (
    <div className="app">
      <div className="app-content">
        {currentPage === 'home' ? <Home /> : <Monthly />}
      </div>
      <nav className="app-nav">
        <button
          className={`nav-item ${currentPage === 'home' ? 'active' : ''}`}
          onClick={() => setCurrentPage('home')}
        >
          <span className="nav-icon">⏱</span>
          <span className="nav-label">打刻</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'monthly' ? 'active' : ''}`}
          onClick={() => setCurrentPage('monthly')}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-label">月合計</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
