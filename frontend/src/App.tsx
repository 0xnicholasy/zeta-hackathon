import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense } from 'react';
import { appRoutes } from './config/routes';

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
                  <div className="text-lg">Loading...</div>
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
