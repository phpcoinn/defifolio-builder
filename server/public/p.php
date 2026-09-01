<?php

// Public profile router: defifolio.dap.ad/p/<address> -> the latest DeFiFolio
// profile that address has published, resolved live from the blockchain and
// proxied through so the URL stays stable across every future republish.
//
// Route wiring: nginx rewrites /p/<address> to this script with the address
// in $_GET['address'] (see server/router.php for the local dev equivalent).
//
// No caching layer yet: every request does a live findTxData lookup + a live
// gateway fetch. Fine at current volume; if this route gets busy, cache the
// resolved CID per address (Redis or APCu, short TTL) to cut both round trips.

require_once __DIR__ . '/../lib/PhpCoinAddress.php';
require_once __DIR__ . '/../lib/rate_limit.php';

const NODE_API_URL = 'https://main1.phpcoin.net/api.php';
const IPFS_GATEWAY_URL = 'https://ipfs.phpcoin.net/ipfs/';

function render_not_found(string $message): void {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    $safe = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    echo "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Profile not found - DeFiFolio</title></head>"
        . "<body style=\"font-family:sans-serif;text-align:center;padding:4rem 1rem;\">"
        . "<h1>Profile not found</h1><p>{$safe}</p>"
        . "<p><a href=\"https://defifolio.dap.ad\">Build your own DeFiFolio profile</a></p>"
        . "</body></html>";
    exit;
}

function find_latest_publish(string $address): ?string {
    $url = NODE_API_URL . '?' . http_build_query([
        'q' => 'findTxData',
        'app' => 'defifolio',
        'action' => 'publish',
        'src' => $address,
        'limit' => 1,
    ]);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response ?: '', true);
    $cid = $data['data'][0]['string1'] ?? null;
    return is_string($cid) && $cid !== '' ? $cid : null;
}

$address = trim((string) ($_GET['address'] ?? ''));

// Future improvement: accept a partial/prefix address (e.g. /p/Pbv3LdEUr55QfA)
// for shorter shareable links, resolving it as long as the prefix uniquely
// matches exactly one address that has published - ambiguous prefixes should
// still fail rather than guess. Requires a prefix-capable lookup (checksum
// validation alone won't work on a truncated address), not just this check.
if (!PhpCoinAddress::isValid($address)) {
    render_not_found('That doesn\'t look like a valid PHPCoin address.');
}

rate_limit('p_router', 60, 60);

$cid = find_latest_publish($address);
if ($cid === null) {
    render_not_found('This address hasn\'t published a DeFiFolio profile yet.');
}

// Proxy the resolved profile content so the stable /p/<address> URL is what
// stays in the visitor's browser, not the underlying (ever-changing) CID.
$ch = curl_init(IPFS_GATEWAY_URL . rawurlencode($cid));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
$content = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$content) {
    http_response_code(502);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Could not load this profile right now. Please try again shortly.';
    exit;
}

header('Content-Type: text/html; charset=utf-8');
echo $content;
