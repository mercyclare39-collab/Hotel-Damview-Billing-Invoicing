import {
  Client,
  BillingDocument,
  PaymentRecord,
  HotelProfile,
  SyncQueueItem,
  AuditLogEntry,
  StatementRecord,
  Reservation,
  POSOrder,
  ExpenseRecord,
  CatalogueItem,
  POSOrderItem,
} from '../types';

const DB_NAME = 'HotelDamviewDB';
const DB_VERSION = 5;

export interface DeletedTombstone {
  id: string;
  key?: string;
  type: 'DOCUMENT' | 'CLIENT' | 'PAYMENT' | 'RESERVATION' | 'POS';
  deletedAt: number;
}

export type { AuditLogEntry, Reservation, POSOrder, ExpenseRecord, CatalogueItem, POSOrderItem };

export const STANDARD_HOSPITALITY_CATALOGUE: CatalogueItem[] = [
  {
    id: 'cat-1',
    particulars: 'Executive Conference Hall (Day Package with Projector, PA System & Wi-Fi)',
    category: 'Conference & Banqueting',
    standardRate: 25000,
    taxable: true,
    defaultUnit: 'Day',
  },
  {
    id: 'cat-2',
    particulars: 'Maruba Garden Pavilion / Banqueting Hall Hire',
    category: 'Conference & Banqueting',
    standardRate: 35000,
    taxable: true,
    defaultUnit: 'Day',
  },
  {
    id: 'cat-3',
    particulars: 'Full Day Delegate Conference Package (Buffet Lunch, 2x Tea/Coffee & Snacks, 2x 500ml Water, Stationery)',
    category: 'Conference & Banqueting',
    standardRate: 2800,
    taxable: true,
    defaultUnit: 'Person/Day',
  },
  {
    id: 'cat-4',
    particulars: 'Half Day Delegate Conference Package (Buffet Lunch, 1x Tea/Coffee & Snacks, 1x 500ml Water)',
    category: 'Conference & Banqueting',
    standardRate: 2200,
    taxable: true,
    defaultUnit: 'Person/Day',
  },
  {
    id: 'cat-5',
    particulars: 'VIP Deluxe Lake View Suite (Bed & Breakfast, Lake View, Wi-Fi)',
    category: 'Accommodation',
    standardRate: 8500,
    taxable: true,
    defaultUnit: 'Night',
  },
  {
    id: 'cat-6',
    particulars: 'Standard Room Accommodation (Single Occupancy, Bed & Breakfast)',
    category: 'Accommodation',
    standardRate: 5500,
    taxable: true,
    defaultUnit: 'Night',
  },
  {
    id: 'cat-7',
    particulars: 'Standard Room Accommodation (Double / Twin Occupancy, Bed & Breakfast)',
    category: 'Accommodation',
    standardRate: 7000,
    taxable: true,
    defaultUnit: 'Night',
  },
  {
    id: 'cat-8',
    particulars: 'Damview Special Buffet Dinner / Lunch (3-Course Corporate Dining)',
    category: 'Food & Beverage',
    standardRate: 1800,
    taxable: true,
    defaultUnit: 'Person/Day',
  },
  {
    id: 'cat-9',
    particulars: 'Outdoor Cocktail Reception & Live BBQ Station (per delegate)',
    category: 'Food & Beverage',
    standardRate: 2500,
    taxable: true,
    defaultUnit: 'Person/Day',
  },
  {
    id: 'cat-10',
    particulars: 'High-Lumen HD Projector & Motorized Screen Hire',
    category: 'Equipment & Services',
    standardRate: 5000,
    taxable: true,
    defaultUnit: 'Day',
  },
  {
    id: 'cat-11',
    particulars: 'Wireless Cordless Microphones & Dedicated Sound Engineer',
    category: 'Equipment & Services',
    standardRate: 6000,
    taxable: true,
    defaultUnit: 'Day',
  },
  {
    id: 'cat-12',
    particulars: 'Dam Grounds Team-Building Facilitation & Obstacle Course',
    category: 'Equipment & Services',
    standardRate: 35000,
    taxable: true,
    defaultUnit: 'Session',
  },
];

export const STANDARD_POS_MENU: POSOrderItem[] = [
  { id: 'pos-m1', name: 'English Breakfast Combo (Eggs, Sausage, Toast, Coffee/Tea)', category: 'Breakfast', price: 750, quantity: 1, amount: 750 },
  { id: 'pos-m2', name: 'African Tea & Mahamri / Samosas (2 pcs)', category: 'Breakfast', price: 350, quantity: 1, amount: 350 },
  { id: 'pos-m3', name: 'Spanish Omelette with Buttered Toast & Grilled Tomato', category: 'Breakfast', price: 450, quantity: 1, amount: 450 },
  { id: 'pos-m4', name: 'Damview Chicken Wings (Sweet Chilli / Hot Buffalo 6 pcs)', category: 'Starters & Snacks', price: 650, quantity: 1, amount: 650 },
  { id: 'pos-m5', name: 'Beef Samosas Trio with Tangy Tamarind Sauce', category: 'Starters & Snacks', price: 300, quantity: 1, amount: 300 },
  { id: 'pos-m6', name: 'Crispy Garlic Masala Chips / Potato Wedges', category: 'Starters & Snacks', price: 350, quantity: 1, amount: 350 },
  { id: 'pos-m7', name: 'Wet/Dry Fry Goat Meat (Mbuzi Fry 1/2 Kg) with Ugali & Greens', category: 'Main Dishes', price: 950, quantity: 1, amount: 950 },
  { id: 'pos-m8', name: 'Kienyeji Chicken Special (Half) with Rice/Chapati', category: 'Main Dishes', price: 1100, quantity: 1, amount: 1100 },
  { id: 'pos-m9', name: 'Whole Deep-Fried Lake Tilapia with Kachumbari & Ugali', category: 'Main Dishes', price: 1200, quantity: 1, amount: 1200 },
  { id: 'pos-m10', name: 'Prime Beef Steak in Pepper Sauce with Roast Herb Potatoes', category: 'Main Dishes', price: 1050, quantity: 1, amount: 1050 },
  { id: 'pos-m11', name: 'Fresh Passion / Mango / Tropical Cocktail Juice (500ml)', category: 'Beverages & Juices', price: 300, quantity: 1, amount: 300 },
  { id: 'pos-m12', name: 'Soda 300ml Glass (Coke, Fanta, Sprite, Stoney)', category: 'Beverages & Juices', price: 150, quantity: 1, amount: 150 },
  { id: 'pos-m13', name: 'Mineral Water 500ml Still', category: 'Beverages & Juices', price: 100, quantity: 1, amount: 100 },
  { id: 'pos-m14', name: 'Special Dawa Tea (Ginger, Lemon, Honey & Mint)', category: 'Beverages & Juices', price: 350, quantity: 1, amount: 350 },
  { id: 'pos-m15', name: 'Tusker Lager / Malt / Cider 500ml', category: 'Bar & Cocktails', price: 350, quantity: 1, amount: 350 },
  { id: 'pos-m16', name: 'White Cap Crisp / Heineken 330ml', category: 'Bar & Cocktails', price: 400, quantity: 1, amount: 400 },
  { id: 'pos-m17', name: 'Maruba Sunset Signature Cocktail', category: 'Bar & Cocktails', price: 750, quantity: 1, amount: 750 },
  { id: 'pos-m18', name: 'House Wine (Red / White by Glass 150ml)', category: 'Bar & Cocktails', price: 500, quantity: 1, amount: 500 },
  { id: 'pos-m19', name: 'Executive Buffet Lunch (Corporate Dining per person)', category: 'Conference Packages', price: 1800, quantity: 1, amount: 1800 },
  { id: 'pos-m20', name: 'Morning / Afternoon Tea Break with Assorted Savouries', category: 'Conference Packages', price: 650, quantity: 1, amount: 650 },
];

export const DEFAULT_HOTEL_PROFILE: HotelProfile = {
  name: 'HOTEL DAMVIEW',
  tagline: 'Scenic Luxury, Conferences & Dining by Maruba Dam',
  kraPin: 'P051982741Z',
  email: 'reservations@damviewhotel.co.ke',
  phone: '+254 722 890 123 / +254 733 456 789',
  physicalLocation: 'Off Machakos-Wote Road, Adjacent to Maruba Dam, Machakos',
  postalAddress: 'P.O. Box 1420 - 90100, Machakos, Kenya',
  logoBase64: '',
  bankName: 'Kenya Commercial Bank (KCB)',
  bankBranch: 'Machakos Main Branch',
  accountHolder: 'Hotel Damview Enterprises Ltd',
  accountNumber: '1102983746',
  mpesaTillNumber: '5432100',
  vatRate: 16,
  googleWebAppUrl: '',
  googleDriveFolder: 'Hotel Damview Archives',
  googleSheetUrl: '',
  googleDriveFolderUrl: '',
  googleSheetEmbedUrl: '',
  autoSyncEnabled: true,
};

const SAMPLE_CLIENTS: Client[] = [
  {
    id: 'cli-001',
    name: 'Machakos County Executive Committee',
    contactPerson: 'Director Mutua Musyoka',
    email: 'treasury@machakosgovernment.co.ke',
    phone: '+254 711 200 300',
    kraPin: 'P051122334A',
    address: 'County Headquarters, Mwatu wa Ngoma St, Machakos',
    createdAt: '2026-08-10',
    updatedAt: '2026-08-10T08:00:00.000Z',
  },
  {
    id: 'cli-002',
    name: 'Kenya Red Cross Society - Eastern Region',
    contactPerson: 'Faith Ndanu Mwende',
    email: 'eastern.operations@redcross.or.ke',
    phone: '+254 722 455 677',
    kraPin: 'P051998877B',
    address: 'Regional Offices, Ngei Road, Machakos',
    createdAt: '2026-08-15',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'cli-003',
    name: 'Apex Agro-Logistics Ltd',
    contactPerson: 'Peter Kariuki',
    email: 'finance@apexagroke.com',
    phone: '+254 733 899 001',
    kraPin: 'P051443322C',
    address: 'Mombasa Road Business Park, Suite 4B, Nairobi/Athi River',
    createdAt: '2026-08-20',
    updatedAt: '2026-08-20T08:00:00.000Z',
  },
];

