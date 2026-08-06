import { Navigate, Route, Routes } from 'react-router-dom';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { OrdersPage } from './features/orders/OrdersPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/onboarding" replace />} />
      <Route path="/onboarding/*" element={<OnboardingPage />} />
      <Route path="/orders" element={<OrdersPage />} />
    </Routes>
  );
}
