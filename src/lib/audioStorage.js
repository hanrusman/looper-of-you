/**
 * IndexedDB storage for audio files (MP3/WAV).
 * Zustand persist can't handle large binary blobs, so we use IndexedDB directly.
 *
 * Each song stores its audio under key = songId.
 */

const DB_NAME = 'akkoordenboek-audio';
const STORE_NAME = 'files';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
  });
}

/**
 * Save an audio file for a song.
 * @param {string} songId
 * @param {ArrayBuffer} arrayBuffer - Raw audio file data
 * @param {string} fileName - Original file name
 * @param {string} mimeType - MIME type (e.g. 'audio/mpeg')
 */
export async function saveAudioFile(songId, arrayBuffer, fileName, mimeType) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ arrayBuffer, fileName, mimeType }, songId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Load an audio file for a song.
 * @param {string} songId
 * @returns {Promise<{ arrayBuffer: ArrayBuffer, fileName: string, mimeType: string } | null>}
 */
export async function loadAudioFile(songId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(songId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete an audio file for a song.
 * @param {string} songId
 */
export async function deleteAudioFile(songId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(songId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Create a blob URL from stored audio data.
 * Caller is responsible for revoking the URL when done.
 * @param {string} songId
 * @returns {Promise<string | null>} - Blob URL or null
 */
export async function getAudioBlobUrl(songId) {
  const data = await loadAudioFile(songId);
  if (!data) return null;
  const blob = new Blob([data.arrayBuffer], { type: data.mimeType });
  return URL.createObjectURL(blob);
}
