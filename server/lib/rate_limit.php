<?php

// Basic per-IP rate limit to blunt automated abuse. Not a substitute for real
// auth, just cheap insurance for a proof-of-concept backend. Shared by api.php
// and p.php.
function rate_limit($action, $limit, $windowSeconds) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = sys_get_temp_dir() . '/defifolio_rl_' . md5($action . '|' . $ip) . '.json';

    $fh = fopen($file, 'c+');
    if (!$fh) {
        return; // fail open rather than break the endpoint
    }
    flock($fh, LOCK_EX);

    $raw = stream_get_contents($fh);
    $requests = $raw ? (json_decode($raw, true) ?: []) : [];
    $now = time();
    $requests = array_values(array_filter($requests, function ($t) use ($now, $windowSeconds) {
        return $t > $now - $windowSeconds;
    }));

    if (count($requests) >= $limit) {
        flock($fh, LOCK_UN);
        fclose($fh);
        http_response_code(429);
        echo json_encode(['error' => 'Rate limit exceeded. Please try again shortly.']);
        exit;
    }

    $requests[] = $now;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($requests));
    flock($fh, LOCK_UN);
    fclose($fh);
}
