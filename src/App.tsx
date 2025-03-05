import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Calendar from './pages/Calendar';
import Products from './pages/Products';
import Scanner from './pages/Scanner';
import ProductDetails from './pages/ProductDetails';
import Navbar from './components/Navbar';
import Modal from './components/Modal';

function FloatingScannerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 w-14 h-14 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition-colors flex items-center justify-center"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11H6m2 0H4m10 0h2m-2 0v1m0 11v-1m0-11v1m-6 0v-1m0 11v-1m0 0h2m-2 0v-2m0 2v2m6-2v2m0-2v-2m0 0h-2m2 0v2m0-2v-2m-6 2v-2m0 2v2m6-2v2m0-2v-2m-6 2v-2m0 2v2" />
      </svg>
    </button>
  );
}

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
