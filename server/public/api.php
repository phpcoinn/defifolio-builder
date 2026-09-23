<?php

// scp /home/marko/web/phpcoin/node/dev/dapad/ipfs.php phpcoin3:/var/www/dap.ad/ipfs.php
// https://dap.ad/ipfs.php?q=publish_ipfs

header('Content-Type: application/json');

// Only allow the known frontend origins, not the whole internet.
define('DEFIFOLIO_ALLOWED_ORIGINS', [
    'http://localhost:5173',
    'http://localhost:8034',
    'https://defifolio.dap.ad',
]);
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, DEFIFOLIO_ALLOWED_ORIGINS, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true'); // needed for the wallet-login session cookie
}
header('Vary: Origin');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();
require_once __DIR__ . '/../lib/WalletAuth.php';
require_once __DIR__ . '/../lib/rate_limit.php';

function publish_ipfs() {
    rate_limit('publish_ipfs', 20, 60);

    $data = _getJsonData();
    $html = $data['html'] ?? '';
    if (empty($html)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing html']);
        exit;
    }

    $tmpFile = tempnam(sys_get_temp_dir(), 'ipfs');
    file_put_contents($tmpFile, $html);

    // Free tier: upload through the public dap.ad IPFS uploader (unauthenticated,
    // 10MB cap, not pinned) rather than talking to an IPFS node directly.
    $url = 'https://upload.ipfs.phpcoin.net/api.php?q=upload';
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, [
        'file' => new CURLFile($tmpFile, 'text/html', 'index.html'),
        'free_upload' => '1',
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    unlink($tmpFile);

    if ($curlError) {
        throw new Exception("Failed to reach IPFS uploader: $curlError");
    }

    $result = json_decode($response, true);
    if ($httpCode !== 200 || !$result || empty($result['cid'])) {
        throw new Exception('IPFS upload failed: ' . ($result['error'] ?? "HTTP $httpCode"));
    }

    return ["ipfsCID" => $result['cid']];
}

// Proxies a profile HTML fetch from our IPFS gateway. Needed because the
// gateway's CORS policy only allows admin.ipfs.phpcoin.net, so the browser
// can't fetch it directly from defifolio.dap.ad - this sidesteps that
// entirely, since CORS is a browser-only restriction.
function fetch_profile_html() {
    rate_limit('fetch_profile_html', 30, 60);

    $data = _getJsonData();
    $cid = trim((string) ($data['cid'] ?? ''));
    if ($cid === '' || !preg_match('/^[a-zA-Z0-9]+$/', $cid)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid cid']);
        exit;
    }

    $url = 'https://ipfs.phpcoin.net/ipfs/' . rawurlencode($cid);
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    $content = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        throw new Exception("Failed to reach IPFS gateway: $curlError");
    }
    if ($httpCode !== 200 || !$content) {
        throw new Exception("Could not fetch profile content (HTTP $httpCode)");
    }

    return ['html' => $content];
}

function authSession() {
    return WalletAuth::session();
}

function authChallenge() {
    return WalletAuth::issueChallenge();
}

function walletLogin() {
    $data = _getJsonData();
    return WalletAuth::loginWithWallet($data ?: []);
}

function authLogout() {
    return WalletAuth::logout();
}

function track_event() {
    rate_limit('track_event', 120, 60);

    $data = _getJsonData();
    $event = is_array($data) && isset($data['event']) && is_string($data['event'])
        ? $data['event']
        : '';
    $allowedEvents = [
        'app_opened',
        'editor_started',
        'profile_imported',
        'html_exported',
        'ai_bio_generated',
        'ai_analysis_generated',
        'publish_success',
        'wallet_login_success',
        'permanent_link_success',
        'save_changes_success',
    ];

    if (!in_array($event, $allowedEvents, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid activity event']);
        exit;
    }

    $session = isset($data['session']) && is_string($data['session']) ? strtolower($data['session']) : '';
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $session)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid activity session']);
        exit;
    }

    $sanitizeTag = static function ($value): ?string {
        if (!is_string($value)) return null;
        $value = strtolower(trim($value));
        return preg_match('/^[a-z0-9._-]{1,64}$/', $value) ? $value : null;
    };
    $source = $sanitizeTag($data['source'] ?? null);
    $campaign = $sanitizeTag($data['campaign'] ?? null);

    $referrer = isset($data['referrer']) && is_string($data['referrer'])
        ? strtolower(trim($data['referrer']))
        : '';
    if (!preg_match('/^(?=.{1,253}$)[a-z0-9.-]+$/', $referrer)) {
        $referrer = null;
    }

    $userAgent = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
    $device = preg_match('/mobile|android|iphone|ipad|ipod/i', $userAgent) ? 'mobile' : 'desktop';
    $isBot = $userAgent === '' || (bool) preg_match(
        '/bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headlesschrome|lighthouse|curl|wget/i',
        $userAgent
    );

    $secretFile = getenv('DEFIFOLIO_ACTIVITY_HMAC_KEY_FILE') ?: '/var/lib/defifolio/activity_hmac_key';
    $secret = is_file($secretFile) ? trim((string) file_get_contents($secretFile)) : '';
    if ($secret === '') {
        throw new RuntimeException('Activity logger is not configured');
    }
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $visitor = substr(hash_hmac('sha256', $ip . "\n" . $userAgent, $secret), 0, 20);

    $logDir = getenv('DEFIFOLIO_ACTIVITY_LOG_DIR') ?: '/var/log/defifolio';
    $logFile = $logDir . '/activity-' . gmdate('Y-m-d') . '.jsonl';
    $record = [
        'time' => gmdate('c'),
        'event' => $event,
        'session' => $session,
        'visitor' => $visitor,
        'device' => $device,
        'bot' => $isBot,
    ];
    if ($source !== null) $record['source'] = $source;
    if ($campaign !== null) $record['campaign'] = $campaign;
    if ($referrer !== null) $record['referrer'] = $referrer;
    $line = json_encode($record, JSON_UNESCAPED_SLASHES) . "\n";

    if (!is_dir($logDir) || file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX) === false) {
        throw new RuntimeException('Could not write activity log');
    }

    // Daily files make retention cheap: opportunistically remove anything older
    // than the temporary promotion-tracking window on every successful event.
    $retentionCutoff = time() - (30 * 86400);
    foreach (glob($logDir . '/activity-*.jsonl') ?: [] as $candidate) {
        if (is_file($candidate) && filemtime($candidate) < $retentionCutoff) {
            unlink($candidate);
        }
    }

    return ['success' => true];
}

