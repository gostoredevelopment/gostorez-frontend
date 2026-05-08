// src/components/admin/Admin.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { supabase } from '../../lib/supabaseClient';
import { notificationService } from '../../services/notificationService';
import {
  Users, Store, ShoppingBag, Package, Settings, LogOut, HelpCircle, Bug, Lightbulb, MessageSquare,
  Search, X, AlertCircle, CheckCircle, DollarSign,
  Bell, Eye, Edit, Plus, Minus, Star,
  TrendingUp, CreditCard, Trash2, UserX, UserCheck,
  ChevronUp, ChevronDown, Home, Menu, Send, ArrowLeftRight, Clock,
  Shield, UserMinus, MessageCircle as MessageCircleIcon, Reply, Filter, SortAsc, SortDesc,
  RefreshCw, Mail, Smartphone, Inbox, Check, Flag, Loader, Headphones,
  Video, Calendar, Ban, Wallet, ArrowDownToLine, ArrowUpFromLine, History, Printer, Copy
} from 'lucide-react';
import logo from '../../assets/images/logo.png';
import './Admin.css';

// -------------------- Types --------------------
interface User {
  id: string;
  firebase_uid: string;
  name: string;
  email: string;
  phone: string;
  avatar_url: string;
  user_type: 'user' | 'vendor' | 'admin' | 'suspended';
  balance: number;
  total_spent: number;
  total_orders: number;
  created_at: string;
  last_seen: string;
  is_active: boolean;
  shops?: { id: string; shop_name: string }[];
}

interface VendorProfile {
  id: string;
  vendor_id: string;
  user_id: string;
  shop_name: string;
  business_email: string;
  contact_phone: string;
  profile_image: string;
  is_active: boolean;
  total_products: number;
  total_sales: number;
  average_rating: number;
  pending_balance: number;
  available_balance: number;
  created_at: string;
}

interface Order {
  id: string;
  order_number: string;
  user_name: string;
  user_email: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
}

interface Product {
  id: string;
  vendor_name: string;
  title: string;
  price: number;
  images: string[];
  inventory: number;
  is_active: boolean;
  is_promoted: boolean;
  category: string;
  views_count: number;
  created_at: string;
}

interface Notification {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  created_at: string;
  read: boolean;
}

interface Feedback {
  id: string;
  question: string;
  answer: string;
  sender_id: string;
  sender_name: string;
  sender_email: string;
  feedback_type: string;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SupportRecipient {
  id: string;
  email: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface OpenMarketSettings {
  id: number;
  active_status: boolean;
  open_date: string | null;
  close_date: string | null;
  schedule_type: 'once' | 'regular';
  created_at: string;
  updated_at: string;
}

interface OpenMarketVideoRoom {
  id: string;
  room_name: string;
  created_by_user_id: string;
  created_by_name: string;
  participant_count: number;
  is_active: boolean;
  last_activity: string;
  created_at: string;
}

interface OpenMarketPost {
  id: string;
  user_id: string;
  text: string;
  media_urls: string[] | null;
  media_types: string[] | null;
  created_at: string;
  expires_at: string;
  user_name?: string;
  user_avatar?: string;
  likes_count?: number;
  comments_count?: number;
}

interface OpenMarketBlacklistEntry {
  id: string;
  user_id: string;
  reason: string | null;
  created_by: string;
  created_at: string;
}

interface OverviewStats {
  totalUsers: number;
  totalVendors: number;
  totalAdmins: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalUserBalance: number;
  totalVendorPending: number;
  totalVendorAvailable: number;
  ordersLast7Days: number;
  usersLast7Days: number;
}

// Money Record Types
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

interface EnrichedMoneyRecord extends MoneyRecord {
  sender_name?: string;
  sender_email?: string;
  sender_avatar?: string;
  recipient_name?: string;
  recipient_email?: string;
  recipient_avatar?: string;
}

interface Bank {
  name: string;
  code: string;
  slug: string;
}

type SortDirection = 'asc' | 'desc';
interface SortConfig {
  key: string;
  direction: SortDirection;
}

type FeedbackFilterType = 'all' | 'complaint' | 'bug' | 'suggestion' | 'feature' | 'other';
type FeedbackReplyStatus = 'all' | 'replied' | 'unreplied';
type TabType = 'overview' | 'users' | 'vendors' | 'orders' | 'products' | 'notifications' | 'admins' | 'settings' | 'feedbacks' | 'faq' | 'support' | 'openmarket' | 'funding';

// Simple infinite scroll
const SimpleInfiniteScroll: React.FC<{
  dataLength: number;
  next: () => void;
  hasMore: boolean;
  loader: React.ReactNode;
  children: React.ReactNode;
}> = ({ dataLength, next, hasMore, loader, children }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current || !hasMore) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 100) next();
    };
    const current = scrollRef.current;
    if (current) current.addEventListener('scroll', handleScroll);
    return () => current?.removeEventListener('scroll', handleScroll);
  }, [hasMore, next]);

  return (
    <div ref={scrollRef} className="admin-scroll-container">
      {children}
      {hasMore && dataLength > 0 && loader}
    </div>
  );
};