const SAMPLE_DOCUMENTS: BillingDocument[] = [
  {
    id: 'doc-q001',
    documentType: 'QUOTATION',
    documentNumber: 'QT-0001',
    clientId: 'cli-001',
    clientName: 'Machakos County Executive Committee',
    clientKraPin: 'P051122334A',
    clientAddress: 'County Headquarters, Mwatu wa Ngoma St, Machakos',
    clientPhone: '+254 711 200 300',
    clientEmail: 'treasury@machakosgovernment.co.ke',
    issueDate: '2026-09-05',
    validityDays: 30,
    dueDate: '2026-10-05',
    lineItems: [
      {
        id: 'li-1',
        particulars: 'Executive Conference Hall (Day Package with Projector & PA)',
        quantity: 1,
        days: 3,
        rate: 25000,
        discount: 0,
        amount: 75000,
      },
      {
        id: 'li-2',
        particulars: 'Full Day Delegate Package (Buffet Lunch, 2x Tea/Coffee & Snacks)',
        quantity: 45,
        days: 3,
        rate: 2800,
        discount: 5000,
        amount: 373000,
      },
      {
        id: 'li-3',
        particulars: 'VIP Accommodation - Deluxe Lake View Suites (Bed & Breakfast)',
        quantity: 5,
        days: 3,
        rate: 8500,
        discount: 2500,
        amount: 125000,
      },
    ],
    subtotal: 573000,
    vatAmount: 91680,
    grandTotal: 664680,
    amountPaid: 0,
    balanceDue: 664680,
    status: 'Sent',
    notes: 'Conference rates include high-speed Wi-Fi, writing pads, pens, and 2 bottles of 500ml mineral water per delegate per day.',
    terms: 'Payment terms: 50% commitment deposit upon LPO confirmation, balance payable on or before departure.',
    createdAt: '2026-09-05T08:00:00.000Z',
    updatedAt: '2026-09-05T08:00:00.000Z',
  },
  {
    id: 'doc-pi001',
    documentType: 'PROFORMA',
    documentNumber: 'PI-0001',
    clientId: 'cli-002',
    clientName: 'Kenya Red Cross Society - Eastern Region',
    clientKraPin: 'P051998877B',
    clientAddress: 'Regional Offices, Ngei Road, Machakos',
    clientPhone: '+254 722 455 677',
    clientEmail: 'eastern.operations@redcross.or.ke',
    issueDate: '2026-09-10',
    validityDays: 14,
    dueDate: '2026-09-24',
    lineItems: [
      {
        id: 'li-4',
        particulars: 'Emergency Preparedness Workshop Hall Rental (Maruba Garden Pavilion)',
        quantity: 1,
        days: 2,
        rate: 18000,
        discount: 0,
        amount: 36000,
      },
      {
        id: 'li-5',
        particulars: 'Mid-Morning & Afternoon Tea with Assorted Traditional Snacks',
        quantity: 30,
        days: 2,
        rate: 950,
        discount: 1000,
        amount: 56000,
      },
      {
        id: 'li-6',
        particulars: 'Chef Special Damview 3-Course Buffet Lunch + Soft Drink',
        quantity: 30,
        days: 2,
        rate: 1650,
        discount: 0,
        amount: 99000,
      },
    ],
    subtotal: 191000,
    vatAmount: 30560,
    grandTotal: 221560,
    amountPaid: 100000,
    balanceDue: 121560,
    status: 'Sent',
    notes: 'Includes breakout gazebo tents and emergency power generator backup.',
    terms: 'Kindly quote Proforma Invoice number PI-0001 when remitting electronic bank transfer.',
    createdAt: '2026-09-10T08:00:00.000Z',
    updatedAt: '2026-09-11T08:00:00.000Z',
  },
  {
    id: 'doc-inv001',
    documentType: 'INVOICE',
    documentNumber: 'INV-0001',
    clientId: 'cli-003',
    clientName: 'Apex Agro-Logistics Ltd',
    clientKraPin: 'P051443322C',
    clientAddress: 'Mombasa Road Business Park, Suite 4B, Nairobi/Athi River',
    clientPhone: '+254 733 899 001',
    clientEmail: 'finance@apexagroke.com',
    issueDate: '2026-09-12',
    validityDays: 14,
    dueDate: '2026-09-26',
    lineItems: [
      {
        id: 'li-7',
        particulars: 'Quarterly Strategy Retreat - Damview Conference Boardroom',
        quantity: 1,
        days: 2,
        rate: 20000,
        discount: 0,
        amount: 40000,
      },
      {
        id: 'li-8',
        particulars: 'Standard Room Accommodation (Single Occupancy, Half-Board)',
        quantity: 8,
        days: 2,
        rate: 6500,
        discount: 4000,
        amount: 100000,
      },
      {
        id: 'li-9',
        particulars: 'Team Building Facilitation & Damview Grounds Access',
        quantity: 1,
        days: 1,
        rate: 35000,
        discount: 0,
        amount: 35000,
      },
    ],
    subtotal: 175000,
    vatAmount: 28000,
    grandTotal: 203000,
    amountPaid: 203000,
    balanceDue: 0,
    status: 'Paid',
    notes: 'Thank you for your valued partnership. All attendees expressed warm satisfaction.',
    terms: 'Settled in full via KCB RTGS on 2026-09-14.',
    createdAt: '2026-09-12T08:00:00.000Z',
    updatedAt: '2026-09-14T08:00:00.000Z',
  },
  {
    id: 'doc-inv002',
    documentType: 'INVOICE',
    documentNumber: 'INV-0002',
    clientId: 'cli-002',
    clientName: 'Kenya Red Cross Society - Eastern Region',
    clientKraPin: 'P051998877B',
    clientAddress: 'Regional Offices, Ngei Road, Machakos',
    clientPhone: '+254 722 455 677',
    clientEmail: 'eastern.operations@redcross.or.ke',
    issueDate: '2026-09-15',
    validityDays: 14,
    dueDate: '2026-09-29',
    lineItems: [
      {
        id: 'li-10',
        particulars: 'Maruba Garden Pavilion Workshop Facility Hire',
        quantity: 1,
        days: 2,
        rate: 18000,
        discount: 0,
        amount: 36000,
      },
      {
        id: 'li-11',
        particulars: 'Catering & Beverages - 30 Delegates (2 Days)',
        quantity: 30,
        days: 2,
        rate: 2600,
        discount: 0,
        amount: 156000,
      },
    ],
    subtotal: 192000,
    vatAmount: 30720,
    grandTotal: 222720,
    amountPaid: 100000,
    balanceDue: 122720,
    status: 'Sent',
    notes: 'Converted from Proforma PI-0001 upon service delivery.',
    terms: 'Balance due within 14 calendar days.',
    createdAt: '2026-09-15T08:00:00.000Z',
    updatedAt: '2026-09-15T08:00:00.000Z',
  },
];

const SAMPLE_PAYMENTS: PaymentRecord[] = [
  {
    id: 'pay-001',
    receiptNumber: 'REC-0001',
    documentId: 'doc-inv001',
    documentNumber: 'INV-0001',
    clientId: 'cli-003',
    clientName: 'Apex Agro-Logistics Ltd',
    date: '2026-09-14',
    amount: 203000,
    paymentMode: 'Bank Transfer',
    referenceNote: 'KCB RTGS Ref: KCB992837190',
    createdAt: '2026-09-14T08:00:00.000Z',
  },
  {
    id: 'pay-002',
    receiptNumber: 'REC-0002',
    documentId: 'doc-inv002',
    documentNumber: 'INV-0002',
    clientId: 'cli-002',
    clientName: 'Kenya Red Cross Society - Eastern Region',
    date: '2026-09-16',
    amount: 100000,
    paymentMode: 'M-Pesa',
    referenceNote: 'M-Pesa Buy Goods Code: QJC899120',
    createdAt: '2026-09-16T08:00:00.000Z',
  },
];

const SAMPLE_STATEMENTS: StatementRecord[] = [
  {
    id: 'stmt-001',
    statementNumber: 'SOA-MAC-20260920',
    clientId: 'cli-001',
    clientName: 'Machakos County Executive Committee',
    clientKraPin: 'P051122334A',
    issueDate: '2026-09-20',
    startDate: '2026-08-01',
    endDate: '2026-09-20',
    totalDebit: 448000,
    totalCredit: 0,
    closingBalance: 448000,
    entriesCount: 1,
    pdfGenerated: true,
    driveFileUrl: 'https://drive.google.com/file/d/sample-stmt-001/view',
    createdAt: '2026-09-20T08:00:00.000Z',
  },
  {
    id: 'stmt-002',
    statementNumber: 'SOA-KEN-20260918',
    clientId: 'cli-002',
    clientName: 'Kenya Red Cross Society - Eastern Region',
    clientKraPin: 'P051998877B',
    issueDate: '2026-09-18',
    startDate: '2026-08-01',
    endDate: '2026-09-18',
    totalDebit: 222720,
    totalCredit: 100000,
    closingBalance: 122720,
    entriesCount: 2,
    pdfGenerated: true,
    driveFileUrl: 'https://drive.google.com/file/d/sample-stmt-002/view',
    createdAt: '2026-09-18T08:00:00.000Z',
  },
];

const SAMPLE_RESERVATIONS: Reservation[] = [
  {
    id: 'res-001',
    folioNumber: 'FOL-2026-001',
    guestName: 'Hon. Mutua Musyoka',
    guestPhone: '+254 711 200 300',
    guestEmail: 'treasury@machakosgovernment.co.ke',
    guestKraPin: 'P051122334A',
    clientId: 'cli-001',
    clientName: 'Machakos County Executive Committee',
    unitType: 'Hall',
    unitName: 'Executive Conference Hall',
    checkInDate: '2026-09-24',
    checkOutDate: '2026-09-27',
    ratePerNight: 25000,
    nightsOrDays: 3,
    totalAmount: 75000,
    amountPaid: 75000,
    balanceDue: 0,
    status: 'Checked-In',
    specialRequests: 'PA System, Projector, Wi-Fi high priority, 45 delegate layout',
    createdAt: '2026-09-20T08:00:00.000Z',
    updatedAt: '2026-09-23T08:00:00.000Z',
  },
  {
    id: 'res-002',
    folioNumber: 'FOL-2026-002',
    guestName: 'Faith Ndanu Mwende',
    guestPhone: '+254 722 455 677',
    guestEmail: 'eastern.operations@redcross.or.ke',
    guestKraPin: 'P051998877B',
    clientId: 'cli-002',
    clientName: 'Kenya Red Cross Society - Eastern Region',
    unitType: 'Hall',
    unitName: 'Maruba Garden Pavilion',
    checkInDate: '2026-09-25',
    checkOutDate: '2026-09-26',
    ratePerNight: 35000,
    nightsOrDays: 1,
    totalAmount: 35000,
    amountPaid: 35000,
    balanceDue: 0,
    status: 'Reserved',
    specialRequests: 'Outdoor tent setup, cocktail tables, emergency response training mock zone',
    createdAt: '2026-09-21T08:00:00.000Z',
    updatedAt: '2026-09-21T08:00:00.000Z',
  },
  {
    id: 'res-003',
    folioNumber: 'FOL-2026-003',
    guestName: 'Eng. Peter Kariuki',
    guestPhone: '+254 733 899 001',
    guestEmail: 'finance@apexagroke.com',
    guestKraPin: 'P051443322C',
    clientId: 'cli-003',
    clientName: 'Apex Agro-Logistics Ltd',
    unitType: 'Room',
    unitName: 'VIP Suite 101 (Lake View)',
    checkInDate: '2026-09-23',
    checkOutDate: '2026-09-25',
    ratePerNight: 8500,
    nightsOrDays: 2,
    totalAmount: 17000,
    amountPaid: 17000,
    balanceDue: 0,
    status: 'Checked-In',
    specialRequests: 'Quiet room facing Maruba Dam, extra workstation desk & iron box',
    createdAt: '2026-09-22T08:00:00.000Z',
    updatedAt: '2026-09-23T08:00:00.000Z',
  },
  {
    id: 'res-004',
    folioNumber: 'FOL-2026-004',
    guestName: 'Dr. Sarah Wambui',
    guestPhone: '+254 700 112 233',
    guestEmail: 'swambui@consultant.ke',
    unitType: 'Room',
    unitName: 'Deluxe Room 204',
    checkInDate: '2026-09-24',
    checkOutDate: '2026-09-26',
    ratePerNight: 7000,
    nightsOrDays: 2,
    totalAmount: 14000,
    amountPaid: 0,
    balanceDue: 14000,
    status: 'Reserved',
    specialRequests: 'Late check-in around 8 PM, airport pick-up transfer requested',
    createdAt: '2026-09-23T08:00:00.000Z',
    updatedAt: '2026-09-23T08:00:00.000Z',
  },
];

