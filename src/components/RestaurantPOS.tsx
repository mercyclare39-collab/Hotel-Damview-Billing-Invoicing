import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Coffee,
  Wine,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Printer,
  Smartphone,
  CreditCard,
  DollarSign,
  Search,
  Receipt,
  User,
  Clock,
  Building,
  RefreshCw,
  ShoppingBag,
  Share2,
  Edit2,
  X,
} from 'lucide-react';
import { POSOrder, POSOrderItem, HotelProfile, Client, BillingDocument } from '../types';
import { dbService, STANDARD_POS_MENU } from '../services/db';

interface RestaurantPOSProps {
  profile: HotelProfile;
  clients: Client[];
  onGenerateReceipt?: (docData: Partial<BillingDocument>) => void;
}

const CATEGORIES = [
  'ALL',
  'Breakfast',
  'Starters & Snacks',
  'Main Dishes',
  'Beverages & Juices',
  'Bar & Cocktails',
  'Conference Packages',
];

const TABLE_OPTIONS = [
  'Table 1 (Main Dining)',
  'Table 2 (Main Dining)',
  'Table 3 (Window View)',
  'Table 4 (Window View)',
  'Table 5 (Terrace)',
  'Table 6 (Terrace Lake View)',
  'VIP Lounge 1',
  'VIP Lounge 2',
  'Room 101 (Room Service)',
  'Room 102 (Room Service)',
  'Room 204 (Room Service)',
  'Garden Pavilion Bar',
  'Takeaway / Express Counter',
];

