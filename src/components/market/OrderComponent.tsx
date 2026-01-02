import React, { useState, useEffect } from 'react';
import { auth } from '../../lib/firebase';
import { supabase } from '../../lib/supabaseClient';
import { User } from 'firebase/auth';
import { Shield, AlertCircle, CheckCircle, CreditCard, X, Receipt, Store, User as UserIcon, Package } from 'lucide-react';
import './OrderComponent.css';

// Types
interface Product {
  id: string;
  title: string;
  price: number;
  currency: string;
  vendor_id: string;
  vendor_name: string;
  inventory: number;
  images: string[];
}

interface CartItem {
  id: string;
  product_id: string;
  vendor_id: string;
  quantity: number;
  product: Product;
}

interface UserProfile {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: string;
  balance?: number;
  total_spent?: number;
  total_orders?: number;
  profileImage?: string;
}

interface VendorProfile {
  id: string;
  vendor_id: string;
  shop_name: string;
  profile_image: string;
  balance?: number;
  total_earnings?: number;
  total_sales?: number;
  pending_balance?: number;
  available_balance?: number;
}

interface LocationStep {
  state_id?: number;
  university_id?: number;
  campus_id?: number;
  precise_location?: string;
  state_name?: string;
  university_name?: string;
  campus_name?: string;
}

interface OrderItem {
  order_id: string;
  product_id: string;
  vendor_id: string;
  product_title: string;
  vendor_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: 'pending' | 'accepted' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'reversed';
  location_details?: any;
}

interface Transaction {
  id: string;
  order_id: string;
  user_id: string;
  vendor_id?: string;
  type: 'purchase' | 'vendor_credit' | 'refund' | 'reversal' | 'deposit';
  amount: number;
  old_balance: number;
  new_balance: number;
  description: string;
  metadata?: any;
}

interface OrderComponentProps {
  cartItems: CartItem[];
  locationStep: LocationStep;
  userProfile: UserProfile | null;
  totalAmount: number;
  onOrderSuccess: (orderId: string) => void;
  onClose: () => void;
}

