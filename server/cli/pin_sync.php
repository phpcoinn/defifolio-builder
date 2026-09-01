<?php

declare(strict_types=1);

// DeFiFolio pin sync worker. Runs on the IPFS host (ipfs.phpcoin.net), which
// happens to also run its own full, independently-synced mainnet PHPCoin node
// with a local database - so this reads transaction data directly from that
// local DB (no public HTTP API involved) and pins/unpins via the local IPFS
// RPC at 127.0.0.1:5001, all on one machine.
//
// Keeps IPFS storage bounded to "one pinned CID per address" for anyone who
// has signed a defifolio publish tx: each run, pin the newest CID and unpin
// whatever was pinned before it. Incremental via a small state file (last
// processed block height + per-address currently-pinned CID) instead of
// re-deriving the full history every run.
//
// Deploy: scp to this host, then cron e.g.:
//   */5 * * * * php /opt/defifolio/pin_sync.php >> /var/log/defifolio-pin-sync.log 2>&1

const NODE_ROOT = '/var/www/phpcoin-mainnet';
const IPFS_RPC_URL = 'http://127.0.0.1:5001/api/v0';
const STATE_FILE = __DIR__ . '/pin_sync_state.json';
const FIND_TX_LIMIT = 100;

require_once NODE_ROOT . '/include/init.inc.php';

function log_line(string $msg): void {
    echo '[' . gmdate('Y-m-d H:i:s') . 'Z] ' . $msg . "\n";
}

function load_state(): array {
    if (!file_exists(STATE_FILE)) {
        return ['last_height' => 0, 'pinned' => []];
    }
    $raw = file_get_contents(STATE_FILE);
    $state = json_decode($raw ?: '', true);
    if (!is_array($state)) {
        return ['last_height' => 0, 'pinned' => []];
    }
    return [
        'last_height' => (int) ($state['last_height'] ?? 0),
        'pinned' => is_array($state['pinned'] ?? null) ? $state['pinned'] : [],
    ];
}

function save_state(array $state): void {
    $tmp = STATE_FILE . '.tmp';
    file_put_contents($tmp, json_encode($state, JSON_PRETTY_PRINT));
    rename($tmp, STATE_FILE);
}

function ipfs_pin_add(string $cid): bool {
    return ipfs_rpc_post('/pin/add', $cid);
}

function ipfs_pin_rm(string $cid): bool {
    return ipfs_rpc_post('/pin/rm', $cid);
}

function ipfs_rpc_post(string $path, string $cid): bool {
    $url = IPFS_RPC_URL . $path . '?' . http_build_query(['arg' => $cid]);
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, '');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $ok = !curl_errno($ch);
    curl_close($ch);
    return $ok && $httpCode === 200 && $response !== false;
}

// Same query as the node's own Api::findTxData, run directly against the local
// DB instead of over HTTP. Returns rows with height > $sinceHeight, newest first.
function fetch_new_publishes(int $sinceHeight): array {
    global $db;

    $sql = "select td.tx_id, td.string1, t.height, t.src
            from transaction_data td
            join transactions t on t.id = td.tx_id
            where td.app = :app
              and td.action = :action
              and t.height > :sinceHeight
            order by t.height desc, td.tx_id desc";

    $rows = $db->run($sql, [
        ':app' => 'defifolio',
        ':action' => 'publish',
        ':sinceHeight' => $sinceHeight,
    ], false);

    return is_array($rows) ? $rows : [];
}

function run(): void {
    $state = load_state();
    log_line('Starting sync from height ' . $state['last_height']);

    $rows = fetch_new_publishes($state['last_height']);
    if (count($rows) === 0) {
        log_line('No new publish records.');
        return;
    }
    log_line('Found ' . count($rows) . ' new publish record(s).');

    // Rows come back newest-first; keep only each address's newest CID in this batch.
    $latestByAddress = [];
    $maxHeight = $state['last_height'];
    foreach ($rows as $row) {
        $address = $row['src'] ?? null;
        $cid = $row['string1'] ?? null;
        $height = (int) ($row['height'] ?? 0);
        $maxHeight = max($maxHeight, $height);

        if (!is_string($address) || !is_string($cid) || $cid === '') {
            continue;
        }
        if (!isset($latestByAddress[$address])) {
            $latestByAddress[$address] = $cid; // first occurrence = newest, since rows are height desc
        }
    }

    foreach ($latestByAddress as $address => $newCid) {
        $oldCid = $state['pinned'][$address] ?? null;
        if ($oldCid === $newCid) {
            continue;
        }

        log_line("Address {$address}: pinning {$newCid}" . ($oldCid ? " (was {$oldCid})" : ''));
        if (!ipfs_pin_add($newCid)) {
            log_line("  FAILED to pin {$newCid}, will retry next run");
            continue; // leave state untouched so we retry this address next run
        }

        if ($oldCid && $oldCid !== $newCid) {
            if (!ipfs_pin_rm($oldCid)) {
                log_line("  WARNING: failed to unpin old CID {$oldCid} (leaving it pinned)");
            }
        }

        $state['pinned'][$address] = $newCid;
    }

    $state['last_height'] = $maxHeight;
    save_state($state);
    log_line('Done. last_height now ' . $maxHeight);
}

run();
