import { Navigate, Route, Routes } from 'react-router-dom';
import { StoreApp } from './features/home/StoreApp';
import { SAMPLE_STORE_SLUG } from '@mithra/domain';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${SAMPLE_STORE_SLUG}`} replace />} />
      <Route path="/:storeSlug/*" element={<StoreApp />} />
    </Routes>
  );
}
