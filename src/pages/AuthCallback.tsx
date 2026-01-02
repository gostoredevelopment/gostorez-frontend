import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        console.log('Auth callback triggered');
        
        // Get the URL parameters
        const urlParams = new URLSearchParams(window.location.hash.substring(1) + window.location.search);
        const token_hash = urlParams.get('token_hash');
        const type = urlParams.get('type');

        console.log('Token hash:', token_hash);
        console.log('Type:', type);

        if (token_hash && type === 'email') {
          // USE verifyEmail instead of verifyOtp
const { error } = await supabase.auth.verifyOtp({
  token_hash,
  type: 'email'
});

          if (error) {
            console.error('Email verification error:', error);
            navigate('/signin?error=verification_failed');
            return;
          }

          // SUCCESS - redirect to home
          console.log('Email verified successfully!');
          navigate('/?verified=true');
        } else {
          console.log('No valid token found');
          navigate('/signin?error=invalid_token');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/signin?error=unexpected_error');
      }
    };

    handleEmailVerification();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F4F1E8] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#9B4819] mx-auto mb-4"></div>
        <p className="text-gray-600">Verifying your email...</p>
      </div>
    </div>
  );
};

export default AuthCallback;