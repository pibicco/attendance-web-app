import { Suspense, lazy, useState } from 'react';
import { Home } from './pages/Home';
import './App.css';

type Page = 'home' | 'history' | 'monthly';

const History = lazy(() =>
  import('./pages/History').then((module) => ({ default: module.History }))
);
const Monthly = lazy(() =>
  import('./pages/Monthly').then((module) => ({ default: module.Monthly }))
);

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  const renderCurrentPage = () => {
    if (currentPage === 'home') {
      return <Home />;
    }

    return (
      <Suspense fallback={<div className="page-loading">読み込み中...</div>}>
        {currentPage === 'history' ? <History /> : <Monthly />}
      </Suspense>
    );
  };

  return (
    <div className="app">
      <div className="app-content">
        {renderCurrentPage()}
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
