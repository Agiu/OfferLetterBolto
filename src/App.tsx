import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { OffersProvider } from './data/OffersContext';
import { OffersPage } from './pages/OffersPage/OffersPage';
import { OfferSetupPage } from './pages/OfferSetupPage/OfferSetupPage';
import { ReviewPage } from './pages/ReviewPage/ReviewPage';
import { ChangeTemplatePage, TemplateSetupPage } from './pages/TemplateSetupPage/TemplateSetupPage';

export function App() {
  return (
    <BrowserRouter>
      <OffersProvider>
        <Routes>
          <Route path="/" element={<OffersPage />} />
          <Route path="/offers/new/:candidateId" element={<TemplateSetupPage />} />
          <Route path="/offers/:offerId/template" element={<ChangeTemplatePage />} />
          <Route path="/offers/:offerId/setup" element={<OfferSetupPage />} />
          <Route path="/offers/:offerId/review" element={<ReviewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </OffersProvider>
    </BrowserRouter>
  );
}
