const DB_NAME = "marquee-scanner";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("tickets")) {
        db.createObjectStore("tickets", { keyPath: "qrToken" });
      }
      if (!db.objectStoreNames.contains("syncQueue")) {
        db.createObjectStore("syncQueue", { keyPath: "clientScanId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Replaces the entire cached ticket list (called after fetching a fresh manifest). */
export async function saveManifest(tickets) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tickets", "readwrite");
    const store = tx.objectStore("tickets");
    store.clear();
    for (const ticket of tickets) store.put(ticket);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalTicket(qrToken) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tickets", "readonly");
    const req = tx.objectStore("tickets").get(qrToken);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function markLocalTicketUsed(qrToken) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tickets", "readwrite");
    const store = tx.objectStore("tickets");
    const getReq = store.get(qrToken);
    getReq.onsuccess = () => {
      const ticket = getReq.result;
      if (ticket) store.put({ ...ticket, status: "USED" });
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function queueScan(scan) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("syncQueue", "readwrite");
    tx.objectStore("syncQueue").put(scan);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedScans() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("syncQueue", "readonly");
    const req = tx.objectStore("syncQueue").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function clearQueuedScan(clientScanId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("syncQueue", "readwrite");
    tx.objectStore("syncQueue").delete(clientScanId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function queuedScanCount() {
  const scans = await getQueuedScans();
  return scans.length;
}
