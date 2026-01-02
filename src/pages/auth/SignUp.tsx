import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification 
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import imageCompression from 'browser-image-compression';
import logo from '../../assets/images/logo.png';

const SignUp: React.FC = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false
  });
  const [profileImage, setProfileImage] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Convert file to Data URL
  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  };

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 400,
      useWebWorker: true,
    };
    return await imageCompression(file, options);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError("Please select a valid image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image size should be less than 2MB");
      return;
    }

    try {
      const compressedFile = await compressImage(file);
      const dataURL = await fileToDataURL(compressedFile);
      
      setImagePreview(dataURL);
      setProfileImage(dataURL);
      setError("");
    } catch (error) {
      console.error('Error processing image:', error);
      setError("Failed to process image");
    }
  };

  const checkExistingUser = async (email: string): Promise<boolean> => {
    try {
      // Check if any user document has this email
      const querySnapshot = await getDoc(doc(db, "users", email.toLowerCase()));
      return querySnapshot.exists();
    } catch (error) {
      console.error('Error checking existing user:', error);
      return false;
    }
  };

  const createUserProfile = async (userId: string, profileImageData: string) => {
    try {
      await setDoc(doc(db, "users", userId), {
        name: formData.name,
        email: formData.email.toLowerCase(),
        phone: formData.phone || null,
        profileImage: profileImageData,
        role: "user",
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    if (!formData.acceptTerms) {
      setError("Please accept the Terms of Service and Privacy Policy");
      setLoading(false);
      return;
    }

    if (!formData.name.trim()) {
      setError("Please enter your full name");
      setLoading(false);
      return;
    }

    try {
      // Check if user might already exist
      const userExists = await checkExistingUser(formData.email);
      if (userExists) {
        setError('Email already exists. Please proceed to login.');
        setLoading(false);
        return;
      }

      // 1. Create user in Firebase Auth
      const { user } = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );

      // 2. Update user profile in Auth with display name
      await updateProfile(user, {
        displayName: formData.name,
        //photoURL: profileImage // Store data URL as photoURL
      });

      // 3. Create user document in Firestore with profile image data
      await createUserProfile(user.uid, profileImage);

      // 4. Send email verification
      await sendEmailVerification(user);

      // 5. Show verification modal
      setShowVerificationModal(true);

    } catch (err: any) {
      console.error('Signup error:', err);
      
      // Handle specific Firebase errors
      if (err.code === 'auth/email-already-in-use') {
        setError('Email already exists. Please proceed to login.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak.');
      } else {
        setError(err.message || "An unexpected error occurred during signup.");
      }
    } finally {
      setLoading(false);
    }
  };

  const openEmailClient = () => {
    window.open('mailto:', '_blank');
  };

  const resendVerificationEmail = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        await sendEmailVerification(user);
        setError("✅ Verification email resent successfully!");
      } else {
        setError("No user found. Please try signing up again.");
      }
    } catch (err: any) {
      setError("Failed to resend verification email: " + err.message);
    }
  };

  const handleModalClose = () => {
    setShowVerificationModal(false);
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-[#F4F1E8] flex flex-col justify-center py-8 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img 
            src={logo} 
            alt="Campus GOSTOREz" 
            className="h-32 w-auto"
          />
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold text-[#9B4819]">
          Join Campus GOSTOREz
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Create your account to start your campus journey
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 px-6 shadow-lg rounded-lg sm:px-8 border border-gray-100">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Profile Picture */}
            <div className="text-center">
              <div className="flex flex-col items-center">
                <div className="relative inline-block">
                  <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100">
                    {imagePreview ? (
                      <img 
                        src={imagePreview} 
                        alt="Profile preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <label htmlFor="profileImage" className="absolute bottom-0 right-0 bg-[#9B4819] text-white p-1 rounded-full cursor-pointer shadow-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <input
                      id="profileImage"
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Add a profile picture (optional)
                </p>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name *
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2.5 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 text-sm"
                  placeholder="Enter your full name"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address *
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
                  className="appearance-none block w-full px-3 py-2.5 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 text-sm"
                  placeholder="your.email@university.edu"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <div className="mt-1">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2.5 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 text-sm"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 text-sm"
                  placeholder="At least 6 characters"
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password *
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 text-sm"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start">
              <input
                id="acceptTerms"
                name="acceptTerms"
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={handleChange}
                className="h-4 w-4 text-[#9B4819] focus:ring-[#9B4819] border-gray-300 rounded mt-0.5"
              />
              <label htmlFor="acceptTerms" className="ml-2 block text-sm text-gray-700">
                I agree to the{" "}
                <a href="/terms" className="text-[#9B4819] hover:text-[#7a3914] font-medium">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" className="text-[#9B4819] hover:text-[#7a3914] font-medium">
                  Privacy Policy
                </a>
              </label>
            </div>

            {/* Error Display */}
            {error && (
              <div className="rounded-md bg-red-50 p-3 border border-red-200">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-red-700 font-medium">{error}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#9B4819] hover:bg-[#7a3914] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#9B4819] transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating Account...
                  </div>
                ) : (
                  "Create Account"
                )}
              </button>
            </div>

            {/* Sign In Link */}
            <div className="text-center pt-2">
              <span className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link
                  to="/signin"
                  className="font-medium text-[#9B4819] hover:text-[#7a3914] transition duration-150 ease-in-out"
                >
                  Sign in here
                </Link>
              </span>
            </div>
          </form>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            By joining, you agree to our community guidelines
          </p>
        </div>
      </div>

      {/* Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Verify Your Email
              </h3>
              
              <p className="text-gray-600 mb-4">
                We've sent a verification link to <strong>{formData.email}</strong>. 
                Please check your email <strong>or spam folder</strong> and click the link to verify your account.
              </p>

              <div className="space-y-3">
                <button
                  onClick={openEmailClient}
                  className="w-full bg-[#9B4819] text-white py-2.5 px-4 rounded-lg font-medium hover:bg-[#7a3914] transition duration-150"
                >
                  📧 Open Email App
                </button>
                
                <button
                  onClick={resendVerificationEmail}
                  className="w-full border border-[#9B4819] text-[#9B4819] py-2.5 px-4 rounded-lg font-medium hover:bg-[#9B4819] hover:text-white transition duration-150"
                >
                  ↻ Resend Verification Email
                </button>
                
                <button
                  onClick={handleModalClose}
                  className="w-full border border-gray-300 text-gray-700 py-2.5 px-4 rounded-lg font-medium hover:bg-gray-50 transition duration-150"
                >
                  Continue to Sign In
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                After verification, you can sign in to your account
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignUp;