import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from './lib/firebase';
import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";
import UpdatePassword from "./pages/auth/UpdatePassword";
import ResetPassword from "./pages/auth/ResetPassword";
import PrivateRoute from './components/PrivateRoute';
import VendorDashboard from './components/vendor/dashboard/VendorDashboard';
import TermsOfService from "./pages/legal/TermsOfService";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import VendorOnboarding from './components/vendor/VendorOnboarding';
import AddProductForm from './components/vendor/AddProductForm';
import UserDashboard from './components/user/UserDashboard';
import logo from './assets/images/logo.png';
import Marketplace from './components/market/Marketplace';
import VendorShop from './components/vendor-shop/VendorShop';
import CartPage from './components/market/CartPage'; 
import ChatList from "./components/ChatList";
import ChatRoom from "./components/ChatRoom";
import FavoritesPage from './components/market/FavoritesPage';


// Welcome Page Component
const WelcomePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is logged in, redirect to dashboard immediately
        navigate('/market');
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F4F1E8] to-[#E8E4D8] flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <img 
              src={logo} 
              alt="Campus GOSTOREz" 
              className="h-24 w-auto animate-pulse"
            />
          </div>
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-[#9B4819] font-medium">Loading your campus experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F4F1E8] to-[#E8E4D8]">
      {/* Navigation */}
      <nav className="px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <img 
              src={logo} 
              alt="Campus GOSTOREz" 
              className="h-12 w-auto"
            />
            <span className="text-2xl font-bold text-[#9B4819]">GOSTOREz</span>
          </div>
          <div className="flex space-x-4">
            <button 
              onClick={() => navigate('/signin')}
              className="px-6 py-2 text-[#9B4819] font-medium hover:text-[#7a3914] transition duration-150"
            >
              Sign In
            </button>
            <button 
              onClick={() => navigate('/signup')}
              className="px-6 py-2 bg-[#9B4819] text-white rounded-lg hover:bg-[#7a3914] transition duration-150 font-medium"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            Your Campus
            <span className="block text-[#9B4819]">Marketplace</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Buy, sell, and connect with your campus community. Everything you need, right at your fingertips.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <button 
              onClick={() => navigate('/signup')}
              className="px-8 py-4 bg-[#9B4819] text-white text-lg font-semibold rounded-xl hover:bg-[#7a3914] transition duration-150 transform hover:scale-105 shadow-lg"
            >
              🚀 Start Your Journey
            </button>
            <button 
              onClick={() => navigate('/signin')}
              className="px-8 py-4 border-2 border-[#9B4819] text-[#9B4819] text-lg font-semibold rounded-xl hover:bg-[#9B4819] hover:text-white transition duration-150"
            >
              Welcome Back
            </button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/20">
              <div className="text-4xl mb-4">🛍️</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Campus Shopping</h3>
              <p className="text-gray-600">Discover unique items from fellow students and local campus businesses.</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/20">
              <div className="text-4xl mb-4">🏪</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Start Selling</h3>
              <p className="text-gray-600">Turn your passion into profit with your own campus shop in minutes.</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/20">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Community First</h3>
              <p className="text-gray-600">Connect, trade, and grow with your campus community safely.</p>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 max-w-4xl mx-auto shadow-lg border border-white/20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-[#9B4819]">500+</div>
                <div className="text-gray-600">Active Students</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-[#9B4819]">200+</div>
                <div className="text-gray-600">Campus Shops</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-[#9B4819]">1K+</div>
                <div className="text-gray-600">Products Listed</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-[#9B4819]">98%</div>
                <div className="text-gray-600">Satisfaction Rate</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <img src={logo} alt="Campus GOSTOREz" className="h-8 w-auto" />
              <span className="text-lg font-bold text-[#9B4819]">Campus GOSTOREz</span>
            </div>
            <div className="flex space-x-6 text-sm text-gray-600">
              <a href="/terms" className="hover:text-[#9B4819] transition duration-150">Terms</a>
              <a href="/privacy" className="hover:text-[#9B4819] transition duration-150">Privacy</a>
              <a href="mailto:support@campusgostorez.com" className="hover:text-[#9B4819] transition duration-150">Support</a>
            </div>
          </div>
          <div className="text-center md:text-left mt-4">
            <p className="text-xs text-gray-500">© 2024 Campus GOSTOREz. Connecting campus communities through commerce.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Main App Component
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<WelcomePage />} />

        <Route 
          path="/vendor/dashboard" 
          element={
            <PrivateRoute>
              <VendorDashboard />
            </PrivateRoute>
          } 
        />

        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/vendor-onboarding" element={<VendorOnboarding />} />
        <Route path="/vendor/add-product" element={<AddProductForm />} />
        <Route path="/user/dashboard" element={<UserDashboard />} />
        <Route path="/vendor/dashboard" element={<VendorDashboard />} />
        <Route path="/market" element={<Marketplace />} />
        <Route path="/vendor/:vendorId" element={<VendorShop />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/chats" element={<ChatList />} />
        <Route path="/chat/:roomId" element={<ChatRoom />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        
      </Routes>
    </Router>
  );
}

export default App;