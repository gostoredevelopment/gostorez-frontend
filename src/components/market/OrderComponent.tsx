import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../../lib/firebase';
import { supabase } from '../../lib/supabaseClient';
import { User } from 'firebase/auth';
import { Shield, AlertCircle, CheckCircle, CreditCard, X, Receipt, Package, Home, BarChart, Printer } from 'lucide-react';
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
  const [processingStage, setProcessingStage] = useState<number>(0);
  const [locationNames, setLocationNames] = useState<LocationStep>({});
  const printButtonRef = useRef<HTMLButtonElement>(null);

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

  // Fetch location names from IDs
  const fetchLocationNames = async (locationStep: LocationStep): Promise<LocationStep> => {
    try {
      const updatedLocation: LocationStep = { ...locationStep };
      
      // Fetch state name
      if (locationStep.state_id && !locationStep.state_name) {
        const { data: stateData, error } = await supabase
          .from('states')
          .select('name')
          .eq('id', locationStep.state_id)
          .single();
        
        if (!error && stateData) {
          updatedLocation.state_name = stateData.name;
        }
      }
      
      // Fetch university name
      if (locationStep.university_id && !locationStep.university_name) {
        const { data: uniData, error } = await supabase
          .from('universities')
          .select('name')
          .eq('id', locationStep.university_id)
          .single();
        
        if (!error && uniData) {
          updatedLocation.university_name = uniData.name;
        }
      }
      
      // Fetch campus name
      if (locationStep.campus_id && !locationStep.campus_name) {
        const { data: campusData, error } = await supabase
          .from('campuses')
          .select('name')
          .eq('id', locationStep.campus_id)
          .single();
        
        if (!error && campusData) {
          updatedLocation.campus_name = campusData.name;
        }
      }
      
      return updatedLocation;
    } catch (error) {
      console.error('Error fetching location names:', error);
      return locationStep;
    }
  };

  // Initialize component - fetch location names immediately
  useEffect(() => {
    const init = async () => {
      const balance = await fetchFreshUserBalance();
      setUserBalance(balance);
      
      // Fetch location names as soon as component mounts
      if (locationStep.state_id || locationStep.university_id || locationStep.campus_id) {
        const names = await fetchLocationNames(locationStep);
        setLocationNames(names);
      } else {
        setLocationNames(locationStep);
      }
    };
    init();
  }, [locationStep]);

  // Auto-click print button when order is successful
  useEffect(() => {
    if (step === 'success' && receiptData && printButtonRef.current) {
      // Small delay to ensure UI is fully rendered
      setTimeout(() => {
        printButtonRef.current?.click();
      }, 800);
    }
  }, [step, receiptData]);

  // Generate and download PDF receipt
  const generatePDFReceipt = () => {
    if (!receiptData) return;

    // Create HTML content for the receipt
    const receiptHtml = `
   <!DOCTYPE html>
    <html>
    <head>
      <title>GoStorez Order Receipt - ${receiptData.order_number}</title>
      <meta charset="UTF-8">
      <style>
        @page { margin: 15mm; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0; 
          padding: 0; 
          color: #333;
          line-height: 1.4;
          font-size: 12px;
          background: white !important;
        }
        .receipt-container {
          max-width: 210mm;
          margin: 0 auto;
          padding: 15mm;
        }
        .header {
          text-align: center;
          margin-bottom: 8mm;
          padding-bottom: 4mm;
          border-bottom: 2px solid #9B4819;
        }
        .company-name {
          font-size: 28px;
          font-weight: bold;
          color: #9B4819;
          margin-bottom: 2px;
        }
        .receipt-title {
          font-size: 20px;
          color: #444;
          margin-bottom: 4mm;
          font-weight: 600;
        }
        .order-number {
          font-size: 16px;
          color: #666;
          font-weight: 700;
          letter-spacing: 1px;
        }
        .section {
          margin-bottom: 6mm;
        }
        .section-title {
          font-size: 16px;
          font-weight: bold;
          color: #9B4819;
          border-bottom: 1px solid #e0d6cc;
          padding-bottom: 3mm;
          margin-bottom: 4mm;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 3mm;
        }
        .label {
          font-weight: 600;
          color: #666;
          min-width: 35mm;
        }
        .value {
          font-weight: 500;
          color: #333;
          text-align: right;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 4mm 0;
        }
        .items-table th {
          background-color: #f9f1eb;
          padding: 3mm;
          text-align: left;
          border-bottom: 1.5px solid #e0d6cc;
          font-weight: 700;
          color: #9B4819;
          font-size: 12px;
        }
        .items-table td {
          padding: 2.5mm 3mm;
          border-bottom: 0.5px solid #f0f0f0;
          font-size: 11px;
          vertical-align: top;
        }
        .total-row {
          font-weight: bold;
          font-size: 13px;
          color: #333;
          background-color: #f9f1eb;
        }
        .total-row td {
          border-top: 1.5px solid #9B4819;
          border-bottom: none;
          padding-top: 3mm;
        }
        .location-box {
          background-color: #f9f1eb;
          padding: 3mm;
          border-radius: 2mm;
          border-left: 4px solid #9B4819;
          margin-top: 2mm;
          font-size: 12px;
          line-height: 1.5;
        }
        .highlight {
          color: #9B4819;
          font-weight: 700;
        }
        .success {
          color: #28a745;
          font-weight: 700;
        }
        .danger {
          color: #dc3545;
          font-weight: 700;
        }
        .divider {
          height: 0.5px;
          background-color: #e0d6cc;
          margin: 4mm 0;
        }
        .footer {
          margin-top: 8mm;
          padding-top: 4mm;
          border-top: 0.5px solid #e0d6cc;
          font-size: 10px;
          color: #666;
          text-align: center;
          line-height: 1.6;
        }
        .footer p {
          margin: 1mm 0;
        }
        @media print {
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="header">
          <div class="company-name">GoStorez</div>
          <div class="receipt-title">Order Receipt</div>
          <div class="order-number">#${receiptData.order_number}</div>
        </div>
        
        <div class="section">
          <div class="section-title">Order Information</div>
          <div class="info-row">
            <span class="label">Order Number:</span>
            <span class="value highlight">${receiptData.order_number}</span>
          </div>
          <div class="info-row">
            <span class="label">Order ID:</span>
            <span class="value">${receiptData.order_id}</span>
          </div>
          <div class="info-row">
            <span class="label">Date & Time:</span>
            <span class="value">${new Date(receiptData.date).toLocaleString()}</span>
          </div>
        </div>
        
        <div class="divider"></div>
        
        <div class="section">
          <div class="section-title">Customer Information</div>
          <div class="info-row">
            <span class="label">Customer Name:</span>
            <span class="value">${receiptData.user_name}</span>
          </div>
          <div class="info-row">
            <span class="label">Email Address:</span>
            <span class="value">${receiptData.user_email}</span>
          </div>
        </div>
        
        <div class="divider"></div>
        
        <div class="section">
          <div class="section-title">Items Purchased</div>
          <table class="items-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Vendor</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${receiptData.items.map((item: any, index: number) => `
                <tr>
                  <td>${item.product}</td>
                  <td>${item.vendor}</td>
                  <td>${item.quantity}</td>
                  <td>₦${item.unit_price.toLocaleString()}</td>
                  <td>₦${item.total.toLocaleString()}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="4" style="text-align: right; font-weight: 700;">Total:</td>
                <td style="font-weight: 700; color: #9B4819;">₦${receiptData.total_amount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="divider"></div>
        
        <div class="section">
          <div class="section-title">Payment Summary</div>
          <div class="info-row">
            <span class="label">Subtotal:</span>
            <span class="value">₦${receiptData.total_amount.toLocaleString()}</span>
          </div>
          <div class="info-row">
            <span class="label">Delivery Fee:</span>
            <span class="value">₦0.00</span>
          </div>
          <div class="info-row">
            <span class="label">Total Amount:</span>
            <span class="value highlight">₦${receiptData.total_amount.toLocaleString()}</span>
          </div>
        </div>
        
        <div class="divider"></div>
        
        <div class="section">
          <div class="section-title">Wallet Transaction</div>
          <div class="info-row">
            <span class="label">Balance Deducted:</span>
            <span class="value danger">-₦${receiptData.balance_deducted.toLocaleString()}</span>
          </div>
          <div class="info-row">
            <span class="label">New Balance:</span>
            <span class="value success">₦${receiptData.new_balance.toLocaleString()}</span>
          </div>
        </div>
        
        <div class="divider"></div>
        
        <div class="section">
          <div class="section-title">Delivery Location</div>
          <div class="location-box">
            ${receiptData.location}
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for shopping with GoStorez!</p>
          <p>Vendors receive payment only after delivery confirmation.</p>
          <p>For support: support@gostorez.com</p>
          <p>Receipt generated on: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
    `;

    // Create blob and download as HTML file
    const blob = new Blob([receiptHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gostorez_order_${receiptData.order_number}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Main order processing function
  const processOrder = async () => {
    if (processingOrder) {
      console.log('Order already processing, ignoring duplicate click');
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated. Please login again.');
      }

      const processingId = `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setProcessingOrder(processingId);
      setProcessingStage(0);

      setLoading(true);
      setError('');

      // Stage 1: Verify details
      setProcessingOrder('Verifying order details...');
      setProcessingStage(1);
      
      const orderNumber = generateOrderNumber();
      const isDuplicate = await checkForDuplicateOrder(orderNumber);
      if (isDuplicate) {
        throw new Error('Order number conflict detected. Please try again with a new order.');
      }

      const inventoryOk = await checkProductInventory();
      if (!inventoryOk) {
        throw new Error('Some products are out of stock or unavailable. Please update your cart and try again.');
      }

      // Stage 2: Process payment
      setProcessingOrder('Processing payment...');
      setProcessingStage(2);
      
      const freshBalance = await fetchFreshUserBalance();
      if (freshBalance < totalAmount) {
        setStep('insufficient');
        setError(`Insufficient balance. Current balance: ₦${freshBalance.toLocaleString()}. Required: ₦${totalAmount.toLocaleString()}. Please deposit funds.`);
        setProcessingOrder('');
        setProcessingStage(0);
        setLoading(false);
        return;
      }

      setStep('processing');
      setProcessingStage(3);

      // Stage 3: Create order and complete transaction
      setProcessingOrder('Creating order and completing transaction...');
      
      // Create order record with names
      const order = await createOrderRecord(orderNumber, user.uid);
      setOrderId(order.id);

      // Update user balance
      const balanceResult = await updateUserBalanceSafely(user.uid, totalAmount);
      if (!balanceResult.success) {
        await supabase.from('orders').delete().eq('id', order.id);
        setStep('insufficient');
        setError('Insufficient balance detected during final verification. Order cancelled.');
        setProcessingOrder('');
        setProcessingStage(0);
        setLoading(false);
        return;
      }

      // Update vendor balances
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
        await supabase.from('orders').delete().eq('id', order.id);
        await supabase
          .from('users')
          .update({ 
            balance: freshBalance,
            updated_at: new Date().toISOString()
          })
          .eq('firebase_uid', user.uid);
        throw new Error('Failed to process vendor payments. Order has been cancelled and your balance has been restored.');
      }

      // Create order items with names
      await createOrderItems(order.id);

      // Update product inventory
      await updateProductInventory();

      // Clear cart
      await clearCart(user.uid);

      // Prepare receipt
      const fullLocation = [
        locationNames.state_name || `State ID: ${locationStep.state_id}`,
        locationNames.university_name || (locationStep.university_id ? `University ID: ${locationStep.university_id}` : ''),
        locationNames.campus_name || (locationStep.campus_id ? `Campus ID: ${locationStep.campus_id}` : ''),
        locationStep.precise_location
      ].filter(Boolean).join(', ');

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
        location: fullLocation,
        balance_deducted: totalAmount,
        new_balance: balanceResult.newBalance
      };

      setReceiptData(receipt);
      setUserBalance(balanceResult.newBalance);
      setStep('success');
      setProcessingOrder('');
      setProcessingStage(0);

    } catch (error: any) {
      console.error('Error processing order:', error);
      
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
      setProcessingStage(0);
    } finally {
      setLoading(false);
      setProcessingOrder('');
    }
  };

  // Helper functions (same as before)
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

  const checkProductInventory = async (): Promise<boolean> => {
    try {
      for (const item of cartItems) {
        const { data: product, error } = await supabase
          .from('products')
          .select('inventory')
          .eq('id', item.product_id)
          .single();
        if (error || !product) return false;
        if (product.inventory < item.quantity) return false;
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

  const updateUserBalanceSafely = async (userId: string, amount: number): Promise<{success: boolean, oldBalance: number, newBalance: number}> => {
    try {
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('balance, total_spent, total_orders')
        .eq('firebase_uid', userId)
        .single();
      if (fetchError) throw fetchError;
      const oldBalance = currentUser.balance || 0;
      if (oldBalance < amount) return { success: false, oldBalance, newBalance: oldBalance };
      const newBalance = oldBalance - amount;
      const totalSpent = (currentUser.total_spent || 0) + amount;
      const totalOrders = (currentUser.total_orders || 0) + 1;
      const { error: updateError } = await supabase
        .from('users')
        .update({
          balance: newBalance,
          total_spent: totalSpent,
          total_orders: totalOrders,
          updated_at: new Date().toISOString()
        })
        .eq('firebase_uid', userId)
        .eq('balance', oldBalance);
      if (updateError) throw new Error('CONCURRENT_UPDATE');
      return { success: true, oldBalance, newBalance };
    } catch (error) {
      console.error('Error updating user balance:', error);
      throw error;
    }
  };

  const updateVendorBalanceSafely = async (vendorId: string, amount: number): Promise<boolean> => {
    try {
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

      const fullLocation = [
        locationNames.state_name || `State ID: ${locationStep.state_id}`,
        locationNames.university_name || (locationStep.university_id ? `University ID: ${locationStep.university_id}` : ''),
        locationNames.campus_name || (locationStep.campus_id ? `Campus ID: ${locationStep.campus_id}` : ''),
        locationStep.precise_location
      ].filter(Boolean).join(', ');

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
          state_name: locationNames.state_name || `State ID: ${locationStep.state_id}`,
          university_id: locationStep.university_id,
          university_name: locationNames.university_name || (locationStep.university_id ? `University ID: ${locationStep.university_id}` : null),
          campus_id: locationStep.campus_id,
          campus_name: locationNames.campus_name || (locationStep.campus_id ? `Campus ID: ${locationStep.campus_id}` : null),
          precise_location: locationStep.precise_location,
          full_location: fullLocation
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

      if (error) throw new Error(`Failed to create order: ${error.message}`);
      return order;
    } catch (error) {
      console.error('Error in createOrderRecord:', error);
      throw error;
    }
  };

  const createOrderItems = async (orderId: string) => {
    try {
      const fullLocation = [
        locationNames.state_name || `State ID: ${locationStep.state_id}`,
        locationNames.university_name || (locationStep.university_id ? `University ID: ${locationStep.university_id}` : ''),
        locationNames.campus_name || (locationStep.campus_id ? `Campus ID: ${locationStep.campus_id}` : ''),
        locationStep.precise_location
      ].filter(Boolean).join(', ');

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
          state_name: locationNames.state_name || `State ID: ${locationStep.state_id}`,
          university_id: locationStep.university_id,
          university_name: locationNames.university_name || (locationStep.university_id ? `University ID: ${locationStep.university_id}` : null),
          campus_id: locationStep.campus_id,
          campus_name: locationNames.campus_name || (locationStep.campus_id ? `Campus ID: ${locationStep.campus_id}` : null),
          precise_location: locationStep.precise_location,
          full_location: fullLocation
        },
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (error) throw new Error(`Failed to create order items: ${error.message}`);
    } catch (error) {
      console.error('Error in createOrderItems:', error);
      throw error;
    }
  };

  const updateProductInventory = async () => {
    try {
      for (const item of cartItems) {
        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('inventory')
          .eq('id', item.product_id)
          .single();

        if (fetchError) throw new Error(`Product ${item.product_id} not found: ${fetchError.message}`);

        const currentInventory = product.inventory || 0;
        if (currentInventory < item.quantity) {
          throw new Error(`Insufficient inventory for ${item.product.title}. Available: ${currentInventory}, Requested: ${item.quantity}`);
        }

        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            inventory: currentInventory - item.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.product_id);

        if (updateError) throw new Error(`Failed to update inventory for ${item.product.title}: ${updateError.message}`);
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

      if (error) throw new Error(`Failed to clear cart: ${error.message}`);
    } catch (error) {
      console.error('Error in clearCart:', error);
      throw error;
    }
  };

  const formatPrice = (price: number) => `₦${price.toLocaleString('en-NG')}`;

  const generateBankDetails = () => ({
    bank_name: "WEMA BANK",
    account_number: "7839273645",
    account_name: "GoStorez Enterprises",
    reference: `DEP-${userProfile?.email?.split('@')[0]?.toUpperCase() || 'USER'}-${Date.now().toString().slice(-6)}`
  });

  const bankDetails = generateBankDetails();

  const renderConfirmStep = () => {
    const locationDisplay = [
      locationNames.state_name || (locationStep.state_id ? `State ID: ${locationStep.state_id}` : ''),
      locationNames.university_name || (locationStep.university_id ? `University ID: ${locationStep.university_id}` : ''),
      locationNames.campus_name || (locationStep.campus_id ? `Campus ID: ${locationStep.campus_id}` : ''),
      locationStep.precise_location
    ].filter(Boolean).join(', ');

    return (
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
              {locationDisplay}
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
  };

  const renderProcessingStep = () => {
    const stages = [
      { number: 1, label: 'Verifying details', active: processingStage >= 1 },
      { number: 2, label: 'Processing payment', active: processingStage >= 2 },
      { number: 3, label: 'Creating order', active: processingStage >= 3 }
    ];

    return (
      <div className="order-processing">
        <div className="processing-content">
          <div className="processing-spinner"></div>
          <h3>Processing Your Order</h3>
          <p>{processingOrder || 'Please wait while we process your order...'}</p>
          
          <div className="processing-steps">
            {stages.map((stage) => (
              <div key={stage.number} className={`processing-step ${stage.active ? 'active' : ''}`}>
                <div className="step-icon">{stage.number}</div>
                <span>{stage.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSuccessStep = () => {
    const locationDisplay = [
      locationNames.state_name || `State ID: ${locationStep.state_id}`,
      locationNames.university_name || (locationStep.university_id ? `University ID: ${locationStep.university_id}` : ''),
      locationNames.campus_name || (locationStep.campus_id ? `Campus ID: ${locationStep.campus_id}` : ''),
      locationStep.precise_location
    ].filter(Boolean).join(', ');

    return (
      <div className="order-success">
        <div className="success-content">
          <div className="success-header">
            <CheckCircle size={48} className="success-icon" />
            <h3>Order Successful!</h3>
            <p className="success-message">
              Your purchase has been completed successfully. Receipt is downloading...
            </p>
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
                <div className="location-info">{locationDisplay}</div>
              </div>
            </div>
          </div>

          <div className="success-actions">
            <button
              className="success-btn primary"
              onClick={() => {
                onOrderSuccess(orderId);
                window.location.href = '/user/dashboard';
              }}
            >
              <BarChart size={16} />
              Track Order
            </button>
            <button
              className="success-btn secondary"
              onClick={() => {
                onOrderSuccess(orderId);
                window.location.href = '/';
              }}
            >
              <Home size={16} />
              Continue Shopping
            </button>
            <button
              ref={printButtonRef}
              className="success-btn success"
              onClick={generatePDFReceipt}
              style={{ display: 'none' }}
            >
              <Printer size={16} />
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
  };

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