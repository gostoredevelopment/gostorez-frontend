import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendEmailVerification
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import logo from '../../assets/images/logo.png';

const SignIn: React.FC = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState<any>(null);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const checkUserExistsInFirestore = async (email: string): Promise<boolean> => {
    try {
      // Check if user document exists in Firestore
      const userDoc = await getDoc(doc(db, "users", email.toLowerCase()));
      return userDoc.exists();
    } catch (error) {
      console.error('Error checking user in Firestore:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setShowVerificationPrompt(false);

    try {
      const { user } = await signInWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );

      // Check if email is verified
      if (!user.emailVerified) {
        setUnverifiedUser(user);
        setShowVerificationPrompt(true);
        setError('Please verify your email before signing in');
        await auth.signOut();
        setLoading(false);
        return;
      }

      // Success - redirect to home
      navigate('/');

    } catch (error: any) {
      console.error('Signin error:', error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (error.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else if (error.code === 'auth/wrong-password') {
        setError('Invalid password');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(error.message || "Failed to sign in");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      
      // First check if user exists in Firestore before allowing sign in
      const userExists = await checkUserExistsInFirestore(formData.email || "");
      
      if (!userExists && !formData.email) {
        setError('Please enter your email first to check if you have an existing account');
        setGoogleLoading(false);
        return;
      }

      if (!userExists) {
        setError('No existing account found with this email. Please sign up first.');
        setGoogleLoading(false);
        return;
      }

      const result = await signInWithPopup(auth, provider);
      
      // Google sign-in successful - redirect to home
      navigate('/');

    } catch (error: any) {
      console.error('Google signin error:', error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        setError('Sign in was cancelled');
      } else if (error.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for this site.');
      } else if (error.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for Google sign-in');
      } else {
        setError(error.message || "Failed to sign in with Google");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (unverifiedUser) {
      try {
        await sendEmailVerification(unverifiedUser);
        setError('✅ Verification email sent! Please check your inbox.');
        setShowVerificationPrompt(false);
      } catch (error: any) {
        setError('Failed to send verification email: ' + error.message);
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError('Please enter your email address first');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, formData.email);
      setError('✅ Password reset email sent! Check your inbox.');
    } catch (error: any) {
      setError('Failed to send reset email: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F1E8] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img 
            src={logo} 
            alt="Campus GOSTOREz" 
            className="h-48 w-auto"
          />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-[#9B4819]">
          Welcome back
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Sign in to your Campus GOSTOREz account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-[#9B4819] hover:text-[#7a3914] font-medium transition duration-150 ease-in-out"
                >
                  Forgot password?
                </button>
              </div>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-3 pr-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition duration-150 ease-in-out"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="rememberMe"
                  name="rememberMe"
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  className="h-4 w-4 text-[#9B4819] focus:ring-[#9B4819] border-gray-300 rounded"
                />
                <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>
            </div>

            {error && (
              <div className={`rounded-md p-4 ${error.includes('✅') ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center">
                  {error.includes('✅') ? (
                    <svg className="h-5 w-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className={`text-sm ${error.includes('✅') ? 'text-green-700' : 'text-red-700'}`}>{error}</span>
                </div>
              </div>
            )}

            {/* Verification Prompt */}
            {showVerificationPrompt && (
              <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-yellow-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm text-yellow-700 font-medium mb-2">
                      Email verification required
                    </p>
                    <p className="text-sm text-yellow-600 mb-3">
                      Please verify your email address before signing in. Check your inbox for the verification link.
                    </p>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-[#9B4819] hover:bg-[#7a3914] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#9B4819] transition duration-150"
                      >
                        ↻ Resend Verification Email
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowVerificationPrompt(false)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition duration-150"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#9B4819] hover:bg-[#7a3914] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#9B4819] transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>

            <div className="text-center">
              <span className="text-sm text-gray-600">
                Don't have an account?{" "}
                <Link
                  to="/signup"
                  className="font-medium text-[#9B4819] hover:text-[#7a3914] transition duration-150 ease-in-out"
                >
                  Sign up
                </Link>
              </span>
            </div>
          </form>
        </div>

        {/* Additional Features */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#F4F1E8] text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full inline-flex justify-center items-center py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>
                  Signing in...
                </div>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;