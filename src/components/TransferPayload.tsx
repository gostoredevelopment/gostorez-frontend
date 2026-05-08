import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import './TransferPayload.css';

interface Bank {
  name: string;
  code: string;
  slug: string;
}

const TransferPayload: React.FC = () => {
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);

  // Get current admin user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setAdminUserId(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch banks on mount
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const response = await fetch('https://gostorez-backend.onrender.com/api/pay/banks');
        const data = await response.json();
        if (data.success) {
          setBanks(data.banks);
        }
      } catch (error) {
        console.error('Failed to fetch banks:', error);
      }
    };
    fetchBanks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminUserId) {
      setMessage({ type: 'error', text: 'Please log in as admin' });
      return;
    }
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 100) {
      setMessage({ type: 'error', text: 'Amount must be at least ₦100' });
      return;
    }
    
    if (!bankName) {
      setMessage({ type: 'error', text: 'Please select a bank' });
      return;
    }
    
    if (!accountNumber || accountNumber.length < 10) {
      setMessage({ type: 'error', text: 'Valid account number required' });
      return;
    }
    
    setLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch('http://localhost:3000/api/pay/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          bank_name: bankName,
          account_number: accountNumber,
          account_name: accountName || undefined,
          admin_user_id: adminUserId
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setMessage({ 
          type: 'success', 
          text: `✅ Transfer initiated! Reference: ${data.reference}` 
        });
        // Reset form
        setAmount('');
        setBankName('');
        setAccountNumber('');
        setAccountName('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Transfer failed' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="withdrawal-container">
      <div className="withdrawal-card">
        <h2>💸 Admin Withdrawal</h2>
        <p>Send money from Paystack balance to any Nigerian bank account</p>
        
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Amount (₦)</label>
            <input
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
          
          <div className="form-group">
            <label>Bank Name</label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              required
              disabled={loading}
            >
              <option value="">Select a bank</option>
              {banks.map((bank) => (
                <option key={bank.code} value={bank.name}>
                  {bank.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Account Number</label>
            <input
              type="text"
              pattern="[0-9]{10}"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="10-digit account number"
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label>Account Name (Optional)</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Will be auto-resolved if left empty"
              disabled={loading}
            />
          </div>
          
          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Withdraw Funds'}
          </button>
        </form>
        
        <div className="info-note">
          <p>⚠️ Note: Ensure OTP verification is disabled in Paystack dashboard for automated transfers.</p>
          <p>📍 Settings → Preferences → Uncheck "Confirm transfers before sending"</p>
        </div>
      </div>
    </div>
  );
};

export default TransferPayload;