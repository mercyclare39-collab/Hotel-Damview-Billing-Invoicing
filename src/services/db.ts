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
  SyncEntityType,
  SyncActionType,
} from '../types';

const DB_NAME = 'HotelDamviewDB';
const DB_VERSION = 6;

export interface SaveLocalFirstParams<T = any> {
  entityType: SyncEntityType;
  entityId: string;
  storeName: string;
  entity: T;
  action?: SyncActionType;
  isDelete?: boolean;
  auditDetails?: string;
  skipQueue?: boolean;
}

export interface DeletedTombstone {
  id: string;
  key?: string;
  type: 'DOCUMENT' | 'CLIENT' | 'PAYMENT' | 'RESERVATION' | 'POS' | 'EXPENSE' | 'CATALOGUE' | 'PROFILE';
  deletedAt: number;
}

export type { AuditLogEntry, Reservation, POSOrder, ExpenseRecord, CatalogueItem, POSOrderItem };

export const STANDARD_HOSPITALITY_CATALOGUE: CatalogueItem[] = [];

export const STANDARD_POS_MENU: POSOrderItem[] = [];

export const DEFAULT_HOTEL_PROFILE: HotelProfile = {
  name: 'HOTEL DAMVIEW',
  tagline: '',
  kraPin: 'P051453023Q',
  email: 'hoteldamview@gmail.com',
  phone: '+254 725 242 620',
  physicalLocation: 'MARIAKANI',
  postalAddress: 'P.O. BOX 42491-80100, Mombasa, Kenya',
  logoBase64: '',
  bankName: '',
  bankBranch: '',
  accountHolder: '',
  accountNumber: '',
  mpesaTillNumber: '',
  vatRate: 16,
  googleWebAppUrl: 'https://script.google.com/macros/s/AKfycbydS-5XrObH66rYF6x_pm_zIKkgvwD720IqRR724ndaz3NhTMlFFgSQ9_UBa5nYWnVk/exec',
  googleDriveFolder: 'Hotel Damview Archives',
  googleSheetUrl: '',
  googleDriveFolderUrl: 'https://drive.google.com/drive/folders/19BU3YmTeQx7NMKwubVCm8N6nISzA8Hzn',
  googleSheetEmbedUrl: '',
  autoSyncEnabled: true,
};

const SAMPLE_CLIENTS: Client[] = [];

const SAMPLE_DOCUMENTS: BillingDocument[] = [];

const SAMPLE_PAYMENTS: PaymentRecord[] = [];

const SAMPLE_STATEMENTS: StatementRecord[] = [];

const SAMPLE_RESERVATIONS: Reservation[] = [];

const SAMPLE_POS_ORDERS: POSOrder[] = [];