const OrderComponent: React.FC<OrderComponentProps> = ({
  cartItems,
  locationStep,
  userProfile,
  totalAmount,
  onOrderSuccess,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'confirm' | 'processing' | 'success' | 'insufficient'>('confirm');
  const [orderId, setOrderId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [userBalance, setUserBalance] = useState<number>(0);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [vendors, setVendors] = useState<VendorProfile[]>([]);

  // Initialize component
  useEffect(() => {
    loadUserBalance();
    loadVendorProfiles();
  }, []);

  const loadUserBalance = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Check if user exists in Supabase users table
      const { data: supabaseUser, error } = await supabase
        .from('users')
        .select('balance, total_spent, total_orders')
        .eq('firebase_uid', user.uid)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (supabaseUser) {
        setUserBalance(supabaseUser.balance || 0);
      } else {
        // Create user in Supabase if doesn't exist
        await createSupabaseUser(user);
        setUserBalance(0);
      }
    } catch (error) {
      console.error('Error loading user balance:', error);
      setUserBalance(0);
    }
  };

  const createSupabaseUser = async (user: User) => {
    try {
      const userData = {
        firebase_uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        avatar_url: user.photoURL || '',
        balance: 0,
        total_spent: 0,
        total_orders: 0,
        user_type: 'customer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('users')
        .insert([userData]);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating Supabase user:', error);
    }
  };

  const loadVendorProfiles = async () => {
    try {
      const vendorIds = Array.from(new Set(cartItems.map(item => item.vendor_id)));
      
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('*')
        .in('vendor_id', vendorIds);

      if (error) throw error;

      setVendors(data || []);
    } catch (error) {
      console.error('Error loading vendor profiles:', error);
    }
  };

  const generateOrderNumber = (): string => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `GOSTOREZ-${timestamp.slice(-8)}-${random}`;
  };

  const updateUserBalance = async (userId: string, amount: number, type: 'deduct' | 'add') => {
    try {
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('balance, total_spent, total_orders')
        .eq('firebase_uid', userId)
        .single();

      if (fetchError) throw fetchError;

      const oldBalance = currentUser.balance || 0;
      let newBalance = oldBalance;
      let totalSpent = currentUser.total_spent || 0;
      let totalOrders = currentUser.total_orders || 0;

      if (type === 'deduct') {
        newBalance = oldBalance - amount;
        totalSpent += amount;
        totalOrders += 1;
      } else {
        newBalance = oldBalance + amount;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({
          balance: newBalance,
          total_spent: totalSpent,
          total_orders: totalOrders,
          updated_at: new Date().toISOString()
        })
        .eq('firebase_uid', userId);

      if (updateError) throw updateError;

      return { oldBalance, newBalance };
    } catch (error) {
      console.error('Error updating user balance:', error);
      throw error;
    }
  };

  const updateVendorBalance = async (vendorId: string, amount: number, type: 'sale' | 'refund') => {
    try {
      const { data: currentVendor, error: fetchError } = await supabase
        .from('vendor_profiles')
        .select('balance, total_earnings, total_sales, pending_balance, available_balance')
        .eq('vendor_id', vendorId)
        .single();

      if (fetchError) throw fetchError;

      const oldBalance = currentVendor.balance || 0;
      let newBalance = oldBalance;
      let totalEarnings = currentVendor.total_earnings || 0;
      let totalSales = currentVendor.total_sales || 0;
      let pendingBalance = currentVendor.pending_balance || 0;
      let availableBalance = currentVendor.available_balance || 0;

      if (type === 'sale') {
        // Add to pending balance first (will be moved to available after delivery)
        pendingBalance += amount;
        totalEarnings += amount;
        totalSales += 1;
      } else {
        // For refunds
        newBalance = Math.max(oldBalance - amount, 0);
        availableBalance = Math.max(availableBalance - amount, 0);
      }

      const { error: updateError } = await supabase
        .from('vendor_profiles')
        .update({
          balance: newBalance,
          total_earnings: totalEarnings,
          total_sales: totalSales,
          pending_balance: pendingBalance,
          available_balance: availableBalance,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', vendorId);

      if (updateError) throw updateError;

      return { oldBalance, newBalance };
    } catch (error) {
      console.error('Error updating vendor balance:', error);
      throw error;
    }
  };

  const createOrderRecord = async (orderNumber: string, userId: string) => {
    try {
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Group items by vendor for the order record
      const vendorGroups = cartItems.reduce((acc, item) => {
        if (!acc[item.vendor_id]) {
          acc[item.vendor_id] = {
            vendor_id: item.vendor_id,
            vendor_name: item.product.vendor_name,
            total_amount: 0,
            items: []
          };
        }
        const itemTotal = item.product.price * item.quantity;
        acc[item.vendor_id].total_amount += itemTotal;
        acc[item.vendor_id].items.push({
          product_id: item.product_id,
          product_title: item.product.title,
          quantity: item.quantity,
          unit_price: item.product.price,
          total_price: itemTotal,
          status: 'pending'
        });
        return acc;
      }, {} as Record<string, any>);

      const orderData = {
        id: orderId,
        order_number: orderNumber,
        user_id: userId,
        user_name: userProfile?.name || '',
        user_email: userProfile?.email || '',
        user_phone: userProfile?.phone || '',
        total_amount: totalAmount,
        currency: 'NGN',
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'wallet',
        delivery_location: {
          state_id: locationStep.state_id,
          state_name: locationStep.state_name,
          university_id: locationStep.university_id,
          university_name: locationStep.university_name,
          campus_id: locationStep.campus_id,
          campus_name: locationStep.campus_name,
          precise_location: locationStep.precise_location
        },
        vendors: Object.values(vendorGroups).map((vendor: any) => ({
          vendor_id: vendor.vendor_id,
          vendor_name: vendor.vendor_name,
          total_amount: vendor.total_amount,
          status: 'pending',
          items: vendor.items
        })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: order, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) throw error;

      return order;
    } catch (error) {
      console.error('Error creating order record:', error);
      throw error;
    }
  };

  const createOrderItems = async (orderId: string) => {
    try {
      const orderItems = cartItems.map(item => ({
        order_id: orderId,
        product_id: item.product_id,
        vendor_id: item.vendor_id,
        product_title: item.product.title,
        vendor_name: item.product.vendor_name,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
        status: 'pending',
        location_details: {
          state_id: locationStep.state_id,
          state_name: locationStep.state_name,
          university_id: locationStep.university_id,
          university_name: locationStep.university_name,
          campus_id: locationStep.campus_id,
          campus_name: locationStep.campus_name,
          precise_location: locationStep.precise_location
        },
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating order items:', error);
      throw error;
    }
  };

  const createTransactionRecord = async (
    orderId: string,
    userId: string,
    vendorId: string | null,
    type: Transaction['type'],
    amount: number,
    oldBalance: number,
    newBalance: number,
    description: string,
    metadata?: any
  ) => {
    try {
      const transactionId = `trx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const transactionData = {
        id: transactionId,
        order_id: orderId,
        user_id: userId,
        vendor_id: vendorId,
        type,
        amount,
        old_balance: oldBalance,
        new_balance: newBalance,
        description,
        metadata: metadata || {},
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('transactions')
        .insert([transactionData]);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating transaction record:', error);
      throw error;
    }
  };

  const updateProductInventory = async () => {
    try {
      for (const item of cartItems) {
        const { error } = await supabase.rpc('decrement_product_inventory', {
          p_product_id: item.product_id,
          p_quantity: item.quantity
        });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating inventory:', error);
      throw error;
    }
  };

  const clearCart = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('carts')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  };

  const processOrder = async () => {
    try {
      setLoading(true);
      setStep('processing');
      setError('');

      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Check if user has sufficient balance
      if (userBalance < totalAmount) {
        setStep('insufficient');
        setError(`Insufficient balance. Current balance: ₦${userBalance.toLocaleString()}. Please deposit.`);
        return;
      }

      // Generate order number
      const orderNumber = generateOrderNumber();

      // 1. Create order record
      const order = await createOrderRecord(orderNumber, user.uid);
      setOrderId(order.id);

      // 2. Create order items
      await createOrderItems(order.id);

      // 3. Deduct from user balance and create transaction
      const userBalanceUpdate = await updateUserBalance(user.uid, totalAmount, 'deduct');
      
      await createTransactionRecord(
        order.id,
        user.uid,
        null,
        'purchase',
        totalAmount,
        userBalanceUpdate.oldBalance,
        userBalanceUpdate.newBalance,
        `Purchase order ${orderNumber}`,
        { order_number: orderNumber, items_count: cartItems.length }
      );

      // 4. Process each vendor's portion
      const vendorGroups = cartItems.reduce((acc, item) => {
        const vendorAmount = item.product.price * item.quantity;
        if (!acc[item.vendor_id]) {
          acc[item.vendor_id] = {
            vendor_id: item.vendor_id,
            vendor_name: item.product.vendor_name,
            total_amount: 0,
            items: []
          };
        }
        acc[item.vendor_id].total_amount += vendorAmount;
        acc[item.vendor_id].items.push({
          product_id: item.product_id,
          quantity: item.quantity,
          amount: vendorAmount
        });
        return acc;
      }, {} as Record<string, any>);

      // Process each vendor
      for (const vendorId in vendorGroups) {
        const vendorData = vendorGroups[vendorId];
        
        // Update vendor balance (add to pending balance)
        const vendorBalanceUpdate = await updateVendorBalance(vendorId, vendorData.total_amount, 'sale');
        
        // Create transaction for vendor
        await createTransactionRecord(
          order.id,
          user.uid,
          vendorId,
          'vendor_credit',
          vendorData.total_amount,
          vendorBalanceUpdate.oldBalance,
          vendorBalanceUpdate.newBalance,
          `Sale from order ${orderNumber}`,
          { 
            order_number: orderNumber, 
            items: vendorData.items,
            pending: true // Funds are in pending balance until delivery
          }
        );
      }

      // 5. Update product inventory
      await updateProductInventory();

      // 6. Clear cart
      await clearCart(user.uid);

      // 7. Prepare receipt data
      const receipt = {
        order_id: order.id,
        order_number: orderNumber,
        user_name: userProfile?.name || '',
        user_email: userProfile?.email || '',
        date: new Date().toISOString(),
        total_amount: totalAmount,
        items: cartItems.map(item => ({
          product: item.product.title,
          vendor: item.product.vendor_name,
          quantity: item.quantity,
          unit_price: item.product.price,
          total: item.product.price * item.quantity
        })),
        location: [
          locationStep.state_name,
          locationStep.university_name,
          locationStep.campus_name,
          locationStep.precise_location
        ].filter(Boolean).join(' - '),
        transaction_id: `trx_${Date.now().toString().slice(-12)}`,
        balance_deducted: totalAmount,
        new_balance: userBalance - totalAmount
      };

      setReceiptData(receipt);
      setStep('success');
      
      // Update local balance
      setUserBalance(prev => prev - totalAmount);

    } catch (error: any) {
      console.error('Error processing order:', error);
      setError(error.message || 'Failed to process order. Please try again.');
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => `₦${price.toLocaleString('en-NG')}`;

  const generateBankDetails = () => {
    return {
      bank_name: "WEMA BANK",
      account_number: "7839273645",
      account_name: "GoStorez Enterprises",
      reference: `DEP-${userProfile?.email?.split('@')[0]?.toUpperCase()}-${Date.now().toString().slice(-6)}`
    };
  };

  const bankDetails = generateBankDetails();

  const renderConfirmStep = () => (
    <div className="order-confirm">
      <div className="order-header">
        <h2 className="order-title">Complete Purchase</h2>
        <p className="order-subtitle">Review and confirm your order</p>
      </div>
      
      <div className="order-summary-card">
        <div className="summary-section">
          <h3 className="section-title">Order Summary</h3>
          <div className="summary-total">
            <span>Total Amount:</span>
            <span className="total-amount">{formatPrice(totalAmount)}</span>
          </div>
          
          <div className="balance-info">
            <div className="balance-row">
              <span>Your Balance:</span>
              <span className={`balance-amount ${userBalance >= totalAmount ? 'sufficient' : 'insufficient'}`}>
                {formatPrice(userBalance)}
              </span>
            </div>
            {userBalance < totalAmount && (
              <div className="balance-warning">
                <AlertCircle size={14} />
                <span>Insufficient balance. Deposit to complete purchase.</span>
              </div>
            )}
          </div>
        </div>

        <div className="summary-section">
          <h3 className="section-title">Delivery Location</h3>
          <div className="location-display">
            {[
              locationStep.state_name,
              locationStep.university_name,
              locationStep.campus_name,
              locationStep.precise_location
            ].filter(Boolean).map((part, index) => (
              <div key={index} className="location-part">
                {part}
              </div>
            ))}
          </div>
        </div>

        <div className="summary-section">
          <h3 className="section-title">Order Details</h3>
          <div className="order-items">
            {cartItems.map((item, index) => (
              <div key={index} className="order-item">
                <div className="item-info">
                  <span className="item-name">{item.product.title}</span>
                  <span className="item-vendor">by {item.product.vendor_name}</span>
                </div>
                <div className="item-details">
                  <span>{item.quantity} × {formatPrice(item.product.price)}</span>
                  <span className="item-total">{formatPrice(item.product.price * item.quantity)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="summary-section">
          <h3 className="section-title">Payment Method</h3>
          <div className="payment-method">
            <div className="method-selected">
              <CreditCard size={20} />
              <div>
                <strong>GoStorez Wallet</strong>
                <p>Pay with your account balance</p>
              </div>
              <span className="method-balance">{formatPrice(userBalance)}</span>
            </div>
            {userBalance < totalAmount && (
              <div className="method-alternative">
                <p>Insufficient balance? <button onClick={() => setStep('insufficient')}>Deposit Funds</button></p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="order-actions">
        <button
          className="order-cancel-btn"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          className="order-confirm-btn"
          onClick={processOrder}
          disabled={loading || userBalance < totalAmount}
        >
          {loading ? 'Processing...' : 'Complete Purchase'}
        </button>
      </div>

      <div className="order-security">
        <Shield size={14} />
        <span>Secured by GoStorez. Vendors receive payment only after delivery confirmation.</span>
      </div>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="order-processing">
      <div className="processing-content">
        <div className="processing-spinner"></div>
        <h3>Processing Your Order</h3>
        <p>Please wait while we confirm your payment and create your order...</p>
        
        <div className="processing-steps">
          <div className="processing-step active">
            <div className="step-icon">1</div>
            <span>Verifying payment</span>
          </div>
          <div className="processing-step">
            <div className="step-icon">2</div>
            <span>Creating order</span>
          </div>
          <div className="processing-step">
            <div className="step-icon">3</div>
            <span>Notifying vendors</span>
          </div>
        </div>

        <div className="processing-details">
          <div className="detail-item">
            <span>Order Total:</span>
            <span>{formatPrice(totalAmount)}</span>
          </div>
          <div className="detail-item">
            <span>Balance Deducted:</span>
            <span>{formatPrice(totalAmount)}</span>
          </div>
          <div className="detail-item">
            <span>New Balance:</span>
            <span>{formatPrice(userBalance - totalAmount)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="order-success">
      <div className="success-content">
        <div className="success-header">
          <CheckCircle size={48} className="success-icon" />
          <h3>Order Successful!</h3>
          <p className="success-message">Your purchase has been completed successfully.</p>
        </div>

        <div className="receipt-card">
          <div className="receipt-header">
            <Receipt size={20} />
            <h4>Order Receipt</h4>
            <span className="receipt-id">#{receiptData?.order_number}</span>
          </div>
          
          <div className="receipt-body">
            <div className="receipt-section">
              <div className="receipt-row">
                <span>Order ID:</span>
                <span className="receipt-value">{receiptData?.order_id}</span>
              </div>
              <div className="receipt-row">
                <span>Date:</span>
                <span className="receipt-value">{new Date(receiptData?.date || '').toLocaleString()}</span>
              </div>
              <div className="receipt-row">
                <span>Customer:</span>
                <span className="receipt-value">{receiptData?.user_name}</span>
              </div>
            </div>

            <div className="receipt-section">
              <h5>Items Purchased</h5>
              {receiptData?.items.map((item: any, index: number) => (
                <div key={index} className="receipt-item">
                  <div className="item-main">
                    <span className="item-name">{item.product}</span>
                    <span className="item-vendor">{item.vendor}</span>
                  </div>
                  <div className="item-details">
                    <span>{item.quantity} × {formatPrice(item.unit_price)}</span>
                    <span className="item-total">{formatPrice(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="receipt-section">
              <div className="receipt-row">
                <span>Subtotal:</span>
                <span>{formatPrice(receiptData?.total_amount || 0)}</span>
              </div>
              <div className="receipt-row">
                <span>Delivery:</span>
                <span>₦0.00</span>
              </div>
              <div className="receipt-row total">
                <span>Total Paid:</span>
                <span className="total-amount">{formatPrice(receiptData?.total_amount || 0)}</span>
              </div>
            </div>

            <div className="receipt-section">
              <div className="receipt-row">
                <span>Balance Deducted:</span>
                <span className="text-danger">-{formatPrice(receiptData?.balance_deducted || 0)}</span>
              </div>
              <div className="receipt-row">
                <span>New Balance:</span>
                <span className="text-success">{formatPrice(receiptData?.new_balance || 0)}</span>
              </div>
            </div>

            <div className="receipt-section">
              <h5>Delivery Location</h5>
              <div className="location-info">{receiptData?.location}</div>
            </div>
          </div>
        </div>

        <div className="success-actions">
          <button
            className="success-btn primary"
            onClick={() => {
              onOrderSuccess(orderId);
              window.open(`/orders/${orderId}`, '_blank');
            }}
          >
            Track Order
          </button>
          <button
            className="success-btn secondary"
            onClick={() => {
              onOrderSuccess(orderId);
              onClose();
            }}
          >
            Continue Shopping
          </button>
          <button
            className="success-btn outline"
            onClick={() => {
              // Print receipt
              window.print();
            }}
          >
            Print Receipt
          </button>
        </div>

        <div className="success-note">
          <Package size={14} />
          <p>Vendors have been notified. They will process your order shortly.</p>
        </div>
      </div>
    </div>
  );

  const renderInsufficientStep = () => (
    <div className="order-insufficient">
      <div className="insufficient-content">
        <div className="insufficient-header">
          <AlertCircle size={48} className="insufficient-icon" />
          <h3>Insufficient Balance</h3>
          <p className="insufficient-message">
            You need {formatPrice(totalAmount - userBalance)} more to complete this purchase.
          </p>
        </div>

        <div className="balance-card">
          <div className="balance-summary">
            <div className="balance-item">
              <span>Order Total:</span>
              <span>{formatPrice(totalAmount)}</span>
            </div>
            <div className="balance-item">
              <span>Your Balance:</span>
              <span>{formatPrice(userBalance)}</span>
            </div>
            <div className="balance-item deficit">
              <span>Deficit:</span>
              <span className="deficit-amount">{formatPrice(totalAmount - userBalance)}</span>
            </div>
          </div>
        </div>

        <div className="deposit-options">
          <h4>Deposit Options</h4>
          
          <div className="deposit-method">
            <div className="method-header">
              <span>Bank</span>
              <div>
                <h5>Bank Transfer</h5>
                <p>Transfer to our dedicated account</p>
              </div>
            </div>
            
            <div className="bank-details-card">
              <div className="bank-detail">
                <span>Bank Name:</span>
                <span>{bankDetails.bank_name}</span>
              </div>
              <div className="bank-detail">
                <span>Account Number:</span>
                <span className="account-highlight">{bankDetails.account_number}</span>
                <button 
                  className="copy-btn"
                  onClick={() => navigator.clipboard.writeText(bankDetails.account_number)}
                >
                  Copy
                </button>
              </div>
              <div className="bank-detail">
                <span>Account Name:</span>
                <span>{bankDetails.account_name}</span>
              </div>
              <div className="bank-detail">
                <span>Reference:</span>
                <span className="reference-highlight">{bankDetails.reference}</span>
              </div>
            </div>

            <div className="deposit-instructions">
              <div className="instruction">
                <AlertCircle size={12} />
                <span>Use the exact reference above for faster processing</span>
              </div>
              <div className="instruction">
                <AlertCircle size={12} />
                <span>Balance updates within 1-5 minutes after transfer</span>
              </div>
            </div>
          </div>

          <div className="deposit-method">
            <div className="method-header">
              <CreditCard size={24} />
              <div>
                <h5>Card Payment</h5>
                <p>Instant deposit with debit/credit card</p>
              </div>
            </div>
            
            <button
              className="card-deposit-btn"
              onClick={() => {
                // Redirect to card deposit page
                window.open(`/deposit?amount=${totalAmount - userBalance}`, '_blank');
              }}
            >
              Deposit {formatPrice(totalAmount - userBalance)} with Card
            </button>
          </div>
        </div>

        <div className="insufficient-actions">
          <button
            className="insufficient-btn primary"
            onClick={() => setStep('confirm')}
          >
            Back to Order
          </button>
          <button
            className="insufficient-btn secondary"
            onClick={onClose}
          >
            Cancel Order
          </button>
        </div>

        <div className="support-note">
          <p>Need help with deposit? Contact support@gostorez.com or call +234-XXX-XXX-XXXX</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="order-component-overlay">
      <div className="order-component">
        <button className="order-close-btn" onClick={onClose} disabled={loading}>
          <X size={24} />
        </button>

        {step === 'confirm' && renderConfirmStep()}
        {step === 'processing' && renderProcessingStep()}
        {step === 'success' && renderSuccessStep()}
        {step === 'insufficient' && renderInsufficientStep()}

        {error && (
          <div className="order-error-alert">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => setError('')} className="error-close">
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderComponent;