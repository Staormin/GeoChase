/**
 * IndexedDB service for storing PDF files
 * Uses IndexedDB instead of localStorage to support larger files (50MB+)
 */

const DB_NAME = 'geochase_pdf_storage';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

interface PdfRecord {
  projectId: string;
  data: string; // Base64 encoded PDF
  name: string;
  password?: string;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open/create the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    /* istanbul ignore next -- @preserve defensive error handler */
    request.addEventListener('error', () => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    });

    request.addEventListener('success', () => {
      resolve(request.result);
    });

    request.addEventListener('upgradeneeded', (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      /* istanbul ignore else -- @preserve store always created on first open */
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
      }
    });
  });

  return dbPromise;
}

/**
 * Save PDF data for a project
 */
export async function savePdf(
  projectId: string,
  data: string,
  name: string,
  password?: string
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record: PdfRecord = {
      projectId,
      data,
      name,
      password,
      updatedAt: Date.now(),
    };

    const request = store.put(record);

    /* istanbul ignore next -- @preserve defensive error handler */
    request.addEventListener('error', () => {
      console.error('Failed to save PDF:', request.error);
      reject(request.error);
    });

    request.addEventListener('success', () => {
      resolve();
    });
  });
}

/**
 * Get PDF data for a project
 */
export async function getPdf(
  projectId: string
): Promise<{ data: string; name: string; password?: string } | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(projectId);

    /* istanbul ignore next -- @preserve defensive error handler */
    request.addEventListener('error', () => {
      console.error('Failed to get PDF:', request.error);
      reject(request.error);
    });

    request.addEventListener('success', () => {
      const record = request.result as PdfRecord | undefined;
      if (record) {
        resolve({
          data: record.data,
          name: record.name,
          password: record.password,
        });
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Delete PDF data for a project
 */
export async function deletePdf(projectId: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(projectId);

    /* istanbul ignore next -- @preserve defensive error handler */
    request.addEventListener('error', () => {
      console.error('Failed to delete PDF:', request.error);
      reject(request.error);
    });

    request.addEventListener('success', () => {
      resolve();
    });
  });
}

/**
 * Check if a project has a PDF stored
 */
export async function hasPdf(projectId: string): Promise<boolean> {
  const pdf = await getPdf(projectId);
  return pdf !== null;
}

/**
 * Update only the password for a PDF
 */
export async function updatePdfPassword(
  projectId: string,
  password: string | null
): Promise<boolean> {
  const pdf = await getPdf(projectId);
  if (!pdf) {
    return false;
  }

  await savePdf(projectId, pdf.data, pdf.name, password ?? undefined);
  return true;
}