const SAMPLE_POS_ORDERS: POSOrder[] = [
  {
    id: 'pos-ord-001',
    orderNumber: 'POS-2026-001',
    tableOrRoom: 'Terrace Table 6',
    guestOrClientName: 'County Delegation (Dinner)',
    items: [
      { id: 'pos-m7', name: 'Wet/Dry Fry Goat Meat (Mbuzi Fry 1/2 Kg) with Ugali & Greens', category: 'Main Dishes', price: 950, quantity: 4, amount: 3800 },
      { id: 'pos-m11', name: 'Fresh Passion / Mango / Tropical Cocktail Juice (500ml)', category: 'Beverages & Juices', price: 300, quantity: 4, amount: 1200 },
      { id: 'pos-m15', name: 'Tusker Lager / Malt / Cider 500ml', category: 'Bar & Cocktails', price: 350, quantity: 6, amount: 2100 },
    ],
    subtotal: 7100,
    vatAmount: 1136,
    grandTotal: 8236,
    paymentMode: 'M-Pesa',
    status: 'Completed',
    receiptNumber: 'REC-0004',
    createdAt: '2026-09-23T04:30:00.000Z',
  },
  {
    id: 'pos-ord-002',
    orderNumber: 'POS-2026-002',
    tableOrRoom: 'Room 101',
    guestOrClientName: 'Eng. Peter Kariuki',
    items: [
      { id: 'pos-m10', name: 'Prime Beef Steak in Pepper Sauce with Roast Herb Potatoes', category: 'Main Dishes', price: 1050, quantity: 1, amount: 1050 },
      { id: 'pos-m14', name: 'Special Dawa Tea (Ginger, Lemon, Honey & Mint)', category: 'Beverages & Juices', price: 350, quantity: 1, amount: 350 },
    ],
    subtotal: 1400,
    vatAmount: 224,
    grandTotal: 1624,
    paymentMode: 'Room Charge',
    status: 'Billed to Room',
    createdAt: '2026-09-23T05:10:00.000Z',
  },
];

const SAMPLE_EXPENSES: ExpenseRecord[] = [
  {
    id: 'exp-001',
    expenseNumber: 'EXP-2026-001',
    category: 'Kitchen & Food Supplies',
    description: 'Fresh vegetables, butchery goat meat & dairy supplies from Machakos Market',
    amount: 24500,
    date: '2026-09-22',
    paidTo: 'Machakos Farmers Fresh Produce',
    paymentMode: 'M-Pesa',
    createdAt: '2026-09-22T08:00:00.000Z',
  },
  {
    id: 'exp-002',
    expenseNumber: 'EXP-2026-002',
    category: 'Utilities (Water/Power)',
    description: 'Kenya Power (KPLC) Prepaid Token Purchase for Hotel Damview Premises',
    amount: 18000,
    date: '2026-09-20',
    paidTo: 'Kenya Power and Lighting Co.',
    paymentMode: 'Bank Transfer',
    createdAt: '2026-09-20T08:00:00.000Z',
  },
];

class StorageEngine {
  private dbPromise: Promise<IDBDatabase> | null = null;
  
  // High-performance L1 In-Memory Reactive Cache
  private l1Profile: HotelProfile | null = null;
  private l1Clients: Map<string, Client> = new Map();
  private l1Documents: Map<string, BillingDocument> = new Map();
  private l1Payments: Map<string, PaymentRecord> = new Map();
  private l1Statements: Map<string, StatementRecord> = new Map();
  private l1Reservations: Map<string, Reservation> = new Map();
  private l1POSOrders: Map<string, POSOrder> = new Map();
  private l1Expenses: Map<string, ExpenseRecord> = new Map();
  private l1Catalogue: Map<string, CatalogueItem> = new Map();
  private l1SyncQueue: Map<string, SyncQueueItem> = new Map();
  private l1Tombstones: DeletedTombstone[] | null = null;
  private isL1Hydrated = false;

  constructor() {
    this.hydrateFromLocalStorage();
    this.init();
  }

  /**
   * Synchronous L1 Cache Bootstrapper: Reads from localStorage immediately (0ms perceived latency)
   */
  private hydrateFromLocalStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const savedProfile = localStorage.getItem('damview_profile');
      if (savedProfile) {
        this.l1Profile = { ...DEFAULT_HOTEL_PROFILE, ...JSON.parse(savedProfile) };
      }

      const savedClients = localStorage.getItem('damview_clients');
      if (savedClients) {
        const list: Client[] = JSON.parse(savedClients);
        this.l1Clients.clear();
        list.forEach((c) => this.l1Clients.set(c.id, c));
      }

      const savedDocs = localStorage.getItem('damview_docs');
      if (savedDocs) {
        const list: BillingDocument[] = JSON.parse(savedDocs);
        this.l1Documents.clear();
        list.forEach((d) => this.l1Documents.set(d.id, d));
      }

      const savedPays = localStorage.getItem('damview_payments');
      if (savedPays) {
        const list: PaymentRecord[] = JSON.parse(savedPays);
        this.l1Payments.clear();
        list.forEach((p) => this.l1Payments.set(p.id, p));
      }

      const savedStatements = localStorage.getItem('damview_statements_v1');
      if (savedStatements) {
        const list: StatementRecord[] = JSON.parse(savedStatements);
        this.l1Statements.clear();
        list.forEach((s) => this.l1Statements.set(s.id, s));
      }

      const savedQueue = localStorage.getItem('damview_sync_queue');
      if (savedQueue) {
        const list: SyncQueueItem[] = JSON.parse(savedQueue);
        this.l1SyncQueue.clear();
        list.forEach((q) => this.l1SyncQueue.set(q.id, q));
      }

      const savedRes = localStorage.getItem('damview_reservations');
      if (savedRes) {
        const list: Reservation[] = JSON.parse(savedRes);
        this.l1Reservations.clear();
        list.forEach((r) => this.l1Reservations.set(r.id, r));
      }

      const savedPOS = localStorage.getItem('damview_pos_orders');
      if (savedPOS) {
        const list: POSOrder[] = JSON.parse(savedPOS);
        this.l1POSOrders.clear();
        list.forEach((p) => this.l1POSOrders.set(p.id, p));
      }

      const savedExp = localStorage.getItem('damview_expenses');
      if (savedExp) {
        const list: ExpenseRecord[] = JSON.parse(savedExp);
        this.l1Expenses.clear();
        list.forEach((e) => this.l1Expenses.set(e.id, e));
      }

      const savedCat = localStorage.getItem('damview_catalogue');
      if (savedCat) {
        const list: CatalogueItem[] = JSON.parse(savedCat);
        this.l1Catalogue.clear();
        list.forEach((c) => this.l1Catalogue.set(c.id, c));
      }

