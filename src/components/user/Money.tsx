import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { supabase } from '../../lib/supabaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { notificationService } from '../../services/notificationService';
import imageCompression from 'browser-image-compression';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  LayoutDashboard,
  History,
  Upload,
  AlertTriangle,
  X,
  CheckCircle,
  Clock,
  Building2,
  User,
  Copy,
  Loader2,
  RefreshCw,
  Filter,
  Calendar,
  UserCircle,
  Printer
} from 'lucide-react';
import './Money.css';

// ---------- Types ----------
interface ManualAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
}

interface MoneyRecord {
  id: string;
  user_id: string;
  recipient_id: string | null;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'transfer';
  status: string;
  approval: boolean;
  receipt_base64: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  description: string | null;
  admin_notes: string | null;
  sender_previous_balance: number | null;
  sender_new_balance: number | null;
  recipient_previous_balance: number | null;
  recipient_new_balance: number | null;
  created_at: string;
  updated_at: string;
}

interface ShopBalance {
  id: string;
  shop_name: string;
  available_balance: number;
}

interface RecipientInfo {
  id: string;
  firebase_uid: string;
  name: string;
  email: string;
  avatar_url: string;
}

interface SupportRecipient {
  id: string;
  email: string | null;
  user_id: string | null;
}

interface EnrichedMoneyRecord extends MoneyRecord {
  sender_name?: string;
  sender_email?: string;
  sender_avatar?: string;
  recipient_name?: string;
  recipient_email?: string;
  recipient_avatar?: string;
}

// ---------- Helper: image to Base64 ----------
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const compressAndGetBase64 = async (file: File): Promise<string> => {
  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 800,
    useWebWorker: true,
  };
  const compressed = await imageCompression(file, options);
  return await fileToBase64(compressed);
};

// ---------- Helper: get support recipients (admin) ----------
const getSupportRecipients = async (): Promise<SupportRecipient[]> => {
  const { data, error } = await supabase
    .from('feedback_support')
    .select('id, email, user_id');
  if (error) {
    console.error('Error fetching support recipients:', error);
    return [];
  }
  return data || [];
};

