import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Calendar from './pages/Calendar';
import Products from './pages/Products';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <Routes>
          <Route path="/" element={<Calendar />} />
          <Route path="/products" element={<Products />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
