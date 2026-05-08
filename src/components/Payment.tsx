import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { Loader, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import './Payment.css';

const Payment: React.FC = () => {
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const referenceFromUrl = searchParams.get('reference');
  const status = searchParams.get('status');

  // Get authenticated user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch Supabase user id from firebase_uid
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('firebase_uid', currentUser.uid)
          .single();
        if (!error && data) {
          setSupabaseUserId(data.id);
        } else {
          console.error('Failed to fetch user ID', error);
          setError('User profile not found');
        }
      } else {
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Show success/error messages from redirect
  useEffect(() => {
    if (status === 'success') {
      setError(null);
      // Optional: show a success toast
      alert('Payment successful! Your balance has been updated.');
      navigate('/money');
    } else if (status === 'cancelled') {
      setError('Payment was cancelled.');
    }
  }, [status, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUserId) {
      setError('Please log in first');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 100) {
      setError('Amount must be at least ₦100');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3000/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: supabaseUserId,
          amount: amountNum,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize payment');
      }

      // Redirect user to Paystack payment page
      window.location.href = data.authorization_url;
    } catch (err: any) {
      console.error('Payment init error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="payment-container">
        <div className="payment-card">
          <Loader className="spin" size={32} />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-container">
      <div className="payment-card">
        <div className="payment-header">
          <CreditCard size={32} />
          <h1>Deposit with Paystack</h1>
          <p>Secure Channels – card, USSD, bank transfer, QR, mobile money</p>
        </div>

        {error && (
          <div className="payment-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="payment-form">
          <div className="form-group">
            <label htmlFor="amount">Amount (₦)</label>
            <input
              id="amount"
              type="number"
              step="100"
              min="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount (min ₦100)"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="payment-button" disabled={loading}>
            {loading ? (
              <>
                <Loader size={18} className="spin" />
                <span>Initializing...</span>
              </>
            ) : (
              <>
                <CreditCard size={18} />
                <span>Deposit Now</span>
              </>
            )}
          </button>
        </form>

        <div className="payment-info">
          <p> All major cards (Visa, Mastercard, Verve)</p>
          <p> USSD – dial * code from your phone</p>
          <p> Bank transfer – instant account number</p>
          <p> QR code & Mobile Money</p>
        </div>
      </div>
    </div>
  );
};

export default Payment;