const SAMPLE_EXPENSES: ExpenseRecord[] = [];

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
    if (typeof window === 'undefined' || !window.localStorage) {
      this.l1Profile = { ...DEFAULT_HOTEL_PROFILE };
      return;
    }
    try {
      if (!localStorage.getItem('damview_admin_passcode') || localStorage.getItem('damview_admin_passcode') === '2025') {
        localStorage.setItem('damview_admin_passcode', '1000');
      }

      const savedProfile = localStorage.getItem('damview_profile');
      if (savedProfile) {
        const reconciled = this.reconcileProfile(JSON.parse(savedProfile));
        this.l1Profile = reconciled;
        localStorage.setItem('damview_profile', JSON.stringify(reconciled));
      } else {
        const initial = { ...DEFAULT_HOTEL_PROFILE };
        this.l1Profile = initial;
        localStorage.setItem('damview_profile', JSON.stringify(initial));
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
        list.forEach((q) => {
          if (q && q.id !== undefined) {
            this.l1SyncQueue.set(String(q.id), q);
          }
        });
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
        // Filter out legacy demo items if present
        const cleanList = list.filter((c) => !c.id.match(/^cat-\d+$/));
        this.l1Catalogue.clear();
        cleanList.forEach((c) => this.l1Catalogue.set(c.id, c));
        localStorage.setItem('damview_catalogue', JSON.stringify(cleanList));
      } else {
        this.l1Catalogue.clear();
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
        const tx = (event.target as IDBOpenDBRequest).transaction;

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

        // Durable sync_queue store with required composite indexes
        let syncStore: IDBObjectStore;
        if (!db.objectStoreNames.contains('sync_queue')) {
          syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        } else if (tx) {
          syncStore = tx.objectStore('sync_queue');
        } else {
          syncStore = null as any;
        }

        if (syncStore) {
          if (!syncStore.indexNames.contains('[status+createdAt]')) {
            syncStore.createIndex('[status+createdAt]', ['status', 'createdAt'], { unique: false });
          }
          if (!syncStore.indexNames.contains('[entityType+entityId]')) {
            syncStore.createIndex('[entityType+entityId]', ['entityType', 'entityId'], { unique: false });
          }
          if (!syncStore.indexNames.contains('status')) {
            syncStore.createIndex('status', 'status', { unique: false });
          }
          if (!syncStore.indexNames.contains('createdAt')) {
            syncStore.createIndex('createdAt', 'createdAt', { unique: false });
          }
          if (!syncStore.indexNames.contains('nextRetryAt')) {
            syncStore.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
          }
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
        if (!db.objectStoreNames.contains('pos_menu_catalog')) {
          db.createObjectStore('pos_menu_catalog', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('room_space_catalog')) {
          db.createObjectStore('room_space_catalog', { keyPath: 'id' });
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
            this.l1Profile = this.reconcileProfile(reqProf.result);
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
            reqQueue.result.forEach((q: SyncQueueItem) => {
              if (q && q.id !== undefined) {
                this.l1SyncQueue.set(String(q.id), q);
              }
            });
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
            // Seeding was already performed in the past. Ensure hotel_profile is populated with all baked credentials
            try {
              if (db.objectStoreNames.contains('hotel_profile')) {
                const profTx = db.transaction(['hotel_profile'], 'readwrite');
                const profStore = profTx.objectStore('hotel_profile');
                const profReq = profStore.get('current');
                profReq.onsuccess = () => {
                  const existing = profReq.result;
                  const reconciled = this.reconcileProfile(existing);
                  profStore.put({ id: 'current', ...reconciled });
                  this.l1Profile = reconciled;
                  if (typeof window !== 'undefined' && window.localStorage) {
                    try {
                      localStorage.setItem('damview_profile', JSON.stringify(reconciled));
                    } catch {}
                  }
                  resolve();
                };
                profReq.onerror = () => resolve();
                return;
              }
            } catch {
              resolve();
              return;
            }
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
            const initialProfile = this.reconcileProfile(DEFAULT_HOTEL_PROFILE);
            seedTx.objectStore('hotel_profile').put({ id: 'current', ...initialProfile });
            this.l1Profile = initialProfile;
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                localStorage.setItem('damview_profile', JSON.stringify(initialProfile));
              } catch {}
            }
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

  private reconcileProfile(raw?: Partial<HotelProfile> | null): HotelProfile {
    if (!raw) return { ...DEFAULT_HOTEL_PROFILE };

    // Tagline / Subtitle: default to blank always; purge all original/legacy baked demo strings completely
    const rawTagline = raw.tagline !== undefined ? String(raw.tagline).trim() : '';
    const legacyDemoTaglines = [
      'premier hospitality, accommodation & dining',
      'luxury & serenity by the dam',
      'luxury & serenity',
      'luxury and serenity by the dam',
      'premier hospitality',
      'serenity by the dam',
    ];
    const isLegacyTagline = legacyDemoTaglines.includes(rawTagline.toLowerCase());
    const cleanTagline = isLegacyTagline ? '' : rawTagline;

    // Bank and settlement credentials: default to blank unless officially entered
    // Purge all original/legacy demo credentials completely
    const rawBankName = raw.bankName !== undefined ? String(raw.bankName).trim() : '';
    const rawBankBranch = raw.bankBranch !== undefined ? String(raw.bankBranch).trim() : '';
    const rawAccountHolder = raw.accountHolder !== undefined ? String(raw.accountHolder).trim() : '';
    const rawAccountNo = raw.accountNumber !== undefined ? String(raw.accountNumber).trim() : '';
    const rawMpesa = raw.mpesaTillNumber !== undefined ? String(raw.mpesaTillNumber).trim() : '';

    const legacyDemoBankNames = [
      'kcb bank kenya',
      'kenya commercial bank',
      'kenya commercial bank (kcb)',
      'kcb',
      'equity bank',
      'equity bank kenya',
      'equity bank machakos',
      'equity bank limited',
    ];
    const legacyDemoAccountNos = [
      '1102983746',
      '0123456789012',
    ];
    const legacyDemoBranches = [
      'mariakani branch',
      'machakos branch',
      'machakos main branch',
      'machakos',
    ];
    const legacyDemoHolders = [
      'hotel damview enterprises ltd',
      'hotel damview ltd',
      'hotel damview',
    ];

    const isLegacyDemoBank =
      legacyDemoBankNames.includes(rawBankName.toLowerCase()) ||
      legacyDemoAccountNos.includes(rawAccountNo.replace(/\s+/g, '')) ||
      (rawBankName.length > 0 && legacyDemoBranches.includes(rawBankBranch.toLowerCase())) ||
      (rawBankName.length > 0 && legacyDemoHolders.includes(rawAccountHolder.toLowerCase()));

    const cleanBankName = isLegacyDemoBank ? '' : rawBankName;
    const cleanBankBranch = isLegacyDemoBank ? '' : rawBankBranch;
    const cleanAccountHolder = isLegacyDemoBank ? '' : rawAccountHolder;
    const cleanAccountNo = isLegacyDemoBank ? '' : rawAccountNo;
    const cleanMpesa = (rawMpesa === '5432100' && (isLegacyDemoBank || rawBankName === 'KCB Bank Kenya' || !rawBankName)) ? '' : rawMpesa;

    return {
      name: (raw.name && String(raw.name).trim()) ? String(raw.name).trim() : DEFAULT_HOTEL_PROFILE.name,
      tagline: cleanTagline,
      kraPin: (raw.kraPin && String(raw.kraPin).trim()) ? String(raw.kraPin).trim() : DEFAULT_HOTEL_PROFILE.kraPin,
      email: (raw.email && String(raw.email).trim()) ? String(raw.email).trim() : DEFAULT_HOTEL_PROFILE.email,
      phone: (raw.phone && String(raw.phone).trim()) ? String(raw.phone).trim() : DEFAULT_HOTEL_PROFILE.phone,
      physicalLocation: (raw.physicalLocation && String(raw.physicalLocation).trim()) ? String(raw.physicalLocation).trim() : DEFAULT_HOTEL_PROFILE.physicalLocation,
      postalAddress: (raw.postalAddress && String(raw.postalAddress).trim()) ? String(raw.postalAddress).trim() : DEFAULT_HOTEL_PROFILE.postalAddress,
      logoBase64: raw.logoBase64 !== undefined ? raw.logoBase64 : DEFAULT_HOTEL_PROFILE.logoBase64,
      bankName: cleanBankName,
      bankBranch: cleanBankBranch,
      accountHolder: cleanAccountHolder,
      accountNumber: cleanAccountNo,
      mpesaTillNumber: cleanMpesa,
      vatRate: typeof raw.vatRate === 'number' && !isNaN(raw.vatRate) && raw.vatRate >= 0 ? raw.vatRate : DEFAULT_HOTEL_PROFILE.vatRate,
      googleWebAppUrl: (raw.googleWebAppUrl && String(raw.googleWebAppUrl).trim()) ? String(raw.googleWebAppUrl).trim() : DEFAULT_HOTEL_PROFILE.googleWebAppUrl,
      googleDriveFolder: (raw.googleDriveFolder && String(raw.googleDriveFolder).trim()) ? String(raw.googleDriveFolder).trim() : DEFAULT_HOTEL_PROFILE.googleDriveFolder,
      googleSheetUrl: raw.googleSheetUrl !== undefined ? raw.googleSheetUrl : (DEFAULT_HOTEL_PROFILE.googleSheetUrl || ''),
      googleDriveFolderUrl: (raw.googleDriveFolderUrl && String(raw.googleDriveFolderUrl).trim()) ? String(raw.googleDriveFolderUrl).trim() : DEFAULT_HOTEL_PROFILE.googleDriveFolderUrl,
      googleSheetEmbedUrl: raw.googleSheetEmbedUrl !== undefined ? raw.googleSheetEmbedUrl : (DEFAULT_HOTEL_PROFILE.googleSheetEmbedUrl || ''),
      autoSyncEnabled: raw.autoSyncEnabled !== undefined ? raw.autoSyncEnabled : DEFAULT_HOTEL_PROFILE.autoSyncEnabled,
      lastSyncTimestamp: raw.lastSyncTimestamp,
    };
  }

  /**
   * Strict Local-First Mutation Pipeline (IndexedDB-First Law)
   * Commits the entity and its corresponding sync queue event atomically within
   * an IndexedDB transaction boundary before initiating any network dispatch.
   */
  async saveLocalFirst<T = any>(params: SaveLocalFirstParams<T>): Promise<T> {
    const {
      entityType,
      entityId,
      storeName,
      entity,
      action,
      isDelete = false,
      auditDetails,
      skipQueue = false,
    } = params;

    // 1. Statutory financial validations & invariants
    if (entityType === 'DOCUMENT' && entity && !isDelete) {
      const doc = entity as unknown as BillingDocument;
      if (typeof doc.subtotal === 'number') {
        doc.subtotal = Math.round(doc.subtotal * 100) / 100;
        doc.vatAmount = typeof doc.vatAmount === 'number' ? Math.round(doc.vatAmount * 100) / 100 : 0;
        doc.grandTotal = Math.round((doc.subtotal + doc.vatAmount) * 100) / 100;
        doc.amountPaid = typeof doc.amountPaid === 'number' ? Math.round(doc.amountPaid * 100) / 100 : 0;
        doc.balanceDue = Math.max(0, Math.round((doc.grandTotal - doc.amountPaid) * 100) / 100);
      }
    } else if (entityType === 'PAYMENT' && entity && !isDelete) {
      const pay = entity as unknown as PaymentRecord;
      if (typeof pay.amount === 'number') {
        pay.amount = Math.round(pay.amount * 100) / 100;
      }
    }

    const nowIso = new Date().toISOString();
    let queueAction: SyncActionType;
    if (action) {
      queueAction = action;
    } else if (isDelete) {
      if (entityType === 'CLIENT') queueAction = 'CASCADE_DELETE_CLIENT' as any;
      else if (entityType === 'PAYMENT') queueAction = 'CASCADE_DELETE_PAYMENT' as any;
      else queueAction = 'CASCADE_DELETE_DOCUMENT' as any;
    } else {
      queueAction = 'UPSERT';
    }

    const queueItem: SyncQueueItem = {
      id: 'sq-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8),
      entityType,
      entityId,
      action: queueAction,
      payload: isDelete ? { id: entityId, ...(typeof entity === 'object' ? entity : {}) } : entity,
      status: 'PENDING',
      retryCount: 0,
      lastError: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      nextRetryAt: 0,
    };

    // 2. Atomic IndexedDB Transaction Boundary (Enforcing Rollback Invariant)
    const db = await this.init();
    const activeStores = [storeName];
    if (db.objectStoreNames.contains('sync_queue') && !skipQueue) {
      activeStores.push('sync_queue');
    }
    if (db.objectStoreNames.contains('audit_log') && auditDetails) {
      activeStores.push('audit_log');
    }

    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(activeStores, 'readwrite');
        const entityStore = tx.objectStore(storeName);

        if (isDelete) {
          entityStore.delete(entityId);
        } else {
          entityStore.put(entity);
        }

        if (!skipQueue && db.objectStoreNames.contains('sync_queue')) {
          const syncStore = tx.objectStore('sync_queue');
          syncStore.put(queueItem);
        }

        if (auditDetails && db.objectStoreNames.contains('audit_log')) {
          const auditStore = tx.objectStore('audit_log');
          auditStore.put({
            id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            timestamp: nowIso,
            entityType,
            entityId,
            action: isDelete ? 'DELETE' : 'UPDATE',
            details: auditDetails,
            snapshot: entity,
          });
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Atomic transaction failed'));
        tx.onabort = () => reject(tx.error || new Error('Atomic transaction aborted'));
      } catch (err) {
        reject(err);
      }
    });

    // 3. Update L1 In-Memory Reactive Cache & localStorage Mirror
    if (!skipQueue) {
      this.l1SyncQueue.set(String(queueItem.id!), queueItem);
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(
            'damview_sync_queue',
            JSON.stringify(Array.from(this.l1SyncQueue.values()))
          );
        } catch {}
      }
    }

    // 4. Fire Reactivity & Non-blocking Async Sync Dispatch
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('damview:data-changed'));
      window.dispatchEvent(new CustomEvent('damview:sync-trigger'));
    }

    return entity;
  }

  // --- Hotel Profile ---
  async getHotelProfile(): Promise<HotelProfile> {
    if (this.l1Profile) {
      return this.reconcileProfile(this.l1Profile);
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem('damview_profile');
        if (stored) {
          const parsed = JSON.parse(stored);
          const reconciled = this.reconcileProfile(parsed);
          this.l1Profile = reconciled;
          try {
            localStorage.setItem('damview_profile', JSON.stringify(reconciled));
          } catch {}
          // Asynchronously ensure IndexedDB is also updated with the clean purged profile
          this.init().then((db) => {
            try {
              const tx = db.transaction('hotel_profile', 'readwrite');
              tx.objectStore('hotel_profile').put({ id: 'current', ...reconciled });
            } catch {}
          }).catch(() => {});
          return { ...reconciled };
        }
      } catch {}
    }

    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const tx = db.transaction('hotel_profile', 'readwrite');
        const store = tx.objectStore('hotel_profile');
        const req = store.get('current');
        req.onsuccess = () => {
          const profile = this.reconcileProfile(req.result);
          this.l1Profile = profile;
          try {
            store.put({ id: 'current', ...profile });
          } catch {}
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              localStorage.setItem('damview_profile', JSON.stringify(profile));
            } catch {}
          }
          resolve({ ...profile });
        };
        req.onerror = () => {
          const fallback = { ...DEFAULT_HOTEL_PROFILE };
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
      name: profile.name !== undefined ? profile.name : existing.name,
      tagline: profile.tagline !== undefined ? profile.tagline : existing.tagline,
      kraPin: profile.kraPin !== undefined ? profile.kraPin : existing.kraPin,
      email: profile.email !== undefined ? profile.email : existing.email,
      phone: profile.phone !== undefined ? profile.phone : existing.phone,
      physicalLocation: profile.physicalLocation !== undefined ? profile.physicalLocation : existing.physicalLocation,
      postalAddress: profile.postalAddress !== undefined ? profile.postalAddress : existing.postalAddress,
      logoBase64: profile.logoBase64 !== undefined ? profile.logoBase64 : existing.logoBase64,
      bankName: profile.bankName !== undefined ? profile.bankName : existing.bankName,
      bankBranch: profile.bankBranch !== undefined ? profile.bankBranch : existing.bankBranch,
      accountHolder: profile.accountHolder !== undefined ? profile.accountHolder : existing.accountHolder,
      accountNumber: profile.accountNumber !== undefined ? profile.accountNumber : existing.accountNumber,
      mpesaTillNumber: profile.mpesaTillNumber !== undefined ? profile.mpesaTillNumber : existing.mpesaTillNumber,
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
  async recordTombstone(
    id: string,
    key?: string,
    type: 'DOCUMENT' | 'CLIENT' | 'PAYMENT' | 'RESERVATION' | 'POS' | 'EXPENSE' | 'CATALOGUE' = 'DOCUMENT'
  ): Promise<void> {
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

    // 1. Instant L1 cache update & localStorage mirror
    this.l1Clients.set(mergedClient.id, mergedClient);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_clients', JSON.stringify(Array.from(this.l1Clients.values())));
      } catch {}
    }

    // 2. Atomic IndexedDB Local-First Persistence + Sync Queue Append
    await this.saveLocalFirst({
      entityType: 'CLIENT',
      entityId: mergedClient.id,
      storeName: 'clients',
      entity: mergedClient,
      action: 'UPSERT',
      auditDetails: `${existing ? 'Updated' : 'Created'} client profile: ${mergedClient.name} (PIN: ${mergedClient.kraPin || 'N/A'})`,
    });
  }

  async deleteClient(clientId: string): Promise<void> {
    const target = await this.getClientById(clientId);
    await this.recordTombstone(clientId, target?.name || target?.kraPin, 'CLIENT');
    if (target?.kraPin) await this.recordTombstone(clientId, target.kraPin, 'CLIENT');

    // 1. Instant L1 cache deletion & localStorage mirror
    this.l1Clients.delete(clientId);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_clients', JSON.stringify(Array.from(this.l1Clients.values())));
      } catch {}
    }

    // 2. Atomic IndexedDB Local-First Delete + Sync Queue Append
    await this.saveLocalFirst({
      entityType: 'CLIENT',
      entityId: clientId,
      storeName: 'clients',
      entity: target || { id: clientId },
      isDelete: true,
      action: 'CASCADE_DELETE_CLIENT',
      auditDetails: `Deleted client: ${target?.name || clientId}`,
    });
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

    // 1. Instant L1 cache update & localStorage mirror
    this.l1Documents.set(mergedDoc.id, mergedDoc);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_docs', JSON.stringify(Array.from(this.l1Documents.values())));
      } catch {}
    }

    // 2. Atomic IndexedDB Local-First Persistence + Sync Queue Append
    await this.saveLocalFirst({
      entityType: 'DOCUMENT',
      entityId: mergedDoc.id,
      storeName: 'documents',
      entity: mergedDoc,
      action: 'UPSERT',
      auditDetails: `${existing ? 'Updated' : 'Created'} ${mergedDoc.documentType} ${mergedDoc.documentNumber} for ${mergedDoc.clientName} (Ksh ${mergedDoc.grandTotal})`,
    });
  }

  async deleteDocument(docId: string): Promise<void> {
    const target = await this.getDocumentById(docId);
    await this.recordTombstone(docId, target?.documentNumber, 'DOCUMENT');

    // 1. Instant L1 cache removal & localStorage mirror
    this.l1Documents.delete(docId);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_docs', JSON.stringify(Array.from(this.l1Documents.values())));
      } catch {}
    }

    // 2. Atomic IndexedDB Local-First Delete + Sync Queue Append
    await this.saveLocalFirst({
      entityType: 'DOCUMENT',
      entityId: docId,
      storeName: 'documents',
      entity: target || { id: docId },
      isDelete: true,
      action: 'CASCADE_DELETE_DOCUMENT',
      auditDetails: `Deleted ${target?.documentType || 'DOCUMENT'} ${target?.documentNumber || docId}`,
    });
  }

  // --- Multi-Terminal Continuous Number Generator with Cloud Sequence Lock ---
  private cloudSequenceResolver?: (type: 'QUOTATION' | 'PROFORMA' | 'INVOICE' | 'RECEIPT') => Promise<string | null>;

  public setCloudSequenceResolver(resolver: (type: 'QUOTATION' | 'PROFORMA' | 'INVOICE' | 'RECEIPT') => Promise<string | null>) {
    this.cloudSequenceResolver = resolver;
  }

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

    let localResult = `${prefix}${String(maxNum + 1).padStart(4, '0')}`;

    // Cloud sequence check if online and configured
    if (this.cloudSequenceResolver && typeof window !== 'undefined' && navigator.onLine) {
      try {
        const cloudSeq = await this.cloudSequenceResolver(type);
        if (cloudSeq && cloudSeq.startsWith(prefix)) {
          const cloudNum = parseInt(cloudSeq.replace(prefix, ''), 10);
          if (!isNaN(cloudNum) && cloudNum > maxNum) {
            localResult = cloudSeq;
          }
        }
      } catch (err) {
        console.warn('[StorageEngine] Cloud sequence lock check skipped, using deterministic local serial:', err);
      }
    }

    return localResult;
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

    // 1. Instant L1 cache update & localStorage mirror
    this.l1Payments.set(cleanPayment.id, cleanPayment);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_payments', JSON.stringify(Array.from(this.l1Payments.values())));
      } catch {}
    }

    // 2. Atomic IndexedDB Local-First Persistence + Sync Queue Append
    await this.saveLocalFirst({
      entityType: 'PAYMENT',
      entityId: cleanPayment.id,
      storeName: 'payments',
      entity: cleanPayment,
      action: 'RECORD_PAYMENT',
      auditDetails: `Recorded payment receipt ${cleanPayment.receiptNumber} of Ksh ${cleanPayment.amount} from ${cleanPayment.clientName} (${cleanPayment.paymentMode})`,
    });

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
  }

  async deletePayment(paymentId: string): Promise<{ payment: PaymentRecord | null; updatedDoc?: BillingDocument | null }> {
    const allPayments = await this.getPayments();
    const payment = allPayments.find((p) => p.id === paymentId) || null;

    await this.recordTombstone(paymentId, payment?.receiptNumber, 'PAYMENT');

    // 1. Instant L1 cache removal & localStorage mirror
    this.l1Payments.delete(paymentId);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_payments', JSON.stringify(Array.from(this.l1Payments.values())));
      } catch {}
    }

    // 2. Atomic IndexedDB Local-First Delete + Sync Queue Append
    await this.saveLocalFirst({
      entityType: 'PAYMENT',
      entityId: paymentId,
      storeName: 'payments',
      entity: payment || { id: paymentId },
      isDelete: true,
      action: 'CASCADE_DELETE_PAYMENT',
      auditDetails: `Deleted payment receipt ${payment?.receiptNumber || paymentId}`,
    });

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

  async getPaymentById(paymentId: string): Promise<PaymentRecord | null> {
    if (this.l1Payments.has(paymentId)) {
      return { ...this.l1Payments.get(paymentId)! };
    }
    const all = await this.getPayments();
    return all.find((p) => p.id === paymentId) || null;
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

    let localResult = `REC-${String(maxNum + 1).padStart(4, '0')}`;

    if (this.cloudSequenceResolver && typeof window !== 'undefined' && navigator.onLine) {
      try {
        const cloudSeq = await this.cloudSequenceResolver('RECEIPT');
        if (cloudSeq && cloudSeq.startsWith('REC-')) {
          const cloudNum = parseInt(cloudSeq.replace('REC-', ''), 10);
          if (!isNaN(cloudNum) && cloudNum > maxNum) {
            localResult = cloudSeq;
          }
        }
      } catch (err) {
        console.warn('[StorageEngine] Cloud receipt sequence lock skipped, using deterministic local serial:', err);
      }
    }

    return localResult;
  }

  /**
   * Deterministic collision resolution: Update document and all linked dependencies
   * when cloud reconciliation assigns the next continuous chronological serial.
   */
  async handleDocumentRenumbering(originalNumber: string, newNumber: string, docId: string): Promise<void> {
    const doc = await this.getDocumentById(docId);
    if (doc) {
      const updatedDoc = { ...doc, documentNumber: newNumber };
      await this.saveDocument(updatedDoc);
    }
    // Update linked payments that referenced the contested document number
    const payments = await this.getPayments();
    for (const p of payments) {
      if (p.documentNumber === originalNumber) {
        await this.savePayment({ ...p, documentNumber: newNumber });
      }
    }
    // Record deterministic resolution in local Audit Log
    await this.recordAuditLog({
      entityType: 'DOCUMENT',
      entityId: docId,
      action: 'UPDATE',
      details: `Sequential collision resolved: Document renumbered from ${originalNumber} to continuous sequence ${newNumber}`,
      snapshot: { originalNumber, newNumber },
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('damview:data-changed'));
      window.dispatchEvent(
        new CustomEvent('damview-renumbered', { detail: { originalNumber, newNumber, docId } })
      );
    }
  }

  async handleReceiptRenumbering(originalNumber: string, newNumber: string, paymentId: string): Promise<void> {
    const payment = await this.getPaymentById(paymentId);
    if (payment) {
      const updatedPayment = { ...payment, receiptNumber: newNumber };
      await this.savePayment(updatedPayment);
    }
    await this.recordAuditLog({
      entityType: 'PAYMENT',
      entityId: paymentId,
      action: 'UPDATE',
      details: `Sequential collision resolved: Receipt renumbered from ${originalNumber} to continuous sequence ${newNumber}`,
      snapshot: { originalNumber, newNumber },
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('damview:data-changed'));
      window.dispatchEvent(
        new CustomEvent('damview-renumbered', { detail: { originalNumber, newNumber, paymentId } })
      );
    }
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
    await this.recordTombstone(id, target?.folioNumber, 'RESERVATION');
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

    await this.recordTombstone(id, target?.orderNumber, 'POS');

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
    const target = this.l1Expenses.get(id);
    await this.recordTombstone(id, target?.expenseNumber, 'EXPENSE');
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
          const cleanList = parsed.filter((c) => !c.id.match(/^cat-\d+$/));
          this.l1Catalogue.clear();
          cleanList.forEach((c) => this.l1Catalogue.set(c.id, c));
          return cleanList;
        }
      } catch {}
    }
    this.l1Catalogue.clear();
    return [];
  }

  async purgeAllCatalogueItems(): Promise<void> {
    const all = Array.from(this.l1Catalogue.values());
    for (const item of all) {
      await this.recordTombstone(item.id, item.particulars, 'CATALOGUE');
    }
    this.l1Catalogue.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem('damview_catalogue');
      } catch {}
    }
    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('catalogue')) {
        const tx = db.transaction('catalogue', 'readwrite');
        tx.objectStore('catalogue').clear();
      }
    } catch {}
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
    const target = this.l1Catalogue.get(id);
    await this.recordTombstone(id, target?.particulars, 'CATALOGUE');
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
            // Filter out any legacy demo POS items if present
            const cleanList = parsed.filter((item) => !item.id.match(/^pos-m\d+$/));
            this.l1POSMenu.clear();
            cleanList.forEach((item) => this.l1POSMenu.set(item.id, item));
            localStorage.setItem('damview_pos_menu_catalog', JSON.stringify(cleanList));
            return cleanList;
          }
        }
      } catch {}
    }
    this.l1POSMenu.clear();
    return [];
  }

  async purgeAllPOSMenuItems(): Promise<void> {
    this.l1POSMenu.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_pos_menu_catalog', JSON.stringify([]));
      } catch {}
    }
    try {
      const db = await this.init();
      if (db.objectStoreNames?.contains('pos_menu_catalog')) {
        const tx = db.transaction('pos_menu_catalog', 'readwrite');
        tx.objectStore('pos_menu_catalog').clear();
      }
    } catch {}
  }

  /**
   * Purges all demo / mock records across all operational modules (Catalogue, POS Menu, Documents, Payments, Clients, Reservations, Expenses, POS Orders)
   * while preserving the hotel's official credentials and profile settings.
   */
  async purgeAllDemoDataAcrossModules(): Promise<{ purgedModules: string[]; count: number }> {
    const purged: string[] = [];
    let count = 0;

    // 1. Purge Catalogue
    count += this.l1Catalogue.size;
    await this.purgeAllCatalogueItems();
    purged.push('Particulars & Service Catalogue');

    // 2. Purge POS Menu
    count += this.l1POSMenu.size;
    await this.purgeAllPOSMenuItems();
    purged.push('Restaurant & POS Menu Catalog');

    // 3. Clear L1 Stores & LocalStorage for transactional datasets if they contain demo entries
    const storeKeys: Array<{ key: string; store: string; map: Map<string, any>; name: string }> = [
      { key: 'damview_clients', store: 'clients', map: this.l1Clients, name: 'Clients Directory' },
      { key: 'damview_docs', store: 'documents', map: this.l1Documents, name: 'Billing Documents' },
      { key: 'damview_payments', store: 'payments', map: this.l1Payments, name: 'Payment Receipts' },
      { key: 'damview_reservations', store: 'reservations', map: this.l1Reservations, name: 'Reservations' },
      { key: 'damview_pos_orders', store: 'pos_orders', map: this.l1POSOrders, name: 'POS Orders' },
      { key: 'damview_expenses', store: 'expenses', map: this.l1Expenses, name: 'Expenses' },
      { key: 'damview_statements_v1', store: 'statements', map: this.l1Statements, name: 'Statements' },
    ];

    try {
      const db = await this.init();
      for (const item of storeKeys) {
        if (item.map.size > 0) {
          // Check if entries are demo / sample
          const entries = Array.from(item.map.values());
          const demoEntries = entries.filter((e: any) => 
            (e.id && (e.id.startsWith('demo-') || e.id.startsWith('sample-') || e.id.startsWith('mock-'))) ||
            (e.isDemo === true)
          );
          if (demoEntries.length > 0) {
            demoEntries.forEach((d: any) => item.map.delete(d.id));
            count += demoEntries.length;
            purged.push(item.name);
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                localStorage.setItem(item.key, JSON.stringify(Array.from(item.map.values())));
              } catch {}
            }
          }
        }
      }
    } catch {}

    return { purgedModules: purged, count };
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
    try {
      const db = await this.init();
      const list = await new Promise<SyncQueueItem[]>((resolve) => {
        const tx = db.transaction('sync_queue', 'readonly');
        const req = tx.objectStore('sync_queue').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      // Filter, auto-heal, and permanently purge generic/invalid queue items
      const cleanList = list.filter((q) => {
        if (!q || !q.id) return false;
        const act = String(q.action || '').trim().toUpperCase();
        if (!act || act === 'UPSERT' || act === 'CREATE' || act === 'UPDATE' || act === 'UNDEFINED' || act === 'NULL') {
          // Silently remove from persistent store
          this.removeSyncQueueItem(q.id).catch(() => {});
          return false;
        }

        // Auto-heal any legacy un-suffixed CASCADE_DELETE actions in the queue
        if (act === 'CASCADE_DELETE') {
          if (q.entityType === 'CLIENT' || (q.payload && (q.payload.clientId || q.payload.clientName))) {
            q.action = 'CASCADE_DELETE_CLIENT' as any;
          } else if (q.entityType === 'PAYMENT' || (q.payload && (q.payload.paymentId || q.payload.receiptNumber))) {
            q.action = 'CASCADE_DELETE_PAYMENT' as any;
          } else {
            q.action = 'CASCADE_DELETE_DOCUMENT' as any;
          }
          this.updateSyncQueueItem(q).catch(() => {});
        }

        return true;
      });

      this.l1SyncQueue.clear();
      cleanList.forEach((q: SyncQueueItem) => {
        if (q && q.id !== undefined) {
          this.l1SyncQueue.set(String(q.id), q);
        }
      });

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem('damview_sync_queue', JSON.stringify(cleanList));
        } catch {}
      }
      return cleanList;
    } catch {
      // Fallback L1 cache cleanup
      const cached = Array.from(this.l1SyncQueue.values());
      const cleanCached = cached.filter((q) => {
        const act = String(q.action || '').trim().toUpperCase();
        return !(!act || act === 'UPSERT' || act === 'CREATE' || act === 'UPDATE' || act === 'UNDEFINED' || act === 'NULL');
      });
      return cleanCached;
    }
  }

  async addToSyncQueue(item: Partial<SyncQueueItem> & { action?: any; payload?: any }): Promise<string> {
    const rawPayload = item.payload || {};
    let rawAction = item.action || rawPayload.action || (item as any).type || '';
    if (typeof rawAction !== 'string') {
      rawAction = String(rawAction || '');
    }
    let resolvedAction: string = rawAction.trim();
    if (!resolvedAction || resolvedAction === 'undefined' || resolvedAction === 'null' || resolvedAction === '[object Object]') {
      resolvedAction = '';
    }

    if (!resolvedAction || resolvedAction === 'UPSERT' || resolvedAction === 'CREATE' || resolvedAction === 'UPDATE') {
      if (item.entityType === 'DOCUMENT' || rawPayload.document || rawPayload.documentNumber || rawPayload.documentType) {
        resolvedAction = 'UPSERT_DOCUMENT';
      } else if (item.entityType === 'CLIENT' || rawPayload.client || rawPayload.kraPin || rawPayload.contactPerson) {
        resolvedAction = 'UPSERT_CLIENT';
      } else if (item.entityType === 'PAYMENT' || rawPayload.payment || rawPayload.receiptNumber || rawPayload.paymentMode) {
        resolvedAction = 'RECORD_PAYMENT';
      } else if (item.entityType === 'PROFILE' || rawPayload.profile || rawPayload.hotelName) {
        resolvedAction = 'UPSERT_PROFILE';
      } else if (rawPayload.tombstones) {
        resolvedAction = 'PURGE_TOMBSTONES';
      } else if (rawPayload.pdfBase64 && (rawPayload.statementNumber || rawPayload.startDate || rawPayload.endDate)) {
        resolvedAction = 'ARCHIVE_STATEMENT_PDF';
      } else if (rawPayload.pdfBase64) {
        resolvedAction = 'ARCHIVE_PDF';
      } else {
        // Discard generic UPSERT/empty actions instead of polling FULL_SYNC
        return '';
      }
    }

    // Extra safety: discard item completely if it still evaluates to generic or empty action
    const upperAction = resolvedAction.toUpperCase();
    if (!resolvedAction || upperAction === 'UPSERT' || upperAction === 'CREATE' || upperAction === 'UPDATE') {
      return '';
    } else if (
      resolvedAction === 'DELETE' ||
      resolvedAction === 'DELETE_DOCUMENT' ||
      resolvedAction === 'CASCADE_DELETE' ||
      resolvedAction === 'CASCADE_DELETE_DOCUMENT'
    ) {
      if (item.entityType === 'CLIENT' || rawPayload.clientName || rawPayload.clientId) {
        resolvedAction = 'CASCADE_DELETE_CLIENT';
      } else if (item.entityType === 'PAYMENT' || rawPayload.receiptNumber || rawPayload.paymentId) {
        resolvedAction = 'CASCADE_DELETE_PAYMENT';
      } else {
        resolvedAction = 'CASCADE_DELETE_DOCUMENT';
      }
    } else if (resolvedAction === 'DELETE_CLIENT' || resolvedAction === 'CASCADE_DELETE_CLIENT') {
      resolvedAction = 'CASCADE_DELETE_CLIENT';
    } else if (resolvedAction === 'DELETE_PAYMENT' || resolvedAction === 'CASCADE_DELETE_PAYMENT') {
      resolvedAction = 'CASCADE_DELETE_PAYMENT';
    } else if (resolvedAction === 'ARCHIVE_STATEMENT' || resolvedAction === 'STATEMENT_PDF') {
      resolvedAction = 'ARCHIVE_STATEMENT_PDF';
    }

    const queueItem: SyncQueueItem = {
      id: 'sq-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING',
      ...item,
      action: resolvedAction,
      payload: {
        ...rawPayload,
        action: resolvedAction,
      },
    };
    const stringId = String(queueItem.id);
    this.l1SyncQueue.set(stringId, queueItem);

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

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('damview:sync-queue-added', { detail: queueItem }));
      } catch {}
    }

    return stringId;
  }

  async updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
    const stringId = String(item.id || '');
    if (stringId) {
      this.l1SyncQueue.set(stringId, item);
    }

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

  async removeSyncQueueItem(id: string | number): Promise<void> {
    const stringId = String(id);
    this.l1SyncQueue.delete(stringId);

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

  // --- Immutable Audit Logging & Automated Lifecycle Pruning ---
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

        // Trigger periodic automated pruning in the background
        if (Math.random() < 0.2) {
          this.pruneAuditLogs(250).catch(() => {});
        }
      }
    } catch {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const current: AuditLogEntry[] = JSON.parse(
            localStorage.getItem('damview_audit_log') || '[]'
          );
          current.unshift(logItem);
          if (current.length > 250) current.length = 250;
          localStorage.setItem('damview_audit_log', JSON.stringify(current));
        } catch {}
      }
    }
  }

  /**
   * Automated Audit Log Pruning & Retention Management
   * Enforces retention policy, removing oldest logs to prevent unbounded storage growth.
   */
  async pruneAuditLogs(maxEntries: number = 250): Promise<{ prunedCount: number; remainingCount: number }> {
    let prunedCount = 0;
    let remainingCount = 0;

    try {
      const db = await this.init();
      if (db.objectStoreNames.contains('audit_log')) {
        const allLogs = await new Promise<AuditLogEntry[]>((resolve) => {
          const tx = db.transaction('audit_log', 'readonly');
          const req = tx.objectStore('audit_log').getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });

        if (allLogs.length > maxEntries) {
          allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          const logsToKeep = allLogs.slice(0, maxEntries);
          const logsToDelete = allLogs.slice(maxEntries);

          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('audit_log', 'readwrite');
            const store = tx.objectStore('audit_log');
            logsToDelete.forEach((log) => {
              store.delete(log.id);
            });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });

          prunedCount = logsToDelete.length;
          remainingCount = logsToKeep.length;
        } else {
          remainingCount = allLogs.length;
        }
      }
    } catch (err) {
      console.warn('[StorageEngine] Audit log prune error:', err);
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const current: AuditLogEntry[] = JSON.parse(
          localStorage.getItem('damview_audit_log') || '[]'
        );
        if (current.length > maxEntries) {
          current.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          const trimmed = current.slice(0, maxEntries);
          localStorage.setItem('damview_audit_log', JSON.stringify(trimmed));
        }
      } catch {}
    }

    return { prunedCount, remainingCount };
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

  // --- Defensive Runtime Alias Bindings for System Resilience ---
  async upsertDocument(doc: BillingDocument): Promise<void> {
    return this.saveDocument(doc);
  }
  async recordDocument(doc: BillingDocument): Promise<void> {
    return this.saveDocument(doc);
  }
  async upsertClient(client: Client): Promise<void> {
    return this.saveClient(client);
  }
  async upsertPayment(payment: PaymentRecord): Promise<any> {
    return this.savePayment(payment);
  }
  async upsertHotelProfile(profile: Partial<HotelProfile>): Promise<void> {
    return this.saveHotelProfile(profile);
  }
  async cascadeDeleteDocument(docId: string): Promise<void> {
    return this.deleteDocument(docId);
  }
  async cascadeDeleteClient(clientId: string): Promise<void> {
    return this.deleteClient(clientId);
  }
  async cascadeDeletePayment(paymentId: string): Promise<{ payment: PaymentRecord | null; updatedDoc?: BillingDocument | null }> {
    return this.deletePayment(paymentId);
  }
}

export const dbService = new StorageEngine();

export const saveLocalFirst = <T = any>(params: SaveLocalFirstParams<T>) =>
  dbService.saveLocalFirst<T>(params);
