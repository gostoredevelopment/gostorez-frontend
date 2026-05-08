import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { Building2, Copy, AlertTriangle, Loader2, X, CheckCircle, RefreshCw } from 'lucide-react';

// API base URL – set REACT_APP_API_URL in your .env (e.g. http://localhost:3000 or https://your-backend.com)
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

interface VirtualAccountData {
  account_number: string;
  account_name: string;
  bank_name: string;
  created_at: string;
}

const VirtualAccount: React.FC = () => {
  const navigate = useNavigate();
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccountData | null>(null);
  const [showBvnModal, setShowBvnModal] = useState(false);
  const [bvnInput, setBvnInput] = useState('');
  const [generatingVA, setGeneratingVA] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);

  // ========== FETCH USER DATA FROM SUPABASE ==========
  const fetchUserData = useCallback(async (uid: string) => {
    console.log('💰 VirtualAccount: Fetching user data for UID:', uid);
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, phone, virtual_account_number, virtual_account_name, virtual_account_bank, virtual_account_created_at')
        .eq('firebase_uid', uid)
        .single();

      if (userError) {
        console.error('❌ VirtualAccount: Supabase error:', userError);
        throw userError;
      }

      if (!userData) {
        console.warn('⚠️ VirtualAccount: No user found in Supabase');
        setError('User profile not found. Please contact support.');
        setLoading(false);
        return;
      }

      console.log('✅ VirtualAccount: User data fetched:', userData);
      setUserId(userData.id);
      setUserName(userData.name || 'User');
      setUserPhone(userData.phone || '');

      if (userData.virtual_account_number && userData.virtual_account_name && userData.virtual_account_bank) {
        console.log('✅ VirtualAccount: Existing virtual account found:', userData.virtual_account_number);
        setVirtualAccount({
          account_number: userData.virtual_account_number,
          account_name: userData.virtual_account_name,
          bank_name: userData.virtual_account_bank,
          created_at: userData.virtual_account_created_at || new Date().toISOString()
        });
      } else {
        console.log('ℹ️ VirtualAccount: No virtual account found for user');
        setVirtualAccount(null);
      }
    } catch (err) {
      console.error('🔥 VirtualAccount: Error fetching user:', err);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  }, []);

  // ========== AUTH STATE LISTENER ==========
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔐 VirtualAccount: Auth state changed', user?.uid);
      if (!user) {
        console.log('🚪 VirtualAccount: No user logged in');
        setLoading(false);
        navigate('/signin');
        return;
      }
      setFirebaseUid(user.uid);
      await fetchUserData(user.uid);
    });
    return () => unsubscribe();
  }, [navigate, fetchUserData]);

  // ========== COPY ACCOUNT NUMBER ==========
  const copyAccountNumber = () => {
    if (virtualAccount?.account_number) {
      navigator.clipboard.writeText(virtualAccount.account_number);
      setSuccess('Copied!');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  // ========== GENERATE VIRTUAL ACCOUNT (LIVE PRODUCTION READY) ==========
  const handleGenerate = async () => {
    if (!bvnInput || bvnInput.length !== 11) {
      setError('Enter a valid 11-digit BVN');
      return;
    }

    setGeneratingVA(true);
    setError('');
    setSuccess('');

    try {
      const user = auth.currentUser;
      if (!user) {
        setError('Not logged in');
        return;
      }

      // Ensure we have user ID and phone
      let currentUserId = userId;
      let currentUserPhone = userPhone;
      if (!currentUserId) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, phone')
          .eq('firebase_uid', user.uid)
          .single();
        if (userError || !userData) {
          setError('User not found in database');
          return;
        }
        currentUserId = userData.id;
        currentUserPhone = userData.phone || '';
        setUserId(currentUserId);
        setUserPhone(currentUserPhone);
      }

      console.log('📡 VirtualAccount: Calling backend to create virtual account...');
      const nameParts = userName.split(' ');
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || 'Customer';

      // Use the phone number from Supabase (or fallback to Firebase phone number)
      const phoneToSend = currentUserPhone || user.phoneNumber || '';

      const response = await fetch(`${API_BASE_URL}/api/dedicated-account/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          first_name: firstName,
          last_name: lastName,
          phone: phoneToSend,
          bvn: bvnInput,
          user_id: currentUserId
        })
      });

      const result = await response.json();
      console.log('📡 VirtualAccount: Backend response:', result);

      if (result.success && result.account_number) {
        const newVirtualAccount = {
          account_number: result.account_number,
          account_name: result.account_name || `${firstName} ${lastName}`,
          bank_name: result.bank_name || 'Moniepoint',
          created_at: new Date().toISOString()
        };

        // Update Supabase users table
        const { error: updateError } = await supabase
          .from('users')
          .update({
            virtual_account_number: newVirtualAccount.account_number,
            virtual_account_name: newVirtualAccount.account_name,
            virtual_account_bank: newVirtualAccount.bank_name,
            virtual_account_created_at: newVirtualAccount.created_at,
            virtual_account_active: true
          })
          .eq('firebase_uid', user.uid);

        if (updateError) {
          console.error('❌ VirtualAccount: Failed to update Supabase:', updateError);
          setError('Account created but failed to save locally. Please refresh.');
        } else {
          setVirtualAccount(newVirtualAccount);
          setSuccess('Virtual account created successfully!');
          setShowBvnModal(false);
          setBvnInput('');
        }
      } else if (result.exists) {
        setError('Account already exists. Refreshing...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        // Improved error message from backend
        const backendMsg = result.error || result.message || 'Creation failed. Check backend logs.';
        setError(backendMsg);
      }
    } catch (err: any) {
      console.error('🔥 VirtualAccount: Generate error:', err);
      setError(err.message || `Network error. Unable to reach ${API_BASE_URL}`);
    } finally {
      setGeneratingVA(false);
    }
  };

  // ========== LOADING STATE ==========
  if (loading) {
    return (
      <div className="marketplace-loading">
        <RefreshCw className="animate-spin" size={32} />
        <div className="loading-text">Loading account details...</div>
      </div>
    );
  }

  // ========== RENDER ==========
  return (
    <div className="money-container">
      {/* Welcome Header */}
      <div className="money-balance-card" style={{ marginBottom: '12px' }}>
        <div className="money-balance-total">
          <span className="money-balance-label">Welcome, {userName || 'Guest'}</span>
          <span className="money-balance-amount">
            <Building2 size={16} style={{ marginRight: '6px' }} />
            Gostorez Virtual Account
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="money-error">
          <AlertTriangle size={12} />
          <span>{error}</span>
          <button onClick={() => setError('')}><X size={12} /></button>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="money-success">
          <CheckCircle size={12} />
          <span>{success}</span>
          <button onClick={() => setSuccess('')}><X size={12} /></button>
        </div>
      )}

      {/* Virtual Account Details OR Generate Button */}
      {virtualAccount ? (
        <div className="money-balance-card">
          <div className="money-balance-breakdown" style={{ flexDirection: 'column', gap: '8px' }}>
            <div className="money-breakdown-item" style={{ justifyContent: 'space-between' }}>
              <span>Bank:</span>
              <strong>{virtualAccount.bank_name}</strong>
            </div>
            <div className="money-breakdown-item" style={{ justifyContent: 'space-between' }}>
              <span>Account Number:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong>{virtualAccount.account_number}</strong>
                <button onClick={copyAccountNumber} className="money-submit-btn" style={{ padding: '2px 8px', fontSize: '10px', width: 'auto' }}>
                  <Copy size={12} /> Copy
                </button>
              </div>
            </div>
            <div className="money-breakdown-item" style={{ justifyContent: 'space-between' }}>
              <span>Account Name:</span>
              <strong>{virtualAccount.account_name}</strong>
            </div>
            <div className="money-breakdown-item" style={{ justifyContent: 'space-between' }}>
              <span>Created:</span>
              <small>{new Date(virtualAccount.created_at).toLocaleDateString()}</small>
            </div>
            <div className="money-warning" style={{ marginTop: '8px' }}>
              <AlertTriangle size={12} />
              <span>Transfer to this account to fund your wallet automatically</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="money-deposit">
          <div className="money-warning">
            <AlertTriangle size={14} />
            <span>No virtual account found. Click below to generate one.</span>
          </div>
          <button className="money-submit-btn" onClick={() => setShowBvnModal(true)} style={{ marginTop: '12px' }}>
            Generate Virtual Account
          </button>
        </div>
      )}

      {/* BVN Modal */}
      {showBvnModal && (
        <div className="money-modal-overlay" onClick={() => setShowBvnModal(false)}>
          <div className="money-modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>Identity Verification</h3>
              <button onClick={() => setShowBvnModal(false)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '13px', marginBottom: '16px', color: '#666' }}>
              BVN is required to generate your virtual account.
            </p>
            <div className="money-form-group">
              <label>Enter BVN (11 digits)</label>
              <input
                type="text"
                maxLength={11}
                placeholder="22123456789"
                value={bvnInput}
                onChange={(e) => setBvnInput(e.target.value.replace(/\D/g, ''))}
                disabled={generatingVA}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                className="money-submit-btn"
                style={{ background: '#ccc', color: '#333' }}
                onClick={() => setShowBvnModal(false)}
                disabled={generatingVA}
              >
                Cancel
              </button>
              <button
                className="money-submit-btn"
                onClick={handleGenerate}
                disabled={bvnInput.length !== 11 || generatingVA}
              >
                {generatingVA ? <Loader2 className="money-spinner" size={14} /> : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom spacer for bottom navigation */}
      <div style={{ height: '30px' }}></div>
    </div>
  );
};

export default VirtualAccount;