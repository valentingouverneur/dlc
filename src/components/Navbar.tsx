import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-14">
          <div className="flex items-center">
            <Link to="/" className="text-gray-800 text-lg font-semibold">
              DLC Watcher
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              to="/products"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                location.pathname === '/products'
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Produits
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 