// ---------- Helper: send notification ----------
const sendNotification = async (
  targetUserId: string | null,
  targetEmail: string | null,
  title: string,
  body: string,
  redirectUrl: string = '/money'
) => {
  try {
    const notificationData: any = {
      title,
      body,
      notification_type: 'system',
      redirect_url: redirectUrl,
      data: {
        type: 'money_update',
        timestamp: new Date().toISOString()
      }
    };
    if (targetUserId) notificationData.target_user_id = targetUserId;
    if (targetEmail) notificationData.email = targetEmail;

    await notificationService.sendNotification(notificationData);

    if (targetUserId) {
      await supabase.from('user_notifications').insert({
        user_id: targetUserId,
        title,
        message: body,
        type: 'system',
        is_read: false,
        created_at: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('Notification error:', err);
  }
};

// ---------- Helper: get total balance (home + all shops) ----------
const getTotalBalance = (homeBalance: number, shops: ShopBalance[]): number => {
  const shopTotal = shops.reduce((sum, s) => sum + s.available_balance, 0);
  return homeBalance + shopTotal;
};

// ---------- Helper: deduct amount from user's combined balances (home + shops sequentially) ----------
// Returns new home balance and updated shops. Does NOT write to DB – only calculates.
const calculateDeduction = (
  amount: number,
  currentHomeBalance: number,
  currentShops: ShopBalance[]
): { success: boolean; newHomeBalance: number; newShops: ShopBalance[]; error?: string } => {
  let remaining = amount;
  let newHomeBalance = currentHomeBalance;
  const newShops = currentShops.map(shop => ({ ...shop }));

  // Deduct from home
  if (newHomeBalance >= remaining) {
    newHomeBalance -= remaining;
    return { success: true, newHomeBalance, newShops };
  } else {
    remaining -= newHomeBalance;
    newHomeBalance = 0;
  }

  // Deduct from shops in order
  for (let i = 0; i < newShops.length && remaining > 0; i++) {
    const shop = newShops[i];
    if (shop.available_balance >= remaining) {
      newShops[i].available_balance -= remaining;
      remaining = 0;
    } else {
      remaining -= shop.available_balance;
      newShops[i].available_balance = 0;
    }
  }

  if (remaining > 0) {
    return { success: false, newHomeBalance, newShops, error: 'Insufficient total balance' };
  }
  return { success: true, newHomeBalance, newShops };
};

// ---------- Helper: apply deduction to DB (atomic attempt) ----------
const applyDeductionToDB = async (
  firebaseUid: string,
  userId: string,
  amount: number,
  currentHomeBalance: number,
  currentShops: ShopBalance[]
): Promise<{ success: boolean; newHomeBalance: number; newShops: ShopBalance[]; error?: string }> => {
  const deduction = calculateDeduction(amount, currentHomeBalance, currentShops);
  if (!deduction.success) return deduction;

  // Update home balance
  const { error: homeError } = await supabase
    .from('users')
    .update({ balance: deduction.newHomeBalance, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (homeError) {
    return { success: false, newHomeBalance: currentHomeBalance, newShops: currentShops, error: homeError.message };
  }

  // Update each shop that changed
  for (let i = 0; i < currentShops.length; i++) {
    const oldShop = currentShops[i];
    const newShop = deduction.newShops[i];
    if (oldShop.available_balance !== newShop.available_balance) {
      const { error: shopError } = await supabase
        .from('vendor_profiles')
        .update({ available_balance: newShop.available_balance, updated_at: new Date().toISOString() })
        .eq('id', oldShop.id);
      if (shopError) {
        console.error(`Error updating shop ${oldShop.id}:`, shopError);
        // Not failing whole operation because home balance already updated – will be caught by cross-check
      }
    }
  }
  return { success: true, newHomeBalance: deduction.newHomeBalance, newShops: deduction.newShops };
};

// ---------- Cross‑check & fix for withdrawal ----------
const verifyAndFixWithdrawal = async (
  firebaseUid: string,
  userId: string,
  expectedTotalAfter: number,
  recordId: string
): Promise<void> => {
  // Fetch fresh data
  const { data: userData } = await supabase
    .from('users')
    .select('balance')
    .eq('id', userId)
    .single();
  const { data: shops } = await supabase
    .from('vendor_profiles')
    .select('id, available_balance')
    .eq('user_id', firebaseUid);
  const shopBalances: ShopBalance[] = (shops || []).map(s => ({ id: s.id, shop_name: '', available_balance: Number(s.available_balance) }));
  const currentTotal = getTotalBalance(userData?.balance || 0, shopBalances);

  if (Math.abs(currentTotal - expectedTotalAfter) > 0.01) {
    console.warn(`⚠️ Withdrawal verification failed for ${recordId}. Expected ${expectedTotalAfter}, got ${currentTotal}. Attempting fix.`);
    // Fix: recalc required adjustment
    const adjustment = expectedTotalAfter - currentTotal;
    if (Math.abs(adjustment) > 0.01) {
      // Apply adjustment to home balance (simplest)
      const newHome = (userData?.balance || 0) + adjustment;
      await supabase
        .from('users')
        .update({ balance: newHome, updated_at: new Date().toISOString() })
        .eq('id', userId);
      console.log(`🔧 Withdrawal correction applied: home balance changed by ${adjustment}`);
    }
  }
};

// ---------- Cross‑check & fix for transfer ----------
const verifyAndFixTransfer = async (
  senderId: string,
  senderFirebaseUid: string,
  recipientId: string,
  amount: number,
  expectedSenderTotalAfter: number,
  expectedRecipientBalanceAfter: number,
  recordId: string
): Promise<void> => {
  // Get sender fresh data
  const { data: senderUser } = await supabase
    .from('users')
    .select('balance')
    .eq('id', senderId)
    .single();
  const { data: senderShops } = await supabase
    .from('vendor_profiles')
    .select('id, available_balance')
    .eq('user_id', senderFirebaseUid);
  const senderShopBalances: ShopBalance[] = (senderShops || []).map(s => ({ id: s.id, shop_name: '', available_balance: Number(s.available_balance) }));
  const senderCurrentTotal = getTotalBalance(senderUser?.balance || 0, senderShopBalances);

  // Get recipient fresh balance
  const { data: recipientUser } = await supabase
    .from('users')
    .select('balance')
    .eq('id', recipientId)
    .single();
  const recipientCurrentBalance = recipientUser?.balance || 0;

  let needsFix = false;
  if (Math.abs(senderCurrentTotal - expectedSenderTotalAfter) > 0.01) {
    console.warn(`⚠️ Transfer sender verification failed for ${recordId}. Expected ${expectedSenderTotalAfter}, got ${senderCurrentTotal}`);
    needsFix = true;
  }
  if (Math.abs(recipientCurrentBalance - expectedRecipientBalanceAfter) > 0.01) {
    console.warn(`⚠️ Transfer recipient verification failed for ${recordId}. Expected ${expectedRecipientBalanceAfter}, got ${recipientCurrentBalance}`);
    needsFix = true;
  }

  if (needsFix) {
    // Fix: recalc necessary adjustments
    const senderAdjust = expectedSenderTotalAfter - senderCurrentTotal;
    const recipientAdjust = expectedRecipientBalanceAfter - recipientCurrentBalance;
    if (Math.abs(senderAdjust) > 0.01) {
      // Apply to sender's home balance (simplest)
      const newHome = (senderUser?.balance || 0) + senderAdjust;
      await supabase
        .from('users')
        .update({ balance: newHome, updated_at: new Date().toISOString() })
        .eq('id', senderId);
      console.log(`🔧 Transfer sender correction: home balance changed by ${senderAdjust}`);
    }
    if (Math.abs(recipientAdjust) > 0.01) {
      const newRecipientBalance = recipientCurrentBalance + recipientAdjust;
      await supabase
        .from('users')
        .update({ balance: newRecipientBalance, updated_at: new Date().toISOString() })
        .eq('id', recipientId);
      console.log(`🔧 Transfer recipient correction: balance changed by ${recipientAdjust}`);
    }
  }
};

// ---------- Main Component ----------
const Money: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdrawal' | 'transfer' | 'transactions'>('overview');
  const [loading, setLoading] = useState(true);
  const [userBalance, setUserBalance] = useState(0);
  const [shopBalances, setShopBalances] = useState<ShopBalance[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [manualAccount, setManualAccount] = useState<ManualAccount | null>(null);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState<string>('');
  const [firebaseUid, setFirebaseUid] = useState<string>('');

  const [moneyRecords, setMoneyRecords] = useState<MoneyRecord[]>([]);
  const [enrichedRecords, setEnrichedRecords] = useState<EnrichedMoneyRecord[]>([]);

  // Deposit state
  const [depositAmount, setDepositAmount] = useState('');
  const [depositReceipt, setDepositReceipt] = useState<File | null>(null);
  const [depositReceiptPreview, setDepositReceiptPreview] = useState('');
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);

  // Withdrawal state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  // Transfer state
  const [transferEmail, setTransferEmail] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState<RecipientInfo | null>(null);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [recipientError, setRecipientError] = useState('');

  // Transactions filter
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'transfer'>('all');
  const [transactionSort, setTransactionSort] = useState<'desc' | 'asc'>('desc');

  // Modal
  const [selectedTransaction, setSelectedTransaction] = useState<EnrichedMoneyRecord | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Calculate pending amounts
  const pendingDeposits = moneyRecords.filter(r => r.type === 'deposit' && r.status === 'pending');
  const pendingWithdrawals = moneyRecords.filter(r => r.type === 'withdrawal' && r.status === 'pending');
  const pendingDepositAmount = pendingDeposits.reduce((sum, r) => sum + r.amount, 0);
  const pendingWithdrawalAmount = pendingWithdrawals.reduce((sum, r) => sum + r.amount, 0);

  // ---------- Enrich money records with user details ----------
  const enrichRecords = async (records: MoneyRecord[]): Promise<EnrichedMoneyRecord[]> => {
    const enriched: EnrichedMoneyRecord[] = [];
    for (const record of records) {
      const enrichedRecord: EnrichedMoneyRecord = { ...record };

      if (record.user_id) {
        const { data: sender } = await supabase
          .from('users')
          .select('name, email, avatar_url')
          .eq('id', record.user_id)
          .single();
        if (sender) {
          enrichedRecord.sender_name = sender.name;
          enrichedRecord.sender_email = sender.email;
          enrichedRecord.sender_avatar = sender.avatar_url;
        }
      }

      if (record.recipient_id) {
        const { data: recipient } = await supabase
          .from('users')
          .select('name, email, avatar_url')
          .eq('id', record.recipient_id)
          .single();
        if (recipient) {
          enrichedRecord.recipient_name = recipient.name;
          enrichedRecord.recipient_email = recipient.email;
          enrichedRecord.recipient_avatar = recipient.avatar_url;
        }
      }

      enriched.push(enrichedRecord);
    }
    return enriched;
  };

  // ---------- Fetch all user data ----------
  const fetchData = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      navigate('/signin');
      return;
    }

    try {
      console.log('💰 Fetching user data for:', user.uid);
      setFirebaseUid(user.uid);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, balance, withdrawal_pending_balance, name, email')
        .eq('firebase_uid', user.uid)
        .single();

      if (userError) throw userError;
      if (!userData) throw new Error('User not found');

      setUserId(userData.id);
      setUserName(userData.name || 'User');
      setUserBalance(Number(userData.balance) || 0);

      const { data: shops, error: shopsError } = await supabase
        .from('vendor_profiles')
        .select('id, shop_name, available_balance')
        .eq('user_id', user.uid);

      if (shopsError) {
        console.error('❌ Error fetching shops:', shopsError);
      } else {
        console.log('🏪 Shops found:', shops?.length || 0, shops);
      }

      let shopList: ShopBalance[] = [];
      if (shops && shops.length > 0) {
        shopList = shops.map(s => ({
          id: s.id,
          shop_name: s.shop_name,
          available_balance: Number(s.available_balance) || 0
        }));
        setShopBalances(shopList);
        const total = getTotalBalance(Number(userData.balance) || 0, shopList);
        setTotalBalance(total);
        console.log(`✅ Home: ₦${userData.balance}, Shops total: ₦${shopList.reduce((sum, s) => sum + s.available_balance, 0)}, Grand total: ₦${total}`);
      } else {
        setShopBalances([]);
        setTotalBalance(Number(userData.balance) || 0);
        console.log('ℹ️ No shops found for this user');
      }

      const { data: accountData } = await supabase
        .from('manual_accounts')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      setManualAccount(accountData || null);

      const { data: moneyData, error: moneyError } = await supabase
        .from('money')
        .select('*')
        .or(`user_id.eq.${userData.id},recipient_id.eq.${userData.id}`)
        .order('created_at', { ascending: false });

      if (moneyError) throw moneyError;
      setMoneyRecords(moneyData || []);

      const enriched = await enrichRecords(moneyData || []);
      setEnrichedRecords(enriched);

    } catch (err: any) {
      console.error('🔥 fetchData error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/signin');
      } else {
        fetchData();
      }
    });
    return () => unsubscribe();
  }, [navigate, fetchData]);

  // ---------- Fetch recipient info when email changes ----------
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!transferEmail.trim() || transferEmail === auth.currentUser?.email) {
      setRecipientInfo(null);
      setRecipientError('');
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setRecipientLoading(true);
      setRecipientError('');
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, firebase_uid, name, email, avatar_url')
          .eq('email', transferEmail.trim())
          .maybeSingle();

        if (error || !data) {
          setRecipientError('User not found');
          setRecipientInfo(null);
        } else {
          setRecipientInfo({
            id: data.id,
            firebase_uid: data.firebase_uid,
            name: data.name || 'User',
            email: data.email,
            avatar_url: data.avatar_url || ''
          });
        }
      } catch (err) {
        setRecipientError('Error looking up user');
        setRecipientInfo(null);
      } finally {
        setRecipientLoading(false);
      }
    }, 500);
  }, [transferEmail]);

  // ---------- Submit Deposit Claim ----------
  const handleDepositSubmit = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!depositReceipt) {
      setError('Please upload a receipt/screenshot');
      return;
    }

    setDepositSubmitting(true);
    setError(null);
    try {
      const receiptBase64 = await compressAndGetBase64(depositReceipt);

      const currentTotalBalance = totalBalance;

      const { error: insertError } = await supabase
        .from('money')
        .insert({
          user_id: userId,
          recipient_id: null,
          amount: amountNum,
          type: 'deposit',
          status: 'pending',
          approval: false,
          receipt_base64: receiptBase64,
          description: `Deposit claim of ₦${amountNum.toLocaleString()}`,
          sender_previous_balance: currentTotalBalance,
          sender_new_balance: currentTotalBalance,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      const admins = await getSupportRecipients();
      for (const admin of admins) {
        await sendNotification(
          admin.user_id,
          admin.email,
          '💰 New Deposit Claim',
          `${userName} requested a deposit of ₦${amountNum.toLocaleString()}. Please review.`,
          '/admin/money'
        );
      }

      setSuccess('Deposit claim submitted! Awaiting admin approval.');
      setDepositAmount('');
      setDepositReceipt(null);
      setDepositReceiptPreview('');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDepositSubmitting(false);
    }
  };

  const cancelDeposit = async (recordId: string) => {
    const { error } = await supabase
      .from('money')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', recordId)
      .eq('status', 'pending')
      .eq('type', 'deposit');

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Deposit claim cancelled');
      fetchData();
    }
    setShowCancelConfirm(null);
  };

  // ---------- Submit Withdrawal Request (uses combined balances) ----------
  const handleWithdrawSubmit = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (amountNum > totalBalance) {
      setError(`Amount exceeds your total available balance of ₦${totalBalance.toLocaleString()}`);
      return;
    }
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      setError('Please fill all bank details');
      return;
    }
    if (accountName.trim().toLowerCase() !== userName.toLowerCase()) {
      setError('Account name must match your registered name for security');
      return;
    }

    setWithdrawSubmitting(true);
    setError(null);
    try {
      const currentTotalBalance = totalBalance;
      const expectedTotalAfter = currentTotalBalance - amountNum;

      // Get fresh data for deduction
      const { data: currentUserData, error: fetchError } = await supabase
        .from('users')
        .select('balance, withdrawal_pending_balance')
        .eq('id', userId)
        .single();
      if (fetchError) throw fetchError;

      const { data: currentShops } = await supabase
        .from('vendor_profiles')
        .select('id, shop_name, available_balance')
        .eq('user_id', firebaseUid);
      const shopsList: ShopBalance[] = (currentShops || []).map(s => ({
        id: s.id,
        shop_name: s.shop_name,
        available_balance: Number(s.available_balance) || 0
      }));

      // Apply deduction to DB
      const deductionResult = await applyDeductionToDB(
        firebaseUid,
        userId,
        amountNum,
        currentUserData.balance,
        shopsList
      );
      if (!deductionResult.success) {
        throw new Error(deductionResult.error || 'Failed to deduct balances');
      }

      // Update withdrawal_pending_balance
      const newPending = (currentUserData.withdrawal_pending_balance || 0) + amountNum;
      const { error: updatePendingError } = await supabase
        .from('users')
        .update({ withdrawal_pending_balance: newPending, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (updatePendingError) throw updatePendingError;

      // Create money record
      const { error: insertError, data: newRecord } = await supabase
        .from('money')
        .insert({
          user_id: userId,
          recipient_id: null,
          amount: amountNum,
          type: 'withdrawal',
          status: 'pending',
          approval: false,
          bank_name: bankName,
          account_number: accountNumber,
          account_name: accountName,
          description: `Withdrawal request of ₦${amountNum.toLocaleString()} to ${bankName} ${accountNumber}`,
          sender_previous_balance: currentTotalBalance,
          sender_new_balance: expectedTotalAfter,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // === CROSS-CHECK & FIX ===
      await verifyAndFixWithdrawal(firebaseUid, userId, expectedTotalAfter, newRecord.id);

      // Notify admins
      const admins = await getSupportRecipients();
      for (const admin of admins) {
        await sendNotification(
          admin.user_id,
          admin.email,
          '🏦 New Withdrawal Request',
          `${userName} requested a withdrawal of ₦${amountNum.toLocaleString()}. Please review.`,
          '/admin/money'
        );
      }

      setSuccess('Withdrawal request submitted! Funds are locked for processing.');
      setWithdrawAmount('');
      setBankName('');
      setAccountNumber('');
      setAccountName('');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  // ---------- Submit Transfer (uses combined balances) ----------
  const handleTransferSubmit = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (amountNum > totalBalance) {
      setError(`Amount exceeds your total available balance of ₦${totalBalance.toLocaleString()}`);
      return;
    }
    if (!transferEmail.trim()) {
      setError('Please enter recipient email');
      return;
    }
    if (transferEmail === user.email) {
      setError('You cannot transfer to your own account');
      return;
    }
    if (!recipientInfo) {
      setError('Recipient not found');
      return;
    }

    setTransferSubmitting(true);
    setError(null);
    try {
      const currentSenderTotalBalance = totalBalance;
      const expectedSenderTotalAfter = currentSenderTotalBalance - amountNum;

      // Get fresh sender data
      const { data: senderData, error: senderFetchError } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();
      if (senderFetchError) throw senderFetchError;

      const { data: senderShops } = await supabase
        .from('vendor_profiles')
        .select('id, shop_name, available_balance')
        .eq('user_id', firebaseUid);
      const shopsList: ShopBalance[] = (senderShops || []).map(s => ({
        id: s.id,
        shop_name: s.shop_name,
        available_balance: Number(s.available_balance) || 0
      }));

      // Apply deduction to sender
      const deductionResult = await applyDeductionToDB(
        firebaseUid,
        userId,
        amountNum,
        senderData.balance,
        shopsList
      );
      if (!deductionResult.success) {
        throw new Error(deductionResult.error || 'Failed to deduct sender balances');
      }

      // Get recipient current balance
      const { data: recipientData } = await supabase
        .from('users')
        .select('balance')
        .eq('id', recipientInfo.id)
        .single();
      const recipientOldBalance = recipientData?.balance || 0;
      const recipientNewBalance = recipientOldBalance + amountNum;

      // Update recipient balance
      const { error: updateRecipient } = await supabase
        .from('users')
        .update({ balance: recipientNewBalance, updated_at: new Date().toISOString() })
        .eq('id', recipientInfo.id);
      if (updateRecipient) throw updateRecipient;

      // Create money record
      const { error: insertError, data: newRecord } = await supabase
        .from('money')
        .insert({
          user_id: userId,
          recipient_id: recipientInfo.id,
          amount: amountNum,
          type: 'transfer',
          status: 'completed',
          approval: true,
          description: `Transfer to ${recipientInfo.email}`,
          sender_previous_balance: currentSenderTotalBalance,
          sender_new_balance: expectedSenderTotalAfter,
          recipient_previous_balance: recipientOldBalance,
          recipient_new_balance: recipientNewBalance,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // === CROSS-CHECK & FIX ===
      await verifyAndFixTransfer(
        userId,
        firebaseUid,
        recipientInfo.id,
        amountNum,
        expectedSenderTotalAfter,
        recipientNewBalance,
        newRecord.id
      );

      await sendNotification(
        recipientInfo.firebase_uid,
        recipientInfo.email,
        '💸 Money Received',
        `${userName} sent you ₦${amountNum.toLocaleString()}.`,
        '/money'
      );

      setSuccess(`Transferred ₦${amountNum.toLocaleString()} to ${transferEmail}`);
      setTransferAmount('');
      setTransferEmail('');
      setRecipientInfo(null);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTransferSubmitting(false);
    }
  };

  const copyAccountNumber = () => {
    if (manualAccount) {
      navigator.clipboard.writeText(manualAccount.account_number);
      setSuccess('Account number copied!');
    }
  };

  // Helper to get amount text color based on transaction type and status
  const getAmountColor = (record: EnrichedMoneyRecord, isSender: boolean): string => {
    const { type, status, user_id, recipient_id } = record;
    const isUserSender = user_id === userId;
    const isUserRecipient = recipient_id === userId;

    if (type === 'deposit') {
      if (status === 'pending') return '#6c757d'; // dark grey
      if (status === 'approved' || status === 'completed') return '#10b981'; // green
      if (status === 'rejected') return '#adb5bd'; // light grey
      return '#6c757d';
    }
    if (type === 'withdrawal') {
      if (status === 'pending') return '#f59e0b'; // orange
      if (status === 'approved' || status === 'completed') return '#ef4444'; // red
      if (status === 'rejected') return '#adb5bd'; // light grey
      return '#6c757d';
    }
    if (type === 'transfer') {
      if (status === 'completed') return '#10b981'; // green
      if (status === 'pending') return '#f59e0b';
      return '#adb5bd';
    }
    return '#6c757d';
  };

  // Helper for status text color (no background)
  const getStatusColor = (status: string): string => {
    if (status === 'completed' || status === 'approved') return '#10b981';
    if (status === 'pending') return '#f59e0b';
    return '#6c757d'; // cancelled, rejected, etc.
  };

  const filteredRecords = enrichedRecords
    .filter(record => {
      if (transactionFilter === 'all') return true;
      return record.type === transactionFilter;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return transactionSort === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const last24Hours = enrichedRecords.filter(record => {
    const recordDate = new Date(record.created_at);
    const dayAgo = new Date();
    dayAgo.setDate(dayAgo.getDate() - 1);
    return recordDate >= dayAgo;
  });

  const transferRecords = enrichedRecords.filter(r => r.type === 'transfer');

  const handleTransactionClick = (record: EnrichedMoneyRecord) => {
    setSelectedTransaction(record);
    setShowDetailsModal(true);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="money-loading">
        <Loader2 className="money-spinner" size={32} />
      </div>
    );
  }

  return (
    <div className="money-container">
      <header className="money-header">
        <button className="money-back-btn" onClick={() => navigate('/dashboard')}>←</button>
        <h1 className="money-title">Financial Hub</h1>
        <button className="money-refresh-btn" onClick={fetchData}>
          <RefreshCw size={16} />
        </button>
      </header>

      <div className="money-balance-card">
        <div className="money-balance-total">
          <span className="money-balance-label">Total Available Balance</span>
          <span className="money-balance-amount">₦{totalBalance.toLocaleString()}</span>
        </div>
        <div className="money-balance-breakdown">
          <span className="money-breakdown-item">
            <span>Home:</span> <strong>₦{userBalance.toLocaleString()}</strong>
          </span>
          {shopBalances.map(shop => (
            <span key={shop.id} className="money-breakdown-item">
              <span>{shop.shop_name}:</span> <strong>₦{shop.available_balance.toLocaleString()}</strong>
            </span>
          ))}
        </div>
      </div>

      <div className="money-tabs">
        <button className={`money-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <LayoutDashboard size={14} /> Overview
        </button>
        <button className={`money-tab ${activeTab === 'deposit' ? 'active' : ''}`} onClick={() => setActiveTab('deposit')}>
          <ArrowDownToLine size={14} /> Deposit
        </button>
        <button className={`money-tab ${activeTab === 'withdrawal' ? 'active' : ''}`} onClick={() => setActiveTab('withdrawal')}>
          <ArrowUpFromLine size={14} /> Withdraw
        </button>
        <button className={`money-tab ${activeTab === 'transfer' ? 'active' : ''}`} onClick={() => setActiveTab('transfer')}>
          <Send size={14} /> Transfer
        </button>
        <button className={`money-tab ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>
          <History size={14} /> History
        </button>
      </div>

      {error && (
        <div className="money-error">
          <AlertTriangle size={12} /> {error}
          <button onClick={() => setError(null)}><X size={12} /></button>
        </div>
      )}
      {success && (
        <div className="money-success">
          <CheckCircle size={12} /> {success}
          <button onClick={() => setSuccess(null)}><X size={12} /></button>
        </div>
      )}

      <div className="money-tab-content">
        {/* ========== OVERVIEW TAB ========== */}
        {activeTab === 'overview' && (
          <div className="money-overview">
            <div className="money-stats-grid">
              <div className="money-stat-card">
                <Wallet size={18} />
                <div><span>Home Balance</span><strong>₦{userBalance.toLocaleString()}</strong></div>
              </div>
              <div className="money-stat-card">
                <Building2 size={18} />
                <div><span>Shops Total</span><strong>₦{shopBalances.reduce((s, b) => s + b.available_balance, 0).toLocaleString()}</strong></div>
              </div>
              <div className="money-stat-card">
                <Clock size={18} />
                <div>
                  <span>Pending Deposit</span>
                  <strong>({pendingDeposits.length}) ₦{pendingDepositAmount.toLocaleString()}</strong>
                </div>
              </div>
              <div className="money-stat-card">
                <ArrowUpFromLine size={18} />
                <div>
                  <span>Pending Withdrawal</span>
                  <strong>({pendingWithdrawals.length}) ₦{pendingWithdrawalAmount.toLocaleString()}</strong>
                </div>
              </div>
            </div>
            <div className="money-recent">
              <h3>Recent Activity (Last 24h)</h3>
              {last24Hours.length === 0 && <p className="money-empty">No activity in the last 24 hours</p>}
              {last24Hours.slice(0, 5).map(record => {
                let displayEmail = '';
                let displayName = '';
                let displayAvatar = '';
                if (record.type === 'transfer') {
                  if (record.user_id === userId) {
                    displayEmail = record.recipient_email || '';
                    displayName = record.recipient_name || 'Recipient';
                    displayAvatar = record.recipient_avatar || '';
                  } else {
                    displayEmail = record.sender_email || '';
                    displayName = record.sender_name || 'Sender';
                    displayAvatar = record.sender_avatar || '';
                  }
                } else {
                  displayEmail = record.sender_email || '';
                  displayName = record.sender_name || 'You';
                  displayAvatar = record.sender_avatar || '';
                }
                const isSender = record.user_id === userId;
                const amountColor = getAmountColor(record, isSender);
                return (
                  <div key={record.id} className="money-recent-item" onClick={() => handleTransactionClick(record)} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {displayAvatar ? (
                        <img src={displayAvatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <UserCircle size={28} color="#6c757d" />
                      )}
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {record.type === 'deposit' && 'Deposit request'}
                          {record.type === 'withdrawal' && 'Withdrawal request'}
                          {record.type === 'transfer' && (record.user_id === userId ? `Sent to ${displayName}` : `Received from ${displayName}`)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6c757d' }}>{displayEmail}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: amountColor, fontWeight: 600 }}>
                        {record.type === 'transfer' && record.recipient_id === userId ? '+' : '-'}
                        ₦{record.amount.toLocaleString()}
                      </span>
                      <small style={{ display: 'block', fontSize: '10px' }}>{new Date(record.created_at).toLocaleString()}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========== DEPOSIT TAB ========== */}
        {activeTab === 'deposit' && (
          <div className="money-deposit">
            
            {/* New action buttons before manual deposit */}
            <div className="money-action-buttons">
              <button className="money-action-btn" onClick={() => navigate('/payment')}>
                <Wallet size={14} /> Quick deposit
              </button>
              <button className="money-action-btn" onClick={() => navigate('/virtual-account')}>
                <Building2 size={14} /> Create permanent ACC NO.
              </button>
              <button className="money-action-btn" onClick={() => navigate('/temporal-account')}>
                <ArrowUpFromLine size={14} /> Bank transfer
              </button>
            </div>

            {manualAccount ? (
              <div className="money-manual-account">
                <p>Manual Deposit via Bank Transfer</p>
                <div className="money-account-details">
                  <div><strong>Bank:</strong> {manualAccount.bank_name}</div>
                  <div>
                    <strong>Account Number:</strong> {manualAccount.account_number}
                    <button onClick={copyAccountNumber}><Copy size={12} /></button>
                  </div>
                  <div><strong>Account Name:</strong> {manualAccount.account_name}</div>
                </div>
                <div className="money-form-group">
                  <label>Amount (₦)</label>
                  <input type="number" placeholder="Enter amount" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                </div>
                <div className="money-form-group">
                  <label>Upload Receipt / Screenshot</label>
                  <div className="money-upload-area" onClick={() => document.getElementById('receipt-input')?.click()}>
                    {depositReceiptPreview ? (
                      <img src={depositReceiptPreview} alt="receipt preview" />
                    ) : (
                      <>
                        <Upload size={20} />
                        <span>Click to upload or take photo</span>
                      </>
                    )}
                    <input
                      id="receipt-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setDepositReceipt(file);
                          setDepositReceiptPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </div>
                </div>
                <button className="money-submit-btn" onClick={handleDepositSubmit} disabled={depositSubmitting}>
                  {depositSubmitting ? <Loader2 className="money-spinner" size={14} /> : 'Submit Deposit Claim'}
                </button>
                <div style={{ visibility: 'hidden', width: '100%', height: '20px' }}></div>
                <div className="money-warning">
              <AlertTriangle size={14} />
              <span><strong>Fraud Alert:</strong> Fake deposit claims will result in permanent suspension. We verify every receipt.</span>
            </div>
              </div>
            ) : (
              <div className="money-error-box">
                <AlertTriangle size={16} />
                <p>No manual account configured. Please contact support.</p>
              </div>
            )}
            <div className="money-records">
              <h4>Your Deposit Claims</h4>
              {enrichedRecords.filter(r => r.type === 'deposit').length === 0 && <p className="money-empty">No deposit records</p>}
              {enrichedRecords.filter(r => r.type === 'deposit').map(record => (
                <div key={record.id} className="money-record-item" onClick={() => handleTransactionClick(record)} style={{ cursor: 'pointer' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: getAmountColor(record, true) }}>₦{record.amount.toLocaleString()}</span>
                    <span style={{ marginLeft: '10px', fontSize: '12px', color: getStatusColor(record.status) }}>
                      {record.status}
                    </span>
                  </div>
                  <div>
                    <small>{new Date(record.created_at).toLocaleDateString()}</small>
                    {record.status === 'pending' && (
                      <button onClick={(e) => { e.stopPropagation(); setShowCancelConfirm(record.id); }} className="money-cancel-btn">Cancel</button>
                    )}
                    {record.status === 'rejected' && record.admin_notes && <small>Reason: {record.admin_notes}</small>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== WITHDRAWAL TAB ========== */}
        {activeTab === 'withdrawal' && (
          <div className="money-withdrawal">
            <div className="money-form-group">
              <label>Amount (₦) - Max: ₦{totalBalance.toLocaleString()}</label>
              <input type="number" placeholder="Enter amount" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
            </div>
            <div className="money-form-group">
              <label>Bank Name</label>
              <input type="text" placeholder="e.g., GTBank" value={bankName} onChange={e => setBankName(e.target.value)} />
            </div>
            <div className="money-form-group">
              <label>Account Number</label>
              <input type="text" placeholder="10-digit number" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
            </div>
            <div className="money-form-group">
              <label>Account Name (must match registered name)</label>
              <input type="text" placeholder="Full name" value={accountName} onChange={e => setAccountName(e.target.value)} />
            </div>
            <button className="money-submit-btn" onClick={handleWithdrawSubmit} disabled={withdrawSubmitting}>
              {withdrawSubmitting ? <Loader2 className="money-spinner" size={14} /> : 'Request Withdrawal'}
            </button>
            <div className="money-records">
              <h4>Withdrawal History</h4>
              {enrichedRecords.filter(r => r.type === 'withdrawal').length === 0 && <p className="money-empty">No withdrawal requests</p>}
              {enrichedRecords.filter(r => r.type === 'withdrawal').map(record => (
                <div key={record.id} className="money-record-item" onClick={() => handleTransactionClick(record)} style={{ cursor: 'pointer' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: getAmountColor(record, true) }}>₦{record.amount.toLocaleString()}</span>
                    <span style={{ marginLeft: '10px', fontSize: '12px', color: getStatusColor(record.status) }}>
                      {record.status}
                    </span>
                  </div>
                  <div>
                    <small>{record.bank_name} • {record.account_number}</small>
                    <small>{new Date(record.created_at).toLocaleDateString()}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== TRANSFER TAB ========== */}
        {activeTab === 'transfer' && (
          <div className="money-transfer">
            <div className="money-form-group">
              <label>Recipient Email</label>
              <input type="email" placeholder="user@example.com" value={transferEmail} onChange={e => setTransferEmail(e.target.value)} />
              {recipientLoading && <Loader2 size={14} className="money-spinner" />}
              {recipientInfo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                  {recipientInfo.avatar_url ? (
                    <img src={recipientInfo.avatar_url} alt={recipientInfo.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserCircle size={24} color="#6c757d" />
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600 }}>{recipientInfo.name}</div>
                    <div style={{ fontSize: 12, color: '#6c757d' }}>{recipientInfo.email}</div>
                  </div>
                </div>
              )}
              {recipientError && <div className="money-error-text">{recipientError}</div>}
            </div>
            <div className="money-form-group">
              <label>Amount (₦) - Max: ₦{totalBalance.toLocaleString()}</label>
              <input type="number" placeholder="Enter amount" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} />
            </div>
            <button
              className="money-submit-btn"
              onClick={handleTransferSubmit}
              disabled={transferSubmitting || !recipientInfo || transferAmount === '' || parseFloat(transferAmount) > totalBalance}
            >
              {transferSubmitting ? <Loader2 className="money-spinner" size={14} /> : 'Send Transfer'}
            </button>

            <div className="money-records" style={{ marginTop: 24 }}>
              <h4>Transfer History</h4>
              {transferRecords.length === 0 && <p className="money-empty">No transfer records</p>}
              {transferRecords.map(record => {
                const isSender = record.user_id === userId;
                const amountColor = getAmountColor(record, isSender);
                return (
                  <div key={record.id} className="money-record-item" onClick={() => handleTransactionClick(record)} style={{ cursor: 'pointer' }}>
                    <div>
                      <span style={{ fontWeight: 600, color: amountColor }}>₦{record.amount.toLocaleString()}</span>
                      <span style={{ marginLeft: '10px', fontSize: '12px', color: getStatusColor(record.status) }}>
                        {record.status}
                      </span>
                      <small style={{ marginLeft: 8 }}>
                        {isSender ? `To: ${record.recipient_email || record.recipient_id}` : `From: ${record.sender_email || record.user_id}`}
                      </small>
                    </div>
                    <div>
                      <small>{new Date(record.created_at).toLocaleDateString()}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========== TRANSACTIONS TAB ========== */}
        {activeTab === 'transactions' && (
          <div className="money-transactions">
            <div className="money-transactions-filters">
              <div className="money-filter-group">
                <Filter size={14} />
                <select value={transactionFilter} onChange={e => setTransactionFilter(e.target.value as any)}>
                  <option value="all">All</option>
                  <option value="deposit">Deposits</option>
                  <option value="withdrawal">Withdrawals</option>
                  <option value="transfer">Transfers</option>
                </select>
              </div>
              <div className="money-filter-group">
                <Calendar size={14} />
                <select value={transactionSort} onChange={e => setTransactionSort(e.target.value as 'desc' | 'asc')}>
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
                </select>
              </div>
            </div>
            <div className="money-transactions-list">
              {filteredRecords.length === 0 && <p className="money-empty">No transactions found</p>}
              {filteredRecords.map(record => {
                const isSender = record.user_id === userId;
                const amountDisplay = (record.type === 'transfer' && !isSender && record.recipient_id === userId)
                  ? `+₦${record.amount.toLocaleString()}`
                  : `-₦${record.amount.toLocaleString()}`;
                const amountColor = getAmountColor(record, isSender);

                let displayEmail = '';
                let displayName = '';
                let displayAvatar = '';
                if (record.type === 'transfer') {
                  if (isSender) {
                    displayEmail = record.recipient_email || '';
                    displayName = record.recipient_name || 'Recipient';
                    displayAvatar = record.recipient_avatar || '';
                  } else {
                    displayEmail = record.sender_email || '';
                    displayName = record.sender_name || 'Sender';
                    displayAvatar = record.sender_avatar || '';
                  }
                } else {
                  displayEmail = record.sender_email || '';
                  displayName = record.sender_name || 'You';
                  displayAvatar = record.sender_avatar || '';
                }

                return (
                  <div key={record.id} className="money-transaction-item" onClick={() => handleTransactionClick(record)} style={{ cursor: 'pointer' }}>
                    <div className="money-tx-icon">
                      {record.type === 'deposit' && <ArrowDownToLine size={14} className="money-green" />}
                      {record.type === 'withdrawal' && <ArrowUpFromLine size={14} className="money-red" />}
                      {record.type === 'transfer' && <Send size={14} className="money-blue" />}
                    </div>
                    <div className="money-tx-details">
                      <div className="money-tx-desc">
                        {record.type === 'deposit' && 'Deposit claim'}
                        {record.type === 'withdrawal' && 'Withdrawal request'}
                        {record.type === 'transfer' && (isSender ? `Sent to ${displayName}` : `Received from ${displayName}`)}
                      </div>
                      <div className="money-tx-meta">
                        <span>{new Date(record.created_at).toLocaleString()}</span>
                        <span style={{ color: getStatusColor(record.status), fontSize: '11px', fontWeight: 500 }}>
                          {record.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        {displayAvatar ? (
                          <img src={displayAvatar} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                        ) : (
                          <UserCircle size={16} color="#6c757d" />
                        )}
                        <span style={{ fontSize: '12px', color: '#6c757d' }}>{displayEmail}</span>
                      </div>
                    </div>
                    <div className="money-tx-amount" style={{ color: amountColor, fontWeight: 600 }}>{amountDisplay}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {showDetailsModal && selectedTransaction && (
        <div className="money-modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="money-modal-content-large" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <button onClick={handlePrint} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f0f0f0' }}>
                <Printer size={18} /> Print / PDF
              </button>
              <button onClick={() => setShowDetailsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', fontSize: '20px' }}>
                <X size={20} />
              </button>
            </div>
            <div className="money-transaction-details-print">
              <h3>Transaction Details</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>ID:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>{selectedTransaction.id}</td></tr>
                  <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Type:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>{selectedTransaction.type}</td></tr>
                  <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Amount:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>₦{selectedTransaction.amount.toLocaleString()}</td></tr>
                  <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Status:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', color: getStatusColor(selectedTransaction.status) }}>{selectedTransaction.status}</td></tr>
                  <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Description:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>{selectedTransaction.description || '—'}</td></tr>
                  <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Created At:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>{new Date(selectedTransaction.created_at).toLocaleString()}</td></tr>
                  {selectedTransaction.type === 'withdrawal' && (
                    <>
                      <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Bank:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>{selectedTransaction.bank_name}</td></tr>
                      <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Account Number:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>{selectedTransaction.account_number}</td></tr>
                      <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Account Name:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>{selectedTransaction.account_name}</td></tr>
                    </>
                  )}
                  {selectedTransaction.type === 'transfer' && (
                    <>
                      <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Sender:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>{selectedTransaction.sender_email || selectedTransaction.user_id}</td></tr>
                      <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Recipient:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>{selectedTransaction.recipient_email || selectedTransaction.recipient_id}</td></tr>
                    </>
                  )}
                  {selectedTransaction.user_id === userId && selectedTransaction.sender_previous_balance !== null && (
                    <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Your Previous Balance:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>₦{selectedTransaction.sender_previous_balance.toLocaleString()}</td></tr>
                  )}
                  {selectedTransaction.user_id === userId && selectedTransaction.sender_new_balance !== null && (
                    <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Your New Balance:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>₦{selectedTransaction.sender_new_balance.toLocaleString()}</td></tr>
                  )}
                  {selectedTransaction.recipient_id === userId && selectedTransaction.recipient_previous_balance !== null && (
                    <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Your Previous Balance:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>₦{selectedTransaction.recipient_previous_balance.toLocaleString()}</td></tr>
                  )}
                  {selectedTransaction.recipient_id === userId && selectedTransaction.recipient_new_balance !== null && (
                    <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Your New Balance:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>₦{selectedTransaction.recipient_new_balance.toLocaleString()}</td></tr>
                  )}
                  {selectedTransaction.admin_notes && (
                    <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Admin Notes:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}>{selectedTransaction.admin_notes}</td></tr>
                  )}
                  {selectedTransaction.receipt_base64 && (
                    <tr><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef', fontWeight: 600 }}>Receipt:</td><td style={{ padding: '8px', borderBottom: '1px solid #e9ecef' }}><img src={selectedTransaction.receipt_base64} alt="receipt" style={{ maxWidth: '200px', maxHeight: '200px' }} /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="money-modal">
          <div className="money-modal-content">
            <h4>Cancel Deposit Claim?</h4>
            <p>This action cannot be undone. Your deposit request will be removed.</p>
            <div className="money-modal-actions">
              <button onClick={() => setShowCancelConfirm(null)}>No, Keep</button>
              <button className="money-danger" onClick={() => cancelDeposit(showCancelConfirm)}>Yes, Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom spacer for bottom navigation */}
      <div style={{ height: '30px' }}></div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .money-modal-content-large, .money-modal-content-large * { visibility: visible; }
          .money-modal-overlay { position: fixed; top: 0; left: 0; right: 0; background: white; z-index: 9999; }
          .money-modal-content-large { margin: 0; padding: 20px; box-shadow: none; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default Money;