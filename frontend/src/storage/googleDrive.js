// Google Drive persistence via Google Identity Services (client-side token flow)
// + the Drive REST API. Stores one JSON file of the user's positions in their
// own Drive. Scope is drive.file, so this app can only ever see files IT created.
//
// The Client ID below is PUBLIC config (not a secret) — it's locked to this app's
// authorized JavaScript origins. Safe to commit. There is no client secret in a
// client-side token flow.

const CLIENT_ID =
  "406072501862-6albj6a2cnajv6deoo63g9rnn275enfl.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FILE_NAME = "optionality-positions.json";
const FOLDER_NAME = "Optionality";
const FOLDER_MIME = "application/vnd.google-apps.folder";

let accessToken = null;

export const isConnected = () => accessToken != null;

// Open Google's sign-in/consent popup and capture an access token for this session.
export function connectDrive() {
  return new Promise((resolve, reject) => {
    const gis = window.google?.accounts?.oauth2;
    if (!gis) {
      reject(new Error("Google sign-in isn't loaded yet — try again in a moment."));
      return;
    }
    const client = gis.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        accessToken = resp.access_token;
        resolve(accessToken);
      },
    });
    client.requestAccessToken({ prompt: "" });
  });
}

const authHeaders = () => ({ Authorization: "Bearer " + accessToken });

// Find the app's "Optionality" folder (null if it doesn't exist yet).
async function findFolderId() {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`
  );
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id)`,
    { headers: authHeaders() }
  );
  if (!r.ok) throw new Error("Drive lookup failed (" + r.status + ")");
  const j = await r.json();
  return j.files && j.files[0] ? j.files[0].id : null;
}

// Find the folder, creating it if needed (used on save).
async function ensureFolderId() {
  const existing = await findFolderId();
  if (existing) return existing;
  const r = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  if (!r.ok) throw new Error("Drive folder create failed (" + r.status + ")");
  return (await r.json()).id;
}

// Find the positions file inside the given folder (null if not there).
async function findFileId(folderId) {
  const q = encodeURIComponent(
    `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`
  );
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id)`,
    { headers: authHeaders() }
  );
  if (!r.ok) throw new Error("Drive lookup failed (" + r.status + ")");
  const j = await r.json();
  return j.files && j.files[0] ? j.files[0].id : null;
}

// Returns the array of saved positions (empty if none yet).
export async function loadPositions() {
  const folderId = await findFolderId();
  if (!folderId) return [];
  const id = await findFileId(folderId);
  if (!id) return [];
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
    { headers: authHeaders() }
  );
  if (!r.ok) return [];
  try {
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Writes the positions array into the Optionality folder, creating both on first save.
export async function savePositions(positions) {
  const body = JSON.stringify(positions, null, 2);
  const folderId = await ensureFolderId();
  const id = await findFileId(folderId);
  if (id) {
    const r = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
      { method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" }, body }
    );
    if (!r.ok) throw new Error("Drive save failed (" + r.status + ")");
  } else {
    const boundary = "optionality" + Date.now();
    const metadata = { name: FILE_NAME, mimeType: "application/json", parents: [folderId] };
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      body +
      `\r\n--${boundary}--`;
    const r = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "multipart/related; boundary=" + boundary },
        body: multipart,
      }
    );
    if (!r.ok) throw new Error("Drive create failed (" + r.status + ")");
  }
}
