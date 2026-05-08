import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { Building2, Copy, AlertTriangle, Loader2, X, CheckCircle, RefreshCw } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

interface TemporalAccountData {
  reference: string;
  amount: number;
  account_number?: string;
  bank_name?: string;
  account_name?: string;
  authorization_url?: string;
}

const TemporalAccount: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState('');
  const [temporalData, setTemporalData] = useState<TemporalAccountData | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pollingReference, setPollingReference] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<string>('');
  const [paymentOpened, setPaymentOpened] = useState(false);

  // Check for success param after redirect
  useEffect(() => {
    if (searchParams.get('deposit_success') === 'true') {
      setSuccess('Your deposit is being processed. It will reflect in a few minutes.');
    }
  }, [searchParams]);

  // Fetch user data
  const fetchUserData = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('firebase_uid', uid)
        .single();

      if (error) throw error;
      if (data) {
        setUserId(data.id);
        setUserName(data.name || 'User');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/signin');
        return;
      }
      fetchUserData(user.uid);
    });
    return () => unsubscribe();
  }, [navigate, fetchUserData]);

  // Poll for deposit status
  useEffect(() => {
    if (!pollingReference) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/temporal-account/status/${pollingReference}`);
        const data = await res.json();
        if (data.status === 'completed') {
          setPollingStatus('completed');
          setSuccess(`Deposit of ₦${data.amount.toLocaleString()} completed!`);
          setTemporalData(null);
          setPollingReference(null);
          clearInterval(interval);
        } else if (data.status === 'pending') {
          setPollingStatus('pending');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pollingReference]);

  // Auto-open payment page once temporalData is available
  useEffect(() => {
    if (temporalData?.authorization_url && !paymentOpened) {
      setPaymentOpened(true);
      window.open(temporalData.authorization_url, '_blank');
    }
  }, [temporalData, paymentOpened]);

  const handleInitialize = async () => {
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (amountNum < 100) {
      setError('Minimum deposit is ₦100');
      return;
    }

    setIsInitializing(true);
    setError('');
    setSuccess('');
    setPaymentOpened(false);

    try {
      const res = await fetch(`${API_BASE_URL}/api/temporal-account/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, amount: amountNum }),
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      setTemporalData({
        reference: data.reference,
        amount: data.amount,
        account_number: data.account_details?.account_number,
        bank_name: data.account_details?.bank_name,
        account_name: data.account_details?.account_name,
        authorization_url: data.authorization_url,
      });
      setPollingReference(data.reference);
      setPollingStatus('pending');
    } catch (err: any) {
      setError(err.message || 'Failed to initialize deposit');
    } finally {
      setIsInitializing(false);
    }
  };

  const copyAccountNumber = () => {
    if (temporalData?.account_number) {
      navigator.clipboard.writeText(temporalData.account_number);
      setSuccess('Account number copied!');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  const resetForm = () => {
    setTemporalData(null);
    setDepositAmount('');
    setPollingReference(null);
    setPollingStatus('');
    setPaymentOpened(false);
  };

  if (loading) {
    return (
      <div className="marketplace-loading">
        <RefreshCw className="animate-spin" size={32} />
        <div className="loading-text">Loading...</div>
      </div>
    );
  }

  return (
    <div className="money-container">
      {/* Welcome Header */}
      <div className="money-balance-card" style={{ marginBottom: '12px' }}>
        <div className="money-balance-total">
          <span className="money-balance-label">One‑Time Deposit</span>
          <span className="money-balance-amount">
            <Building2 size={16} style={{ marginRight: '6px' }} />
            Temporary Virtual Account
          </span>
        </div>
        <div className="money-balance-label" style={{ fontSize: '12px', marginTop: '4px' }}>
          Welcome, {userName}
        </div>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="money-error">
          <AlertTriangle size={12} />
          <span>{error}</span>
          <button onClick={() => setError('')}><X size={12} /></button>
        </div>
      )}
      {success && (
        <div className="money-success">
          <CheckCircle size={12} />
          <span>{success}</span>
          <button onClick={() => setSuccess('')}><X size={12} /></button>
        </div>
      )}

      {!temporalData ? (
        // Initial form
        <div className="money-deposit">
          <div className="money-warning">
            <AlertTriangle size={14} />
            <span>You will get a one‑time account number. Pay exactly the amount you enter.</span>
          </div>
          <div className="money-form-group">
            <label>Amount (₦)</label>
            <input
              type="number"
              placeholder="Enter amount (min ₦100)"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              disabled={isInitializing}
            />
          </div>
          <button className="money-submit-btn" onClick={handleInitialize} disabled={isInitializing}>
            {isInitializing ? <Loader2 className="money-spinner" size={14} /> : 'Generate Temporary Account'}
          </button>
        </div>
      ) : (
        // Display temporary account details
        <div className="money-balance-card">
          <div className="money-balance-breakdown" style={{ flexDirection: 'column', gap: '8px' }}>
            <div className="money-breakdown-item" style={{ justifyContent: 'space-between' }}>
              <span>Bank:</span>
              <strong>{temporalData.bank_name || 'Paystack-Titan'}</strong>
            </div>
            <div className="money-breakdown-item" style={{ justifyContent: 'space-between' }}>
              <span>Account Number:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong>{temporalData.account_number || 'Generating...'}</strong>
                {temporalData.account_number && (
                  <button onClick={copyAccountNumber} className="money-submit-btn" style={{ padding: '2px 8px', fontSize: '10px', width: 'auto' }}>
                    <Copy size={12} /> Copy
                  </button>
                )}
              </div>
            </div>
            <div className="money-breakdown-item" style={{ justifyContent: 'space-between' }}>
              <span>Account Name:</span>
              <strong>{temporalData.account_name || userName}</strong>
            </div>
            <div className="money-breakdown-item" style={{ justifyContent: 'space-between' }}>
              <span>Amount to Pay:</span>
              <strong>₦{temporalData.amount.toLocaleString()}</strong>
            </div>
            <div className="money-warning" style={{ marginTop: '8px', backgroundColor: '#fef3c7', color: '#d97706' }}>
              <AlertTriangle size={12} />
              <span>This account is valid for one payment only. Send the exact amount.</span>
            </div>
            {pollingStatus === 'pending' && (
              <div className="money-warning" style={{ marginTop: '8px', backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                <Loader2 size={12} className="money-spinner" />
                <span>Waiting for payment confirmation...</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button className="money-submit-btn" onClick={resetForm}>
                New Deposit
              </button>
              {/* Removed the manual "Open Payment Page" button – it auto-opens */}
            </div>
          </div>
        </div>
      )}

      {/* Bottom spacer */}
      <div style={{ height: '30px' }}></div>
    </div>
  );
};

export default TemporalAccount;