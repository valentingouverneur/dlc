import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Calendar from './pages/Calendar';
import Products from './pages/Products';
import Scanner from './pages/Scanner';
import ProductDetails from './pages/ProductDetails';
import Affiches from './pages/Affiches';
import TestDashboard from './pages/TestDashboard';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Modal from './components/Modal';
import FloatingScannerButton from './components/FloatingScannerButton';
import MobileBlurEffect from './components/MobileBlurEffect';

function App() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleProductAdded = () => {
    setIsScannerOpen(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 overflow-x-hidden">
        {/* Sidebar pour desktop */}
        <Sidebar />
        
        {/* Contenu principal avec marge pour le sidebar */}
        <div className="md:ml-16 pb-20 md:pb-0 w-full max-w-full overflow-x-hidden">
          <div className="w-full px-2 sm:px-4 py-8 max-w-full min-w-0">
            <Routes>
              <Route path="/" element={<Calendar key={refreshKey} />} />
              <Route path="/products" element={<Products key={refreshKey} />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/affiches" element={<Affiches key={refreshKey} />} />
              <Route path="/test" element={<TestDashboard />} />
            </Routes>
          </div>
        </div>

        <MobileBlurEffect />

        {/* Bottom nav pour mobile */}
        <BottomNav onScannerClick={() => setIsScannerOpen(true)} />

        <Modal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          title="Scanner un produit"
        >
          <Scanner onClose={handleProductAdded} />
        </Modal>
      </div>
    </Router>
  );
}

export default App;
