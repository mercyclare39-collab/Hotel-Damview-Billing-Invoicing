import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Bed,
  Building,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  LogOut,
  FileText,
  User,
  Phone,
  Mail,
  Trash2,
  Edit2,
  X,
  CreditCard,
  DollarSign,
  Tag,
  AlertCircle,
  ArrowRight,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';
import { Reservation, HotelProfile, Client, BillingDocument } from '../types';
import { dbService } from '../services/db';
import { exportTableToXlsx } from '../utils/excelExporter';
import { formatDate } from '../utils/formatters';
import { calculateTotals, calculateBalanceDue } from '../utils/financial';

interface ReservationsManagerProps {
  profile: HotelProfile;
  clients: Client[];
  onConvertToInvoice: (docData: Partial<BillingDocument>) => void;
  onShowPaymentModal?: (doc: BillingDocument) => void;
}

const ROOM_INVENTORY = [
  { name: 'VIP Suite 101 (Lake View)', type: 'Room', rate: 8500, capacity: '2 Guests' },
  { name: 'Deluxe Room 204 (Lake View)', type: 'Room', rate: 7000, capacity: '2 Guests' },
  { name: 'Standard Room 102', type: 'Room', rate: 5500, capacity: '1-2 Guests' },
  { name: 'Standard Room 103', type: 'Room', rate: 5500, capacity: '1-2 Guests' },
  { name: 'Twin Deluxe 105', type: 'Room', rate: 7000, capacity: '2-3 Guests' },
  { name: 'Executive Conference Hall', type: 'Hall', rate: 25000, capacity: '60 Delegates' },
  { name: 'Maruba Garden Pavilion', type: 'Hall', rate: 35000, capacity: '150 Delegates' },
  { name: 'Boardroom VIP Suite', type: 'Hall', rate: 15000, capacity: '20 Delegates' },
];