function generate_bio() {
    rate_limit('generate_bio', 10, 60);
    $profile = _getProfileData();

    $networkSummary = '';
    if (isset($profile['addresses']) && is_array($profile['addresses'])) {
        $networks = array_map(function($a) { return $a['network']; }, $profile['addresses']);
        $networkSummary = implode(', ', $networks);
    }

    $name = $profile['name'] ?? 'User';
    $title = $profile['title'] ?? '';

    $prompt = "Generate a short, engaging, and professional crypto twitter-style bio (max 200 chars) for a user named \"{$name}\".\n\nContext:\n- Title: {$title}\n- Active on networks: {$networkSummary}\n- Vibe: Web3 native, forward-thinking, privacy-focused.\n\nJust return the bio text, no quotes or explanations.";

    _callGeminiApi($prompt);
}

function analyze_portfolio() {
    rate_limit('analyze_portfolio', 10, 60);
    $profile = _getProfileData();
    $chainDetails = '';
    if (isset($profile['addresses']) && is_array($profile['addresses'])) {
        $details = array_map(function($a) {
            $label = $a['label'] ?? '';
            $net = $a['network'] ?? 'Unknown';
            return "{$net} ({$label})";
        }, $profile['addresses']);
        $chainDetails = implode(', ', $details);
    }

    $prompt = "Analyze this crypto profile based on their chain selection and give a 1-sentence \"vibe check\". \nAre they a maxi? A multi-chain degen? A privacy advocate?\n\nChains/Wallets:\n{$chainDetails}";
    _callGeminiApi($prompt);
}

function _getJsonData() {
    return json_decode(file_get_contents('php://input'), true);
}

function _getProfileData() {
    // 3. Get Input
    $inputJSON = file_get_contents('php://input');
    $input = json_decode($inputJSON, true);

    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON input']);
        exit;
    }

    $profile = $input['profile'] ?? null;

    if (!$profile) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing profile data']);
        exit;
    }

    return $profile;
}

function _getGeminiApiKey() {
    // Prefer a local, non-committed key file scoped to this app (avoids touching
    // the shared PHP-FPM pool config, which every vhost on this host uses).
    $keyFile = __DIR__ . '/../lib/gemini_api_key.txt';
    if (file_exists($keyFile)) {
        $key = trim((string) file_get_contents($keyFile));
        if ($key !== '') {
            return $key;
        }
    }
    return getenv('GEMINI_API_KEY') ?: '';
}

function _callGeminiApi($prompt) {

    $apiKey = _getGeminiApiKey();
    if (empty($apiKey)) {
        http_response_code(500);
        echo json_encode(['error' => 'Server configuration error: API Key not set.']);
        exit;
    }

    // 4. Construct Prompt based on Action
    $model = 'gemini-2.5-flash';

    // 5. Call Google Gemini API
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

    $data = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $prompt]
                ]
            ]
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if (curl_errno($ch)) {
        http_response_code(500);
        echo json_encode(['error' => 'Curl error: ' . curl_error($ch)]);
        curl_close($ch);
        exit;
    }

    curl_close($ch);

    // 6. Process Response
    $responseData = json_decode($response, true);

    if ($httpCode !== 200) {
        http_response_code($httpCode);
        echo json_encode(['error' => 'Gemini API Error', 'details' => $responseData]);
        exit;
    }

    // Extract text
    $generatedText = $responseData['candidates'][0]['content']['parts'][0]['text'] ?? '';

    // 7. Return Result
    header('Content-Type: application/json');
    echo json_encode(['text' => trim($generatedText)]);
    exit;
}

$q = isset($_GET['q']) && is_string($_GET['q']) ? $_GET['q'] : '';
$actions = [
    'publish_ipfs' => 'publish_ipfs',
    'fetch_profile_html' => 'fetch_profile_html',
    'authSession' => 'authSession',
    'authChallenge' => 'authChallenge',
    'walletLogin' => 'walletLogin',
    'authLogout' => 'authLogout',
    'track_event' => 'track_event',
    'generate_bio' => 'generate_bio',
    'analyze_portfolio' => 'analyze_portfolio',
];

if (!isset($actions[$q])) {
    http_response_code(400);
    error_log('Unknown API action: ' . $q);
    echo json_encode(['success' => false, 'error' => 'Unknown API action']);
    exit;
}

try {
    $data = call_user_func($actions[$q]);
    echo json_encode($data);
} catch (Throwable $e) {
    error_log('DeFiFolio API error [' . $q . ']: ' . $e);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Request failed']);
}
