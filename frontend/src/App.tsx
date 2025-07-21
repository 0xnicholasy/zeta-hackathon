import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense } from 'react';
import { appRoutes } from './config/routes';
import { Spinner } from './components/ui/spinner';

function App() {
  return (
    <Router>
      <Routes>
        {appRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen">
                  <Spinner variant="zeta" size="xl" text="Loading..." textPosition="bottom" />
                </div>
              }>
                <route.element />
              </Suspense>
            }
          />
        ))}
      </Routes>
    </Router>
  );
}

export default App