export const ReservationsManager: React.FC<ReservationsManagerProps> = ({
  profile,
  clients,
  onConvertToInvoice,
}) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [roomSpaces, setRoomSpaces] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [activeView, setActiveView] = useState<'grid' | 'table' | 'spaces'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);

  // Space Registration Modal State
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<any | null>(null);
  const [spaceCode, setSpaceCode] = useState('');
  const [spaceName, setSpaceName] = useState('');
  const [spaceType, setSpaceType] = useState<'Room' | 'Conference Hall' | 'Auxiliary Space'>('Room');
  const [spaceBaseRate, setSpaceBaseRate] = useState<number>(5500);
  const [spaceCapacity, setSpaceCapacity] = useState('2 Guests');

  // Form State
  const [folioNumber, setFolioNumber] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestKraPin, setGuestKraPin] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [unitType, setUnitType] = useState<'Room' | 'Hall'>('Room');
  const [unitName, setUnitName] = useState('');
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);
  const [checkOutDate, setCheckOutDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [ratePerNight, setRatePerNight] = useState(5500);
  const [nightsOrDays, setNightsOrDays] = useState(1);
  const [amountPaid, setAmountPaid] = useState(0);
  const [status, setStatus] = useState<'Reserved' | 'Checked-In' | 'Checked-Out' | 'Cancelled'>(
    'Reserved'
  );
  const [specialRequests, setSpecialRequests] = useState('');

  const loadData = async () => {
    const list = await dbService.getReservations();
    setReservations(list);
    const spaces = await dbService.getRoomSpaceItems();
    setRoomSpaces(spaces);
    if (spaces.length > 0 && !unitName) {
      setUnitName(spaces[0].name);
      setUnitType(spaces[0].spaceType === 'Conference Hall' ? 'Hall' : 'Room');
      setRatePerNight(spaces[0].baseRate || 5500);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenNewSpace = () => {
    setEditingSpace(null);
    setSpaceCode(`R-${Math.floor(100 + Math.random() * 900)}`);
    setSpaceName('');
    setSpaceType('Room');
    setSpaceBaseRate(6000);
    setSpaceCapacity('2 Guests');
    setIsSpaceModalOpen(true);
  };

  const handleOpenEditSpace = (space: any) => {
    setEditingSpace(space);
    setSpaceCode(space.code || '');
    setSpaceName(space.name || '');
    setSpaceType(space.spaceType || 'Room');
    setSpaceBaseRate(space.baseRate || 5500);
    setSpaceCapacity(space.capacity || '2 Guests');
    setIsSpaceModalOpen(true);
  };

  const handleSaveSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceName.trim() || spaceBaseRate <= 0) return;

    const newSpace = {
      id: editingSpace ? editingSpace.id : 'rs-' + Date.now(),
      code: spaceCode.trim() || 'S-001',
      name: spaceName.trim(),
      spaceType,
      baseRate: spaceBaseRate,
      capacity: spaceCapacity.trim() || '2 Guests',
      status: 'Available',
      updatedAt: new Date().toISOString(),
    };

    await dbService.saveRoomSpaceItem(newSpace);
    await loadData();
    setIsSpaceModalOpen(false);
  };

  const handleDeleteSpace = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this space from the catalog?')) return;
    await dbService.deleteRoomSpaceItem(id);
    await loadData();
  };

  // Recalculate nights and total when dates or unit change
  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const d1 = new Date(checkInDate).getTime();
      const d2 = new Date(checkOutDate).getTime();
      const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
      setNightsOrDays(diffDays);
    }
  }, [checkInDate, checkOutDate]);

  const handleUnitSelect = (name: string) => {
    setUnitName(name);
    const item = roomSpaces.find((r) => r.name === name);
    if (item) {
      setUnitType(item.spaceType === 'Conference Hall' ? 'Hall' : 'Room');
      setRatePerNight(item.baseRate || 5500);
    }
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setGuestName(client.contactPerson || client.name);
      setGuestPhone(client.phone || '');
      setGuestEmail(client.email || '');
      setGuestKraPin(client.kraPin || '');
    }
  };

  const openNewModal = async () => {
    const nextFolio = await dbService.getNextFolioNumber();
    setEditingRes(null);
    setFolioNumber(nextFolio);
    setGuestName('');
    setGuestPhone('');
    setGuestEmail('');
    setGuestKraPin('');
    setSelectedClientId('');
    setUnitName(ROOM_INVENTORY[0].name);
    setUnitType(ROOM_INVENTORY[0].type as 'Room' | 'Hall');
    setRatePerNight(ROOM_INVENTORY[0].rate);
    setCheckInDate(new Date().toISOString().split('T')[0]);
    setCheckOutDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    setNightsOrDays(1);
    setAmountPaid(0);
    setStatus('Reserved');
    setSpecialRequests('');
    setIsModalOpen(true);
  };

  const openEditModal = (res: Reservation) => {
    setEditingRes(res);
    setFolioNumber(res.folioNumber);
    setGuestName(res.guestName);
    setGuestPhone(res.guestPhone || '');
    setGuestEmail(res.guestEmail || '');
    setGuestKraPin(res.guestKraPin || '');
    setSelectedClientId(res.clientId || '');
    setUnitType(res.unitType);
    setUnitName(res.unitName);
    setCheckInDate(res.checkInDate);
    setCheckOutDate(res.checkOutDate);
    setRatePerNight(res.ratePerNight);
    setNightsOrDays(res.nightsOrDays);
    setAmountPaid(res.amountPaid);
    setStatus(res.status);
    setSpecialRequests(res.specialRequests || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmount = ratePerNight * nightsOrDays;
    const balanceDue = Math.max(0, totalAmount - amountPaid);
    const clientObj = clients.find((c) => c.id === selectedClientId);

    const reservationData: Reservation = {
      id: editingRes?.id || 'res-' + Date.now(),
      folioNumber,
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
      guestEmail: guestEmail.trim(),
      guestKraPin: guestKraPin.trim(),
      clientId: selectedClientId || undefined,
      clientName: clientObj?.name,
      unitType,
      unitName,
      checkInDate,
      checkOutDate,
      ratePerNight,
      nightsOrDays,
      totalAmount,
      amountPaid,
      balanceDue,
      status,
      specialRequests: specialRequests.trim(),
      createdAt: editingRes?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.saveReservation(reservationData);
    await loadData();
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this reservation folio?')) {
      await dbService.deleteReservation(id);
      await loadData();
    }
  };

  const handleQuickStatus = async (res: Reservation, newStatus: Reservation['status']) => {
    await dbService.saveReservation({
      ...res,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
    await loadData();
  };

  const handleInvoiceConversion = (res: Reservation) => {
    const client = clients.find((c) => c.id === res.clientId) || {
      id: 'temp-' + Date.now(),
      name: res.clientName || res.guestName,
      kraPin: res.guestKraPin || '',
      address: profile.physicalLocation,
      phone: res.guestPhone || '',
      email: res.guestEmail || '',
      contactPerson: res.guestName,
      createdAt: new Date().toISOString(),
    };

    const lineItems = [
      {
        id: 'li-res-1',
        particulars: `${res.unitName} - ${res.unitType === 'Room' ? 'Accommodation Stay' : 'Conference Facility Hire'} (${res.checkInDate} to ${res.checkOutDate})`,
        quantity: 1,
        days: res.nightsOrDays,
        rate: res.ratePerNight,
        discount: 0,
        amount: res.totalAmount,
      },
    ];

    const totals = calculateTotals(lineItems, 0, profile.vatRate || 16);
    const balanceDue = calculateBalanceDue(totals.grandTotal, res.amountPaid);

    onConvertToInvoice({
      documentType: 'INVOICE',
      clientId: client.id,
      clientName: client.name,
      clientKraPin: client.kraPin,
      clientAddress: client.address,
      clientPhone: client.phone,
      clientEmail: client.email,
      issueDate: new Date().toISOString().split('T')[0],
      validityDays: 14,
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      lineItems,
      grossSubtotal: totals.grossSubtotal,
      discount: 0,
      discountedTotal: totals.discountedTotal,
      subtotal: totals.taxableSubtotal,
      vatAmount: totals.vatAmount,
      grandTotal: totals.grandTotal,
      amountPaid: res.amountPaid,
      balanceDue: balanceDue,
      status: res.amountPaid >= totals.grandTotal ? 'Paid' : 'Sent',
      notes: `Generated from Reservation Folio: ${res.folioNumber}. Guest: ${res.guestName}. Special Notes: ${res.specialRequests || 'Standard check-out'}.`,
      terms: 'Settlement due upon departure via M-Pesa or Bank Transfer as per hotel accounts configuration.',
    });
  };

  const filteredReservations = reservations.filter((r) => {
    const matchSearch =
      r.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.folioNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.unitName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.clientName && r.clientName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchStatus = filterStatus === 'ALL' || r.status === filterStatus;
    const matchType = filterType === 'ALL' || r.unitType === filterType;

    return matchSearch && matchStatus && matchType;
  });

  const getStatusBadge = (st: Reservation['status']) => {
    switch (st) {
      case 'Checked-In':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
            Checked-In
          </span>
        );
      case 'Reserved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3" />
            Reserved
          </span>
        );
      case 'Checked-Out':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-300">
            <CheckCircle2 className="w-3 h-3" />
            Checked-Out
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-lg border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-700 rounded-lg">
              <Bed className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">Room & Conference Hall Folios</h2>
              <p className="text-xs text-stone-500">
                Manage guest check-ins, banquet bookings, occupancy schedules & one-click billing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
            <button
              onClick={() => setActiveView('grid')}
              className={`px-3 py-1.5 font-medium rounded-md transition-all ${
                activeView === 'grid'
                  ? 'bg-white shadow-xs text-stone-900 font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Room Grid
            </button>
            <button
              onClick={() => setActiveView('table')}
              className={`px-3 py-1.5 font-medium rounded-md transition-all ${
                activeView === 'table'
                  ? 'bg-white shadow-xs text-stone-900 font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Table List
            </button>
            <button
              onClick={() => setActiveView('spaces')}
              className={`px-3 py-1.5 font-medium rounded-md transition-all ${
                activeView === 'spaces'
                  ? 'bg-white shadow-xs text-stone-900 font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Rooms & Spaces Catalog ({roomSpaces.length})
            </button>
          </div>

          <button
            type="button"
            onClick={async () => {
              if (reservations.length === 0) {
                alert('No reservations to export.');
                return;
              }
              const columns = [
                { header: 'Folio #', key: 'folioNumber', type: 'code' as const, width: 14 },
                { header: 'Guest Name', key: 'guestName', type: 'text' as const, width: 22 },
                { header: 'Unit / Space', key: 'unitName', type: 'text' as const, width: 22 },
                { header: 'Type', key: 'unitType', type: 'text' as const, width: 12 },
                { header: 'Check-In', key: 'checkInDate', type: 'date' as const, width: 13 },
                { header: 'Check-Out', key: 'checkOutDate', type: 'date' as const, width: 13 },
                { header: 'Duration', key: 'nightsOrDays', type: 'number' as const, width: 12 },
                { header: 'Total (Ksh)', key: 'totalAmount', type: 'currency' as const, width: 16 },
                { header: 'Paid (Ksh)', key: 'amountPaid', type: 'currency' as const, width: 16 },
                { header: 'Balance (Ksh)', key: 'balanceDue', type: 'currency' as const, width: 16 },
                { header: 'Status', key: 'status', type: 'status' as const, width: 14 },
              ];

              const data = reservations.map((r) => ({
                folioNumber: r.folioNumber,
                guestName: r.guestName,
                unitName: r.unitName,
                unitType: r.unitType,
                checkInDate: r.checkInDate,
                checkOutDate: r.checkOutDate,
                nightsOrDays: r.nightsOrDays,
                totalAmount: r.totalAmount,
                amountPaid: r.amountPaid || 0,
                balanceDue: r.balanceDue || 0,
                status: r.status,
              }));

              await exportTableToXlsx({
                title: 'Reservations & Folios Schedule',
                sheetName: 'Reservations_Ledger',
                profile,
                columns,
                data,
                filename: `HotelDamview_Reservations_${formatDate()}.xlsx`,
              });
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-lg border border-stone-300 transition-colors cursor-pointer"
            title="Export reservations register to formatted Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={openNewModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-amber-400 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>New Reservation / Folio</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Total Active Folios
          </span>
          <div className="text-xl font-bold text-stone-900 mt-1">{reservations.length}</div>
          <div className="text-[11px] text-stone-500 mt-0.5">Rooms & Halls combined</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-emerald-200 bg-emerald-50/30 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
            Currently In-House
          </span>
          <div className="text-xl font-bold text-emerald-900 mt-1">
            {reservations.filter((r) => r.status === 'Checked-In').length}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Active checked-in units</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-amber-200 bg-amber-50/30 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
            Upcoming Bookings
          </span>
          <div className="text-xl font-bold text-amber-900 mt-1">
            {reservations.filter((r) => r.status === 'Reserved').length}
          </div>
          <div className="text-[11px] text-amber-700 mt-0.5">Awaiting arrival</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Total Folio Value
          </span>
          <div className="text-xl font-bold text-stone-900 mt-1">
            Ksh {reservations.reduce((sum, r) => sum + r.totalAmount, 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            Ksh {reservations.reduce((sum, r) => sum + r.balanceDue, 0).toLocaleString()} unbilled
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-lg border border-stone-200 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by guest name, folio number, room or corporate client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-stone-50 border border-stone-300 rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs bg-stone-50 border border-stone-300 rounded-md px-3 py-2 text-stone-700 focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="Checked-In">Checked-In</option>
            <option value="Reserved">Reserved</option>
            <option value="Checked-Out">Checked-Out</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs bg-stone-50 border border-stone-300 rounded-md px-3 py-2 text-stone-700 focus:outline-hidden"
          >
            <option value="ALL">All Units</option>
            <option value="Room">Rooms Only</option>
            <option value="Hall">Halls Only</option>
          </select>
        </div>
      </div>

      {/* Grid View */}
      {activeView === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReservations.map((res) => (
            <div
              key={res.id}
              className="bg-white border border-stone-200 hover:border-amber-400 rounded-lg p-5 shadow-xs transition-all space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-stone-500">
                      <span className="font-mono font-bold text-amber-700">{res.folioNumber}</span>
                      <span>•</span>
                      <span>{res.unitType}</span>
                    </div>
                    <h3 className="text-sm font-bold text-stone-900 mt-0.5">{res.unitName}</h3>
                  </div>
                  {getStatusBadge(res.status)}
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-stone-900 font-semibold">
                    <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>{res.guestName}</span>
                  </div>

                  {res.clientName && (
                    <div className="flex items-center gap-2 text-stone-600 text-[11px]">
                      <Building className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{res.clientName}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-stone-600 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>
                      {res.checkInDate} &rarr; {res.checkOutDate} ({res.nightsOrDays}{' '}
                      {res.unitType === 'Room' ? 'nights' : 'days'})
                    </span>
                  </div>

                  {res.guestPhone && (
                    <div className="flex items-center gap-2 text-stone-600 text-[11px]">
                      <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>{res.guestPhone}</span>
                    </div>
                  )}

                  {res.specialRequests && (
                    <div className="p-2 bg-stone-50 rounded text-[11px] text-stone-600 italic border border-stone-200/60">
                      &ldquo;{res.specialRequests}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500">Total Charges:</span>
                  <span className="font-bold text-stone-900 font-mono">
                    Ksh {res.totalAmount.toLocaleString()}
                  </span>
                </div>

                {res.balanceDue > 0 ? (
                  <div className="flex items-center justify-between text-xs text-rose-700 bg-rose-50 px-2 py-1 rounded">
                    <span>Balance Due:</span>
                    <span className="font-bold font-mono">Ksh {res.balanceDue.toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                    <span>Folio Balance:</span>
                    <span className="font-bold">Settled (Ksh 0)</span>
                  </div>
                )}

                {/* Card Action Buttons */}
                <div className="flex items-center gap-1.5 pt-1">
                  {res.status === 'Reserved' && (
                    <button
                      type="button"
                      onClick={() => handleQuickStatus(res, 'Checked-In')}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Check-In</span>
                    </button>
                  )}

                  {res.status === 'Checked-In' && (
                    <button
                      type="button"
                      onClick={() => handleQuickStatus(res, 'Checked-Out')}
                      className="flex-1 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Check-Out</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleInvoiceConversion(res)}
                    title="Convert Folio to Tax Invoice"
                    className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Bill Invoice</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(res)}
                    className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded"
                    title="Edit Folio"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(res.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                    title="Delete Folio"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table View */}
      {activeView === 'table' && (
        <div className="bg-white border border-stone-200 rounded-lg shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 text-stone-700 border-b border-stone-200">
                  <th className="p-3 font-bold">Folio #</th>
                  <th className="p-3 font-bold">Guest / Client</th>
                  <th className="p-3 font-bold">Unit Allocation</th>
                  <th className="p-3 font-bold">Dates (Stay)</th>
                  <th className="p-3 font-bold text-right">Total (Ksh)</th>
                  <th className="p-3 font-bold text-right">Balance Due</th>
                  <th className="p-3 font-bold">Status</th>
                  <th className="p-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredReservations.map((res) => (
                  <tr key={res.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-amber-700">{res.folioNumber}</td>
                    <td className="p-3">
                      <div className="font-semibold text-stone-900">{res.guestName}</div>
                      {res.clientName && (
                        <div className="text-[11px] text-stone-500 truncate max-w-[180px]">
                          {res.clientName}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-stone-900">{res.unitName}</div>
                      <div className="text-[11px] text-stone-500">
                        {res.unitType} • Ksh {res.ratePerNight.toLocaleString()}/night
                      </div>
                    </td>
                    <td className="p-3 text-stone-700">
                      <div>
                        {res.checkInDate} &rarr; {res.checkOutDate}
                      </div>
                      <div className="text-[11px] text-stone-500 font-medium">
                        {res.nightsOrDays} {res.unitType === 'Room' ? 'nights' : 'days'}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-stone-900">
                      {res.totalAmount.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      {res.balanceDue > 0 ? (
                        <span className="text-rose-600">{res.balanceDue.toLocaleString()}</span>
                      ) : (
                        <span className="text-emerald-600">0.00</span>
                      )}
                    </td>
                    <td className="p-3">{getStatusBadge(res.status)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleInvoiceConversion(res)}
                          title="Generate Tax Invoice"
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded text-xs font-bold flex items-center gap-1 shadow-xs"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Bill</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(res)}
                          className="p-1 text-stone-500 hover:text-stone-900"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(res.id)}
                          className="p-1 text-stone-400 hover:text-rose-600"
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

      {/* Rooms & Spaces Catalog View */}
      {activeView === 'spaces' && (
        <div className="bg-white border border-stone-200 rounded-lg shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
            <div>
              <h3 className="font-bold text-sm text-stone-900">Rooms, Halls & Auxiliary Spaces Catalog</h3>
              <p className="text-xs text-stone-500">
                Register hotel guest rooms, conference hall facilities, outdoor gardens, and terrace event spaces.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenNewSpace}
              className="px-3.5 py-2 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-amber-400 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Space</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 text-stone-700 border-b border-stone-200">
                  <th className="p-3 font-bold">Space Code</th>
                  <th className="p-3 font-bold">Room / Space Name</th>
                  <th className="p-3 font-bold">Space Type</th>
                  <th className="p-3 font-bold text-right">Base Rate (Ksh)</th>
                  <th className="p-3 font-bold">Capacity</th>
                  <th className="p-3 font-bold">Status</th>
                  <th className="p-3 font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {roomSpaces.map((space) => (
                  <tr key={space.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-amber-700">{space.code || 'S-001'}</td>
                    <td className="p-3 font-bold text-stone-900">{space.name}</td>
                    <td className="p-3">
                      <span className="bg-stone-100 border border-stone-200 px-2 py-0.5 rounded text-[11px] font-medium text-stone-700">
                        {space.spaceType}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-stone-900">
                      Ksh {(space.baseRate || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-stone-600">{space.capacity || '2 Guests'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {space.status || 'Available'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditSpace(space)}
                          className="p-1 text-stone-600 hover:text-amber-700 rounded hover:bg-stone-100 transition-colors cursor-pointer"
                          title="Edit Space"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSpace(space.id)}
                          className="p-1 text-stone-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove Space"
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

      {/* Space Add/Edit Modal */}
      {isSpaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden text-xs">
            <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-400" />
                <span>{editingSpace ? 'Edit Room / Space' : 'Register New Room / Space'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSpaceModalOpen(false)}
                className="text-stone-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSpace} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Code / Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. R-101, H-KILIMA"
                    value={spaceCode}
                    onChange={(e) => setSpaceCode(e.target.value)}
                    className="w-full border border-stone-300 rounded-md p-2 text-stone-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Space Type</label>
                  <select
                    value={spaceType}
                    onChange={(e) => setSpaceType(e.target.value as any)}
                    className="w-full border border-stone-300 rounded-md p-2 text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                  >
                    <option value="Room">Guest Room</option>
                    <option value="Conference Hall">Conference Hall</option>
                    <option value="Auxiliary Space">Auxiliary Space</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Room / Space Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Executive Suite 2B, Kilima Conference Hall, Poolside Terrace"
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  className="w-full border border-stone-300 rounded-md p-2 text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Base Rate / Night (Ksh)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={spaceBaseRate}
                    onChange={(e) => setSpaceBaseRate(parseFloat(e.target.value) || 0)}
                    className="w-full border border-stone-300 rounded-md p-2 text-stone-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Capacity Metadata</label>
                  <input
                    type="text"
                    placeholder="e.g. 2 Guests, 150 Delegates"
                    value={spaceCapacity}
                    onChange={(e) => setSpaceCapacity(e.target.value)}
                    className="w-full border border-stone-300 rounded-md p-2 text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsSpaceModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-md text-stone-700 hover:bg-stone-100 font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold rounded-md transition-colors cursor-pointer"
                >
                  Save Space
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reservation Folio Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden my-8">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bed className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">
                  {editingRes ? `Edit Folio: ${folioNumber}` : 'Create New Reservation Folio'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Folio Serial Number *</label>
                  <input
                    type="text"
                    required
                    value={folioNumber}
                    onChange={(e) => setFolioNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-mono font-bold text-stone-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Link Corporate Client (Optional)
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleClientSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                  >
                    <option value="">Individual Guest (No Corporate Link)</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Guest Full Name *</label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. Hon. Mutua Musyoka"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Guest Phone Number</label>
                  <input
                    type="text"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="e.g. +254 711 200 300"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Guest Email</label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="e.g. guest@example.com"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Guest / Corporate KRA PIN</label>
                  <input
                    type="text"
                    value={guestKraPin}
                    onChange={(e) => setGuestKraPin(e.target.value)}
                    placeholder="e.g. P051122334A"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-mono uppercase"
                  />
                </div>
              </div>

              {/* Unit & Pricing */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-stone-900 mb-1">
                      Room / Hall Unit Selection *
                    </label>
                    <select
                      value={unitName}
                      onChange={(e) => handleUnitSelect(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded font-semibold text-stone-900"
                    >
                      {roomSpaces.map((r) => (
                        <option key={r.id || r.name} value={r.name}>
                          {r.code ? `[${r.code}] ` : ''}{r.name} ({r.spaceType} - Ksh {(r.baseRate || r.rate || 0).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-900 mb-1">
                      Folio Status *
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded font-semibold"
                    >
                      <option value="Reserved">Reserved</option>
                      <option value="Checked-In">Checked-In</option>
                      <option value="Checked-Out">Checked-Out</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Check-In Date</label>
                    <input
                      type="date"
                      required
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Check-Out Date</label>
                    <input
                      type="date"
                      required
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">
                      Rate per Night/Day (Ksh)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={ratePerNight}
                      onChange={(e) => setRatePerNight(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-amber-500/20 text-xs">
                  <div>
                    <span className="text-stone-600">Calculated Duration: </span>
                    <strong className="text-stone-900">
                      {nightsOrDays} {unitType === 'Room' ? 'Nights' : 'Days'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-stone-600">Total Folio Charge: </span>
                    <strong className="text-stone-900 font-mono text-sm">
                      Ksh {(ratePerNight * nightsOrDays).toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Special Notes & Guest Preferences
                </label>
                <textarea
                  rows={2}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="e.g. Quiet room facing Maruba Dam, late check-out, extra water bottles, projector required..."
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded text-stone-700 hover:bg-stone-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold rounded shadow-xs"
                >
                  {editingRes ? 'Update Folio' : 'Save Reservation Folio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
