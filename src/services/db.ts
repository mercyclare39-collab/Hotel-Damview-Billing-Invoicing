import { Client, BillingDocument, PaymentRecord, HotelProfile, SyncQueueItem, AuditLogEntry } from '../types';

const DB_NAME = 'HotelDamviewDB';
const DB_VERSION = 3;

export interface DeletedTombstone {
  id: string;
  key?: string;
  type: 'DOCUMENT' | 'CLIENT' | 'PAYMENT';
  deletedAt: number;
}

export type { AuditLogEntry };

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
    documentNumber: 'Q-0001',
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

class StorageEngine {
  private dbPromise: Promise<IDBDatabase> | null = null;
  
  // High-performance L1 In-Memory Reactive Cache
  private l1Profile: HotelProfile | null = null;
  private l1Clients: Map<string, Client> = new Map();
  private l1Documents: Map<string, BillingDocument> = new Map();
  private l1Payments: Map<string, PaymentRecord> = new Map();
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

      const savedQueue = localStorage.getItem('damview_sync_queue');
      if (savedQueue) {
        const list: SyncQueueItem[] = JSON.parse(savedQueue);
        this.l1SyncQueue.clear();
        list.forEach((q) => this.l1SyncQueue.set(q.id, q));
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
            const seedTx = db.transaction(
              ['hotel_profile', 'clients', 'documents', 'payments', 'system_meta'],
              'readwrite'
            );
            seedTx.objectStore('hotel_profile').put({ id: 'current', ...DEFAULT_HOTEL_PROFILE });
            SAMPLE_CLIENTS.forEach((c) => seedTx.objectStore('clients').put(c));
            SAMPLE_DOCUMENTS.forEach((d) => seedTx.objectStore('documents').put(d));
            SAMPLE_PAYMENTS.forEach((p) => seedTx.objectStore('payments').put(p));
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
    const prefix = type === 'QUOTATION' ? 'Q-' : type === 'PROFORMA' ? 'PI-' : 'INV-';
    const matching = docs.filter((d) => d.documentType === type && d.documentNumber.startsWith(prefix));

    let maxNum = 0;
    matching.forEach((d) => {
      const numPart = parseInt(d.documentNumber.replace(prefix, ''), 10);
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
    entityType: 'DOCUMENT' | 'CLIENT' | 'PAYMENT' | 'PROFILE' | 'SYNC';
    entityId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'MUTATION_GUARDED' | 'SELF_HEALED' | 'MERGED';
    details: string;
    snapshot?: any;
  }): Promise<void> {
    const logItem: AuditLogEntry = {
      id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
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