// -------------------- Component --------------------
const Admin: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentAdminName, setCurrentAdminName] = useState('');
  const [currentAdminEmail, setCurrentAdminEmail] = useState('');
  const [currentAdminUid, setCurrentAdminUid] = useState('');

  // Data states
  const [users, setUsers] = useState<User[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [supportRecipients, setSupportRecipients] = useState<SupportRecipient[]>([]);
  
  // Open Market Data states
  const [openMarketSettings, setOpenMarketSettings] = useState<OpenMarketSettings | null>(null);
  const [openMarketVideoRooms, setOpenMarketVideoRooms] = useState<OpenMarketVideoRoom[]>([]);
  const [openMarketPosts, setOpenMarketPosts] = useState<OpenMarketPost[]>([]);
  const [openMarketBlacklist, setOpenMarketBlacklist] = useState<OpenMarketBlacklistEntry[]>([]);
  
  // Open Market form states
  const [omActiveStatus, setOmActiveStatus] = useState(false);
  const [omOpenDate, setOmOpenDate] = useState('');
  const [omCloseDate, setOmCloseDate] = useState('');
  const [omScheduleType, setOmScheduleType] = useState<'once' | 'regular'>('once');
  const [savingOpenMarket, setSavingOpenMarket] = useState(false);

  const [stats, setStats] = useState<OverviewStats>({
    totalUsers: 0, totalVendors: 0, totalAdmins: 0, totalProducts: 0, totalOrders: 0,
    totalRevenue: 0, totalUserBalance: 0, totalVendorPending: 0,
    totalVendorAvailable: 0, ordersLast7Days: 0, usersLast7Days: 0
  });

  // Funding Tab States
  const [moneyRecords, setMoneyRecords] = useState<MoneyRecord[]>([]);
  const [enrichedMoneyRecords, setEnrichedMoneyRecords] = useState<EnrichedMoneyRecord[]>([]);
  const [fundingFilter, setFundingFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'transfer'>('all');
  const [fundingSort, setFundingSort] = useState<'desc' | 'asc'>('desc');
  const [selectedTransaction, setSelectedTransaction] = useState<EnrichedMoneyRecord | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [fundingStats, setFundingStats] = useState({
    totalBalance: 0,
    totalPendingDeposit: 0,
    totalPendingWithdrawal: 0,
    totalCompletedDeposit: 0,
    totalCompletedWithdrawal: 0,
    totalTransfers: 0
  });
  const [banks, setBanks] = useState<Bank[]>([]);
  const [withdrawApprovalData, setWithdrawApprovalData] = useState<{
    recordId: string;
    amount: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
    userId: string;
    userEmail: string;
    userName: string;
  } | null>(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  
  // Feedback specific filters
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState<FeedbackFilterType>('all');
  const [feedbackReplyFilter, setFeedbackReplyFilter] = useState<FeedbackReplyStatus>('all');
  const [feedbackSort, setFeedbackSort] = useState<'recent' | 'oldest'>('recent');

  // Pagination
  const [usersPage, setUsersPage] = useState(0);
  const [vendorsPage, setVendorsPage] = useState(0);
  const [ordersPage, setOrdersPage] = useState(0);
  const [productsPage, setProductsPage] = useState(0);
  const [adminsPage, setAdminsPage] = useState(0);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [hasMoreVendors, setHasMoreVendors] = useState(true);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [hasMoreAdmins, setHasMoreAdmins] = useState(true);
  const PAGE_SIZE = 50;

  // Modal states
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [balanceAmount, setBalanceAmount] = useState<number | ''>('');
  const [balanceAction, setBalanceAction] = useState<'credit' | 'debit'>('credit');
  const [balanceReason, setBalanceReason] = useState('');
  const [processingBalance, setProcessingBalance] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'user' | 'vendor' | 'product' | 'faq' | 'support' | 'openmarket_post' | 'openmarket_room' | 'openmarket_blacklist'; id: string; name: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [showVendorFundModal, setShowVendorFundModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorProfile | null>(null);
  const [fundAmount, setFundAmount] = useState<number | ''>('');
  const [fundDirection, setFundDirection] = useState<'toAvailable' | 'toPending'>('toAvailable');
  const [processingFund, setProcessingFund] = useState(false);

  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationTarget, setNotificationTarget] = useState<'all' | 'users' | 'vendors' | 'admins' | 'custom'>('all');
  const [customUserIds, setCustomUserIds] = useState<string[]>([]);
  const [customUserIdInput, setCustomUserIdInput] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);

  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [userDetail, setUserDetail] = useState<User | null>(null);
  const [showVendorDetailModal, setShowVendorDetailModal] = useState(false);
  const [vendorDetail, setVendorDetail] = useState<VendorProfile | null>(null);

  // Feedback specific modals
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [togglingApprove, setTogglingApprove] = useState<string | null>(null);

  // FAQ specific modals
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqOrderIndex, setFaqOrderIndex] = useState(0);
  const [savingFaq, setSavingFaq] = useState(false);

  // Support specific modals
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [editingSupport, setEditingSupport] = useState<SupportRecipient | null>(null);
  const [supportEmail, setSupportEmail] = useState('');
  const [supportUserId, setSupportUserId] = useState('');
  const [savingSupport, setSavingSupport] = useState(false);

  // Refs
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Fetch banks for withdrawal
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/pay/banks');
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

  // -------------------- Auth check --------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate('/signin'); return; }
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) { setError('User profile not found'); setLoading(false); return; }
        const userData = userDoc.data();
        if (userData.role !== 'admin') { navigate('/market'); return; }
        setIsAdmin(true);
        setCurrentAdminName(userData.name || 'Admin');
        setCurrentAdminEmail(userData.email || '');
        setCurrentAdminUid(user.uid);
        await loadOverviewStats();
        await loadUsers(true);
        await loadAdminsFromFirestore();
        await loadVendors(true);
        await loadOrders(true);
        await loadProducts(true);
        await loadNotifications();
        await loadFeedbacks();
        await loadFaqs();
        await loadSupportRecipients();
        await loadOpenMarketData();
        await loadMoneyRecords();
      } catch (err) { setError('Failed to verify admin access'); } finally { setLoading(false); }
    });
    return () => unsubscribe();
  }, [navigate]);

  // -------------------- Funding Tab - Load Money Records --------------------
  const loadMoneyRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('money')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMoneyRecords(data || []);

      // Enrich with user details
      const enriched = await Promise.all((data || []).map(async (record) => {
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

        return enrichedRecord;
      }));

      setEnrichedMoneyRecords(enriched);

      // Calculate stats
      const deposits = (data || []).filter(r => r.type === 'deposit');
      const withdrawals = (data || []).filter(r => r.type === 'withdrawal');
      const transfers = (data || []).filter(r => r.type === 'transfer');
      
      const pendingDeposits = deposits.filter(r => r.status === 'pending');
      const pendingWithdrawals = withdrawals.filter(r => r.status === 'pending');
      const completedDeposits = deposits.filter(r => r.status === 'approved' || r.status === 'completed');
      const completedWithdrawals = withdrawals.filter(r => r.status === 'approved' || r.status === 'completed');

      // Calculate total balance (sum of all completed deposits minus completed withdrawals)
      const totalDeposited = completedDeposits.reduce((sum, r) => sum + r.amount, 0);
      const totalWithdrawn = completedWithdrawals.reduce((sum, r) => sum + r.amount, 0);
      const totalTransferred = transfers.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.amount, 0);

      setFundingStats({
        totalBalance: totalDeposited - totalWithdrawn,
        totalPendingDeposit: pendingDeposits.reduce((sum, r) => sum + r.amount, 0),
        totalPendingWithdrawal: pendingWithdrawals.reduce((sum, r) => sum + r.amount, 0),
        totalCompletedDeposit: totalDeposited,
        totalCompletedWithdrawal: totalWithdrawn,
        totalTransfers: totalTransferred
      });
    } catch (err) {
      console.error('Error loading money records:', err);
    }
  };

  // -------------------- Funding Tab - Helper Functions --------------------
  const formatCurrency = (amount: number) => '₦' + amount.toLocaleString('en-NG');
  
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString('en-NG', { 
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });

  const getStatusColor = (status: string): string => {
    if (status === 'completed' || status === 'approved') return '#10b981';
    if (status === 'pending') return '#f59e0b';
    if (status === 'rejected' || status === 'cancelled') return '#dc2626';
    return '#6c757d';
  };

  const getAmountColor = (record: EnrichedMoneyRecord): string => {
    const { type, status } = record;
    if (type === 'deposit') {
      if (status === 'pending') return '#6c757d';
      if (status === 'approved' || status === 'completed') return '#10b981';
      if (status === 'rejected') return '#adb5bd';
      return '#6c757d';
    }
    if (type === 'withdrawal') {
      if (status === 'pending') return '#f59e0b';
      if (status === 'approved' || status === 'completed') return '#ef4444';
      if (status === 'rejected') return '#adb5bd';
      return '#6c757d';
    }
    if (type === 'transfer') {
      if (status === 'completed') return '#10b981';
      if (status === 'pending') return '#f59e0b';
      return '#adb5bd';
    }
    return '#6c757d';
  };

  const sendNotificationToUser = async (userId: string, title: string, body: string, redirectUrl?: string) => {
    try {
      const notificationData: any = {
        title,
        body,
        notification_type: 'system',
        redirect_url: redirectUrl || '/money',
        data: { from_admin: true, admin_name: currentAdminName }
      };
      
      notificationData.target_user_id = userId;
      await notificationService.sendNotification(notificationData);
      
      await supabase.from('notifications').insert({
        title,
        body,
        notification_type: 'system',
        receiver_id: userId,
        receiver_ids: [userId],
        read: false,
        redirect_url: redirectUrl || '/money',
        data: { from_admin: true, admin_name: currentAdminName },
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error sending notification:', err);
    }
  };

  // -------------------- Funding Tab - Approve/Decline Handlers --------------------
  const handleApproveDeposit = async (record: EnrichedMoneyRecord) => {
    if (!window.confirm(`Approve deposit of ${formatCurrency(record.amount)} from ${record.sender_name || record.sender_email}?`)) return;
    
    setProcessingAction(true);
    try {
      // Find the user to credit
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, balance, firebase_uid')
        .eq('id', record.user_id)
        .single();
      
      if (userError) throw userError;
      
      const newBalance = (userData.balance || 0) + record.amount;
      
      // Update user balance
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          balance: newBalance, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', userData.id);
      
      if (updateError) throw updateError;
      
      // Update money record
      const { error: moneyError } = await supabase
        .from('money')
        .update({ 
          status: 'approved', 
          approval: true,
          admin_notes: `Approved by ${currentAdminName}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', record.id);
      
      if (moneyError) throw moneyError;
      
      // Send notification
      await sendNotificationToUser(
        userData.firebase_uid,
        '✅ Deposit Approved',
        `Your deposit of ${formatCurrency(record.amount)} has been approved and credited to your account.`,
        '/money'
      );
      
      setSuccessMessage(`Deposit of ${formatCurrency(record.amount)} approved successfully!`);
      await loadMoneyRecords();
      await loadOverviewStats();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    } finally {
      setProcessingAction(false);
      setShowTransactionModal(false);
      setSelectedTransaction(null);
    }
  };

  const handleDeclineDeposit = async (record: EnrichedMoneyRecord) => {
    if (!window.confirm(`Decline deposit of ${formatCurrency(record.amount)} from ${record.sender_name || record.sender_email}?`)) return;
    
    setProcessingAction(true);
    try {
      const { error: moneyError } = await supabase
        .from('money')
        .update({ 
          status: 'rejected', 
          approval: false,
          admin_notes: `Declined by ${currentAdminName}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', record.id);
      
      if (moneyError) throw moneyError;
      
      // Send notification
      await sendNotificationToUser(
        record.sender_email || '',
        '❌ Deposit Declined',
        `Your deposit of ${formatCurrency(record.amount)} was declined. Please contact support for more information.`,
        '/money'
      );
      
      setSuccessMessage(`Deposit of ${formatCurrency(record.amount)} declined.`);
      await loadMoneyRecords();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    } finally {
      setProcessingAction(false);
      setShowTransactionModal(false);
      setSelectedTransaction(null);
    }
  };

  const handleApproveWithdrawal = async (record: EnrichedMoneyRecord) => {
    if (!window.confirm(`Process withdrawal of ${formatCurrency(record.amount)} to ${record.account_name} (${record.bank_name} - ${record.account_number})?`)) return;
    
    setWithdrawApprovalData({
      recordId: record.id,
      amount: record.amount,
      bankName: record.bank_name || '',
      accountNumber: record.account_number || '',
      accountName: record.account_name || '',
      userId: record.user_id,
      userEmail: record.sender_email || '',
      userName: record.sender_name || ''
    });
    setShowWithdrawConfirm(true);
  };

  const processWithdrawalTransfer = async () => {
    if (!withdrawApprovalData) return;
    
    setProcessingAction(true);
    setShowWithdrawConfirm(false);
    
    try {
      // Call backend to process withdrawal
      const response = await fetch('http://localhost:3000/api/pay/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: withdrawApprovalData.amount,
          bank_name: withdrawApprovalData.bankName,
          account_number: withdrawApprovalData.accountNumber,
          account_name: withdrawApprovalData.accountName,
          admin_user_id: currentAdminUid,
          reference: `WD-${withdrawApprovalData.recordId}-${Date.now()}`
        })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Transfer failed');
      }
      
      // Update money record status
      const { error: moneyError } = await supabase
        .from('money')
        .update({ 
          status: 'approved', 
          approval: true,
          admin_notes: `Approved and processed by ${currentAdminName}. Transfer ref: ${data.reference}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', withdrawApprovalData.recordId);
      
      if (moneyError) throw moneyError;
      
      // Send notification
      await sendNotificationToUser(
        withdrawApprovalData.userEmail,
        '✅ Withdrawal Completed',
        `Your withdrawal of ${formatCurrency(withdrawApprovalData.amount)} has been processed and sent to your bank account. Reference: ${data.reference}`,
        '/money'
      );
      
      setSuccessMessage(`Withdrawal of ${formatCurrency(withdrawApprovalData.amount)} processed successfully!`);
      await loadMoneyRecords();
      await loadOverviewStats();
    } catch (err: any) {
      setSuccessMessage(`Error processing withdrawal: ${err.message}`);
    } finally {
      setProcessingAction(false);
      setShowTransactionModal(false);
      setSelectedTransaction(null);
      setWithdrawApprovalData(null);
    }
  };

  const handleDeclineWithdrawal = async (record: EnrichedMoneyRecord) => {
    if (!window.confirm(`Decline withdrawal of ${formatCurrency(record.amount)} to ${record.account_name}?`)) return;
    
    setProcessingAction(true);
    try {
      // Get user data to refund the balance
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, balance, firebase_uid')
        .eq('id', record.user_id)
        .single();
      
      if (userError) throw userError;
      
      // Refund the amount back to user
      const newBalance = (userData.balance || 0) + record.amount;
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          balance: newBalance, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', userData.id);
      
      if (updateError) throw updateError;
      
      // Update withdrawal_pending_balance
      const { error: pendingError } = await supabase
        .from('users')
        .update({ 
          withdrawal_pending_balance: supabase.rpc('decrement_withdrawal_pending', { amount: record.amount })
        })
        .eq('id', userData.id);
      
      // Update money record
      const { error: moneyError } = await supabase
        .from('money')
        .update({ 
          status: 'rejected', 
          approval: false,
          admin_notes: `Declined by ${currentAdminName}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', record.id);
      
      if (moneyError) throw moneyError;
      
      // Send notification
      await sendNotificationToUser(
        userData.firebase_uid,
        '❌ Withdrawal Declined',
        `Your withdrawal request of ${formatCurrency(record.amount)} was declined. Funds have been returned to your account.`,
        '/money'
      );
      
      setSuccessMessage(`Withdrawal of ${formatCurrency(record.amount)} declined and funds refunded.`);
      await loadMoneyRecords();
      await loadOverviewStats();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    } finally {
      setProcessingAction(false);
      setShowTransactionModal(false);
      setSelectedTransaction(null);
    }
  };

  // Filtered money records for funding tab
  const filteredMoneyRecords = enrichedMoneyRecords
    .filter(record => {
      if (fundingFilter === 'all') return true;
      return record.type === fundingFilter;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return fundingSort === 'desc' ? dateB - dateA : dateA - dateB;
    });

  // -------------------- Open Market Data Loading --------------------
  const loadOpenMarketData = async () => {
    try {
      // Load settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('openmarket_settings')
        .select('*')
        .single();
      if (!settingsError && settingsData) {
        setOpenMarketSettings(settingsData);
        setOmActiveStatus(settingsData.active_status);
        setOmOpenDate(settingsData.open_date || '');
        setOmCloseDate(settingsData.close_date || '');
        setOmScheduleType(settingsData.schedule_type || 'once');
      }

      // Load video rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('openmarket_video_rooms')
        .select('*')
        .order('created_at', { ascending: false });
      if (!roomsError) setOpenMarketVideoRooms(roomsData || []);

      // Load posts
      const { data: postsData, error: postsError } = await supabase
        .from('openmarket_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!postsError) {
        const enrichedPosts = await Promise.all((postsData || []).map(async (post) => {
          const { data: userData } = await supabase
            .from('users')
            .select('name, avatar_url')
            .eq('firebase_uid', post.user_id)
            .single();
          const { count: likesCount } = await supabase
            .from('openmarket_post_likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);
          const { count: commentsCount } = await supabase
            .from('openmarket_comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);
          return {
            ...post,
            user_name: userData?.name || 'User',
            user_avatar: userData?.avatar_url || '',
            likes_count: likesCount || 0,
            comments_count: commentsCount || 0
          };
        }));
        setOpenMarketPosts(enrichedPosts);
      }

      // Load blacklisted users (openmarket_blacklist)
      const { data: blacklistData, error: blacklistError } = await supabase
        .from('openmarket_blacklist')
        .select('*')
        .order('created_at', { ascending: false });
      if (!blacklistError) setOpenMarketBlacklist(blacklistData || []);
    } catch (err) {
      console.error('Error loading open market data:', err);
    }
  };

  // -------------------- Open Market Handlers --------------------
  const handleSaveOpenMarketSettings = async () => {
    setSavingOpenMarket(true);
    try {
      const { error } = await supabase
        .from('openmarket_settings')
        .update({
          active_status: omActiveStatus,
          open_date: omOpenDate || null,
          close_date: omCloseDate || null,
          schedule_type: omScheduleType,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) throw error;
      setSuccessMessage('Open Market settings saved successfully!');
      await loadOpenMarketData();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    } finally {
      setSavingOpenMarket(false);
    }
  };

  const handleDeleteOpenMarketPost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('openmarket_posts')
        .delete()
        .eq('id', postId);
      if (error) throw error;
      setSuccessMessage('Post deleted successfully!');
      await loadOpenMarketData();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    }
    setDeleteTarget(null);
  };

  const handleDeleteOpenMarketRoom = async (roomId: string) => {
    try {
      const { error } = await supabase
        .from('openmarket_video_rooms')
        .delete()
        .eq('id', roomId);
      if (error) throw error;
      setSuccessMessage('Video room deleted successfully!');
      await loadOpenMarketData();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    }
    setDeleteTarget(null);
  };

  // NEW: Block a user (add to openmarket_blacklist)
  const handleBlockUserFromPost = async (userId: string, userName: string) => {
    if (!window.confirm(`Block user "${userName}" from Open Market? This will delete all their posts, rooms, and comments.`)) return;
    try {
      const { error } = await supabase
        .from('openmarket_blacklist')
        .insert({
          user_id: userId,
          reason: 'Blocked by admin from Open Market',
          created_by: currentAdminUid,
          created_at: new Date().toISOString()
        });
      if (error) throw error;
      setSuccessMessage(`User "${userName}" has been blacklisted. All their content has been removed.`);
      await loadOpenMarketData(); // refresh posts, rooms, blacklist
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    }
  };

  // Unblock user from blacklist
  const handleUnblockFromBlacklist = async (entryId: string, userId: string) => {
    if (!window.confirm(`Unblock this user? They will be able to post and join live again.`)) return;
    try {
      const { error } = await supabase
        .from('openmarket_blacklist')
        .delete()
        .eq('id', entryId);
      if (error) throw error;
      setSuccessMessage('User unblocked successfully.');
      await loadOpenMarketData();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    }
  };

  // -------------------- Data loading --------------------
  const loadOverviewStats = async () => {
    try {
      const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
      const { count: totalVendors } = await supabase.from('vendor_profiles').select('*', { count: 'exact', head: true });
      
      let totalAdmins = 0;
      try {
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        totalAdmins = usersSnapshot.docs.filter(doc => doc.data().role === 'admin').length;
      } catch (firestoreErr) { console.error('Error fetching admins from Firestore:', firestoreErr); }
      
      const { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true });

      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString();

      const { data: ordersData } = await supabase.from('orders').select('total_amount, payment_status, created_at').eq('payment_status', 'completed');
      const totalRevenue = ordersData?.reduce((sum, o) => sum + o.total_amount, 0) || 0;

      const { count: ordersLast7Days } = await supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgoStr);
      const { count: usersLast7Days } = await supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgoStr);

      const { data: userBalances } = await supabase.from('users').select('balance');
      const totalUserBalance = userBalances?.reduce((sum, u) => sum + (u.balance || 0), 0) || 0;

      const { data: vendorBalances } = await supabase.from('vendor_profiles').select('pending_balance, available_balance');
      const totalVendorPending = vendorBalances?.reduce((sum, v) => sum + (v.pending_balance || 0), 0) || 0;
      const totalVendorAvailable = vendorBalances?.reduce((sum, v) => sum + (v.available_balance || 0), 0) || 0;

      setStats({
        totalUsers: totalUsers || 0,
        totalVendors: totalVendors || 0,
        totalAdmins: totalAdmins || 0,
        totalProducts: totalProducts || 0,
        totalOrders: ordersData?.length || 0,
        totalRevenue,
        totalUserBalance,
        totalVendorPending,
        totalVendorAvailable,
        ordersLast7Days: ordersLast7Days || 0,
        usersLast7Days: usersLast7Days || 0
      });
    } catch (err) { console.error('Error loading stats:', err); }
  };

  const loadSupportRecipients = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_support')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setSupportRecipients(data || []);
    } catch (err) {
      console.error('Error loading support recipients:', err);
    }
  };

  const loadAdminsFromFirestore = async () => {
    try {
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const adminUsers: User[] = [];
      
      for (const docSnapshot of usersSnapshot.docs) {
        const userData = docSnapshot.data();
        if (userData.role === 'admin') {
          const { data: supabaseUser } = await supabase
            .from('users')
            .select('*')
            .eq('firebase_uid', docSnapshot.id)
            .maybeSingle();
          
          adminUsers.push({
            id: supabaseUser?.id || docSnapshot.id,
            firebase_uid: docSnapshot.id,
            name: userData.name || supabaseUser?.name || '',
            email: userData.email || supabaseUser?.email || '',
            phone: supabaseUser?.phone || '',
            avatar_url: supabaseUser?.avatar_url || '',
            user_type: 'admin',
            balance: supabaseUser?.balance || 0,
            total_spent: supabaseUser?.total_spent || 0,
            total_orders: supabaseUser?.total_orders || 0,
            created_at: supabaseUser?.created_at || new Date().toISOString(),
            last_seen: supabaseUser?.last_seen || '',
            is_active: supabaseUser?.is_active !== false
          });
        }
      }
      setAdmins(adminUsers);
      setHasMoreAdmins(false);
    } catch (err) {
      console.error('Error loading admins from Firestore:', err);
    }
  };

  const loadFeedbacks = async () => {
    try {
      let query = supabase
        .from('feedbacks')
        .select('*');
      
      if (feedbackTypeFilter !== 'all') {
        query = query.eq('feedback_type', feedbackTypeFilter);
      }
      
      if (feedbackReplyFilter === 'replied') {
        query = query.not('answer', 'is', null).not('answer', 'eq', '');
      } else if (feedbackReplyFilter === 'unreplied') {
        query = query.or('answer.is.null,answer.eq.');
      }
      
      const orderDirection = feedbackSort === 'recent' ? 'desc' : 'asc';
      query = query.order('created_at', { ascending: orderDirection === 'asc' });
      
      const { data, error } = await query;
      if (error) throw error;
      setFeedbacks(data || []);
    } catch (err) {
      console.error('Error loading feedbacks:', err);
    }
  };

  const loadFaqs = async () => {
    try {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      setFaqs(data || []);
    } catch (err) {
      console.error('Error loading FAQs:', err);
    }
  };

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const filtered = data?.filter(n => n.notification_type !== 'chat') || [];
      setNotifications(filtered);
    } catch (err) { console.error('Error loading notifications:', err); }
  };

  const loadUsers = async (reset = false) => {
    if (reset) { setUsers([]); setUsersPage(0); setHasMoreUsers(true); }
    const page = reset ? 0 : usersPage;
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      let query = supabase
        .from('users')
        .select('*')
        .order(sortConfig.key, { ascending: sortConfig.direction === 'asc' })
        .range(from, to);

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,firebase_uid.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const usersWithShops = await Promise.all((data || []).map(async (u) => {
        const { data: shops } = await supabase
          .from('vendor_profiles')
          .select('id, shop_name')
          .eq('user_id', u.firebase_uid);
        return { ...u, shops: shops || [] };
      }));

      if (reset) setUsers(usersWithShops);
      else setUsers(prev => [...prev, ...usersWithShops]);
      setHasMoreUsers((data?.length || 0) === PAGE_SIZE);
      if (!reset) setUsersPage(page + 1);
    } catch (err) { console.error('Error loading users:', err); }
  };

  const loadVendors = async (reset = false) => {
    if (reset) { setVendors([]); setVendorsPage(0); setHasMoreVendors(true); }
    const page = reset ? 0 : vendorsPage;
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      let query = supabase
        .from('vendor_profiles')
        .select('*')
        .order(sortConfig.key, { ascending: sortConfig.direction === 'asc' })
        .range(from, to);

      if (searchTerm) {
        query = query.or(`shop_name.ilike.%${searchTerm}%,business_email.ilike.%${searchTerm}%,vendor_id.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (reset) setVendors(data || []);
      else setVendors(prev => [...prev, ...(data || [])]);
      setHasMoreVendors((data?.length || 0) === PAGE_SIZE);
      if (!reset) setVendorsPage(page + 1);
    } catch (err) { console.error('Error loading vendors:', err); }
  };

  const loadOrders = async (reset = false) => {
    if (reset) { setOrders([]); setOrdersPage(0); setHasMoreOrders(true); }
    const page = reset ? 0 : ordersPage;
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      let query = supabase
        .from('orders')
        .select('*')
        .order(sortConfig.key, { ascending: sortConfig.direction === 'asc' })
        .range(from, to);

      if (searchTerm) {
        query = query.or(`order_number.ilike.%${searchTerm}%,user_name.ilike.%${searchTerm}%,user_email.ilike.%${searchTerm}%`);
      }
      if (filterStatus !== 'all') query = query.eq('status', filterStatus);

      const { data, error } = await query;
      if (error) throw error;

      if (reset) setOrders(data || []);
      else setOrders(prev => [...prev, ...(data || [])]);
      setHasMoreOrders((data?.length || 0) === PAGE_SIZE);
      if (!reset) setOrdersPage(page + 1);
    } catch (err) { console.error('Error loading orders:', err); }
  };

  const loadProducts = async (reset = false) => {
    if (reset) { setProducts([]); setProductsPage(0); setHasMoreProducts(true); }
    const page = reset ? 0 : productsPage;
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      let query = supabase
        .from('products')
        .select('*')
        .order(sortConfig.key, { ascending: sortConfig.direction === 'asc' })
        .range(from, to);

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,vendor_name.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`);
      }
      if (filterStatus !== 'all') {
        if (filterStatus === 'active') query = query.eq('is_active', true);
        else if (filterStatus === 'inactive') query = query.eq('is_active', false);
        else if (filterStatus === 'promoted') query = query.eq('is_promoted', true);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (reset) setProducts(data || []);
      else setProducts(prev => [...prev, ...(data || [])]);
      setHasMoreProducts((data?.length || 0) === PAGE_SIZE);
      if (!reset) setProductsPage(page + 1);
    } catch (err) { console.error('Error loading products:', err); }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      switch (activeTab) {
        case 'users': loadUsers(true); break;
        case 'vendors': loadVendors(true); break;
        case 'orders': loadOrders(true); break;
        case 'products': loadProducts(true); break;
      }
    }, 500);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchTerm, activeTab]);

  // Sort change
  useEffect(() => {
    switch (activeTab) {
      case 'users': loadUsers(true); break;
      case 'vendors': loadVendors(true); break;
      case 'orders': loadOrders(true); break;
      case 'products': loadProducts(true); break;
    }
  }, [sortConfig]);

  // Filter change
  useEffect(() => {
    if (activeTab === 'orders') loadOrders(true);
    if (activeTab === 'products') loadProducts(true);
    if (activeTab === 'feedbacks') loadFeedbacks();
  }, [filterStatus, feedbackTypeFilter, feedbackReplyFilter, feedbackSort]);

  // -------------------- Feedback Handlers --------------------
  const handleReplyToFeedback = async () => {
    if (!selectedFeedback || !replyText.trim()) return;
    setSendingReply(true);
    
    try {
      const { error } = await supabase
        .from('feedbacks')
        .update({ 
          answer: replyText.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedFeedback.id);
      
      if (error) throw error;
      
      await sendNotificationToUser(
        selectedFeedback.sender_id,
        `Response to your ${selectedFeedback.feedback_type} feedback`,
        `Admin replied: "${replyText.substring(0, 100)}${replyText.length > 100 ? '...' : ''}"`,
        '/feedbacks'
      );
      
      setSuccessMessage('Reply sent successfully!');
      setShowReplyModal(false);
      setSelectedFeedback(null);
      setReplyText('');
      await loadFeedbacks();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    } finally {
      setSendingReply(false);
    }
  };

  const handleToggleApprove = async (feedback: Feedback) => {
    setTogglingApprove(feedback.id);
    try {
      const newApproved = !feedback.approved;
      const { error } = await supabase
        .from('feedbacks')
        .update({ 
          approved: newApproved,
          updated_at: new Date().toISOString()
        })
        .eq('id', feedback.id);
      
      if (error) throw error;
      
      if (newApproved) {
        await sendNotificationToUser(
          feedback.sender_id,
          `Your feedback has been approved`,
          `Thank you for your feedback! It is now visible to the community.`,
          '/feedbacks'
        );
        setSuccessMessage('Feedback approved and user notified!');
      } else {
        setSuccessMessage('Feedback unapproved');
      }
      
      await loadFeedbacks();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    } finally {
      setTogglingApprove(null);
    }
  };

  // -------------------- FAQ Handlers --------------------
  const handleAddFaq = async () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) {
      setSuccessMessage('Please fill in both question and answer');
      return;
    }
    setSavingFaq(true);
    
    try {
      const newOrderIndex = faqs.length + 1;
      const { error } = await supabase
        .from('faqs')
        .insert({
          question: faqQuestion.trim(),
          answer: faqAnswer.trim(),
          order_index: newOrderIndex,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      setSuccessMessage('FAQ added successfully!');
      setShowFaqModal(false);
      setFaqQuestion('');
      setFaqAnswer('');
      await loadFaqs();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    } finally {
      setSavingFaq(false);
    }
  };

  const handleEditFaq = (faq: FAQ) => {
    setEditingFaq(faq);
    setFaqQuestion(faq.question);
    setFaqAnswer(faq.answer);
    setFaqOrderIndex(faq.order_index);
    setShowFaqModal(true);
  };

  const handleUpdateFaq = async () => {
    if (!editingFaq) return;
    if (!faqQuestion.trim() || !faqAnswer.trim()) {
      setSuccessMessage('Please fill in both question and answer');
      return;
    }
    setSavingFaq(true);
    
    try {
      const { error } = await supabase
        .from('faqs')
        .update({
          question: faqQuestion.trim(),
          answer: faqAnswer.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingFaq.id);
      
      if (error) throw error;
      
      setSuccessMessage('FAQ updated successfully!');
      setShowFaqModal(false);
      setEditingFaq(null);
      setFaqQuestion('');
      setFaqAnswer('');
      await loadFaqs();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    } finally {
      setSavingFaq(false);
    }
  };

  const handleDeleteFaq = async (faq: FAQ) => {
    try {
      const { error } = await supabase
        .from('faqs')
        .delete()
        .eq('id', faq.id);
      
      if (error) throw error;
      
      setSuccessMessage('FAQ deleted successfully!');
      await loadFaqs();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    }
    setDeleteTarget(null);
  };

  // -------------------- Support Handlers --------------------
  const handleAddSupport = async () => {
    if (!supportEmail.trim() && !supportUserId.trim()) {
      setSuccessMessage('Please fill in either email or user ID');
      return;
    }
    setSavingSupport(true);
    
    try {
      const { error } = await supabase
        .from('feedback_support')
        .insert({
          email: supportEmail.trim() || null,
          user_id: supportUserId.trim() || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      setSuccessMessage('Support recipient added successfully!');
      setShowSupportModal(false);
      setSupportEmail('');
      setSupportUserId('');
      setEditingSupport(null);
      await loadSupportRecipients();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    } finally {
      setSavingSupport(false);
    }
  };

  const handleEditSupport = (recipient: SupportRecipient) => {
    setEditingSupport(recipient);
    setSupportEmail(recipient.email || '');
    setSupportUserId(recipient.user_id || '');
    setShowSupportModal(true);
  };

  const handleUpdateSupport = async () => {
    if (!editingSupport) return;
    if (!supportEmail.trim() && !supportUserId.trim()) {
      setSuccessMessage('Please fill in either email or user ID');
      return;
    }
    setSavingSupport(true);
    
    try {
      const { error } = await supabase
        .from('feedback_support')
        .update({
          email: supportEmail.trim() || null,
          user_id: supportUserId.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingSupport.id);
      
      if (error) throw error;
      
      setSuccessMessage('Support recipient updated successfully!');
      setShowSupportModal(false);
      setSupportEmail('');
      setSupportUserId('');
      setEditingSupport(null);
      await loadSupportRecipients();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    } finally {
      setSavingSupport(false);
    }
  };

  const handleDeleteSupport = async (recipient: SupportRecipient) => {
    try {
      const { error } = await supabase
        .from('feedback_support')
        .delete()
        .eq('id', recipient.id);
      
      if (error) throw error;
      
      setSuccessMessage('Support recipient deleted successfully!');
      await loadSupportRecipients();
    } catch (err: any) {
      setSuccessMessage(`Error: ${err.message}`);
    }
    setDeleteTarget(null);
  };

  // -------------------- Existing Handlers --------------------
  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'complaint': return 'Complaint';
      case 'bug': return 'Bug Report';
      case 'suggestion': return 'Suggestion';
      case 'feature': return 'Feature Request';
      default: return 'Other';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'complaint': return <AlertCircle size={14} />;
      case 'bug': return <Bug size={14} />;
      case 'suggestion': return <Lightbulb size={14} />;
      case 'feature': return <Star size={14} />;
      default: return <MessageSquare size={14} />;
    }
  };

  const sendNotificationViaService = async (targetUserIds: string[], title: string, message: string) => {
    try {
      const response = await notificationService.sendNotification({
        title,
        body: message,
        target_user_ids: targetUserIds,
        notification_type: 'system',
        data: { from_admin: true, admin_name: currentAdminName }
      });
      return response;
    } catch (err) {
      console.error('Notification service error:', err);
      throw err;
    }
  };

  const updateUserRole = async (user: User, newRole: 'user' | 'admin' | 'suspended') => {
    try {
      await updateDoc(doc(db, 'users', user.firebase_uid), { role: newRole });
      await supabase
        .from('users')
        .update({ user_type: newRole, updated_at: new Date().toISOString() })
        .eq('id', user.id);
    } catch (err) {
      console.error('Error updating user role:', err);
      throw err;
    }
  };

  const handleMakeAdmin = async (user: User) => {
    if (!window.confirm(`Make ${user.name} an admin?`)) return;
    try {
      await updateUserRole(user, 'admin');
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, user_type: 'admin' } : u));
      await loadAdminsFromFirestore();
      await sendNotificationViaService([user.firebase_uid], 'Admin Privileges Granted', 'You have been made an administrator.');
      setSuccessMessage('User promoted to admin.');
    } catch (err: any) { setSuccessMessage(`Error: ${err.message}`); }
  };

  const handleRemoveAdmin = async (admin: User) => {
    if (!window.confirm(`Remove ${admin.name} from admin role?`)) return;
    try {
      await updateUserRole(admin, 'user');
      setAdmins(prev => prev.filter(a => a.id !== admin.id));
      setUsers(prev => prev.map(u => u.id === admin.id ? { ...u, user_type: 'user' } : u));
      await sendNotificationViaService([admin.firebase_uid], 'Admin Privileges Revoked', 'You are no longer an administrator.');
      setSuccessMessage('Admin removed.');
    } catch (err: any) { setSuccessMessage(`Error: ${err.message}`); }
  };

  const handleBalanceAdjust = async () => {
    if (!selectedUser || !balanceAmount) return;
    setProcessingBalance(true);
    try {
      const currentBalance = selectedUser.balance || 0;
      const newBalance = balanceAction === 'credit' ? currentBalance + balanceAmount : currentBalance - balanceAmount;

      const { error: updateError } = await supabase
        .from('users')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', selectedUser.id);
      if (updateError) throw updateError;

      await sendNotificationViaService(
        [selectedUser.firebase_uid],
        `Account ${balanceAction === 'credit' ? 'Credited' : 'Debited'}`,
        `Your account has been ${balanceAction === 'credit' ? 'credited with' : 'debited by'} ${formatCurrency(balanceAmount)}. ${balanceReason || ''}`
      );

      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, balance: newBalance } : u));
      setShowUserModal(false);
      setSelectedUser(null);
      setBalanceAmount('');
      setSuccessMessage(`User ${balanceAction === 'credit' ? 'credited' : 'debited'} successfully!`);
    } catch (err: any) { setSuccessMessage(`Error: ${err.message}`); } finally { setProcessingBalance(false); }
  };

  const handleVendorFundTransfer = async () => {
    if (!selectedVendor || !fundAmount) return;
    setProcessingFund(true);
    try {
      const currentPending = selectedVendor.pending_balance || 0;
      const currentAvailable = selectedVendor.available_balance || 0;
      let newPending = currentPending, newAvailable = currentAvailable;

      if (fundDirection === 'toAvailable') {
        if (fundAmount > currentPending) throw new Error('Insufficient pending balance');
        newPending = currentPending - fundAmount;
        newAvailable = currentAvailable + fundAmount;
      } else {
        if (fundAmount > currentAvailable) throw new Error('Insufficient available balance');
        newAvailable = currentAvailable - fundAmount;
        newPending = currentPending + fundAmount;
      }

      const { error } = await supabase
        .from('vendor_profiles')
        .update({ pending_balance: newPending, available_balance: newAvailable, updated_at: new Date().toISOString() })
        .eq('id', selectedVendor.id);
      if (error) throw error;

      if (selectedVendor.user_id) {
        await sendNotificationViaService(
          [selectedVendor.user_id],
          'Funds Transferred',
          `Your shop ${selectedVendor.shop_name} had ${formatCurrency(fundAmount)} moved.`
        );
      }

      setVendors(prev => prev.map(v => v.id === selectedVendor.id ? { ...v, pending_balance: newPending, available_balance: newAvailable } : v));
      setShowVendorFundModal(false);
      setSelectedVendor(null);
      setFundAmount('');
      setSuccessMessage('Vendor funds transferred successfully!');
    } catch (err: any) { setSuccessMessage(`Error: ${err.message}`); } finally { setProcessingFund(false); }
  };

  const handleSendNotification = async () => {
    if (!notificationTitle || !notificationMessage) return;
    setSendingNotification(true);
    try {
      let targetUserIds: string[] = [];

      if (notificationTarget === 'all') {
        targetUserIds = users.map(u => u.firebase_uid);
      } else if (notificationTarget === 'users') {
        targetUserIds = users.filter(u => u.user_type === 'user').map(u => u.firebase_uid);
      } else if (notificationTarget === 'vendors') {
        targetUserIds = vendors.map(v => v.user_id).filter(Boolean);
      } else if (notificationTarget === 'admins') {
        targetUserIds = admins.map(a => a.firebase_uid);
      } else if (notificationTarget === 'custom') {
        targetUserIds = customUserIds;
      }

      if (targetUserIds.length === 0) {
        setSuccessMessage('No recipients selected.');
        return;
      }

      await sendNotificationViaService(targetUserIds, notificationTitle, notificationMessage);
      setSuccessMessage(`Notification sent to ${targetUserIds.length} users.`);
      setShowNotificationModal(false);
      setNotificationTitle('');
      setNotificationMessage('');
      setCustomUserIds([]);
    } catch (err: any) { setSuccessMessage(`Error: ${err.message}`); } finally { setSendingNotification(false); }
  };

  const handleSuspendUser = async (user: User) => {
    if (!window.confirm(`Suspend user ${user.name}?`)) return;
    try {
      await updateUserRole(user, 'suspended');
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, user_type: 'suspended', is_active: false } : u));
      await sendNotificationViaService([user.firebase_uid], 'Account Suspended', 'Your account has been suspended.');
      setSuccessMessage('User suspended.');
    } catch (err: any) { setSuccessMessage(`Error: ${err.message}`); }
  };

  const handleReactivateUser = async (user: User) => {
    if (!window.confirm(`Reactivate user ${user.name}?`)) return;
    try {
      await updateUserRole(user, 'user');
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, user_type: 'user', is_active: true } : u));
      await sendNotificationViaService([user.firebase_uid], 'Account Reactivated', 'Your account has been reactivated.');
      setSuccessMessage('User reactivated.');
    } catch (err: any) { setSuccessMessage(`Error: ${err.message}`); }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`⚠️ Permanently delete user ${user.name}?`)) return;
    try {
      await supabase.from('users').delete().eq('id', user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setSuccessMessage('User deleted.');
    } catch (err: any) { setSuccessMessage(`Error: ${err.message}`); }
  };

  const handleToggleProductActive = async (product: Product) => {
    try {
      await supabase
        .from('products')
        .update({ is_active: !product.is_active, updated_at: new Date().toISOString() })
        .eq('id', product.id);
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: !p.is_active } : p));
      setSuccessMessage(`Product ${product.is_active ? 'deactivated' : 'activated'}.`);
    } catch (err: any) { setSuccessMessage(`Error: ${err.message}`); }
  };

  const handlePromoteProduct = async (product: Product) => {
    try {
      const promotionEndsAt = new Date(); promotionEndsAt.setDate(promotionEndsAt.getDate() + 30);
      await supabase
        .from('products')
        .update({ is_promoted: true, promotion_ends_at: promotionEndsAt.toISOString(), updated_at: new Date().toISOString() })
        .eq('id', product.id);
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_promoted: true } : p));
      setSuccessMessage('Product promoted for 30 days.');
    } catch (err: any) { setSuccessMessage(`Error: ${err.message}`); }
  };

  const addCustomUserId = () => {
    if (customUserIdInput.trim() && !customUserIds.includes(customUserIdInput.trim())) {
      setCustomUserIds([...customUserIds, customUserIdInput.trim()]);
      setCustomUserIdInput('');
    }
  };
  const removeCustomUserId = (id: string) => setCustomUserIds(customUserIds.filter(uid => uid !== id));

  // -------------------- Render --------------------
  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-loading-spinner"></div>
        <p>Loading admin panel...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error">
        <AlertCircle size={48} />
        <h3>Access Error</h3>
        <p>{error}</p>
        <button onClick={() => navigate('/')}>Go to Home</button>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="admin">
      {/* Sidebar toggle - always visible */}
      <button className="admin-sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
        <Menu size={20} />
      </button>

      {/* Sidebar */}
      <aside ref={sidebarRef} className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <h2>GoStorez Admin</h2>
          <button className="admin-sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </button>
        </div>

        <nav className="admin-nav">
          <button className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => { setActiveTab('overview'); setSidebarOpen(false); }}><Home size={18} /><span>Overview</span></button>
          <button className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); loadUsers(true); setSidebarOpen(false); }}><Users size={18} /><span>Users</span><span className="admin-badge">{stats.totalUsers}</span></button>
          <button className={`admin-nav-item ${activeTab === 'vendors' ? 'active' : ''}`} onClick={() => { setActiveTab('vendors'); loadVendors(true); setSidebarOpen(false); }}><Store size={18} /><span>Vendors</span><span className="admin-badge">{stats.totalVendors}</span></button>
          <button className={`admin-nav-item ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => { setActiveTab('orders'); loadOrders(true); setSidebarOpen(false); }}><ShoppingBag size={18} /><span>Orders</span><span className="admin-badge">{stats.totalOrders}</span></button>
          <button className={`admin-nav-item ${activeTab === 'products' ? 'active' : ''}`} onClick={() => { setActiveTab('products'); loadProducts(true); setSidebarOpen(false); }}><Package size={18} /><span>Products</span><span className="admin-badge">{stats.totalProducts}</span></button>
          <button className={`admin-nav-item ${activeTab === 'admins' ? 'active' : ''}`} onClick={() => { setActiveTab('admins'); loadAdminsFromFirestore(); setSidebarOpen(false); }}><Shield size={18} /><span>Admins</span><span className="admin-badge">{stats.totalAdmins}</span></button>
          <button className={`admin-nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => { setActiveTab('notifications'); loadNotifications(); setSidebarOpen(false); }}><Bell size={18} /><span>Notifications</span><span className="admin-badge">{notifications.length}</span></button>
          <button className={`admin-nav-item ${activeTab === 'feedbacks' ? 'active' : ''}`} onClick={() => { setActiveTab('feedbacks'); loadFeedbacks(); setSidebarOpen(false); }}><MessageCircleIcon size={18} /><span>Feedbacks</span><span className="admin-badge">{feedbacks.length}</span></button>
          <button className={`admin-nav-item ${activeTab === 'faq' ? 'active' : ''}`} onClick={() => { setActiveTab('faq'); loadFaqs(); setSidebarOpen(false); }}><HelpCircle size={18} /><span>FAQ</span><span className="admin-badge">{faqs.length}</span></button>
          <button className={`admin-nav-item ${activeTab === 'support' ? 'active' : ''}`} onClick={() => { setActiveTab('support'); loadSupportRecipients(); setSidebarOpen(false); }}><Headphones size={18} /><span>Support</span><span className="admin-badge">{supportRecipients.length}</span></button>
          <button className={`admin-nav-item ${activeTab === 'openmarket' ? 'active' : ''}`} onClick={() => { setActiveTab('openmarket'); loadOpenMarketData(); setSidebarOpen(false); }}><Video size={18} /><span>Community</span><span className="admin-badge">{openMarketPosts.length}</span></button>
          <button className={`admin-nav-item ${activeTab === 'funding' ? 'active' : ''}`} onClick={() => { setActiveTab('funding'); loadMoneyRecords(); setSidebarOpen(false); }}><Wallet size={18} /><span>Funding</span><span className="admin-badge">{moneyRecords.length}</span></button>
          <button className={`admin-nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}><Settings size={18} /><span>Settings</span></button>
        </nav>

        {/* Quick Action Buttons */}
        <div className="admin-quick-actions">
          <button className="admin-quick-action-btn" onClick={() => navigate('/payment')}>
            <ArrowDownToLine size={16} /> Deposit
          </button>
          <button className="admin-quick-action-btn" onClick={() => navigate('/admin/withdraw')}>
            <ArrowUpFromLine size={16} /> Withdraw
          </button>
        </div>

        <div className="admin-sidebar-footer">
          <button className="admin-logout-btn" onClick={() => auth.signOut()}><LogOut size={16} /><span>Logout</span></button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`admin-main ${sidebarOpen ? 'sidebar-open' : ''}`}>
        {/* Success banner */}
        {successMessage && (
          <div className="admin-success-banner">
            <CheckCircle size={16} />
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage('')}><X size={14} /></button>
          </div>
        )}

        {/* Header */}
        <header className="admin-header">
          <div className="admin-header-actions" style={{ marginLeft: 'auto' }}>
            {activeTab !== 'overview' && activeTab !== 'notifications' && activeTab !== 'settings' && activeTab !== 'feedbacks' && activeTab !== 'faq' && activeTab !== 'support' && activeTab !== 'openmarket' && activeTab !== 'funding' && (
              <div className="admin-search-box">
                <Search size={16} />
                <input type="text" placeholder={`Search ${activeTab}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                {searchTerm && <button className="admin-clear-search" onClick={() => setSearchTerm('')}><X size={14} /></button>}
              </div>
            )}

            {(activeTab === 'orders' || activeTab === 'products') && (
              <select className="admin-filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">All</option>
                {activeTab === 'orders' && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </>
                )}
                {activeTab === 'products' && (
                  <>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="promoted">Promoted</option>
                  </>
                )}
              </select>
            )}

            {activeTab === 'funding' && (
              <div className="admin-feedback-filters">
                <select 
                  className="admin-filter-select" 
                  value={fundingFilter} 
                  onChange={(e) => setFundingFilter(e.target.value as any)}
                >
                  <option value="all">All Transactions</option>
                  <option value="deposit">Deposits</option>
                  <option value="withdrawal">Withdrawals</option>
                  <option value="transfer">Transfers</option>
                </select>
                
                <button 
                  className={`admin-sort-btn ${fundingSort === 'desc' ? 'active' : ''}`}
                  onClick={() => setFundingSort(fundingSort === 'desc' ? 'asc' : 'desc')}
                >
                  {fundingSort === 'desc' ? <SortDesc size={14} /> : <SortAsc size={14} />}
                  {fundingSort === 'desc' ? 'Newest First' : 'Oldest First'}
                </button>
                
                <button className="admin-refresh-btn" onClick={() => loadMoneyRecords()} title="Refresh">
                  <RefreshCw size={14} />
                </button>
              </div>
            )}

            {activeTab === 'feedbacks' && (
              <div className="admin-feedback-filters">
                <select 
                  className="admin-filter-select" 
                  value={feedbackTypeFilter} 
                  onChange={(e) => setFeedbackTypeFilter(e.target.value as FeedbackFilterType)}
                >
                  <option value="all">All Types</option>
                  <option value="complaint">Complaints</option>
                  <option value="bug">Bug Reports</option>
                  <option value="suggestion">Suggestions</option>
                  <option value="feature">Feature Requests</option>
                  <option value="other">Other</option>
                </select>
                
                <select 
                  className="admin-filter-select" 
                  value={feedbackReplyFilter} 
                  onChange={(e) => setFeedbackReplyFilter(e.target.value as FeedbackReplyStatus)}
                >
                  <option value="all">All</option>
                  <option value="replied">Replied</option>
                  <option value="unreplied">Unreplied</option>
                </select>
                
                <button 
                  className={`admin-sort-btn ${feedbackSort === 'recent' ? 'active' : ''}`}
                  onClick={() => setFeedbackSort(feedbackSort === 'recent' ? 'oldest' : 'recent')}
                >
                  {feedbackSort === 'recent' ? <SortDesc size={14} /> : <SortAsc size={14} />}
                  {feedbackSort === 'recent' ? 'Recent First' : 'Oldest First'}
                </button>
              </div>
            )}

            {(activeTab === 'faq' || activeTab === 'support') && (
              <button className="admin-action-button" onClick={() => { 
                setEditingFaq(null); 
                setFaqQuestion(''); 
                setFaqAnswer(''); 
                setShowFaqModal(activeTab === 'faq');
                setShowSupportModal(activeTab === 'support');
                if (activeTab === 'support') {
                  setSupportEmail('');
                  setSupportUserId('');
                  setEditingSupport(null);
                }
              }}>
                <Plus size={16} /> Add {activeTab === 'faq' ? 'FAQ' : 'Support Recipient'}
              </button>
            )}

            {activeTab === 'notifications' && (
              <button className="admin-action-button" onClick={() => setShowNotificationModal(true)}>
                <Send size={16} /> New Notification
              </button>
            )}
          </div>
        </header>

        {/* Tab Content */}
        <div className="admin-tab-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="admin-overview">
              <div className="admin-overview-header">
                <img src={logo} alt="GoStorez" className="admin-overview-logo" />
                <div className="admin-overview-name">Gostorez Administrator: <span>{currentAdminName}</span></div>
                <h2 className="admin-overview-title">Dashboard Overview</h2>
              </div>

              <div className="admin-stats-grid">
                <div className="admin-stat-card" onClick={() => { setActiveTab('users'); loadUsers(true); }}>
                  <div className="admin-stat-icon users"><Users size={24} /></div>
                  <div className="admin-stat-info"><h3>Total Users</h3><p>{stats.totalUsers.toLocaleString()}</p><small>+{stats.usersLast7Days} this week</small></div>
                </div>
                <div className="admin-stat-card" onClick={() => { setActiveTab('vendors'); loadVendors(true); }}>
                  <div className="admin-stat-icon vendors"><Store size={24} /></div>
                  <div className="admin-stat-info"><h3>Vendors</h3><p>{stats.totalVendors.toLocaleString()}</p></div>
                </div>
                <div className="admin-stat-card" onClick={() => { setActiveTab('admins'); loadAdminsFromFirestore(); }}>
                  <div className="admin-stat-icon admins"><Shield size={24} /></div>
                  <div className="admin-stat-info"><h3>Admins</h3><p>{stats.totalAdmins.toLocaleString()}</p></div>
                </div>
                <div className="admin-stat-card" onClick={() => { setActiveTab('products'); loadProducts(true); }}>
                  <div className="admin-stat-icon products"><Package size={24} /></div>
                  <div className="admin-stat-info"><h3>Products</h3><p>{stats.totalProducts.toLocaleString()}</p></div>
                </div>
                <div className="admin-stat-card" onClick={() => { setActiveTab('orders'); loadOrders(true); }}>
                  <div className="admin-stat-icon orders"><ShoppingBag size={24} /></div>
                  <div className="admin-stat-info"><h3>Orders</h3><p>{stats.totalOrders.toLocaleString()}</p><small>+{stats.ordersLast7Days} this week</small></div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-icon revenue"><TrendingUp size={24} /></div>
                  <div className="admin-stat-info"><h3>Revenue</h3><p>{formatCurrency(stats.totalRevenue)}</p></div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-icon balance"><DollarSign size={24} /></div>
                  <div className="admin-stat-info"><h3>User Balances</h3><p>{formatCurrency(stats.totalUserBalance)}</p></div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-icon pending"><Clock size={24} /></div>
                  <div className="admin-stat-info"><h3>Vendor Pending</h3><p>{formatCurrency(stats.totalVendorPending)}</p></div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-icon available"><CheckCircle size={24} /></div>
                  <div className="admin-stat-info"><h3>Vendor Available</h3><p>{formatCurrency(stats.totalVendorAvailable)}</p></div>
                </div>
                <div className="admin-stat-card total-money">
                  <div className="admin-stat-icon money"><CreditCard size={24} /></div>
                  <div className="admin-stat-info"><h3>Total in App</h3><p>{formatCurrency(stats.totalUserBalance + stats.totalVendorPending + stats.totalVendorAvailable)}</p></div>
                </div>
              </div>

              <div className="admin-recent-notifications">
                <h2>Recent Notifications</h2>
                <div className="admin-notification-list">
                  {notifications.length === 0 ? <p>No notifications</p> : notifications.map(n => (
                    <div key={n.id} className="admin-notification-item">
                      <Bell size={14} />
                      <div className="admin-notification-content">
                        <strong>{n.title}</strong>
                        <p>{n.body}</p>
                        <span className="admin-notification-time">{getTimeAgo(n.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <SimpleInfiniteScroll dataLength={users.length} next={() => loadUsers()} hasMore={hasMoreUsers} loader={<div className="admin-scroll-loader">Loading more users...</div>}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('name')}>User {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('email')}>Email {sortConfig.key === 'email' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th>Phone</th>
                    <th onClick={() => handleSort('balance')}>Balance {sortConfig.key === 'balance' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th>Shops</th>
                    <th onClick={() => handleSort('user_type')}>Type {sortConfig.key === 'user_type' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>
                        <div className="admin-user-info">
                          {user.avatar_url ? <img src={user.avatar_url} alt={user.name} className="admin-avatar" /> : <div className="admin-avatar-placeholder">{user.name?.charAt(0) || 'U'}</div>}
                          <span>{user.name || 'No name'}</span>
                        </div>
                       </td>
                       <td>{user.email}</td>
                       <td>{user.phone || '—'}</td>
                      <td className="admin-balance-cell">{formatCurrency(user.balance || 0)}</td>
                       <td>{user.shops && user.shops.length > 0 ? <span className="admin-shop-count">{user.shops.length}</span> : '—'}</td>
                       <td><span className={`admin-badge-type ${user.user_type}`}>{user.user_type}</span></td>
                       <td>
                        <div className="admin-action-buttons">
                          <button className="admin-action-btn view" onClick={() => { setUserDetail(user); setShowUserDetailModal(true); }} title="View"><Eye size={16} /></button>
                          <button className="admin-action-btn credit" onClick={() => { setSelectedUser(user); setBalanceAction('credit'); setBalanceAmount(''); setBalanceReason(''); setShowUserModal(true); }} title="Credit"><Plus size={16} /></button>
                          <button className="admin-action-btn debit" onClick={() => { setSelectedUser(user); setBalanceAction('debit'); setBalanceAmount(''); setBalanceReason(''); setShowUserModal(true); }} title="Debit"><Minus size={16} /></button>
                          <button className="admin-action-btn notify" onClick={() => { setNotificationTarget('custom'); setCustomUserIds([user.firebase_uid]); setShowNotificationModal(true); }} title="Notify"><Send size={16} /></button>
                          {user.user_type !== 'admin' && user.user_type !== 'suspended' && (
                            <button className="admin-action-btn make-admin" onClick={() => handleMakeAdmin(user)} title="Make Admin"><Shield size={16} /></button>
                          )}
                          {user.user_type !== 'suspended' ? (
                            <button className="admin-action-btn suspend" onClick={() => handleSuspendUser(user)} title="Suspend"><UserX size={16} /></button>
                          ) : (
                            <button className="admin-action-btn reactivate" onClick={() => handleReactivateUser(user)} title="Reactivate"><UserCheck size={16} /></button>
                          )}
                          <button className="admin-action-btn delete" onClick={() => setDeleteTarget({ type: 'user', id: user.id, name: user.name })} title="Delete"><Trash2 size={16} /></button>
                        </div>
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </SimpleInfiniteScroll>
          )}

          {/* Vendors Tab */}
          {activeTab === 'vendors' && (
            <SimpleInfiniteScroll dataLength={vendors.length} next={() => loadVendors()} hasMore={hasMoreVendors} loader={<div className="admin-scroll-loader">Loading more vendors...</div>}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('shop_name')}>Shop {sortConfig.key === 'shop_name' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('business_email')}>Email {sortConfig.key === 'business_email' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th>Phone</th>
                    <th onClick={() => handleSort('total_products')}>Products {sortConfig.key === 'total_products' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('total_sales')}>Sales {sortConfig.key === 'total_sales' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('average_rating')}>Rating {sortConfig.key === 'average_rating' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('pending_balance')}>Pending {sortConfig.key === 'pending_balance' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('available_balance')}>Available {sortConfig.key === 'available_balance' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map(vendor => (
                    <tr key={vendor.id}>
                      <td>
                        <div className="admin-user-info">
                          {vendor.profile_image ? <img src={vendor.profile_image} alt={vendor.shop_name} className="admin-avatar" /> : <div className="admin-avatar-placeholder">{vendor.shop_name?.charAt(0) || 'S'}</div>}
                          <span>{vendor.shop_name || 'Unnamed'}</span>
                        </div>
                       </td>
                       <td>{vendor.business_email || '—'}</td>
                       <td>{vendor.contact_phone || '—'}</td>
                       <td>{vendor.total_products || 0}</td>
                       <td>{vendor.total_sales || 0}</td>
                       <td><div className="admin-rating"><Star size={12} fill="currentColor" /><span>{(vendor.average_rating || 0).toFixed(1)}</span></div></td>
                      <td className="admin-balance-cell">{formatCurrency(vendor.pending_balance || 0)}</td>
                      <td className="admin-balance-cell">{formatCurrency(vendor.available_balance || 0)}</td>
                       <td>
                        <div className="admin-action-buttons">
                          <button className="admin-action-btn view" onClick={() => { setVendorDetail(vendor); setShowVendorDetailModal(true); }} title="View"><Eye size={16} /></button>
                          <button className="admin-action-btn credit" onClick={() => { setSelectedVendor(vendor); setBalanceAction('credit'); setBalanceAmount(''); setShowUserModal(true); }} title="Credit"><Plus size={16} /></button>
                          <button className="admin-action-btn debit" onClick={() => { setSelectedVendor(vendor); setBalanceAction('debit'); setBalanceAmount(''); setShowUserModal(true); }} title="Debit"><Minus size={16} /></button>
                          <button className="admin-action-btn transfer" onClick={() => { setSelectedVendor(vendor); setFundAmount(''); setShowVendorFundModal(true); }} title="Transfer"><ArrowLeftRight size={16} /></button>
                          <button className="admin-action-btn notify" onClick={() => { setNotificationTarget('custom'); setCustomUserIds([vendor.user_id]); setShowNotificationModal(true); }} title="Notify"><Send size={16} /></button>
                        </div>
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </SimpleInfiniteScroll>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <SimpleInfiniteScroll dataLength={orders.length} next={() => loadOrders()} hasMore={hasMoreOrders} loader={<div className="admin-scroll-loader">Loading more orders...</div>}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('order_number')}>Order # {sortConfig.key === 'order_number' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('user_name')}>Customer {sortConfig.key === 'user_name' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('total_amount')}>Amount {sortConfig.key === 'total_amount' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('status')}>Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('payment_status')}>Payment {sortConfig.key === 'payment_status' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('created_at')}>Date {sortConfig.key === 'created_at' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td className="admin-order-number">{order.order_number}</td>
                       <td><div>{order.user_name}</div><div className="admin-small">{order.user_email}</div></td>
                      <td className="admin-amount">{formatCurrency(order.total_amount)}</td>
                       <td><span className={`admin-status-badge ${order.status}`}>{order.status}</span></td>
                       <td><span className={`admin-payment-badge ${order.payment_status}`}>{order.payment_status}</span></td>
                       <td>{formatDate(order.created_at)}</td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </SimpleInfiniteScroll>
          )}

          {/* Products Tab */}
          {activeTab === 'products' && (
            <SimpleInfiniteScroll dataLength={products.length} next={() => loadProducts()} hasMore={hasMoreProducts} loader={<div className="admin-scroll-loader">Loading more products...</div>}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('title')}>Product {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('vendor_name')}>Vendor {sortConfig.key === 'vendor_name' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('price')}>Price {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('inventory')}>Stock {sortConfig.key === 'inventory' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('category')}>Category {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('views_count')}>Views {sortConfig.key === 'views_count' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.id}>
                      <td>
                        <div className="admin-product-info">
                          {product.images && product.images[0] ? <img src={product.images[0]} alt={product.title} className="admin-product-thumb" /> : <div className="admin-product-thumb-placeholder"><Package size={16} /></div>}
                          <span className="admin-product-title">{product.title}</span>
                        </div>
                       </td>
                       <td>{product.vendor_name || '—'}</td>
                      <td className="admin-amount">{formatCurrency(product.price)}</td>
                       <td><span className={`admin-stock-badge ${product.inventory < 5 ? 'low' : 'ok'}`}>{product.inventory}</span></td>
                       <td>{product.category || '—'}</td>
                       <td>{product.views_count || 0}</td>
                       <td>
                        <span className={`admin-status-badge ${product.is_active ? 'active' : 'inactive'}`}>{product.is_active ? 'Active' : 'Inactive'}</span>
                        {product.is_promoted && <span className="admin-promo-badge">Promo</span>}
                       </td>
                       <td>
                        <div className="admin-action-buttons">
                          <button className="admin-action-btn view" title="View"><Eye size={16} /></button>
                          <button className="admin-action-btn edit" title="Edit"><Edit size={16} /></button>
                          <button className={`admin-action-btn ${product.is_active ? 'deactivate' : 'activate'}`} onClick={() => handleToggleProductActive(product)} title={product.is_active ? 'Deactivate' : 'Activate'}>{product.is_active ? <X size={16} /> : <CheckCircle size={16} />}</button>
                          {!product.is_promoted && <button className="admin-action-btn promote" onClick={() => handlePromoteProduct(product)} title="Promote"><TrendingUp size={16} /></button>}
                        </div>
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </SimpleInfiniteScroll>
          )}

          {/* Admins Tab */}
          {activeTab === 'admins' && (
            <SimpleInfiniteScroll dataLength={admins.length} next={() => loadAdminsFromFirestore()} hasMore={hasMoreAdmins} loader={<div className="admin-scroll-loader">Loading more admins...</div>}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('name')}>Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th onClick={() => handleSort('email')}>Email {sortConfig.key === 'email' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</th>
                    <th>Phone</th>
                    <th>Last Seen</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map(admin => (
                    <tr key={admin.id}>
                      <td>
                        <div className="admin-user-info">
                          {admin.avatar_url ? <img src={admin.avatar_url} alt={admin.name} className="admin-avatar" /> : <div className="admin-avatar-placeholder">{admin.name?.charAt(0) || 'A'}</div>}
                          <span>{admin.name}</span>
                        </div>
                       </td>
                       <td>{admin.email}</td>
                       <td>{admin.phone || '—'}</td>
                       <td>{admin.last_seen ? getTimeAgo(admin.last_seen) : '—'}</td>
                       <td>
                        <div className="admin-action-buttons">
                          <button className="admin-action-btn view" onClick={() => { setUserDetail(admin); setShowUserDetailModal(true); }} title="View"><Eye size={16} /></button>
                          <button className="admin-action-btn remove-admin" onClick={() => handleRemoveAdmin(admin)} title="Remove Admin"><UserMinus size={16} /></button>
                        </div>
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </SimpleInfiniteScroll>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="admin-notifications-tab">
              <div className="admin-notifications-list">
                {notifications.length === 0 ? <p>No notifications</p> : notifications.map(n => (
                  <div key={n.id} className="admin-notification-item">
                    <Bell size={14} />
                    <div className="admin-notification-content">
                      <strong>{n.title}</strong>
                      <p>{n.body}</p>
                      <span className="admin-notification-time">{getTimeAgo(n.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedbacks Tab */}
          {activeTab === 'feedbacks' && (
            <div className="admin-feedbacks-container">
              {feedbacks.length === 0 ? (
                <div className="admin-feedbacks-empty">
                  <MessageCircleIcon size={48} />
                  <p>No feedbacks found</p>
                </div>
              ) : (
                <div className="admin-feedbacks-list">
                  {feedbacks.map((feedback) => (
                    <div key={feedback.id} className="admin-feedback-card">
                      <div className="admin-feedback-header">
                        <div className="admin-feedback-user">
                          <div className="admin-feedback-avatar">
                            {feedback.sender_name?.charAt(0) || 'U'}
                          </div>
                          <div className="admin-feedback-userinfo">
                            <span className="admin-feedback-name">{feedback.sender_name || 'Anonymous'}</span>
                            <span className="admin-feedback-email">{feedback.sender_email}</span>
                            <span className="admin-feedback-id">ID: {feedback.sender_id?.substring(0, 12)}...</span>
                          </div>
                        </div>
                        <div className="admin-feedback-meta">
                          <div className={`admin-feedback-type ${feedback.feedback_type}`}>
                            {getTypeIcon(feedback.feedback_type)}
                            <span>{getTypeLabel(feedback.feedback_type)}</span>
                          </div>
                          <div className="admin-feedback-date">{formatDate(feedback.created_at)}</div>
                        </div>
                      </div>
                      
                      <div className="admin-feedback-question">
                        <p>{feedback.question}</p>
                      </div>
                      
                      {feedback.answer && (
                        <div className="admin-feedback-answer">
                          <div className="admin-feedback-answer-label">
                            <Reply size={12} />
                            <span>Admin Response:</span>
                          </div>
                          <p>{feedback.answer}</p>
                        </div>
                      )}
                      
                      <div className="admin-feedback-actions">
                        <button 
                          className={`admin-feedback-approve ${feedback.approved ? 'approved' : ''}`}
                          onClick={() => handleToggleApprove(feedback)}
                          disabled={togglingApprove === feedback.id}
                        >
                          {togglingApprove === feedback.id ? (
                            <Loader size={14} className="spin" />
                          ) : (
                            <>
                              {feedback.approved ? <CheckCircle size={14} /> : <X size={14} />}
                              {feedback.approved ? 'Approved' : 'Approve'}
                            </>
                          )}
                        </button>
                        
                        <button 
                          className="admin-feedback-reply"
                          onClick={() => { setSelectedFeedback(feedback); setReplyText(feedback.answer || ''); setShowReplyModal(true); }}
                        >
                          <Reply size={14} />
                          {feedback.answer ? 'Edit Reply' : 'Reply'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FAQ Tab */}
          {activeTab === 'faq' && (
            <div className="admin-faq-container">
              <div className="admin-faq-list">
                {faqs.length === 0 ? (
                  <div className="admin-faq-empty">
                    <HelpCircle size={48} />
                    <p>No FAQs yet. Click "Add FAQ" to create one.</p>
                  </div>
                ) : (
                  faqs.map((faq, index) => (
                    <div key={faq.id} className="admin-faq-item">
                      <div className="admin-faq-header">
                        <div className="admin-faq-order">{index + 1}</div>
                        <div className="admin-faq-content">
                          <div className="admin-faq-question">{faq.question}</div>
                          <div className="admin-faq-answer-preview">{faq.answer.substring(0, 100)}{faq.answer.length > 100 ? '...' : ''}</div>
                        </div>
                        <div className="admin-faq-actions">
                          <button className="admin-faq-edit" onClick={() => handleEditFaq(faq)}>
                            <Edit size={16} />
                          </button>
                          <button className="admin-faq-delete" onClick={() => setDeleteTarget({ type: 'faq', id: faq.id, name: faq.question })}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Support Tab */}
          {activeTab === 'support' && (
            <div className="admin-support-container">
              <div className="admin-support-list">
                {supportRecipients.length === 0 ? (
                  <div className="admin-support-empty">
                    <Headphones size={48} />
                    <p>No support recipients yet. Click "Add Support Recipient" to create one.</p>
                  </div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>User ID (Firebase UID)</th>
                        <th>Created At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supportRecipients.map((recipient) => (
                        <tr key={recipient.id}>
                          <td>{recipient.email || '—'}</td>
                          <td><code className="admin-support-userid">{recipient.user_id || '—'}</code></td>
                          <td>{formatDate(recipient.created_at)}</td>
                          <td>
                            <div className="admin-action-buttons">
                              <button 
                                className="admin-action-btn edit" 
                                onClick={() => handleEditSupport(recipient)} 
                                title="Edit"
                              >
                                <Edit size={16} />
                              </button>
                              <button 
                                className="admin-action-btn delete" 
                                onClick={() => setDeleteTarget({ type: 'support', id: recipient.id, name: recipient.email || recipient.user_id || 'Recipient' })} 
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Funding Tab */}
          {activeTab === 'funding' && (
            <div className="admin-funding-container">
              {/* Stats Cards */}
              <div className="admin-funding-stats">
                <div className="admin-funding-stat-card total">
                  <Wallet size={20} />
                  <div>
                    <span>Total Balance</span>
                    <strong>{formatCurrency(fundingStats.totalBalance)}</strong>
                  </div>
                </div>
                <div className="admin-funding-stat-card pending-deposit">
                  <ArrowDownToLine size={20} />
                  <div>
                    <span>Pending Deposits</span>
                    <strong>{formatCurrency(fundingStats.totalPendingDeposit)}</strong>
                  </div>
                </div>
                <div className="admin-funding-stat-card pending-withdraw">
                  <ArrowUpFromLine size={20} />
                  <div>
                    <span>Pending Withdrawals</span>
                    <strong>{formatCurrency(fundingStats.totalPendingWithdrawal)}</strong>
                  </div>
                </div>
                <div className="admin-funding-stat-card completed-deposit">
                  <CheckCircle size={20} />
                  <div>
                    <span>Completed Deposits</span>
                    <strong>{formatCurrency(fundingStats.totalCompletedDeposit)}</strong>
                  </div>
                </div>
                <div className="admin-funding-stat-card completed-withdraw">
                  <History size={20} />
                  <div>
                    <span>Completed Withdrawals</span>
                    <strong>{formatCurrency(fundingStats.totalCompletedWithdrawal)}</strong>
                  </div>
                </div>
                <div className="admin-funding-stat-card transfers">
                  <Send size={20} />
                  <div>
                    <span>Transfers</span>
                    <strong>{formatCurrency(fundingStats.totalTransfers)}</strong>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div className="admin-funding-transactions">
                <h3>All Transactions</h3>
                {filteredMoneyRecords.length === 0 ? (
                  <div className="admin-empty-state">
                    <History size={48} />
                    <p>No transactions found</p>
                  </div>
                ) : (
                  <div className="admin-funding-list">
                    {filteredMoneyRecords.map((record) => {
                      const isSender = true;
                      const amountDisplay = record.type === 'transfer' && record.recipient_id !== record.user_id
                        ? `-₦${record.amount.toLocaleString()}`
                        : record.type === 'deposit' 
                          ? `+₦${record.amount.toLocaleString()}`
                          : `-₦${record.amount.toLocaleString()}`;
                      const amountColor = getAmountColor(record);
                      
                      let displayEmail = '';
                      let displayName = '';
                      let displayAvatar = '';
                      if (record.type === 'transfer') {
                        displayEmail = record.recipient_email || '';
                        displayName = record.recipient_name || 'Recipient';
                        displayAvatar = record.recipient_avatar || '';
                      } else {
                        displayEmail = record.sender_email || '';
                        displayName = record.sender_name || 'User';
                        displayAvatar = record.sender_avatar || '';
                      }

                      return (
                        <div 
                          key={record.id} 
                          className="admin-funding-item" 
                          onClick={() => { setSelectedTransaction(record); setShowTransactionModal(true); }}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="admin-funding-icon">
                            {record.type === 'deposit' && <ArrowDownToLine size={16} className="deposit-icon" />}
                            {record.type === 'withdrawal' && <ArrowUpFromLine size={16} className="withdraw-icon" />}
                            {record.type === 'transfer' && <Send size={16} className="transfer-icon" />}
                          </div>
                          <div className="admin-funding-details">
                            <div className="admin-funding-desc">
                              {record.type === 'deposit' && 'Deposit'}
                              {record.type === 'withdrawal' && 'Withdrawal Request'}
                              {record.type === 'transfer' && `Transfer ${record.user_id === record.user_id ? 'to' : 'from'} ${displayName}`}
                              {record.status === 'pending' && <span className="admin-funding-badge pending">Pending</span>}
                              {record.status === 'approved' && <span className="admin-funding-badge approved">Approved</span>}
                              {record.status === 'rejected' && <span className="admin-funding-badge rejected">Rejected</span>}
                              {record.status === 'completed' && <span className="admin-funding-badge completed">Completed</span>}
                            </div>
                            <div className="admin-funding-meta">
                              <span>{formatDate(record.created_at)}</span>
                              {record.bank_name && <span>• {record.bank_name}</span>}
                            </div>
                            <div className="admin-funding-user">
                              {displayAvatar ? (
                                <img src={displayAvatar} alt="" className="admin-funding-avatar" />
                              ) : (
                                <div className="admin-funding-avatar-placeholder">{displayName?.charAt(0) || 'U'}</div>
                              )}
                              <span>{displayEmail || displayName}</span>
                            </div>
                          </div>
                          <div className="admin-funding-amount" style={{ color: amountColor }}>
                            {amountDisplay}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Open Market Tab */}
          {activeTab === 'openmarket' && (
            <div className="admin-openmarket-container">
              {/* Settings Section */}
              <div className="admin-openmarket-section">
                <h2><Settings size={18} /> Market Settings</h2>
                <div className="admin-openmarket-settings-card">
                  <div className="admin-form-group">
                    <label className="admin-switch-label">
                      <input type="checkbox" checked={omActiveStatus} onChange={(e) => setOmActiveStatus(e.target.checked)} />
                      <span className="admin-switch-slider"></span>
                      <span className="admin-switch-text">Enable Open Market</span>
                    </label>
                  </div>
                  
                  <div className="admin-form-group">
                    <label>Schedule Type</label>
                    <select value={omScheduleType} onChange={(e) => setOmScheduleType(e.target.value as 'once' | 'regular')}>
                      <option value="once">Once (specific date range)</option>
                      <option value="regular">Regular (recurring)</option>
                    </select>
                  </div>
                  
                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label>Open Date & Time</label>
                      <input type="datetime-local" value={omOpenDate} onChange={(e) => setOmOpenDate(e.target.value)} />
                    </div>
                    <div className="admin-form-group">
                      <label>Close Date & Time</label>
                      <input type="datetime-local" value={omCloseDate} onChange={(e) => setOmCloseDate(e.target.value)} />
                    </div>
                  </div>
                  
                  <div className="admin-openmarket-preview">
                    <strong>Preview:</strong>
                    <span className={omActiveStatus ? 'open' : 'closed'}>
                      {omActiveStatus ? 'Market Open' : 'Market Closed'}
                    </span>
                    {omOpenDate && omCloseDate && (
                      <span className="schedule">
                        {new Date(omOpenDate).toLocaleString()} → {new Date(omCloseDate).toLocaleString()}
                      </span>
                    )}
                  </div>
                  
                  <button className="admin-save-btn" onClick={handleSaveOpenMarketSettings} disabled={savingOpenMarket}>
                    {savingOpenMarket ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>

              {/* Video Rooms Section */}
              <div className="admin-openmarket-section">
                <h2><Video size={18} /> Live Video Rooms</h2>
                <div className="admin-openmarket-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Room Name</th>
                        <th>Created By</th>
                        <th>Participants</th>
                        <th>Created</th>
                        <th>Last Active</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openMarketVideoRooms.map(room => (
                        <tr key={room.id}>
                          <td><strong>{room.room_name}</strong></td>
                          <td>{room.created_by_name}</td>
                          <td>{room.participant_count}</td>
                          <td>{getTimeAgo(room.created_at)}</td>
                          <td>{getTimeAgo(room.last_activity)}</td>
                          <td><span className={`admin-status-badge ${room.is_active ? 'active' : 'inactive'}`}>{room.is_active ? 'Active' : 'Ended'}</span></td>
                          <td>
                            <div className="admin-action-buttons">
                              <button className="admin-action-btn delete" onClick={() => setDeleteTarget({ type: 'openmarket_room', id: room.id, name: room.room_name })} title="Delete Room"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {openMarketVideoRooms.length === 0 && (
                        <tr><td colSpan={7} className="admin-empty-cell">No active video rooms</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Posts Section */}
              <div className="admin-openmarket-section">
                <h2><MessageSquare size={18} /> Community Posts</h2>
                <div className="admin-openmarket-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Post</th>
                        <th>Media</th>
                        <th>Likes</th>
                        <th>Comments</th>
                        <th>Created</th>
                        <th>Expires</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openMarketPosts.map(post => (
                        <tr key={post.id}>
                          <td>
                            <div className="admin-user-info">
                              {post.user_avatar ? <img src={post.user_avatar} className="admin-avatar" /> : <div className="admin-avatar-placeholder">{post.user_name?.charAt(0) || 'U'}</div>}
                              <span>{post.user_name}</span>
                            </div>
                          </td>
                          <td className="admin-post-preview">{post.text?.substring(0, 60)}{post.text?.length > 60 ? '...' : ''}</td>
                          <td>{post.media_urls?.length || 0} media</td>
                          <td>{post.likes_count || 0}</td>
                          <td>{post.comments_count || 0}</td>
                          <td>{getTimeAgo(post.created_at)}</td>
                          <td>{getTimeAgo(post.expires_at)}</td>
                          <td>
                            <div className="admin-action-buttons">
                              <button className="admin-action-btn delete" onClick={() => setDeleteTarget({ type: 'openmarket_post', id: post.id, name: `Post by ${post.user_name}` })} title="Delete Post"><Trash2 size={16} /></button>
                              <button className="admin-action-btn block" onClick={() => handleBlockUserFromPost(post.user_id, post.user_name || 'User')} title="Block User from Open Market"><Ban size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {openMarketPosts.length === 0 && (
                        <tr><td colSpan={8} className="admin-empty-cell">No posts yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Blocked Users Section (Blacklist) */}
              <div className="admin-openmarket-section">
                <h2><UserMinus size={18} /> Blocked Users</h2>
                <div className="admin-openmarket-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User ID (Firebase UID)</th>
                        <th>Duration</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openMarketBlacklist.map(entry => (
                        <tr key={entry.id}>
                          <td><code>{entry.user_id}</code></td>
                          <td>{getTimeAgo(entry.created_at)}</td>
                          <td>
                            <div className="admin-action-buttons">
                              <button className="admin-action-btn reactivate" onClick={() => handleUnblockFromBlacklist(entry.id, entry.user_id)} title="Unblock"><UserCheck size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {openMarketBlacklist.length === 0 && (
                        <tr><td colSpan={3} className="admin-empty-cell">No blocked users</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="admin-settings">
              <div className="admin-settings-card" onClick={() => setShowNotificationModal(true)}>
                <Send size={24} />
                <h3>Send Notification</h3>
                <p>Broadcast message to all users or vendors</p>
              </div>
              <div className="admin-stats-section">
                <h3>System Info</h3>
                <div className="admin-stat-row"><span>Total Users:</span> <strong>{stats.totalUsers}</strong></div>
                <div className="admin-stat-row"><span>Total Vendors:</span> <strong>{stats.totalVendors}</strong></div>
                <div className="admin-stat-row"><span>Total Orders:</span> <strong>{stats.totalOrders}</strong></div>
                <div className="admin-stat-row"><span>Total Products:</span> <strong>{stats.totalProducts}</strong></div>
                <div className="admin-stat-row"><span>Total Revenue:</span> <strong>{formatCurrency(stats.totalRevenue)}</strong></div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}

      {/* Transaction Details Modal (Funding Tab) */}
      {showTransactionModal && selectedTransaction && (
        <div className="admin-modal-overlay" onClick={() => setShowTransactionModal(false)}>
          <div className="admin-modal-content admin-modal-large" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Transaction Details</h3>
              <button className="admin-modal-close" onClick={() => setShowTransactionModal(false)}><X size={18} /></button>
            </div>
            <div className="transaction-details">
              <div className="detail-row"><strong>ID:</strong> <code>{selectedTransaction.id}</code></div>
              <div className="detail-row"><strong>Type:</strong> <span className={`type-badge ${selectedTransaction.type}`}>{selectedTransaction.type}</span></div>
              <div className="detail-row"><strong>Amount:</strong> <span style={{ color: getAmountColor(selectedTransaction), fontWeight: 600 }}>{formatCurrency(selectedTransaction.amount)}</span></div>
              <div className="detail-row"><strong>Status:</strong> <span className={`status-badge ${selectedTransaction.status}`}>{selectedTransaction.status}</span></div>
              <div className="detail-row"><strong>Description:</strong> {selectedTransaction.description || '—'}</div>
              <div className="detail-row"><strong>Created At:</strong> {formatDate(selectedTransaction.created_at)}</div>
              
              {selectedTransaction.type === 'deposit' && selectedTransaction.receipt_base64 && (
                <div className="detail-row receipt">
                  <strong>Receipt:</strong>
                  <img src={selectedTransaction.receipt_base64} alt="Receipt" className="receipt-image" />
                </div>
              )}
              
              {selectedTransaction.type === 'withdrawal' && (
                <>
                  <div className="detail-row"><strong>Bank:</strong> {selectedTransaction.bank_name}</div>
                  <div className="detail-row"><strong>Account Number:</strong> {selectedTransaction.account_number}</div>
                  <div className="detail-row"><strong>Account Name:</strong> {selectedTransaction.account_name}</div>
                </>
              )}
              
              {selectedTransaction.type === 'transfer' && (
                <>
                  <div className="detail-row"><strong>From:</strong> {selectedTransaction.sender_email || selectedTransaction.user_id}</div>
                  <div className="detail-row"><strong>To:</strong> {selectedTransaction.recipient_email || selectedTransaction.recipient_id}</div>
                </>
              )}
              
              <div className="detail-row"><strong>User:</strong> {selectedTransaction.sender_name || selectedTransaction.sender_email} ({selectedTransaction.sender_email})</div>
              
              {selectedTransaction.admin_notes && (
                <div className="detail-row"><strong>Admin Notes:</strong> {selectedTransaction.admin_notes}</div>
              )}
            </div>
            
            {/* Action Buttons for Pending Deposits/Withdrawals */}
            {selectedTransaction.status === 'pending' && (
              <div className="admin-modal-actions funding-actions">
                {selectedTransaction.type === 'deposit' && (
                  <>
                    <button 
                      className="admin-approve-btn" 
                      onClick={() => handleApproveDeposit(selectedTransaction)}
                      disabled={processingAction}
                    >
                      {processingAction ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
                      Approve Deposit
                    </button>
                    <button 
                      className="admin-decline-btn" 
                      onClick={() => handleDeclineDeposit(selectedTransaction)}
                      disabled={processingAction}
                    >
                      <X size={16} />
                      Decline Deposit
                    </button>
                  </>
                )}
                {selectedTransaction.type === 'withdrawal' && (
                  <>
                    <button 
                      className="admin-approve-btn" 
                      onClick={() => handleApproveWithdrawal(selectedTransaction)}
                      disabled={processingAction}
                    >
                      {processingAction ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
                      Approve & Send Transfer
                    </button>
                    <button 
                      className="admin-decline-btn" 
                      onClick={() => handleDeclineWithdrawal(selectedTransaction)}
                      disabled={processingAction}
                    >
                      <X size={16} />
                      Decline & Refund
                    </button>
                  </>
                )}
              </div>
            )}
            
            <div className="admin-modal-actions">
              <button className="admin-cancel-btn" onClick={() => setShowTransactionModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Transfer Confirmation Modal */}
      {showWithdrawConfirm && withdrawApprovalData && (
        <div className="admin-modal-overlay" onClick={() => setShowWithdrawConfirm(false)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <h3>Confirm Withdrawal Transfer</h3>
            <p>You are about to process a withdrawal of <strong>{formatCurrency(withdrawApprovalData.amount)}</strong> to:</p>
            <div className="withdraw-details">
              <p><strong>Bank:</strong> {withdrawApprovalData.bankName}</p>
              <p><strong>Account Number:</strong> {withdrawApprovalData.accountNumber}</p>
              <p><strong>Account Name:</strong> {withdrawApprovalData.accountName}</p>
              <p><strong>Recipient:</strong> {withdrawApprovalData.userName} ({withdrawApprovalData.userEmail})</p>
            </div>
            <p className="admin-warning">⚠️ This action will send real money from the merchant account. Ensure details are correct!</p>
            <div className="admin-modal-actions">
              <button className="admin-cancel-btn" onClick={() => setShowWithdrawConfirm(false)}>Cancel</button>
              <button className="admin-confirm-btn transfer" onClick={processWithdrawalTransfer} disabled={processingAction}>
                {processingAction ? 'Processing...' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Balance Modal */}
      {showUserModal && (selectedUser || selectedVendor) && (
        <div className="admin-modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <h3>{balanceAction === 'credit' ? 'Credit' : 'Debit'} {selectedUser ? 'User' : 'Vendor'}</h3>
            <p><strong>{selectedUser?.name || selectedVendor?.shop_name}</strong></p>
            <p>Current Balance: {formatCurrency(selectedUser?.balance || (balanceAction === 'credit' ? selectedVendor?.pending_balance : selectedVendor?.available_balance) || 0)}</p>
            <div className="admin-form-group">
              <label>Amount (₦)</label>
              <input type="number" min="0" step="100" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value ? Number(e.target.value) : '')} placeholder="0" />
            </div>
            <div className="admin-form-group">
              <label>Reason (optional)</label>
              <input type="text" value={balanceReason} onChange={(e) => setBalanceReason(e.target.value)} placeholder="e.g., Refund, promotion" />
            </div>
            <div className="admin-modal-actions">
              <button className="admin-cancel-btn" onClick={() => setShowUserModal(false)}>Cancel</button>
              <button className="admin-send-btn" onClick={handleBalanceAdjust} disabled={!balanceAmount || processingBalance}>
                {processingBalance ? 'Processing...' : (balanceAction === 'credit' ? 'Credit' : 'Debit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Fund Transfer Modal */}
      {showVendorFundModal && selectedVendor && (
        <div className="admin-modal-overlay" onClick={() => setShowVendorFundModal(false)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <h3>Transfer Funds</h3>
            <p><strong>{selectedVendor.shop_name}</strong></p>
            <p>Pending: {formatCurrency(selectedVendor.pending_balance || 0)} | Available: {formatCurrency(selectedVendor.available_balance || 0)}</p>
            <div className="admin-form-group">
              <label>Direction</label>
              <select value={fundDirection} onChange={(e) => setFundDirection(e.target.value as any)}>
                <option value="toAvailable">Pending → Available</option>
                <option value="toPending">Available → Pending</option>
              </select>
            </div>
            <div className="admin-form-group">
              <label>Amount (₦)</label>
              <input type="number" min="0" step="100" value={fundAmount} onChange={(e) => setFundAmount(e.target.value ? Number(e.target.value) : '')} placeholder="0" />
            </div>
            <div className="admin-modal-actions">
              <button className="admin-cancel-btn" onClick={() => setShowVendorFundModal(false)}>Cancel</button>
              <button className="admin-send-btn" onClick={handleVendorFundTransfer} disabled={!fundAmount || processingFund}>
                {processingFund ? 'Processing...' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Notification Modal */}
      {showNotificationModal && (
        <div className="admin-modal-overlay" onClick={() => setShowNotificationModal(false)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <h3>Send Notification</h3>
            <div className="admin-form-group">
              <label>Target Audience</label>
              <select value={notificationTarget} onChange={(e) => setNotificationTarget(e.target.value as any)}>
                <option value="all">All Users</option>
                <option value="users">Regular Users Only</option>
                <option value="vendors">Vendors Only</option>
                <option value="admins">Admins Only</option>
                <option value="custom">Custom User IDs</option>
              </select>
            </div>
            {notificationTarget === 'custom' && (
              <div className="admin-form-group">
                <label>User IDs (Firebase UID)</label>
                <div className="admin-multi-input">
                  <input type="text" value={customUserIdInput} onChange={(e) => setCustomUserIdInput(e.target.value)} placeholder="Enter Firebase UID" />
                  <button type="button" onClick={addCustomUserId} className="admin-add-btn">Add</button>
                </div>
                <div className="admin-tag-list">
                  {customUserIds.map(id => (
                    <span key={id} className="admin-tag">{id.substring(0, 8)}...<button onClick={() => removeCustomUserId(id)}><X size={12} /></button></span>
                  ))}
                </div>
              </div>
            )}
            <div className="admin-form-group"><label>Title</label><input type="text" value={notificationTitle} onChange={(e) => setNotificationTitle(e.target.value)} placeholder="Notification title" /></div>
            <div className="admin-form-group"><label>Message</label><textarea value={notificationMessage} onChange={(e) => setNotificationMessage(e.target.value)} rows={4} placeholder="Notification message" /></div>
            <div className="admin-modal-actions">
              <button className="admin-cancel-btn" onClick={() => setShowNotificationModal(false)}>Cancel</button>
              <button className="admin-send-btn" onClick={handleSendNotification} disabled={!notificationTitle || !notificationMessage || (notificationTarget === 'custom' && customUserIds.length === 0) || sendingNotification}>
                {sendingNotification ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reply to Feedback Modal */}
      {showReplyModal && selectedFeedback && (
        <div className="admin-modal-overlay" onClick={() => setShowReplyModal(false)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <h3>{selectedFeedback.answer ? 'Edit Reply' : 'Reply to Feedback'}</h3>
            <div className="admin-feedback-original">
              <strong>Original Feedback:</strong>
              <p>{selectedFeedback.question}</p>
              <small>From: {selectedFeedback.sender_name} ({selectedFeedback.sender_email})</small>
            </div>
            <div className="admin-form-group">
              <label>Your Reply</label>
              <textarea 
                value={replyText} 
                onChange={(e) => setReplyText(e.target.value)} 
                rows={5} 
                placeholder="Type your response here..."
              />
            </div>
            <div className="admin-modal-actions">
              <button className="admin-cancel-btn" onClick={() => setShowReplyModal(false)}>Cancel</button>
              <button className="admin-send-btn" onClick={handleReplyToFeedback} disabled={sendingReply || !replyText.trim()}>
                {sendingReply ? 'Sending...' : (selectedFeedback.answer ? 'Update Reply' : 'Send Reply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit FAQ Modal */}
      {showFaqModal && (
        <div className="admin-modal-overlay" onClick={() => setShowFaqModal(false)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <h3>{editingFaq ? 'Edit FAQ' : 'Add New FAQ'}</h3>
            <div className="admin-form-group">
              <label>Question</label>
              <input 
                type="text" 
                value={faqQuestion} 
                onChange={(e) => setFaqQuestion(e.target.value)} 
                placeholder="Enter frequently asked question..."
              />
            </div>
            <div className="admin-form-group">
              <label>Answer</label>
              <textarea 
                value={faqAnswer} 
                onChange={(e) => setFaqAnswer(e.target.value)} 
                rows={5} 
                placeholder="Enter detailed answer..."
              />
            </div>
            <div className="admin-modal-actions">
              <button className="admin-cancel-btn" onClick={() => setShowFaqModal(false)}>Cancel</button>
              <button className="admin-send-btn" onClick={editingFaq ? handleUpdateFaq : handleAddFaq} disabled={savingFaq || !faqQuestion.trim() || !faqAnswer.trim()}>
                {savingFaq ? 'Saving...' : (editingFaq ? 'Update' : 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Support Modal */}
      {showSupportModal && (
        <div className="admin-modal-overlay" onClick={() => setShowSupportModal(false)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <h3>{editingSupport ? 'Edit Support Recipient' : 'Add Support Recipient'}</h3>
            <div className="admin-form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                value={supportEmail} 
                onChange={(e) => setSupportEmail(e.target.value)} 
                placeholder="support@example.com"
              />
              <small>Notifications will be sent to this email</small>
            </div>
            <div className="admin-form-group">
              <label>User ID (Firebase UID)</label>
              <input 
                type="text" 
                value={supportUserId} 
                onChange={(e) => setSupportUserId(e.target.value)} 
                placeholder="Firebase user ID"
              />
              <small>In-app and push notifications will be sent to this user</small>
            </div>
            <div className="admin-modal-actions">
              <button className="admin-cancel-btn" onClick={() => setShowSupportModal(false)}>Cancel</button>
              <button className="admin-send-btn" onClick={editingSupport ? handleUpdateSupport : handleAddSupport} disabled={savingSupport || (!supportEmail.trim() && !supportUserId.trim())}>
                {savingSupport ? 'Saving...' : (editingSupport ? 'Update' : 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="admin-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to permanently delete <strong>{deleteTarget.name}</strong>?</p>
            <p className="admin-warning">This action cannot be undone.</p>
            <div className="admin-modal-actions">
              <button className="admin-cancel-btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="admin-delete-btn" onClick={() => { 
                if (deleteTarget.type === 'user') { 
                  const user = users.find(u => u.id === deleteTarget.id); 
                  if (user) handleDeleteUser(user); 
                } else if (deleteTarget.type === 'faq') {
                  const faq = faqs.find(f => f.id === deleteTarget.id);
                  if (faq) handleDeleteFaq(faq);
                } else if (deleteTarget.type === 'support') {
                  const recipient = supportRecipients.find(r => r.id === deleteTarget.id);
                  if (recipient) handleDeleteSupport(recipient);
                } else if (deleteTarget.type === 'openmarket_post') {
                  handleDeleteOpenMarketPost(deleteTarget.id);
                } else if (deleteTarget.type === 'openmarket_room') {
                  handleDeleteOpenMarketRoom(deleteTarget.id);
                }
                setDeleteTarget(null); 
              }}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {showUserDetailModal && userDetail && (
        <div className="admin-modal-overlay" onClick={() => setShowUserDetailModal(false)}>
          <div className="admin-modal-content admin-modal-large" onClick={e => e.stopPropagation()}>
            <h3>User Details</h3>
            <div className="admin-user-detail">
              <div className="admin-detail-row"><span>Firebase UID:</span> <code>{userDetail.firebase_uid}</code></div>
              <div className="admin-detail-row"><span>Name:</span> {userDetail.name}</div>
              <div className="admin-detail-row"><span>Email:</span> {userDetail.email}</div>
              <div className="admin-detail-row"><span>Phone:</span> {userDetail.phone || '—'}</div>
              <div className="admin-detail-row"><span>Balance:</span> {formatCurrency(userDetail.balance || 0)}</div>
              <div className="admin-detail-row"><span>Total Spent:</span> {formatCurrency(userDetail.total_spent || 0)}</div>
              <div className="admin-detail-row"><span>Total Orders:</span> {userDetail.total_orders || 0}</div>
              <div className="admin-detail-row"><span>User Type:</span> <span className={`admin-badge-type ${userDetail.user_type}`}>{userDetail.user_type}</span></div>
              <div className="admin-detail-row"><span>Joined:</span> {formatDate(userDetail.created_at)}</div>
              <div className="admin-detail-row"><span>Last Seen:</span> {userDetail.last_seen ? formatDate(userDetail.last_seen) : '—'}</div>
              <div className="admin-detail-row"><span>Active:</span> {userDetail.is_active ? 'Yes' : 'No'}</div>
              {userDetail.shops && userDetail.shops.length > 0 && (
                <div className="admin-detail-row"><span>Shops:</span> <div className="admin-shop-list">{userDetail.shops.map(shop => <div key={shop.id}>• {shop.shop_name}</div>)}</div></div>
              )}
            </div>
            <div className="admin-modal-actions"><button className="admin-cancel-btn" onClick={() => setShowUserDetailModal(false)}>Close</button></div>
          </div>
        </div>
      )}

      {/* Vendor Detail Modal */}
      {showVendorDetailModal && vendorDetail && (
        <div className="admin-modal-overlay" onClick={() => setShowVendorDetailModal(false)}>
          <div className="admin-modal-content admin-modal-large" onClick={e => e.stopPropagation()}>
            <h3>Vendor Details</h3>
            <div className="admin-user-detail">
              <div className="admin-detail-row"><span>Vendor ID:</span> <code>{vendorDetail.vendor_id}</code></div>
              <div className="admin-detail-row"><span>User ID (Firebase):</span> <code>{vendorDetail.user_id}</code></div>
              <div className="admin-detail-row"><span>Shop Name:</span> {vendorDetail.shop_name}</div>
              <div className="admin-detail-row"><span>Business Email:</span> {vendorDetail.business_email || '—'}</div>
              <div className="admin-detail-row"><span>Contact Phone:</span> {vendorDetail.contact_phone || '—'}</div>
              <div className="admin-detail-row"><span>Products:</span> {vendorDetail.total_products || 0}</div>
              <div className="admin-detail-row"><span>Sales:</span> {vendorDetail.total_sales || 0}</div>
              <div className="admin-detail-row"><span>Rating:</span> {vendorDetail.average_rating?.toFixed(1) || '0.0'}</div>
              <div className="admin-detail-row"><span>Pending Balance:</span> {formatCurrency(vendorDetail.pending_balance || 0)}</div>
              <div className="admin-detail-row"><span>Available Balance:</span> {formatCurrency(vendorDetail.available_balance || 0)}</div>
              <div className="admin-detail-row"><span>Created:</span> {formatDate(vendorDetail.created_at)}</div>
              <div className="admin-detail-row"><span>Active:</span> {vendorDetail.is_active ? 'Yes' : 'No'}</div>
            </div>
            <div className="admin-modal-actions"><button className="admin-cancel-btn" onClick={() => setShowVendorDetailModal(false)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;