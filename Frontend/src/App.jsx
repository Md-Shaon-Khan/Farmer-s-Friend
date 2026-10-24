// Frontend/src/App.jsx
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import DiseasePage from './pages/DiseasePage.jsx';
import ClassifyPage from './pages/ClassifyPage.jsx';
import { GROUPS } from './data/diseases.js';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="classify" element={<ClassifyPage />} />
        {GROUPS.map((g) => (
          <Route key={g.key} path={g.key} element={<DiseasePage group={g} />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}