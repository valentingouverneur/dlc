import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Calendar from './pages/Calendar';
import Products from './pages/Products';
import Scanner from './pages/Scanner';
import ProductDetails from './pages/ProductDetails';
import Navbar from './components/Navbar';
import Modal from './components/Modal';
import FloatingScannerButton from './components/FloatingScannerButton';

function App() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Calendar />} />
            <Route path="/products" element={<Products />} />
            <Route path="/product/:id" element={<ProductDetails />} />
          </Routes>
        </div>
        <FloatingScannerButton onClick={() => setIsScannerOpen(true)} />

        <Modal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          title="Scanner un produit"
        >
          <Scanner onClose={() => setIsScannerOpen(false)} />
        </Modal>
      </div>
    </Router>
  );
}

export default App;
