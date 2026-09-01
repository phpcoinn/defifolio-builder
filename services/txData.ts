// Builds a PHPCoin TX_TYPE_DATA "publish" transaction and its signature base,
// mirroring node/include/class/Transaction.php exactly (getSignatureBase,
// buildCanonicalTxDataPayloadString, normalizeTxDataPayloadForSignature) and
// node/include/coinspec.inc.php (TX_TYPE_DATA=10, TX_DATA_FEE=1 on mainnet).
// The node re-derives this same base server-side to verify the wallet's
// signature, so any mismatch here makes the signature invalid.

const TX_TYPE_DATA = 10;
const TX_DATA_FEE = 1; // mainnet
const PROFILE_SCHEMA_VERSION = 1;
export const CHAIN_ID = '00'; // mainnet
export const NODE_API_URL = 'https://main1.phpcoin.net/api.php';

// The node requires `dst` to be a valid address different from `src` for TX_TYPE_DATA
// transactions (a plain self-send or null destination is rejected), even though val=0
// means nothing is actually transferred. This is DeFiFolio's own dedicated address,
// used only as that nominal destination.
const DEFIFOLIO_SERVICE_ADDRESS = import.meta.env.VITE_DEFIFOLIO_SERVICE_ADDRESS || '';

// Canonical field order from Transaction::$txDataFieldOrder - must match exactly.
const TX_DATA_FIELD_ORDER = [
  'app', 'action', 'string1', 'string2', 'int1', 'int2',
  'float1', 'float2', 'address1', 'address2', 'json_data',
] as const;

interface TxDataPayload {
  app: string;
  action: string;
  string1?: string | null;
  int1?: number;
}

export interface UnsignedTransaction {
  val: number;
  fee: number;
  dst: string;
  msg: string | null;
  type: number;
  date: number;
  public_key: string;
  src: string;
  tx_data: string;
}

function buildCanonicalTxDataPayloadString(payload: TxDataPayload): string {
  const source = payload as unknown as Record<string, unknown>;
  const canonical: Record<string, unknown> = {};
  for (const field of TX_DATA_FIELD_ORDER) {
    const value = source[field];
    canonical[field] = value === undefined ? null : value;
  }
  return JSON.stringify(canonical);
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const num8 = (n: number) => n.toFixed(8);

async function getSignatureBase(tx: UnsignedTransaction, txDataPayload: TxDataPayload): Promise<string> {
  const canonicalPayload = buildCanonicalTxDataPayloadString(txDataPayload);
  const txDataHash = await sha256Hex(canonicalPayload);

  const parts = [
    num8(tx.val),
    num8(tx.fee),
    tx.dst == null ? '' : tx.dst,
    tx.msg == null ? '' : tx.msg,
    String(tx.type),
    tx.public_key,
    String(tx.date),
    txDataHash,
  ];
  return parts.join('-');
}

export async function buildPublishTransaction(address: string, publicKey: string, cid: string) {
  if (!DEFIFOLIO_SERVICE_ADDRESS) {
    throw new Error('DeFiFolio service address is not configured (VITE_DEFIFOLIO_SERVICE_ADDRESS).');
  }
  if (DEFIFOLIO_SERVICE_ADDRESS === address) {
    throw new Error('The service address cannot be your own address.');
  }

  const payload: TxDataPayload = {
    app: 'defifolio',
    action: 'publish',
    string1: cid,
    int1: PROFILE_SCHEMA_VERSION,
  };

  const tx: UnsignedTransaction = {
    val: 0,
    fee: TX_DATA_FEE,
    dst: DEFIFOLIO_SERVICE_ADDRESS,
    msg: null,
    type: TX_TYPE_DATA,
    date: Math.floor(Date.now() / 1000),
    public_key: publicKey,
    src: address,
    tx_data: buildCanonicalTxDataPayloadString(payload),
  };

  const signatureBase = await getSignatureBase(tx, payload);
  return { tx, signatureBase };
}

export interface PublishRecord {
  txId: string;
  cid: string;
}

// Looks up the newest confirmed "defifolio publish" tx_data event for this address,
// i.e. whatever /p/<address> would currently resolve to. Returns null if the address
// has never published one.
export async function findLatestPublish(address: string): Promise<PublishRecord | null> {
  const query = new URLSearchParams({ q: 'findTxData', app: 'defifolio', action: 'publish', src: address, limit: '1' });
  const response = await fetch(`${NODE_API_URL}?${query.toString()}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.status === 'error') {
    throw new Error(payload.data || payload.message || 'Failed to look up existing publish record');
  }

  const row = payload.data?.[0];
  if (!row || !row.string1) return null;
  return { txId: row.tx_id, cid: row.string1 };
}

export async function submitTransaction(signedTransaction: Record<string, unknown>): Promise<string> {
  const response = await fetch(`${NODE_API_URL}?q=sendTransactionJson`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signedTransaction),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status === 'error') {
    throw new Error(payload.data || payload.message || 'Failed to submit transaction');
  }
  return payload.data as string; // transaction id
}