export const RestaurantPOS: React.FC<RestaurantPOSProps> = ({ profile }) => {
  const [menuItems, setMenuItems] = useState<POSOrderItem[]>([]);
  const [posCatalog, setPosCatalog] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<POSOrderItem[]>([]);
  const [tableOrRoom, setTableOrRoom] = useState(TABLE_OPTIONS[0]);
  const [guestName, setGuestName] = useState('Walk-in Guest');
  const [paymentMode, setPaymentMode] = useState<POSOrder['paymentMode']>('M-Pesa');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [recentOrders, setRecentOrders] = useState<POSOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'pos' | 'history' | 'catalog'>('pos');
  const [successOrder, setSuccessOrder] = useState<POSOrder | null>(null);

  // Catalog Form Modal State
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<any | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState<any>('Main Dishes');
  const [itemRate, setItemRate] = useState<number>(500);
  const [itemTaxable, setItemTaxable] = useState(true);
  const [itemAvailable, setItemAvailable] = useState(true);

  const loadData = async () => {
    const orders = await dbService.getPOSOrders();
    setRecentOrders(orders);
    const catalog = await dbService.getPOSMenuItems();
    setPosCatalog(catalog);
    
    // Map catalog to POSOrderItems format for active touchscreen
    const items: POSOrderItem[] = catalog.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      price: c.unitRate || c.price || 0,
      quantity: 1,
      amount: c.unitRate || c.price || 0,
    }));
    setMenuItems(items);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenNewCatalogItem = () => {
    setEditingMenuItem(null);
    setItemName('');
    setItemCategory('Main Dishes');
    setItemRate(500);
    setItemTaxable(true);
    setItemAvailable(true);
    setIsCatalogModalOpen(true);
  };

  const handleOpenEditCatalogItem = (item: any) => {
    setEditingMenuItem(item);
    setItemName(item.name || '');
    setItemCategory(item.category || 'Main Dishes');
    setItemRate(item.unitRate || item.price || 0);
    setItemTaxable(item.taxApplicable !== false);
    setItemAvailable(item.available !== false);
    setIsCatalogModalOpen(true);
  };

  const handleSaveCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || itemRate <= 0) return;

    const newItem = {
      id: editingMenuItem ? editingMenuItem.id : 'pos-m-' + Date.now(),
      name: itemName.trim(),
      category: itemCategory,
      unitRate: itemRate,
      taxApplicable: itemTaxable,
      available: itemAvailable,
      updatedAt: new Date().toISOString(),
    };

    await dbService.savePOSMenuItem(newItem);
    await loadData();
    setIsCatalogModalOpen(false);
  };

  const handleDeleteCatalogItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this item from the POS menu catalog?')) return;
    await dbService.deletePOSMenuItem(id);
    await loadData();
  };

  const addToCart = (item: POSOrderItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + 1, amount: (i.quantity + 1) * i.price }
            : i
        );
      } else {
        return [...prev, { ...item, quantity: 1, amount: item.price }];
      }
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty, amount: newQty * item.price } : null;
          }
          return item;
        })
        .filter(Boolean) as POSOrderItem[]
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Computations
  const rawSubtotal = cart.reduce((sum, i) => sum + i.amount, 0);
  const discountAmount = Math.round((rawSubtotal * discountPercent) / 100);
  const discountedSubtotal = Math.max(0, rawSubtotal - discountAmount);
  const vatAmount = Math.round((discountedSubtotal * (profile.vatRate || 16)) / 100 * 100) / 100;
  const grandTotal = discountedSubtotal + vatAmount;

  const handleCompleteOrder = async () => {
    if (cart.length === 0) return;

    const nextOrderNum = await dbService.getNextPOSOrderNumber();
    const nextReceiptNum =
      paymentMode !== 'Room Charge' ? await dbService.getNextReceiptNumber() : undefined;

    const newOrder: POSOrder = {
      id: 'pos-ord-' + Date.now(),
      orderNumber: nextOrderNum,
      tableOrRoom,
      guestOrClientName: guestName.trim() || 'Walk-in Guest',
      items: [...cart],
      subtotal: discountedSubtotal,
      vatAmount,
      grandTotal,
      paymentMode,
      status: paymentMode === 'Room Charge' ? 'Billed to Room' : 'Completed',
      receiptNumber: nextReceiptNum,
      createdAt: new Date().toISOString(),
    };

    await dbService.savePOSOrder(newOrder);

    // If paid via cash/mpesa/card, record payment receipt
    if (nextReceiptNum && paymentMode !== 'Room Charge') {
      await dbService.savePayment({
        id: 'pay-pos-' + Date.now(),
        receiptNumber: nextReceiptNum,
        documentId: '',
        documentNumber: newOrder.orderNumber,
        clientId: 'cli-pos-walkin',
        clientName: newOrder.guestOrClientName + ` (${newOrder.tableOrRoom})`,
        date: new Date().toISOString().split('T')[0],
        amount: newOrder.grandTotal,
        paymentMode: paymentMode === 'Complimentary' ? 'Cash' : paymentMode,
        referenceNote: `POS Order: ${newOrder.orderNumber} - ${newOrder.tableOrRoom}`,
        createdAt: new Date().toISOString(),
      });
    }

    setSuccessOrder(newOrder);
    setCart([]);
    await loadData();
  };

  const filteredMenuItems = menuItems.filter((item) => {
    const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-lg border border-stone-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 text-amber-700 rounded-lg">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900">Restaurant & POS Quick-Billing</h2>
            <p className="text-xs text-stone-500">
              Fast touchscreen ordering for dining, bar tabs, outdoor catering & room charge transfers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
            <button
              onClick={() => setActiveTab('pos')}
              className={`px-3 py-1.5 font-medium rounded-md transition-all ${
                activeTab === 'pos'
                  ? 'bg-white shadow-xs text-stone-900 font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Active Terminal
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 font-medium rounded-md transition-all ${
                activeTab === 'history'
                  ? 'bg-white shadow-xs text-stone-900 font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Order Journal ({recentOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-1.5 font-medium rounded-md transition-all ${
                activeTab === 'catalog'
                  ? 'bg-white shadow-xs text-stone-900 font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Menu & Price Catalog ({posCatalog.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Menu Catalogue (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Category Chips & Search */}
            <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Quick-search food, beverage, cocktails or catering packages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-stone-50 border border-stone-300 rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-stone-900 text-amber-400 shadow-xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Tiles Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredMenuItems.map((item) => {
                const inCart = cart.find((i) => i.id === item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addToCart(item)}
                    className={`text-left p-3.5 rounded-lg border transition-all flex flex-col justify-between h-28 relative cursor-pointer ${
                      inCart
                        ? 'bg-amber-50 border-amber-400 shadow-xs'
                        : 'bg-white border-stone-200 hover:border-amber-300 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-stone-400 tracking-wider block">
                        {item.category}
                      </span>
                      <h4 className="text-xs font-bold text-stone-900 leading-tight mt-0.5 line-clamp-2">
                        {item.name}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-100">
                      <span className="font-mono font-bold text-stone-900 text-xs">
                        Ksh {item.price.toLocaleString()}
                      </span>
                      <div className="p-1 bg-amber-500 text-stone-950 rounded font-bold text-xs flex items-center justify-center w-5 h-5 shadow-xs">
                        {inCart ? inCart.quantity : '+'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Active Order Cart & Terminal Checkout (5 Cols) */}
          <div className="lg:col-span-5 bg-white border border-stone-200 rounded-lg shadow-xs p-5 space-y-4 sticky top-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-sm text-stone-900">Active Order Ticket</h3>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-[11px] text-stone-400 hover:text-rose-600 transition-colors font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Ticket
                </button>
              )}
            </div>

            {/* Table & Guest Inputs */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block font-semibold text-stone-600 mb-1">Table / Location</label>
                <select
                  value={tableOrRoom}
                  onChange={(e) => setTableOrRoom(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded font-semibold text-stone-800"
                >
                  {TABLE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-600 mb-1">Guest / Contact</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Table 4 Guest"
                  className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded text-stone-800"
                />
              </div>
            </div>

            {/* Cart Items List */}
            <div className="border border-stone-200 rounded-lg p-2 max-h-60 overflow-y-auto divide-y divide-stone-100 text-xs">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-stone-400 space-y-1">
                  <Utensils className="w-6 h-6 mx-auto stroke-1" />
                  <p className="font-medium">No menu items added yet.</p>
                  <p className="text-[11px]">Click items from the left catalogue to build ticket.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h5 className="font-semibold text-stone-900 truncate">{item.name}</h5>
                      <span className="text-[11px] text-stone-500 font-mono">
                        Ksh {item.price.toLocaleString()} each
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 bg-stone-100 hover:bg-stone-200 rounded flex items-center justify-center font-bold text-stone-700 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-mono font-bold text-stone-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 bg-stone-100 hover:bg-stone-200 rounded flex items-center justify-center font-bold text-stone-700 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right font-mono font-bold text-stone-900 shrink-0 w-16">
                      Ksh {item.amount.toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Financial Summary */}
            <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-2 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal ({cart.reduce((sum, i) => sum + i.quantity, 0)} items):</span>
                <span className="font-mono">Ksh {rawSubtotal.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between text-stone-600">
                <span className="flex items-center gap-1">
                  <span>Discount:</span>
                  <select
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="px-1.5 py-0.5 bg-white border border-stone-300 rounded text-[11px]"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={10}>10%</option>
                    <option value={15}>15%</option>
                    <option value={20}>20%</option>
                  </select>
                </span>
                <span className="font-mono text-stone-700">
                  - Ksh {discountAmount.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between text-stone-600">
                <span>16% VAT Output:</span>
                <span className="font-mono">Ksh {vatAmount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-sm font-bold text-stone-900 pt-2 border-t border-stone-200">
                <span>Grand Total:</span>
                <span className="font-mono text-base text-amber-700">
                  Ksh {grandTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-stone-700">Settlement Method</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['M-Pesa', 'Cash', 'Room Charge', 'Credit Card'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`py-2 px-2.5 rounded-lg font-bold transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                      paymentMode === mode
                        ? 'bg-stone-900 text-amber-400 shadow-xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {mode === 'M-Pesa' && <Smartphone className="w-3.5 h-3.5 text-emerald-400" />}
                    {mode === 'Cash' && <DollarSign className="w-3.5 h-3.5 text-amber-400" />}
                    {mode === 'Room Charge' && <Building className="w-3.5 h-3.5 text-sky-400" />}
                    {mode === 'Credit Card' && <CreditCard className="w-3.5 h-3.5 text-purple-400" />}
                    <span>{mode}</span>
                  </button>
                ))}
              </div>
            </div>

            {paymentMode === 'M-Pesa' && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded text-[11px] text-emerald-900 space-y-0.5">
                <div className="font-bold flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                  <span>M-Pesa Buy Goods Till: {profile.mpesaTillNumber || '(Configure in Hotel Settings)'}</span>
                </div>
                <p className="text-emerald-800">
                  Ask guest to pay <strong>Ksh {grandTotal.toLocaleString()}</strong> to Hotel Damview Till.
                </p>
              </div>
            )}

            {paymentMode === 'Room Charge' && (
              <div className="p-2.5 bg-sky-50 border border-sky-300 rounded text-[11px] text-sky-900 space-y-0.5">
                <div className="font-bold flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-sky-700" />
                  <span>Transfer to Room Folio: {tableOrRoom}</span>
                </div>
                <p className="text-sky-800">
                  Amount will be added to the guest room invoice upon departure check-out.
                </p>
              </div>
            )}

            {/* Complete Order Button */}
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={handleCompleteOrder}
              className={`w-full py-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                cart.length === 0
                  ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>
                {paymentMode === 'Room Charge'
                  ? `Charge Ksh ${grandTotal.toLocaleString()} to Room`
                  : `Complete & Settle Ksh ${grandTotal.toLocaleString()}`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white border border-stone-200 rounded-lg shadow-xs overflow-hidden">
          <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
            <h3 className="font-bold text-sm text-stone-900">POS Order & Receipt History</h3>
            <span className="text-xs text-stone-500">
              Total Recorded Orders: <strong>{recentOrders.length}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 text-stone-700 border-b border-stone-200">
                  <th className="p-3 font-bold">Order #</th>
                  <th className="p-3 font-bold">Table / Room</th>
                  <th className="p-3 font-bold">Guest / Contact</th>
                  <th className="p-3 font-bold">Items Summary</th>
                  <th className="p-3 font-bold text-right">Amount (Ksh)</th>
                  <th className="p-3 font-bold">Payment</th>
                  <th className="p-3 font-bold">Status</th>
                  <th className="p-3 font-bold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {recentOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-stone-50">
                    <td className="p-3 font-mono font-bold text-amber-700">{ord.orderNumber}</td>
                    <td className="p-3 font-medium text-stone-900">{ord.tableOrRoom}</td>
                    <td className="p-3 text-stone-700">{ord.guestOrClientName}</td>
                    <td className="p-3 text-stone-600 max-w-xs truncate">
                      {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-stone-900">
                      {ord.grandTotal.toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-stone-800">
                        {ord.paymentMode}
                      </span>
                      {ord.receiptNumber && (
                        <span className="block font-mono text-[10px] text-emerald-700">
                          {ord.receiptNumber}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ord.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </td>
                    <td className="p-3 text-stone-500 font-mono text-[11px]">
                      {new Date(ord.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Menu Catalog Manager Tab */}
      {activeTab === 'catalog' && (
        <div className="bg-white border border-stone-200 rounded-lg shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
            <div>
              <h3 className="font-bold text-sm text-stone-900">POS Menu Catalog & Rate Master</h3>
              <p className="text-xs text-stone-500">
                Manage food items, beverages, bar offerings, and catering package rates synchronized with Google Sheets.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenNewCatalogItem}
              className="px-3.5 py-2 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-amber-400 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Menu Item</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 text-stone-700 border-b border-stone-200">
                  <th className="p-3 font-bold">Item Name</th>
                  <th className="p-3 font-bold">Category</th>
                  <th className="p-3 font-bold text-right">Standard Rate (Ksh)</th>
                  <th className="p-3 font-bold">Tax Applicability</th>
                  <th className="p-3 font-bold">Status</th>
                  <th className="p-3 font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {posCatalog.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3 font-bold text-stone-900">{item.name}</td>
                    <td className="p-3 text-stone-600">
                      <span className="bg-stone-100 border border-stone-200 px-2 py-0.5 rounded text-[11px] font-medium text-stone-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-amber-700">
                      Ksh {(item.unitRate || item.price || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-stone-600">
                      {item.taxApplicable !== false ? '16% VAT Included' : 'Tax Exempt'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.available !== false
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.available !== false ? 'Active' : 'Unavailable'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditCatalogItem(item)}
                          className="p-1 text-stone-600 hover:text-amber-700 rounded hover:bg-stone-100 transition-colors cursor-pointer"
                          title="Edit Item"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCatalogItem(item.id)}
                          className="p-1 text-stone-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* POS Catalog Item Add/Edit Modal */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden text-xs">
            <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-400" />
                <span>{editingMenuItem ? 'Edit POS Menu Item' : 'Add New POS Menu Item'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(false)}
                className="text-stone-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCatalogItem} className="p-5 space-y-4">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Item / Dish Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Damview Special Tilapia Fry, Grilled Goat Chops, M-Pesa Cocktail"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full border border-stone-300 rounded-md p-2 text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Menu Category</label>
                <select
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  className="w-full border border-stone-300 rounded-md p-2 text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                >
                  <option value="Breakfast">Breakfast</option>
                  <option value="Starters & Snacks">Starters & Snacks</option>
                  <option value="Main Dishes">Main Dishes</option>
                  <option value="Beverages & Juices">Beverages & Juices</option>
                  <option value="Bar & Cocktails">Bar & Cocktails</option>
                  <option value="Conference Packages">Conference Packages</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Standard Rate (Ksh)</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  required
                  value={itemRate}
                  onChange={(e) => setItemRate(parseFloat(e.target.value) || 0)}
                  className="w-full border border-stone-300 rounded-md p-2 text-stone-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemTaxable}
                    onChange={(e) => setItemTaxable(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <span className="text-stone-800 font-medium">Subject to 16% VAT</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemAvailable}
                    onChange={(e) => setItemAvailable(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <span className="text-stone-800 font-medium">Available for Ordering</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsCatalogModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-md text-stone-700 hover:bg-stone-100 font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold rounded-md transition-colors cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Receipt Modal */}
      {successOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden text-xs">
            <div className="bg-stone-900 text-white p-4 text-center space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h3 className="font-bold text-base">Order Settled Successfully</h3>
              <p className="text-stone-300 text-xs font-mono">
                Order #{successOrder.orderNumber}
                {successOrder.receiptNumber && ` • ${successOrder.receiptNumber}`}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="border border-stone-200 rounded-lg p-3 space-y-2 bg-stone-50">
                <div className="flex justify-between">
                  <span className="text-stone-500">Location:</span>
                  <span className="font-bold text-stone-900">{successOrder.tableOrRoom}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Guest:</span>
                  <span className="font-bold text-stone-900">{successOrder.guestOrClientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Payment Mode:</span>
                  <span className="font-bold text-stone-900">{successOrder.paymentMode}</span>
                </div>
                <div className="pt-2 border-t border-stone-200 flex justify-between font-bold text-sm">
                  <span>Grand Total:</span>
                  <span className="font-mono text-amber-700">
                    Ksh {successOrder.grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-1 divide-y divide-stone-100">
                {successOrder.items.map((it) => (
                  <div key={it.id} className="pt-1 flex justify-between text-[11px]">
                    <span className="text-stone-700">
                      {it.quantity}x {it.name}
                    </span>
                    <span className="font-mono font-semibold text-stone-900">
                      Ksh {it.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print POS Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSuccessOrder(null)}
                  className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold rounded-lg transition-colors"
                >
                  New Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
