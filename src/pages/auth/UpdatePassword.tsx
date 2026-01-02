import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import logo from '../../assets/images/logo.png';

const UpdatePassword: React.FC = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Password updated successfully!");
      setTimeout(() => navigate("/signin"), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F1E8] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-[#9B4819] text-center mb-6">
          Set New Password
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border rounded focus:ring-[#9B4819] focus:border-[#9B4819]"
              required
            />
          </div>
          
          <div>
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 border rounded focus:ring-[#9B4819] focus:border-[#9B4819]"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-500 text-sm">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#9B4819] text-white p-3 rounded hover:bg-[#7a3914] disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UpdatePassword;