import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Home } from './pages/Home';
import { prefetchMonthlyRecords } from './utils/gas';
import './App.css';

type Page = 'home' | 'history' | 'monthly';

const loadHistory = () => import('./pages/History');
const loadMonthly = () => import('./pages/Monthly');

const History = lazy(() => loadHistory().then((module) => ({ default: module.History })));
const Monthly = lazy(() => loadMonthly().then((module) => ({ default: module.Monthly })));

const getCurrentMonthKey = () => new Date().toLocaleDateString('sv-SE').slice(0, 7);

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  const prefetchSecondaryViews = useCallback(() => {
    void loadHistory();
    void loadMonthly();
    void prefetchMonthlyRecords(getCurrentMonthKey());
  }, []);

  useEffect(() => {
    const runPrefetch = () => prefetchSecondaryViews();
    const requestIdle = window.requestIdleCallback;
    const cancelIdle = window.cancelIdleCallback;

    if (typeof requestIdle === 'function' && typeof cancelIdle === 'function') {
      const idleId = requestIdle(runPrefetch, { timeout: 2000 });
      return () => cancelIdle(idleId);
    }

    const timeoutId = window.setTimeout(runPrefetch, 1200);
    return () => window.clearTimeout(timeoutId);
  }, [prefetchSecondaryViews]);

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
          onFocus={prefetchSecondaryViews}
          onPointerEnter={prefetchSecondaryViews}
          title="履歴"
        >
          <span className="nav-icon">📋</span>
          <span className="nav-label">履歴</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'monthly' ? 'active' : ''}`}
          onClick={() => setCurrentPage('monthly')}
          onFocus={prefetchSecondaryViews}
          onPointerEnter={prefetchSecondaryViews}
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