      const savedTombstones = localStorage.getItem('damview_tombstones');
      if (savedTombstones) {
        this.l1Tombstones = JSON.parse(savedTombstones);
      }
    } catch (e) {
      console.warn('[StorageEngine] L1 initial hydration warning:', e);
    }
  }

  public async getDatabase(): Promise<IDBDatabase> {
    return this.init();
  }

  private init(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        this.isL1Hydrated = true;
        resolve({} as any);
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('hotel_profile')) {
          db.createObjectStore('hotel_profile', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('clients')) {
          db.createObjectStore('clients', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id' });
          docStore.createIndex('documentType', 'documentType', { unique: false });
          docStore.createIndex('clientId', 'clientId', { unique: false });
          docStore.createIndex('documentNumber', 'documentNumber', { unique: true });
        }
        if (!db.objectStoreNames.contains('payments')) {
          const payStore = db.createObjectStore('payments', { keyPath: 'id' });
          payStore.createIndex('clientId', 'clientId', { unique: false });
          payStore.createIndex('documentId', 'documentId', { unique: false });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('audit_log')) {
          const auditStore = db.createObjectStore('audit_log', { keyPath: 'id' });
          auditStore.createIndex('entityType', 'entityType', { unique: false });
          auditStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('tombstones')) {
          const tombStore = db.createObjectStore('tombstones', { keyPath: 'id' });
          tombStore.createIndex('key', 'key', { unique: false });
          tombStore.createIndex('type', 'type', { unique: false });
          tombStore.createIndex('deletedAt', 'deletedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('system_meta')) {
          db.createObjectStore('system_meta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('statements')) {
          const stmtStore = db.createObjectStore('statements', { keyPath: 'id' });
          stmtStore.createIndex('statementNumber', 'statementNumber', { unique: true });
          stmtStore.createIndex('clientId', 'clientId', { unique: false });
          stmtStore.createIndex('issueDate', 'issueDate', { unique: false });
        }
        if (!db.objectStoreNames.contains('reservations')) {
          const resStore = db.createObjectStore('reservations', { keyPath: 'id' });
          resStore.createIndex('folioNumber', 'folioNumber', { unique: true });
          resStore.createIndex('status', 'status', { unique: false });
          resStore.createIndex('unitType', 'unitType', { unique: false });
          resStore.createIndex('checkInDate', 'checkInDate', { unique: false });
        }
        if (!db.objectStoreNames.contains('pos_orders')) {
          const posStore = db.createObjectStore('pos_orders', { keyPath: 'id' });
          posStore.createIndex('orderNumber', 'orderNumber', { unique: true });
          posStore.createIndex('status', 'status', { unique: false });
          posStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('expenses')) {
          const expStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expStore.createIndex('expenseNumber', 'expenseNumber', { unique: true });
          expStore.createIndex('category', 'category', { unique: false });
          expStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('catalogue')) {
          const catStore = db.createObjectStore('catalogue', { keyPath: 'id' });
          catStore.createIndex('category', 'category', { unique: false });
        }
      };

      request.onsuccess = async () => {
        const db = request.result;
        try {
          await this.seedInitialData(db);
          await this.hydrateFromIndexedDb(db);
        } catch (err) {
          console.warn('[StorageEngine] IndexedDB init hydration notice:', err);
        }
        resolve(db);
      };

      request.onerror = (e) => {
        console.error('[StorageEngine] IndexedDB open error:', e);
        this.isL1Hydrated = true;
        resolve({} as any);
      };
    });

    return this.dbPromise;
  }

  private async hydrateFromIndexedDb(db: IDBDatabase): Promise<void> {
    return new Promise((resolve) => {
      try {
        const storeNames = ['hotel_profile', 'clients', 'documents', 'payments', 'sync_queue'];
        if (db.objectStoreNames.contains('tombstones')) {
          storeNames.push('tombstones');
        }
        if (db.objectStoreNames.contains('statements')) {
          storeNames.push('statements');
        }
        if (db.objectStoreNames.contains('reservations')) {
          storeNames.push('reservations');
        }
        if (db.objectStoreNames.contains('pos_orders')) {
          storeNames.push('pos_orders');
        }
        if (db.objectStoreNames.contains('expenses')) {
          storeNames.push('expenses');
        }
        if (db.objectStoreNames.contains('catalogue')) {
          storeNames.push('catalogue');
        }

        const tx = db.transaction(storeNames, 'readonly');
        
        const reqProf = tx.objectStore('hotel_profile').get('current');
        reqProf.onsuccess = () => {
          if (reqProf.result) {
            this.l1Profile = { ...DEFAULT_HOTEL_PROFILE, ...reqProf.result };
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                localStorage.setItem('damview_profile', JSON.stringify(this.l1Profile));
              } catch {}
            }
          }
        };

        const reqCli = tx.objectStore('clients').getAll();
        reqCli.onsuccess = () => {
          if (reqCli.result) {
            this.l1Clients.clear();
            reqCli.result.forEach((c: Client) => this.l1Clients.set(c.id, c));
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                localStorage.setItem('damview_clients', JSON.stringify(Array.from(this.l1Clients.values())));
              } catch {}
            }
          }
        };

        const reqDoc = tx.objectStore('documents').getAll();
        reqDoc.onsuccess = () => {
          if (reqDoc.result) {
            this.l1Documents.clear();
            reqDoc.result.forEach((d: BillingDocument) => this.l1Documents.set(d.id, d));
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                localStorage.setItem('damview_docs', JSON.stringify(Array.from(this.l1Documents.values())));
              } catch {}
            }
          }
        };

        const reqPay = tx.objectStore('payments').getAll();
        reqPay.onsuccess = () => {
          if (reqPay.result) {
            this.l1Payments.clear();
            reqPay.result.forEach((p: PaymentRecord) => this.l1Payments.set(p.id, p));
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                localStorage.setItem('damview_payments', JSON.stringify(Array.from(this.l1Payments.values())));
              } catch {}
            }
          }
        };

        const reqQueue = tx.objectStore('sync_queue').getAll();
        reqQueue.onsuccess = () => {
          if (reqQueue.result) {
            this.l1SyncQueue.clear();
            reqQueue.result.forEach((q: SyncQueueItem) => this.l1SyncQueue.set(q.id, q));
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                localStorage.setItem('damview_sync_queue', JSON.stringify(Array.from(this.l1SyncQueue.values())));
              } catch {}
            }
          }
        };

        if (db.objectStoreNames.contains('tombstones')) {
          const reqTomb = tx.objectStore('tombstones').getAll();
          reqTomb.onsuccess = () => {
            if (reqTomb.result) {
              this.l1Tombstones = reqTomb.result;
              if (typeof window !== 'undefined' && window.localStorage) {
                try {
                  localStorage.setItem('damview_tombstones', JSON.stringify(this.l1Tombstones));
                } catch {}
              }
            }
          };
        }

        if (db.objectStoreNames.contains('statements')) {
          const reqStmt = tx.objectStore('statements').getAll();
          reqStmt.onsuccess = () => {
            if (reqStmt.result) {
              this.l1Statements.clear();
              reqStmt.result.forEach((s: StatementRecord) => this.l1Statements.set(s.id, s));
              if (typeof window !== 'undefined' && window.localStorage) {
                try {
                  localStorage.setItem('damview_statements_v1', JSON.stringify(Array.from(this.l1Statements.values())));
                } catch {}
              }
            }
          };
        }

        if (db.objectStoreNames.contains('reservations')) {
          const reqRes = tx.objectStore('reservations').getAll();
          reqRes.onsuccess = () => {
            if (reqRes.result) {
              this.l1Reservations.clear();
              reqRes.result.forEach((r: Reservation) => this.l1Reservations.set(r.id, r));
              if (typeof window !== 'undefined' && window.localStorage) {
                try {
                  localStorage.setItem('damview_reservations', JSON.stringify(Array.from(this.l1Reservations.values())));
                } catch {}
              }
            }
          };
        }

        if (db.objectStoreNames.contains('pos_orders')) {
          const reqPOS = tx.objectStore('pos_orders').getAll();
          reqPOS.onsuccess = () => {
            if (reqPOS.result) {
              this.l1POSOrders.clear();
              reqPOS.result.forEach((p: POSOrder) => this.l1POSOrders.set(p.id, p));
              if (typeof window !== 'undefined' && window.localStorage) {
                try {
                  localStorage.setItem('damview_pos_orders', JSON.stringify(Array.from(this.l1POSOrders.values())));
                } catch {}
              }
            }
          };
        }

        if (db.objectStoreNames.contains('expenses')) {
          const reqExp = tx.objectStore('expenses').getAll();
          reqExp.onsuccess = () => {
            if (reqExp.result) {
              this.l1Expenses.clear();
              reqExp.result.forEach((e: ExpenseRecord) => this.l1Expenses.set(e.id, e));
              if (typeof window !== 'undefined' && window.localStorage) {
                try {
                  localStorage.setItem('damview_expenses', JSON.stringify(Array.from(this.l1Expenses.values())));
                } catch {}
              }
            }
          };
        }

        if (db.objectStoreNames.contains('catalogue')) {
          const reqCat = tx.objectStore('catalogue').getAll();
          reqCat.onsuccess = () => {
            if (reqCat.result) {
              this.l1Catalogue.clear();
              reqCat.result.forEach((c: CatalogueItem) => this.l1Catalogue.set(c.id, c));
              if (typeof window !== 'undefined' && window.localStorage) {
                try {
                  localStorage.setItem('damview_catalogue', JSON.stringify(Array.from(this.l1Catalogue.values())));
                } catch {}
              }
            }
          };
        }

        tx.oncomplete = () => {
          this.isL1Hydrated = true;
          resolve();
        };
        tx.onerror = () => {
          this.isL1Hydrated = true;
          resolve();
        };
      } catch (e) {
        this.isL1Hydrated = true;
        resolve();
      }
    });
  }

  private async seedInitialData(db: IDBDatabase): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (!db.objectStoreNames.contains('system_meta')) {
          resolve();
          return;
        }

        const tx = db.transaction(['system_meta'], 'readonly');
        const metaStore = tx.objectStore('system_meta');
        const checkReq = metaStore.get('initial_seed_completed');

        checkReq.onsuccess = () => {
          const hasSeededMeta = checkReq.result;
          const hasSeededStorage = typeof window !== 'undefined' && window.localStorage?.getItem('damview_has_seeded') === 'true';

          if (hasSeededMeta || hasSeededStorage) {
            // Seeding was already performed in the past. Respect user state (even if 0 records).
            resolve();
            return;
          }

          // First-time installation seed
          try {
            const seedStores = ['hotel_profile', 'clients', 'documents', 'payments', 'system_meta'];
            if (db.objectStoreNames.contains('statements')) {
              seedStores.push('statements');
            }
            if (db.objectStoreNames.contains('reservations')) {
              seedStores.push('reservations');
            }
            if (db.objectStoreNames.contains('pos_orders')) {
              seedStores.push('pos_orders');
            }
            if (db.objectStoreNames.contains('expenses')) {
              seedStores.push('expenses');
            }
            if (db.objectStoreNames.contains('catalogue')) {
              seedStores.push('catalogue');
            }
            const seedTx = db.transaction(seedStores, 'readwrite');
            seedTx.objectStore('hotel_profile').put({ id: 'current', ...DEFAULT_HOTEL_PROFILE });
            SAMPLE_CLIENTS.forEach((c) => seedTx.objectStore('clients').put(c));
            SAMPLE_DOCUMENTS.forEach((d) => seedTx.objectStore('documents').put(d));
            SAMPLE_PAYMENTS.forEach((p) => seedTx.objectStore('payments').put(p));
            if (db.objectStoreNames.contains('statements')) {
              SAMPLE_STATEMENTS.forEach((s) => seedTx.objectStore('statements').put(s));
            }
            if (db.objectStoreNames.contains('reservations')) {
              SAMPLE_RESERVATIONS.forEach((r) => seedTx.objectStore('reservations').put(r));
            }
            if (db.objectStoreNames.contains('pos_orders')) {
              SAMPLE_POS_ORDERS.forEach((p) => seedTx.objectStore('pos_orders').put(p));
            }
            if (db.objectStoreNames.contains('expenses')) {
              SAMPLE_EXPENSES.forEach((e) => seedTx.objectStore('expenses').put(e));
            }
            if (db.objectStoreNames.contains('catalogue')) {
              STANDARD_HOSPITALITY_CATALOGUE.forEach((c) => seedTx.objectStore('catalogue').put(c));
            }
            seedTx.objectStore('system_meta').put({
              key: 'initial_seed_completed',
              value: true,
              seededAt: new Date().toISOString(),
            });

            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                localStorage.setItem('damview_has_seeded', 'true');
              } catch {}
            }

            seedTx.oncomplete = () => resolve();
            seedTx.onerror = () => resolve();
          } catch {
            resolve();
          }
        };

        checkReq.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // --- Hotel Profile ---
  async getHotelProfile(): Promise<HotelProfile> {
    if (this.l1Profile) {
      return { ...this.l1Profile };
    }
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const tx = db.transaction('hotel_profile', 'readonly');
        const req = tx.objectStore('hotel_profile').get('current');
        req.onsuccess = () => {
          const profile = req.result ? { ...DEFAULT_HOTEL_PROFILE, ...req.result } : DEFAULT_HOTEL_PROFILE;
          this.l1Profile = profile;
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              localStorage.setItem('damview_profile', JSON.stringify(profile));
            } catch {}
          }
          resolve({ ...profile });
        };
        req.onerror = () => {
          const fallback = DEFAULT_HOTEL_PROFILE;
          this.l1Profile = fallback;
          resolve({ ...fallback });
        };
      });
    } catch {
      return { ...DEFAULT_HOTEL_PROFILE };
    }
  }

  async saveHotelProfile(profile: Partial<HotelProfile>): Promise<void> {
    const existing = await this.getHotelProfile();
    const merged: HotelProfile = {
      name: profile.name !== undefined ? (profile.name.trim() || existing.name) : existing.name,
      tagline: profile.tagline !== undefined ? profile.tagline : existing.tagline,
      kraPin: profile.kraPin !== undefined ? (profile.kraPin.trim() || existing.kraPin) : existing.kraPin,
      email: profile.email !== undefined ? (profile.email.trim() || existing.email) : existing.email,
      phone: profile.phone !== undefined ? (profile.phone.trim() || existing.phone) : existing.phone,
      physicalLocation: profile.physicalLocation !== undefined ? (profile.physicalLocation.trim() || existing.physicalLocation) : existing.physicalLocation,
      postalAddress: profile.postalAddress !== undefined ? (profile.postalAddress.trim() || existing.postalAddress) : existing.postalAddress,
      logoBase64: profile.logoBase64 !== undefined && profile.logoBase64 !== '' ? profile.logoBase64 : existing.logoBase64,
      bankName: profile.bankName !== undefined ? (profile.bankName.trim() || existing.bankName) : existing.bankName,
      bankBranch: profile.bankBranch !== undefined ? (profile.bankBranch.trim() || existing.bankBranch) : existing.bankBranch,
      accountHolder: profile.accountHolder !== undefined ? (profile.accountHolder.trim() || existing.accountHolder) : existing.accountHolder,
      accountNumber: profile.accountNumber !== undefined ? (profile.accountNumber.trim() || existing.accountNumber) : existing.accountNumber,
      mpesaTillNumber: profile.mpesaTillNumber !== undefined ? (profile.mpesaTillNumber.trim() || existing.mpesaTillNumber) : existing.mpesaTillNumber,
      vatRate: typeof profile.vatRate === 'number' ? profile.vatRate : existing.vatRate,
      googleWebAppUrl: profile.googleWebAppUrl !== undefined ? profile.googleWebAppUrl : existing.googleWebAppUrl,
      googleDriveFolder: profile.googleDriveFolder !== undefined ? profile.googleDriveFolder : existing.googleDriveFolder,
      googleSheetUrl: profile.googleSheetUrl !== undefined ? profile.googleSheetUrl : (existing.googleSheetUrl || ''),
      googleDriveFolderUrl: profile.googleDriveFolderUrl !== undefined ? profile.googleDriveFolderUrl : (existing.googleDriveFolderUrl || ''),
      googleSheetEmbedUrl: profile.googleSheetEmbedUrl !== undefined ? profile.googleSheetEmbedUrl : existing.googleSheetEmbedUrl,
      autoSyncEnabled: profile.autoSyncEnabled !== undefined ? profile.autoSyncEnabled : existing.autoSyncEnabled,
      lastSyncTimestamp: profile.lastSyncTimestamp || existing.lastSyncTimestamp,
    };

    // 1. Instant L1 in-memory update
    this.l1Profile = merged;

    // 2. Synchronous localStorage mirror
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_profile', JSON.stringify(merged));
      } catch {}
    }

    // 3. Durable Transactional Write-Through to IndexedDB
    try {
      const db = await this.init();
      if (db.objectStoreNames.contains('hotel_profile')) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('hotel_profile', 'readwrite');
          tx.objectStore('hotel_profile').put({ id: 'current', ...merged });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    } catch (err) {
      console.warn('[StorageEngine] Write error hotel_profile:', err);
    }
  }

  // --- Tombstones (Durable Protection Against Resurrecting Deleted Records) ---
  async recordTombstone(id: string, key?: string, type: 'DOCUMENT' | 'CLIENT' | 'PAYMENT' = 'DOCUMENT'): Promise<void> {
    try {
      const tombstones = await this.getTombstones();
      const cleanKey = key ? key.trim().toLowerCase() : undefined;
      const cleanId = id.trim().toLowerCase();
      
      const now = Date.now();
      const maxAgeMs = 60 * 24 * 60 * 60 * 1000; // 60 days retention
      const filtered = tombstones.filter(
        (t) =>
          now - t.deletedAt < maxAgeMs &&
          t.id.toLowerCase() !== cleanId &&
          (!cleanKey || !t.key || t.key.toLowerCase() !== cleanKey)
      );

      const newTombstone: DeletedTombstone = {
        id: cleanId,
        key: cleanKey,
        type,
        deletedAt: now,
      };

      filtered.push(newTombstone);
      this.l1Tombstones = filtered;

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem('damview_tombstones', JSON.stringify(filtered));
        } catch {}
      }

      const db = await this.init();
      if (db.objectStoreNames.contains('tombstones')) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('tombstones', 'readwrite');
          tx.objectStore('tombstones').put(newTombstone);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    } catch (err) {
      console.warn('[StorageEngine] Error recording tombstone:', err);
    }
  }

  async getTombstones(): Promise<DeletedTombstone[]> {
    if (this.l1Tombstones) {
      return [...this.l1Tombstones];
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = localStorage.getItem('damview_tombstones');
        if (saved) {
          const list: DeletedTombstone[] = JSON.parse(saved);
          const now = Date.now();
          const maxAgeMs = 60 * 24 * 60 * 60 * 1000;
          const valid = list.filter((t) => now - t.deletedAt < maxAgeMs);
          this.l1Tombstones = valid;
          return valid;
        }
      } catch {}
    }
    try {
      const db = await this.init();
      if (db.objectStoreNames.contains('tombstones')) {
        return new Promise((resolve) => {
          const tx = db.transaction('tombstones', 'readonly');
          const req = tx.objectStore('tombstones').getAll();
          req.onsuccess = () => {
            const list: DeletedTombstone[] = req.result || [];
            this.l1Tombstones = list;
            resolve(list);
          };
          req.onerror = () => resolve([]);
        });
      }
    } catch {}
    return [];
  }

  async isTombstoned(idOrKey: string): Promise<boolean> {
    if (!idOrKey) return false;
    const target = idOrKey.trim().toLowerCase();
    const cleanNum = target.replace(/[^a-z0-9]/g, '');
    const tombstones = await this.getTombstones();
    return tombstones.some((t) => {
      const tId = t.id.toLowerCase();
      const tKey = t.key ? t.key.toLowerCase() : '';
      if (tId === target || tKey === target) return true;
      if (cleanNum.length > 2 && (tId.replace(/[^a-z0-9]/g, '') === cleanNum || tKey.replace(/[^a-z0-9]/g, '') === cleanNum)) {
        return true;
      }
      return false;
    });
  }

  async clearTombstone(idOrKey: string): Promise<void> {
    if (!idOrKey) return;
    const target = idOrKey.trim().toLowerCase();
    const tombstones = await this.getTombstones();
    const remaining = tombstones.filter(
      (t) =>
        t.id.toLowerCase() !== target &&
        (!t.key || t.key.toLowerCase() !== target)
    );
    this.l1Tombstones = remaining;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_tombstones', JSON.stringify(remaining));
      } catch {}
    }

    try {
      const db = await this.init();
      if (db.objectStoreNames.contains('tombstones')) {
        const tx = db.transaction('tombstones', 'readwrite');
        tx.objectStore('tombstones').delete(target);
      }
    } catch {}
  }

  // --- Clients ---
  async getClients(): Promise<Client[]> {
    if (this.l1Clients.size > 0) {
      return Array.from(this.l1Clients.values());
    }
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const tx = db.transaction('clients', 'readonly');
        const req = tx.objectStore('clients').getAll();
        req.onsuccess = () => {
          const result: Client[] = req.result || [];
          this.l1Clients.clear();
          result.forEach((c: Client) => this.l1Clients.set(c.id, c));
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              localStorage.setItem('damview_clients', JSON.stringify(result));
            } catch {}
          }
          resolve(Array.from(this.l1Clients.values()));
        };
        req.onerror = () => resolve(Array.from(this.l1Clients.values()));
      });
    } catch {
      return Array.from(this.l1Clients.values());
    }
  }

  async getClientById(id: string): Promise<Client | null> {
    if (this.l1Clients.has(id)) {
      return { ...this.l1Clients.get(id)! };
    }
    const clients = await this.getClients();
    return clients.find((c) => c.id === id) || null;
  }

  async saveClient(client: Client): Promise<void> {
    await this.clearTombstone(client.id);
    if (client.kraPin) await this.clearTombstone(client.kraPin);
    if (client.name) await this.clearTombstone(client.name);

    const existing = await this.getClientById(client.id);
    const nowIso = new Date().toISOString();
    const mergedClient: Client = existing
      ? {
          ...existing,
          ...client,
          name: client.name?.trim() ? client.name.trim() : existing.name,
          kraPin: client.kraPin?.trim() ? client.kraPin.trim() : existing.kraPin,
          email: client.email?.trim() ? client.email.trim() : existing.email,
          phone: client.phone?.trim() ? client.phone.trim() : existing.phone,
          address: client.address?.trim() ? client.address.trim() : existing.address,
          contactPerson: client.contactPerson?.trim() ? client.contactPerson.trim() : existing.contactPerson,
          createdAt: existing.createdAt || client.createdAt || nowIso,
          updatedAt: client.updatedAt || nowIso,
        }
      : {
          ...client,
          createdAt: client.createdAt || nowIso,
          updatedAt: client.updatedAt || nowIso,
        };

    // 1. Instant L1 cache update
    this.l1Clients.set(mergedClient.id, mergedClient);

    // 2. Synchronous localStorage mirror
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_clients', JSON.stringify(Array.from(this.l1Clients.values())));
      } catch {}
    }

    // 3. Durable Transactional Write-Through to IndexedDB
    try {
      const db = await this.init();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('clients', 'readwrite');
        tx.objectStore('clients').put(mergedClient);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[StorageEngine] Write error client:', e);
    }

    this.recordAuditLog({
      entityType: 'CLIENT',
      entityId: mergedClient.id,
      action: existing ? 'UPDATE' : 'CREATE',
      details: `${existing ? 'Updated' : 'Created'} client profile: ${mergedClient.name} (PIN: ${mergedClient.kraPin || 'N/A'})`,
      snapshot: mergedClient,
    }).catch(() => {});
  }

  async deleteClient(clientId: string): Promise<void> {
    const target = await this.getClientById(clientId);
    await this.recordTombstone(clientId, target?.name || target?.kraPin, 'CLIENT');
    if (target?.kraPin) await this.recordTombstone(clientId, target.kraPin, 'CLIENT');

    // 1. Instant L1 cache deletion
    this.l1Clients.delete(clientId);

    // 2. Synchronous localStorage mirror
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_clients', JSON.stringify(Array.from(this.l1Clients.values())));
      } catch {}
    }

    // 3. Durable Transactional Delete from IndexedDB
    try {
      const db = await this.init();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('clients', 'readwrite');
        tx.objectStore('clients').delete(clientId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[StorageEngine] Delete client error:', e);
    }

    this.recordAuditLog({
      entityType: 'CLIENT',
      entityId: clientId,
      action: 'DELETE',
      details: `Deleted client: ${target?.name || clientId}`,
      snapshot: target,
    }).catch(() => {});
  }

  // --- Documents ---
  async getDocuments(): Promise<BillingDocument[]> {
    if (this.l1Documents.size > 0) {
      const list = Array.from(this.l1Documents.values());
      return list.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
    }
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const tx = db.transaction('documents', 'readonly');
        const req = tx.objectStore('documents').getAll();
        req.onsuccess = () => {
          const list: BillingDocument[] = req.result || [];
          this.l1Documents.clear();
          list.forEach((d) => this.l1Documents.set(d.id, d));
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              localStorage.setItem('damview_docs', JSON.stringify(list));
            } catch {}
          }
          list.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
          resolve(list);
        };
        req.onerror = () => resolve(Array.from(this.l1Documents.values()));
      });
    } catch {
      return Array.from(this.l1Documents.values());
    }
  }

  async getDocumentById(id: string): Promise<BillingDocument | null> {
    if (this.l1Documents.has(id)) {
      return { ...this.l1Documents.get(id)! };
    }
    const docs = await this.getDocuments();
    return docs.find((d) => d.id === id) || null;
  }

  async getDocumentByNumber(documentNumber: string): Promise<BillingDocument | null> {
    const normalized = documentNumber.trim().toLowerCase();
    const cleanNum = normalized.replace(/[^a-z0-9]/g, '');

    for (const doc of this.l1Documents.values()) {
      const dNum = doc.documentNumber.trim().toLowerCase();
      if (dNum === normalized || dNum.replace(/[^a-z0-9]/g, '') === cleanNum) {
        return { ...doc };
      }
    }
    const docs = await this.getDocuments();
    return (
      docs.find((d) => {
        const dNum = d.documentNumber.trim().toLowerCase();
        return dNum === normalized || dNum.replace(/[^a-z0-9]/g, '') === cleanNum;
      }) || null
    );
  }

  async getClientByPinOrName(pin: string, name: string): Promise<Client | null> {
    const normPin = pin ? pin.trim().toLowerCase() : '';
    const normName = name ? name.trim().toLowerCase() : '';
    for (const c of this.l1Clients.values()) {
      if ((normPin && c.kraPin?.trim().toLowerCase() === normPin) || (normName && c.name?.trim().toLowerCase() === normName)) {
        return { ...c };
      }
    }
    const clients = await this.getClients();
    return (
      clients.find(
        (c) =>
          (normPin && c.kraPin?.trim().toLowerCase() === normPin) ||
          (normName && c.name?.trim().toLowerCase() === normName)
      ) || null
    );
  }

  async getPaymentByReceiptNumber(receiptNumber: string): Promise<PaymentRecord | null> {
    const normalized = receiptNumber.trim().toLowerCase();
    const cleanNum = normalized.replace(/[^a-z0-9]/g, '');

    for (const p of this.l1Payments.values()) {
      const rNum = p.receiptNumber.trim().toLowerCase();
      if (rNum === normalized || rNum.replace(/[^a-z0-9]/g, '') === cleanNum) {
        return { ...p };
      }
    }
    const payments = await this.getPayments();
    return (
      payments.find((p) => {
        const rNum = p.receiptNumber.trim().toLowerCase();
        return rNum === normalized || rNum.replace(/[^a-z0-9]/g, '') === cleanNum;
      }) || null
    );
  }

  async saveDocument(doc: BillingDocument): Promise<void> {
    await this.clearTombstone(doc.id);
    if (doc.documentNumber) await this.clearTombstone(doc.documentNumber);

    const existing = await this.getDocumentById(doc.id);
    const nowIso = new Date().toISOString();

    const mergedDoc: BillingDocument = existing
      ? {
          ...existing,
          ...doc,
          driveFileUrl: doc.driveFileUrl || existing.driveFileUrl,
          driveFileId: doc.driveFileId || existing.driveFileId,
          // Always respect incoming lineItems if supplied
          lineItems: doc.lineItems !== undefined ? doc.lineItems : existing.lineItems,
          createdAt: existing.createdAt || doc.createdAt || nowIso,
          updatedAt: doc.updatedAt || nowIso,
        }
      : {
          ...doc,
          createdAt: doc.createdAt || nowIso,
          updatedAt: doc.updatedAt || nowIso,
        };

    // 1. Instant L1 cache update
    this.l1Documents.set(mergedDoc.id, mergedDoc);

    // 2. Synchronous localStorage mirror
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_docs', JSON.stringify(Array.from(this.l1Documents.values())));
      } catch {}
    }

    // 3. Durable Transactional Write-Through to IndexedDB
    try {
      const db = await this.init();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('documents', 'readwrite');
        tx.objectStore('documents').put(mergedDoc);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[StorageEngine] Write document error:', e);
    }

    this.recordAuditLog({
      entityType: 'DOCUMENT',
      entityId: mergedDoc.id,
      action: existing ? 'UPDATE' : 'CREATE',
      details: `${existing ? 'Updated' : 'Created'} ${mergedDoc.documentType} ${mergedDoc.documentNumber} for ${mergedDoc.clientName} (Ksh ${mergedDoc.grandTotal})`,
      snapshot: mergedDoc,
    }).catch(() => {});
  }

  async deleteDocument(docId: string): Promise<void> {
    const target = await this.getDocumentById(docId);
    await this.recordTombstone(docId, target?.documentNumber, 'DOCUMENT');

    // 1. Instant L1 cache removal
    this.l1Documents.delete(docId);

    // 2. Synchronous localStorage mirror
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_docs', JSON.stringify(Array.from(this.l1Documents.values())));
      } catch {}
    }

    // 3. Durable Transactional Delete from IndexedDB
    try {
      const db = await this.init();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('documents', 'readwrite');
        tx.objectStore('documents').delete(docId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[StorageEngine] Delete document error:', e);
    }

    this.recordAuditLog({
      entityType: 'DOCUMENT',
      entityId: docId,
      action: 'DELETE',
      details: `Deleted ${target?.documentType || 'DOCUMENT'} ${target?.documentNumber || docId}`,
      snapshot: target,
    }).catch(() => {});
  }

  // --- Next Document Number Generator ---
  async getNextDocumentNumber(type: 'QUOTATION' | 'PROFORMA' | 'INVOICE'): Promise<string> {
    const docs = await this.getDocuments();
    const prefix = type === 'QUOTATION' ? 'QT-' : type === 'PROFORMA' ? 'PI-' : 'INV-';
    const matching = docs.filter((d) => {
      if (d.documentType !== type) return false;
      if (type === 'QUOTATION') {
        return d.documentNumber.startsWith('QT-') || d.documentNumber.startsWith('Q-');
      }
      return d.documentNumber.startsWith(prefix);
    });

    let maxNum = 0;
    matching.forEach((d) => {
      const numPart = parseInt(d.documentNumber.replace(/^(QT-|Q-|PI-|INV-)/, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    });

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  // --- Payments ---
  async getPayments(): Promise<PaymentRecord[]> {
    if (this.l1Payments.size > 0) {
      const list = Array.from(this.l1Payments.values());
      return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const tx = db.transaction('payments', 'readonly');
        const req = tx.objectStore('payments').getAll();
        req.onsuccess = () => {
          const list: PaymentRecord[] = req.result || [];
          this.l1Payments.clear();
          list.forEach((p) => this.l1Payments.set(p.id, p));
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              localStorage.setItem('damview_payments', JSON.stringify(list));
            } catch {}
          }
          list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          resolve(list);
        };
        req.onerror = () => resolve(Array.from(this.l1Payments.values()));
      });
    } catch {
      return Array.from(this.l1Payments.values());
    }
  }

  async getPaymentsForClient(clientId: string): Promise<PaymentRecord[]> {
    const payments = await this.getPayments();
    return payments.filter((p) => p.clientId === clientId);
  }

  async savePayment(payment: PaymentRecord): Promise<void> {
    await this.clearTombstone(payment.id);
    if (payment.receiptNumber) await this.clearTombstone(payment.receiptNumber);

    const nowIso = new Date().toISOString();
    const cleanPayment: PaymentRecord = {
      ...payment,
      createdAt: payment.createdAt || nowIso,
    };

    // 1. Instant L1 cache update
    this.l1Payments.set(cleanPayment.id, cleanPayment);

    // 2. Synchronous localStorage mirror
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_payments', JSON.stringify(Array.from(this.l1Payments.values())));
      } catch {}
    }

    // 3. Durable Transactional Write-Through to IndexedDB
    try {
      const db = await this.init();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('payments', 'readwrite');
        tx.objectStore('payments').put(cleanPayment);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[StorageEngine] Write payment error:', e);
    }

    // Update document balance & status
    if (cleanPayment.documentId) {
      const doc = await this.getDocumentById(cleanPayment.documentId);
      if (doc) {
        const newPaid = Math.round(((doc.amountPaid || 0) + cleanPayment.amount) * 100) / 100;
        const newBalance = Math.max(0, Math.round((doc.grandTotal - newPaid) * 100) / 100);
        const newStatus = newBalance <= 0 ? 'Paid' : 'Sent';
        await this.saveDocument({
          ...doc,
          amountPaid: newPaid,
          balanceDue: newBalance,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    this.recordAuditLog({
      entityType: 'PAYMENT',
      entityId: cleanPayment.id,
      action: 'CREATE',
      details: `Recorded payment receipt ${cleanPayment.receiptNumber} of Ksh ${cleanPayment.amount} from ${cleanPayment.clientName} (${cleanPayment.paymentMode})`,
      snapshot: cleanPayment,
    }).catch(() => {});
  }

  async deletePayment(paymentId: string): Promise<{ payment: PaymentRecord | null; updatedDoc?: BillingDocument | null }> {
    const allPayments = await this.getPayments();
    const payment = allPayments.find((p) => p.id === paymentId) || null;

    await this.recordTombstone(paymentId, payment?.receiptNumber, 'PAYMENT');

    // 1. Instant L1 cache removal
    this.l1Payments.delete(paymentId);

    // 2. Synchronous localStorage mirror
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_payments', JSON.stringify(Array.from(this.l1Payments.values())));
      } catch {}
    }

    // 3. Durable Transactional Delete from IndexedDB
    try {
      const db = await this.init();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('payments', 'readwrite');
        tx.objectStore('payments').delete(paymentId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[StorageEngine] Delete payment error:', e);
    }

    this.recordAuditLog({
      entityType: 'PAYMENT',
      entityId: paymentId,
      action: 'DELETE',
      details: `Deleted payment receipt ${payment?.receiptNumber || paymentId}`,
      snapshot: payment,
    }).catch(() => {});

    let updatedDoc: BillingDocument | null = null;
    if (payment) {
      const doc =
        (payment.documentId ? await this.getDocumentById(payment.documentId) : null) ||
        (payment.documentNumber ? await this.getDocumentByNumber(payment.documentNumber) : null);

      if (doc) {
        const remainingPayments = (await this.getPayments()).filter(
          (p) => p.id !== paymentId && (p.documentId === doc.id || (p.documentNumber && p.documentNumber === doc.documentNumber))
        );
        const newPaid = Math.round(remainingPayments.reduce((sum, p) => sum + (p.amount || 0), 0) * 100) / 100;
        const newBalance = Math.max(0, Math.round((doc.grandTotal - newPaid) * 100) / 100);
        const newStatus = newBalance <= 0 ? 'Paid' : 'Sent';

        updatedDoc = {
          ...doc,
          amountPaid: newPaid,
          balanceDue: newBalance,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        };
        await this.saveDocument(updatedDoc);
      }
    }

    return { payment, updatedDoc };
  }

  async getNextReceiptNumber(): Promise<string> {
    const payments = await this.getPayments();
    let maxNum = 0;
    payments.forEach((p) => {
      const numPart = parseInt(p.receiptNumber.replace('REC-', ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    });
    return `REC-${String(maxNum + 1).padStart(4, '0')}`;
  }

  // --- Statement of Accounts (SOA) ---
  async getStatements(): Promise<StatementRecord[]> {
    if (this.l1Statements.size > 0) {
      const list = Array.from(this.l1Statements.values());
      return list.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
    }

    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('statements')) {
        const tx = db.transaction('statements', 'readonly');
        const store = tx.objectStore('statements');
        const req = store.getAll();
        const res = await new Promise<StatementRecord[]>((resolve) => {
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });

        if (res && res.length > 0) {
          this.l1Statements.clear();
          res.forEach((s) => this.l1Statements.set(s.id, s));
          this.persistL1StatementsFallback();
          return res.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
        }
      }
    } catch (e) {
      console.warn('[StorageEngine] IndexedDB getStatements error:', e);
    }

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('damview_statements_v1');
        if (raw) {
          const parsed: StatementRecord[] = JSON.parse(raw);
          this.l1Statements.clear();
          parsed.forEach((s) => this.l1Statements.set(s.id, s));
          return parsed.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
        }
      } catch (e) {}
    }

    // Seed defaults
    this.l1Statements.clear();
    SAMPLE_STATEMENTS.forEach((s) => this.l1Statements.set(s.id, s));
    this.persistL1StatementsFallback();
    return [...SAMPLE_STATEMENTS];
  }

  async saveStatement(statement: StatementRecord): Promise<void> {
    const updated = {
      ...statement,
      updatedAt: new Date().toISOString(),
    };
    this.l1Statements.set(updated.id, updated);
    this.persistL1StatementsFallback();

    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('statements')) {
        const tx = db.transaction('statements', 'readwrite');
        tx.objectStore('statements').put(updated);
      }
    } catch (e) {
      console.warn('[StorageEngine] IndexedDB saveStatement error:', e);
    }

    this.recordAuditLog({
      entityType: 'DOCUMENT',
      entityId: statement.id,
      action: 'CREATE',
      details: `Generated Statement of Account ${statement.statementNumber} for ${statement.clientName} (Closing Balance: Ksh ${statement.closingBalance.toLocaleString()})`,
      snapshot: statement,
    }).catch(() => {});
  }

  async deleteStatement(statementId: string): Promise<void> {
    const target = this.l1Statements.get(statementId);
    this.l1Statements.delete(statementId);
    this.persistL1StatementsFallback();

    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('statements')) {
        const tx = db.transaction('statements', 'readwrite');
        tx.objectStore('statements').delete(statementId);
      }
    } catch (e) {
      console.warn('[StorageEngine] Delete statement error:', e);
    }

    this.recordAuditLog({
      entityType: 'DOCUMENT',
      entityId: statementId,
      action: 'DELETE',
      details: `Deleted Statement of Account ${target?.statementNumber || statementId} (${target?.clientName || ''})`,
      snapshot: target,
    }).catch(() => {});
  }

  // --- Reservations & Hall Bookings ---
  async getReservations(): Promise<Reservation[]> {
    if (this.l1Reservations.size > 0) {
      const list = Array.from(this.l1Reservations.values());
      return list.sort((a, b) => new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime());
    }
    try {
      const db = await this.init();
      if (db.objectStoreNames.contains('reservations')) {
        const tx = db.transaction('reservations', 'readonly');
        const req = tx.objectStore('reservations').getAll();
        const res = await new Promise<Reservation[]>((resolve) => {
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });
        if (res && res.length > 0) {
          this.l1Reservations.clear();
          res.forEach((r) => this.l1Reservations.set(r.id, r));
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              localStorage.setItem('damview_reservations', JSON.stringify(res));
            } catch {}
          }
          return res.sort((a, b) => new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime());
        }
      }
    } catch {}

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('damview_reservations');
        if (raw) {
          const parsed: Reservation[] = JSON.parse(raw);
          this.l1Reservations.clear();
          parsed.forEach((r) => this.l1Reservations.set(r.id, r));
          return parsed.sort((a, b) => new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime());
        }
      } catch {}
    }

    this.l1Reservations.clear();
    SAMPLE_RESERVATIONS.forEach((r) => this.l1Reservations.set(r.id, r));
    return [...SAMPLE_RESERVATIONS];
  }

  async getReservationById(id: string): Promise<Reservation | null> {
    const list = await this.getReservations();
    return list.find((r) => r.id === id) || null;
  }

  async saveReservation(reservation: Reservation): Promise<void> {
    const nowIso = new Date().toISOString();
    const updated: Reservation = {
      ...reservation,
      updatedAt: nowIso,
      createdAt: reservation.createdAt || nowIso,
    };
    this.l1Reservations.set(updated.id, updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_reservations', JSON.stringify(Array.from(this.l1Reservations.values())));
      } catch {}
    }

    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('reservations')) {
        const tx = db.transaction('reservations', 'readwrite');
        tx.objectStore('reservations').put(updated);
      }
    } catch (e) {
      console.warn('[StorageEngine] IndexedDB saveReservation error:', e);
    }

    this.recordAuditLog({
      entityType: 'RESERVATION',
      entityId: updated.id,
      action: 'UPDATE',
      details: `Saved Folio ${updated.folioNumber} for ${updated.guestName} (${updated.unitName}) - Status: ${updated.status}`,
      snapshot: updated,
    }).catch(() => {});
  }

  async deleteReservation(id: string): Promise<void> {
    const target = this.l1Reservations.get(id);
    this.l1Reservations.delete(id);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_reservations', JSON.stringify(Array.from(this.l1Reservations.values())));
      } catch {}
    }

    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('reservations')) {
        const tx = db.transaction('reservations', 'readwrite');
        tx.objectStore('reservations').delete(id);
      }
    } catch {}

    this.recordAuditLog({
      entityType: 'RESERVATION',
      entityId: id,
      action: 'DELETE',
      details: `Deleted reservation folio ${target?.folioNumber || id}`,
      snapshot: target,
    }).catch(() => {});
  }

  async getNextFolioNumber(): Promise<string> {
    const list = await this.getReservations();
    let maxNum = 0;
    list.forEach((r) => {
      const match = r.folioNumber.match(/FOL-\d{4}-(\d+)/) || r.folioNumber.match(/FOL-(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const year = new Date().getFullYear();
    return `FOL-${year}-${String(maxNum + 1).padStart(3, '0')}`;
  }

  // --- Restaurant & POS Quick-Billing ---
  async getPOSOrders(): Promise<POSOrder[]> {
    if (this.l1POSOrders.size > 0) {
      const list = Array.from(this.l1POSOrders.values());
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    try {
      const db = await this.init();
      if (db.objectStoreNames.contains('pos_orders')) {
        const tx = db.transaction('pos_orders', 'readonly');
        const req = tx.objectStore('pos_orders').getAll();
        const res = await new Promise<POSOrder[]>((resolve) => {
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });
        if (res && res.length > 0) {
          this.l1POSOrders.clear();
          res.forEach((p) => this.l1POSOrders.set(p.id, p));
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              localStorage.setItem('damview_pos_orders', JSON.stringify(res));
            } catch {}
          }
          return res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      }
    } catch {}

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('damview_pos_orders');
        if (raw) {
          const parsed: POSOrder[] = JSON.parse(raw);
          this.l1POSOrders.clear();
          parsed.forEach((p) => this.l1POSOrders.set(p.id, p));
          return parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      } catch {}
    }

    this.l1POSOrders.clear();
    SAMPLE_POS_ORDERS.forEach((p) => this.l1POSOrders.set(p.id, p));
    return [...SAMPLE_POS_ORDERS];
  }

  async savePOSOrder(order: POSOrder): Promise<void> {
    const updated: POSOrder = {
      ...order,
      createdAt: order.createdAt || new Date().toISOString(),
    };
    this.l1POSOrders.set(updated.id, updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_pos_orders', JSON.stringify(Array.from(this.l1POSOrders.values())));
      } catch {}
    }

    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('pos_orders')) {
        const tx = db.transaction('pos_orders', 'readwrite');
        tx.objectStore('pos_orders').put(updated);
      }
    } catch (e) {
      console.warn('[StorageEngine] IndexedDB savePOSOrder error:', e);
    }

    this.recordAuditLog({
      entityType: 'POS',
      entityId: updated.id,
      action: 'CREATE',
      details: `Recorded POS Order ${updated.orderNumber} for ${updated.tableOrRoom} - Ksh ${updated.grandTotal.toLocaleString()} (${updated.paymentMode})`,
      snapshot: updated,
    }).catch(() => {});
  }

  async deletePOSOrder(id: string): Promise<void> {
    const target = this.l1POSOrders.get(id);
    this.l1POSOrders.delete(id);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_pos_orders', JSON.stringify(Array.from(this.l1POSOrders.values())));
      } catch {}
    }

    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('pos_orders')) {
        const tx = db.transaction('pos_orders', 'readwrite');
        tx.objectStore('pos_orders').delete(id);
      }
    } catch {}

    this.recordAuditLog({
      entityType: 'POS',
      entityId: id,
      action: 'DELETE',
      details: `Deleted POS Order ${target?.orderNumber || id}`,
      snapshot: target,
    }).catch(() => {});
  }

  async getNextPOSOrderNumber(): Promise<string> {
    const list = await this.getPOSOrders();
    let maxNum = 0;
    list.forEach((p) => {
      const match = p.orderNumber.match(/POS-\d{4}-(\d+)/) || p.orderNumber.match(/POS-(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const year = new Date().getFullYear();
    return `POS-${year}-${String(maxNum + 1).padStart(3, '0')}`;
  }

  // --- Expenses & Purchases ---
  async getExpenses(): Promise<ExpenseRecord[]> {
    if (this.l1Expenses.size > 0) {
      const list = Array.from(this.l1Expenses.values());
      return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    try {
      const db = await this.init();
      if (db.objectStoreNames.contains('expenses')) {
        const tx = db.transaction('expenses', 'readonly');
        const req = tx.objectStore('expenses').getAll();
        const res = await new Promise<ExpenseRecord[]>((resolve) => {
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });
        if (res && res.length > 0) {
          this.l1Expenses.clear();
          res.forEach((e) => this.l1Expenses.set(e.id, e));
          return res.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
      }
    } catch {}

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('damview_expenses');
        if (raw) {
          const parsed: ExpenseRecord[] = JSON.parse(raw);
          this.l1Expenses.clear();
          parsed.forEach((e) => this.l1Expenses.set(e.id, e));
          return parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
      } catch {}
    }

    this.l1Expenses.clear();
    SAMPLE_EXPENSES.forEach((e) => this.l1Expenses.set(e.id, e));
    return [...SAMPLE_EXPENSES];
  }

  async saveExpense(expense: ExpenseRecord): Promise<void> {
    const updated: ExpenseRecord = {
      ...expense,
      createdAt: expense.createdAt || new Date().toISOString(),
    };
    this.l1Expenses.set(updated.id, updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_expenses', JSON.stringify(Array.from(this.l1Expenses.values())));
      } catch {}
    }
    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('expenses')) {
        const tx = db.transaction('expenses', 'readwrite');
        tx.objectStore('expenses').put(updated);
      }
    } catch {}
  }

  async deleteExpense(id: string): Promise<void> {
    this.l1Expenses.delete(id);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_expenses', JSON.stringify(Array.from(this.l1Expenses.values())));
      } catch {}
    }
    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('expenses')) {
        const tx = db.transaction('expenses', 'readwrite');
        tx.objectStore('expenses').delete(id);
      }
    } catch {}
  }

  async getNextExpenseNumber(): Promise<string> {
    const list = await this.getExpenses();
    let maxNum = 0;
    list.forEach((e) => {
      const match = e.expenseNumber.match(/EXP-\d{4}-(\d+)/) || e.expenseNumber.match(/EXP-(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const year = new Date().getFullYear();
    return `EXP-${year}-${String(maxNum + 1).padStart(3, '0')}`;
  }

  // --- Hospitality Catalogue ---
  async getCatalogueItems(): Promise<CatalogueItem[]> {
    if (this.l1Catalogue.size > 0) {
      return Array.from(this.l1Catalogue.values());
    }
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('damview_catalogue');
        if (raw) {
          const parsed: CatalogueItem[] = JSON.parse(raw);
          this.l1Catalogue.clear();
          parsed.forEach((c) => this.l1Catalogue.set(c.id, c));
          return parsed;
        }
      } catch {}
    }
    this.l1Catalogue.clear();
    STANDARD_HOSPITALITY_CATALOGUE.forEach((c) => this.l1Catalogue.set(c.id, c));
    return [...STANDARD_HOSPITALITY_CATALOGUE];
  }

  async saveCatalogueItem(item: CatalogueItem): Promise<void> {
    this.l1Catalogue.set(item.id, item);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_catalogue', JSON.stringify(Array.from(this.l1Catalogue.values())));
      } catch {}
    }
    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('catalogue')) {
        const tx = db.transaction('catalogue', 'readwrite');
        tx.objectStore('catalogue').put(item);
      }
    } catch {}
  }

  async deleteCatalogueItem(id: string): Promise<void> {
    this.l1Catalogue.delete(id);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_catalogue', JSON.stringify(Array.from(this.l1Catalogue.values())));
      } catch {}
    }
    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('catalogue')) {
        const tx = db.transaction('catalogue', 'readwrite');
        tx.objectStore('catalogue').delete(id);
      }
    } catch {}
  }

  // --- Dynamic POS Menu Catalog ---
  private l1POSMenu = new Map<string, any>();

  async getPOSMenuItems(): Promise<any[]> {
    if (this.l1POSMenu.size > 0) {
      return Array.from(this.l1POSMenu.values());
    }
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('damview_pos_menu_catalog');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.l1POSMenu.clear();
            parsed.forEach((item) => this.l1POSMenu.set(item.id, item));
            return parsed;
          }
        }
      } catch {}
    }
    this.l1POSMenu.clear();
    STANDARD_POS_MENU.forEach((m) => {
      const menuItem = {
        id: m.id,
        name: m.name,
        category: m.category,
        unitRate: m.price,
        taxApplicable: true,
        available: true,
      };
      this.l1POSMenu.set(m.id, menuItem);
    });
    return Array.from(this.l1POSMenu.values());
  }

  async savePOSMenuItem(item: any): Promise<void> {
    const updated = {
      ...item,
      updatedAt: new Date().toISOString(),
    };
    this.l1POSMenu.set(updated.id, updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_pos_menu_catalog', JSON.stringify(Array.from(this.l1POSMenu.values())));
      } catch {}
    }
    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('pos_menu_catalog')) {
        const tx = db.transaction('pos_menu_catalog', 'readwrite');
        tx.objectStore('pos_menu_catalog').put(updated);
      }
    } catch {}
  }

  async deletePOSMenuItem(id: string): Promise<void> {
    this.l1POSMenu.delete(id);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_pos_menu_catalog', JSON.stringify(Array.from(this.l1POSMenu.values())));
      } catch {}
    }
    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('pos_menu_catalog')) {
        const tx = db.transaction('pos_menu_catalog', 'readwrite');
        tx.objectStore('pos_menu_catalog').delete(id);
      }
    } catch {}
  }

  // --- Dynamic Room & Space Catalog ---
  private l1RoomSpaces = new Map<string, any>();

  async getRoomSpaceItems(): Promise<any[]> {
    if (this.l1RoomSpaces.size > 0) {
      return Array.from(this.l1RoomSpaces.values());
    }
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('damview_room_space_catalog');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.l1RoomSpaces.clear();
            parsed.forEach((item) => this.l1RoomSpaces.set(item.id, item));
            return parsed;
          }
        }
      } catch {}
    }
    const baselineSpaces = [
      { id: 'rs-101', code: 'R-101', name: 'VIP Suite 101 (Lake View)', spaceType: 'Room', baseRate: 8500, capacity: '2 Guests', status: 'Available' },
      { id: 'rs-102', code: 'R-102', name: 'Standard Room 102', spaceType: 'Room', baseRate: 5500, capacity: '1-2 Guests', status: 'Available' },
      { id: 'rs-103', code: 'R-103', name: 'Standard Room 103', spaceType: 'Room', baseRate: 5500, capacity: '1-2 Guests', status: 'Available' },
      { id: 'rs-105', code: 'R-105', name: 'Twin Deluxe 105', spaceType: 'Room', baseRate: 7000, capacity: '2-3 Guests', status: 'Available' },
      { id: 'rs-204', code: 'R-204', name: 'Deluxe Room 204 (Lake View)', spaceType: 'Room', baseRate: 7000, capacity: '2 Guests', status: 'Available' },
      { id: 'rs-kilima', code: 'H-KILIMA', name: 'Executive Kilima Hall', spaceType: 'Conference Hall', baseRate: 25000, capacity: '60 Delegates', status: 'Available' },
      { id: 'rs-maruba', code: 'H-MARUBA', name: 'Maruba Garden Pavilion / Pavilion Hall', spaceType: 'Conference Hall', baseRate: 35000, capacity: '150 Delegates', status: 'Available' },
      { id: 'rs-boardroom', code: 'H-BOARD', name: 'Executive Boardroom VIP Suite', spaceType: 'Conference Hall', baseRate: 15000, capacity: '20 Delegates', status: 'Available' },
      { id: 'rs-terrace', code: 'A-TERRACE', name: 'Poolside / Lake View Terrace', spaceType: 'Auxiliary Space', baseRate: 15000, capacity: '80 Guests', status: 'Available' },
      { id: 'rs-grounds', code: 'A-GARDEN', name: 'Damview Gardens / Grounds', spaceType: 'Auxiliary Space', baseRate: 25000, capacity: '300 Guests', status: 'Available' },
    ];
    this.l1RoomSpaces.clear();
    baselineSpaces.forEach((s) => this.l1RoomSpaces.set(s.id, s));
    return baselineSpaces;
  }

  async saveRoomSpaceItem(item: any): Promise<void> {
    const updated = {
      ...item,
      updatedAt: new Date().toISOString(),
    };
    this.l1RoomSpaces.set(updated.id, updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_room_space_catalog', JSON.stringify(Array.from(this.l1RoomSpaces.values())));
      } catch {}
    }
    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('room_space_catalog')) {
        const tx = db.transaction('room_space_catalog', 'readwrite');
        tx.objectStore('room_space_catalog').put(updated);
      }
    } catch {}
  }

  async deleteRoomSpaceItem(id: string): Promise<void> {
    this.l1RoomSpaces.delete(id);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_room_space_catalog', JSON.stringify(Array.from(this.l1RoomSpaces.values())));
      } catch {}
    }
    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('room_space_catalog')) {
        const tx = db.transaction('room_space_catalog', 'readwrite');
        tx.objectStore('room_space_catalog').delete(id);
      }
    } catch {}
  }

  private persistL1StatementsFallback() {
    if (typeof window === 'undefined') return;
    try {
      const list = Array.from(this.l1Statements.values());
      localStorage.setItem('damview_statements_v1', JSON.stringify(list));
    } catch (e) {}
  }

  // --- Sync Queue ---
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    if (this.l1SyncQueue.size > 0) {
      return Array.from(this.l1SyncQueue.values());
    }
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const tx = db.transaction('sync_queue', 'readonly');
        const req = tx.objectStore('sync_queue').getAll();
        req.onsuccess = () => {
          const list: SyncQueueItem[] = req.result || [];
          this.l1SyncQueue.clear();
          list.forEach((q: SyncQueueItem) => this.l1SyncQueue.set(q.id, q));
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              localStorage.setItem('damview_sync_queue', JSON.stringify(list));
            } catch {}
          }
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return Array.from(this.l1SyncQueue.values());
    }
  }

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
    const queueItem: SyncQueueItem = {
      id: 'sq-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
      ...item,
    };
    this.l1SyncQueue.set(queueItem.id, queueItem);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_sync_queue', JSON.stringify(Array.from(this.l1SyncQueue.values())));
      } catch {}
    }

    try {
      const db = await this.init();
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').put(queueItem);
    } catch (e) {
      console.warn('[StorageEngine] Write sync queue error:', e);
    }

    return queueItem.id;
  }

  async updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
    this.l1SyncQueue.set(item.id, item);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_sync_queue', JSON.stringify(Array.from(this.l1SyncQueue.values())));
      } catch {}
    }

    try {
      const db = await this.init();
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').put(item);
    } catch (e) {
      console.warn('[StorageEngine] Update sync queue error:', e);
    }
  }

  async removeSyncQueueItem(id: string): Promise<void> {
    this.l1SyncQueue.delete(id);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_sync_queue', JSON.stringify(Array.from(this.l1SyncQueue.values())));
      } catch {}
    }

    try {
      const db = await this.init();
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').delete(id);
    } catch (e) {
      console.warn('[StorageEngine] Remove sync queue error:', e);
    }
  }

  async clearSyncQueue(): Promise<void> {
    this.l1SyncQueue.clear();

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_sync_queue', JSON.stringify([]));
      } catch {}
    }

    try {
      const db = await this.init();
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').clear();
    } catch (e) {
      console.warn('[StorageEngine] Clear sync queue error:', e);
    }
  }

  // --- Immutable Audit Logging ---
  async recordAuditLog(entry: {
    entityType: AuditLogEntry['entityType'];
    entityId: string;
    action: AuditLogEntry['action'];
    details: string;
    snapshot?: any;
    id?: string;
    timestamp?: string;
  }): Promise<void> {
    const logItem: AuditLogEntry = {
      id: entry.id || ('aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)),
      timestamp: entry.timestamp || new Date().toISOString(),
      ...entry,
    };

    try {
      const db = await this.init();
      if (db.objectStoreNames.contains('audit_log')) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('audit_log', 'readwrite');
          tx.objectStore('audit_log').put(logItem);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    } catch {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const current: AuditLogEntry[] = JSON.parse(
            localStorage.getItem('damview_audit_log') || '[]'
          );
          current.unshift(logItem);
          if (current.length > 200) current.length = 200;
          localStorage.setItem('damview_audit_log', JSON.stringify(current));
        } catch {}
      }
    }
  }

  async getAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    try {
      const db = await this.init();
      if (db.objectStoreNames.contains('audit_log')) {
        return new Promise((resolve) => {
          const tx = db.transaction('audit_log', 'readonly');
          const req = tx.objectStore('audit_log').getAll();
          req.onsuccess = () => {
            const list: AuditLogEntry[] = req.result || [];
            list.sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            resolve(list.slice(0, limit));
          };
          req.onerror = () => resolve([]);
        });
      }
    } catch {}

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const list: AuditLogEntry[] = JSON.parse(
          localStorage.getItem('damview_audit_log') || '[]'
        );
        return list.slice(0, limit);
      } catch {}
    }
    return [];
  }
}

export const dbService = new StorageEngine();
