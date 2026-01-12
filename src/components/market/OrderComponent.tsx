import React, { useState, useEffect } from 'react';
import { auth } from '../../lib/firebase';
import { supabase } from '../../lib/supabaseClient';
import { User } from 'firebase/auth';
import { Shield, AlertCircle, CheckCircle, CreditCard, X, Receipt, Package } from 'lucide-react';
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

interface LocationStep {
  state_id?: number;
  university_id?: number;
  campus_id?: number;
  precise_location?: string;
  state_name?: string;
  university_name?: string;
  campus_name?: string;
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
  const [processingOrder, setProcessingOrder] = useState<string>('');

  // Fetch fresh user balance
  const fetchFreshUserBalance = async (): Promise<number> => {
    try {
      const user = auth.currentUser;
      if (!user) return 0;

      const { data: supabaseUser, error } = await supabase
        .from('users')
        .select('balance')
        .eq('firebase_uid', user.uid)
        .single();

      if (error || !supabaseUser) return 0;
      return supabaseUser.balance || 0;
    } catch (error) {
      console.error('Error fetching user balance:', error);
      return 0;
    }
  };

  // Check for duplicate orders
  const checkForDuplicateOrder = async (orderNumber: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', orderNumber)
        .limit(1);

      if (error) return false;
      return !!(data && data.length > 0);
    } catch (error) {
      console.error('Error checking duplicate order:', error);
      return false;
    }
  };

  // Check product inventory
  const checkProductInventory = async (): Promise<boolean> => {
    try {
      for (const item of cartItems) {
        const { data: product, error } = await supabase
          .from('products')
          .select('inventory')
          .eq('id', item.product_id)
          .single();

        if (error || !product) {
          console.error(`Product ${item.product_id} not found:`, error);
          return false;
        }
        
        if (product.inventory < item.quantity) {
          console.error(`Insufficient inventory for product ${item.product_id}: ${product.inventory} < ${item.quantity}`);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Error checking inventory:', error);
      return false;
    }
  };

  const generateOrderNumber = (): string => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `GOSTOREZ-${timestamp.slice(-8)}-${random}`;
  };

  // Safe user balance update with optimistic concurrency
  const updateUserBalanceSafely = async (userId: string, amount: number): Promise<{success: boolean, oldBalance: number, newBalance: number}> => {
    try {
      // Get current balance
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('balance, total_spent, total_orders')
        .eq('firebase_uid', userId)
        .single();

      if (fetchError) throw fetchError;

      const oldBalance = currentUser.balance || 0;
      
      // Verify balance is sufficient
      if (oldBalance < amount) {
        return { success: false, oldBalance, newBalance: oldBalance };
      }

      const newBalance = oldBalance - amount;
      const totalSpent = (currentUser.total_spent || 0) + amount;
      const totalOrders = (currentUser.total_orders || 0) + 1;

      // Atomic update with optimistic concurrency control
      const { error: updateError } = await supabase
        .from('users')
        .update({
          balance: newBalance,
          total_spent: totalSpent,
          total_orders: totalOrders,
          updated_at: new Date().toISOString()
        })
        .eq('firebase_uid', userId)
        .eq('balance', oldBalance); // Prevent race conditions

      if (updateError) {
        // Balance was changed by another transaction
        throw new Error('CONCURRENT_UPDATE: Balance was updated by another transaction. Please try again.');
      }

      return { success: true, oldBalance, newBalance };
    } catch (error) {
      console.error('Error updating user balance:', error);
      throw error;
    }
  };

  // Safe vendor balance update
  const updateVendorBalanceSafely = async (vendorId: string, amount: number): Promise<boolean> => {
    try {
      // Get current vendor data
      const { data: currentVendor, error: fetchError } = await supabase
        .from('vendor_profiles')
        .select('pending_balance, total_earnings, total_sales')
        .eq('vendor_id', vendorId)
        .single();

      if (fetchError) throw fetchError;

      const oldPendingBalance = currentVendor.pending_balance || 0;
      const pendingBalance = oldPendingBalance + amount;
      const totalEarnings = (currentVendor.total_earnings || 0) + amount;
      const totalSales = (currentVendor.total_sales || 0) + 1;

      // Atomic update
      const { error: updateError } = await supabase
        .from('vendor_profiles')
        .update({
          pending_balance: pendingBalance,
          total_earnings: totalEarnings,
          total_sales: totalSales,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', vendorId)
        .eq('pending_balance', oldPendingBalance);

      if (updateError) throw updateError;

      return true;
    } catch (error) {
      console.error('Error updating vendor balance:', error);
      throw error;
    }
  };

  // Create order record
  const createOrderRecord = async (orderNumber: string, userId: string) => {
    try {
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
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
        payment_status: 'completed',
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

      if (error) {
        console.error('Error creating order record:', error);
        throw new Error(`Failed to create order: ${error.message}`);
      }

      return order;
    } catch (error) {
      console.error('Error in createOrderRecord:', error);
      throw error;
    }
  };

  // Create order items
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
        user_status: 'ordered',
        vendor_status: 'pending',
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

      if (error) {
        console.error('Error creating order items:', error);
        throw new Error(`Failed to create order items: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in createOrderItems:', error);
      throw error;
    }
  };

  // Update product inventory - FIXED VERSION without .sql
  const updateProductInventory = async () => {
    try {
      for (const item of cartItems) {
        // First, get current inventory
        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('inventory')
          .eq('id', item.product_id)
          .single();

        if (fetchError) {
          throw new Error(`Product ${item.product_id} not found: ${fetchError.message}`);
        }

        const currentInventory = product.inventory || 0;
        if (currentInventory < item.quantity) {
          throw new Error(`Insufficient inventory for ${item.product.title}. Available: ${currentInventory}, Requested: ${item.quantity}`);
        }

        // Update inventory directly
        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            inventory: currentInventory - item.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.product_id);

        if (updateError) {
          throw new Error(`Failed to update inventory for ${item.product.title}: ${updateError.message}`);
        }
      }
    } catch (error) {
      console.error('Error updating inventory:', error);
      throw error;
    }
  };

  // Clear cart
  const clearCart = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('carts')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error clearing cart:', error);
        throw new Error(`Failed to clear cart: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in clearCart:', error);
      throw error;
    }
  };

  // Main order processing function
  const processOrder = async () => {
    // Prevent duplicate clicks
    if (processingOrder) {
      console.log('Order already processing, ignoring duplicate click');
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated. Please login again.');
      }

      // Generate unique processing ID
      const processingId = `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setProcessingOrder(processingId);

      setLoading(true);
      setError('');

      // Step 1: Generate order number and check for duplicates
      const orderNumber = generateOrderNumber();
      setProcessingOrder(`Checking duplicate order: ${orderNumber}`);
      
      const isDuplicate = await checkForDuplicateOrder(orderNumber);
      if (isDuplicate) {
        throw new Error('Order number conflict detected. Please try again with a new order.');
      }

      // Step 2: Check product inventory
      setProcessingOrder('Checking product inventory...');
      const inventoryOk = await checkProductInventory();
      if (!inventoryOk) {
        throw new Error('Some products are out of stock or unavailable. Please update your cart and try again.');
      }

      // Step 3: Fetch fresh user balance
      setProcessingOrder('Checking account balance...');
      const freshBalance = await fetchFreshUserBalance();
      if (freshBalance < totalAmount) {
        setStep('insufficient');
        setError(`Insufficient balance. Current balance: ₦${freshBalance.toLocaleString()}. Required: ₦${totalAmount.toLocaleString()}. Please deposit funds.`);
        setProcessingOrder('');
        setLoading(false);
        return;
      }

      setStep('processing');
      setProcessingOrder('Creating order record...');

      // Step 4: Create order record
      const order = await createOrderRecord(orderNumber, user.uid);
      setOrderId(order.id);

      // Step 5: Update user balance with locking
      setProcessingOrder('Processing payment...');
      const balanceResult = await updateUserBalanceSafely(user.uid, totalAmount);
      if (!balanceResult.success) {
        // Rollback order creation if balance insufficient
        await supabase.from('orders').delete().eq('id', order.id);
        setStep('insufficient');
        setError('Insufficient balance detected during final verification. Order cancelled.');
        setProcessingOrder('');
        setLoading(false);
        return;
      }

      // Step 6: Update vendor balances
      setProcessingOrder('Updating vendor accounts...');
      const vendorGroups = cartItems.reduce((acc, item) => {
        const vendorAmount = item.product.price * item.quantity;
        if (!acc[item.vendor_id]) {
          acc[item.vendor_id] = {
            vendor_id: item.vendor_id,
            vendor_name: item.product.vendor_name,
            total_amount: 0
          };
        }
        acc[item.vendor_id].total_amount += vendorAmount;
        return acc;
      }, {} as Record<string, any>);

      let vendorUpdateFailed = false;
      for (const vendorId in vendorGroups) {
        try {
          const success = await updateVendorBalanceSafely(vendorId, vendorGroups[vendorId].total_amount);
          if (!success) vendorUpdateFailed = true;
        } catch (error) {
          vendorUpdateFailed = true;
          console.error(`Failed to update vendor ${vendorId}:`, error);
        }
      }

      if (vendorUpdateFailed) {
        // Rollback: refund user and delete order
        await supabase.from('orders').delete().eq('id', order.id);
        // Restore user balance
        await supabase
          .from('users')
          .update({ 
            balance: freshBalance,
            updated_at: new Date().toISOString()
          })
          .eq('firebase_uid', user.uid);
        throw new Error('Failed to process vendor payments. Order has been cancelled and your balance has been restored.');
      }

      // Step 7: Create order items
      setProcessingOrder('Creating order items...');
      await createOrderItems(order.id);

      // Step 8: Update product inventory
      setProcessingOrder('Updating inventory...');
      await updateProductInventory();

      // Step 9: Clear cart
      setProcessingOrder('Clearing cart...');
      await clearCart(user.uid);

      // Step 10: Prepare receipt
      setProcessingOrder('Generating receipt...');
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
        balance_deducted: totalAmount,
        new_balance: balanceResult.newBalance
      };

      setReceiptData(receipt);
      setUserBalance(balanceResult.newBalance);
      setStep('success');
      setProcessingOrder('');

    } catch (error: any) {
      console.error('Error processing order:', error);
      
      // User-friendly error messages
      if (error.message?.includes('CONCURRENT_UPDATE')) {
        setError('Your account was updated by another transaction. Please check your balance and try again.');
      } else if (error.message?.includes('Insufficient')) {
        setStep('insufficient');
        setError(error.message);
      } else if (error.code === 'PGRST204') {
        setError('Database configuration error. Please contact support.');
      } else if (error.code === '23502') {
        setError('Missing required order information. Please refresh and try again.');
      } else if (error.code === '42501') {
        setError('Permission denied. Please check your account permissions.');
      } else if (error.code === '42P01') {
        setError('Database table not found. Please contact support.');
      } else {
        setError(error.message || 'An unexpected error occurred. Please try again.');
      }
      
      setStep('confirm');
    } finally {
      setLoading(false);
      setProcessingOrder('');
    }
  };

  // Initialize component
  useEffect(() => {
    const initBalance = async () => {
      const balance = await fetchFreshUserBalance();
      setUserBalance(balance);
    };
    initBalance();
  }, []);

  const formatPrice = (price: number) => `₦${price.toLocaleString('en-NG')}`;

  const generateBankDetails = () => {
    return {
      bank_name: "WEMA BANK",
      account_number: "7839273645",
      account_name: "GoStorez Enterprises",
      reference: `DEP-${userProfile?.email?.split('@')[0]?.toUpperCase() || 'USER'}-${Date.now().toString().slice(-6)}`
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
          disabled={loading || !!processingOrder}
        >
          Cancel
        </button>
        <button
          className="order-confirm-btn"
          onClick={processOrder}
          disabled={loading || userBalance < totalAmount || !!processingOrder}
        >
          {processingOrder ? 'Processing...' : loading ? 'Processing...' : 'Complete Purchase'}
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
        <p>{processingOrder || 'Please wait while we process your order...'}</p>
        
        <div className="processing-steps">
          <div className="processing-step active">
            <div className="step-icon">1</div>
            <span>Verifying details</span>
          </div>
          <div className="processing-step">
            <div className="step-icon">2</div>
            <span>Processing payment</span>
          </div>
          <div className="processing-step">
            <div className="step-icon">3</div>
            <span>Creating order</span>
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
          <p>Need help with deposit? Contact support@gostorez.com</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="order-component-overlay">
      <div className="order-component">
        <button className="order-close-btn" onClick={onClose} disabled={loading || !!processingOrder}>
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