import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Calendar from './pages/Calendar';
import Products from './pages/Products';
import Modal from './components/Modal';
import Scanner from './pages/Scanner';

const App: React.FC = () => {
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <Routes>
          <Route path="/" element={<Calendar />} />
          <Route path="/products" element={<Products />} />
        </Routes>

        {/* Bouton flottant */}
        <button
          onClick={() => setIsScannerOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 rounded-full shadow-lg flex items-center justify-center text-white hover:bg-blue-700 hover:scale-110 transition-all duration-200 z-50 cursor-pointer"
          aria-label="Scanner un produit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11V3m0 0H8m4 0h4M4 12h2m6 0h2m-6 0H8m0 0V8m0 4v4" />
          </svg>
        </button>

        {/* Modal du scanner */}
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
};

export default App;
