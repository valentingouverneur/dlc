import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Calendar from './pages/Calendar';
import Products from './pages/Products';
import Scanner from './pages/Scanner';
import ProductDetails from './pages/ProductDetails';
import Affiches from './pages/Affiches';
import Navbar from './components/Navbar';
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
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Calendar key={refreshKey} />} />
            <Route path="/products" element={<Products key={refreshKey} />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/affiches" element={<Affiches key={refreshKey} />} />
          </Routes>
        </div>
        <MobileBlurEffect />
        {!isScannerOpen && (
          <FloatingScannerButton onClick={() => setIsScannerOpen(true)} />
        )}

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
