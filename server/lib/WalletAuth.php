<?php

declare(strict_types=1);

// Ported from dapad-v2's apps/api/src/WalletAuth.php (same PHPCoin wallet-connect
// protocol: challenge -> wallet-signed message -> verified login -> session).
// isAllowedAuthDomain is adapted to reuse DEFIFOLIO_ALLOWED_ORIGINS instead of a
// single FRONTEND_URL, matching this app's existing multi-origin CORS allowlist.

final class WalletAuth
{
    private const SESSION_NONCE_KEY = 'defifolio_wallet_auth_nonce';
    private const SESSION_ACCOUNT_KEY = 'defifolio_wallet_account';

    public static function session(): array
    {
        $account = $_SESSION[self::SESSION_ACCOUNT_KEY] ?? null;

        if (!is_array($account)) {
            return [
                'authenticated' => false,
            ];
        }

        return [
            'authenticated' => true,
            'account' => $account,
        ];
    }

    public static function issueChallenge(): array
    {
        $nonce = bin2hex(random_bytes(16));

        $_SESSION[self::SESSION_NONCE_KEY] = [
            'nonce' => $nonce,
            'issued_at' => (int) round(microtime(true) * 1000),
        ];

        return [
            'nonce' => $nonce,
            'issued_at' => $_SESSION[self::SESSION_NONCE_KEY]['issued_at'],
            'expires_in_ms' => self::authMaxAgeMs(),
        ];
    }

    public static function loginWithWallet(array $input): array
    {
        $challenge = $_SESSION[self::SESSION_NONCE_KEY] ?? null;
        if (!is_array($challenge) || empty($challenge['nonce'])) {
            throw new RuntimeException('Missing auth challenge. Start login again.');
        }

        $message = trim((string) ($input['message'] ?? ''));
        $signature = trim((string) ($input['signature'] ?? ''));
        $publicKey = trim((string) ($input['publicKey'] ?? $input['public_key'] ?? ''));
        $address = trim((string) ($input['address'] ?? ''));

        if ($message === '' || $signature === '' || $publicKey === '' || $address === '') {
            throw new InvalidArgumentException('Missing wallet auth fields.');
        }

        $decodedMessage = json_decode($message, true);
        if (!is_array($decodedMessage)) {
            throw new InvalidArgumentException('Invalid auth message.');
        }

        $domain = trim((string) ($decodedMessage['domain'] ?? ''));
        $nonce = trim((string) ($decodedMessage['nonce'] ?? ''));
        $messageAddress = trim((string) ($decodedMessage['address'] ?? ''));
        $issuedAt = (int) ($decodedMessage['issued_at'] ?? 0);

        if ($domain === '' || $nonce === '' || $messageAddress === '' || $issuedAt <= 0) {
            throw new InvalidArgumentException('Incomplete auth message.');
        }

        if (!self::isAllowedAuthDomain($domain)) {
            throw new RuntimeException('Auth domain mismatch.');
        }

        if (!hash_equals((string) $challenge['nonce'], $nonce)) {
            throw new RuntimeException('Auth nonce mismatch.');
        }

        $ageMs = abs((int) round(microtime(true) * 1000) - $issuedAt);
        if ($ageMs > self::authMaxAgeMs()) {
            throw new RuntimeException('Auth request expired.');
        }

        if (!hash_equals($messageAddress, $address)) {
            throw new RuntimeException('Auth address mismatch.');
        }

        $derivedAddress = self::getAddressFromPublicKey($publicKey);
        if (!hash_equals($derivedAddress, $address)) {
            throw new RuntimeException('Address does not match public key.');
        }

        $canonicalMessage = json_encode([
            'domain' => $domain,
            'address' => $address,
            'nonce' => $nonce,
            'issued_at' => $issuedAt,
        ], JSON_UNESCAPED_SLASHES);

        if (!is_string($canonicalMessage) || !hash_equals($canonicalMessage, $message)) {
            throw new RuntimeException('Auth message is not canonical.');
        }

        if (!self::verifyRawSignature($canonicalMessage, $signature, $publicKey)) {
            throw new RuntimeException('Invalid wallet signature.');
        }

        $account = [
            'address' => $address,
            'public_key' => $publicKey,
            'login_at' => gmdate(DATE_ATOM),
            'auth_domain' => $domain,
        ];

        $_SESSION[self::SESSION_ACCOUNT_KEY] = $account;
        unset($_SESSION[self::SESSION_NONCE_KEY]);

        return $account;
    }

    public static function logout(): array
    {
        unset($_SESSION[self::SESSION_ACCOUNT_KEY], $_SESSION[self::SESSION_NONCE_KEY]);

        return [
            'logged_out' => true,
        ];
    }

    public static function authMaxAgeMs(): int
    {
        $value = getenv('AUTH_MAX_AGE_MS');
        $parsed = is_string($value) ? (int) $value : 120000;

        return $parsed > 0 ? $parsed : 120000;
    }

    private static function isAllowedAuthDomain(string $domain): bool
    {
        $allowed = defined('DEFIFOLIO_ALLOWED_ORIGINS') ? DEFIFOLIO_ALLOWED_ORIGINS : [];
        return in_array($domain, $allowed, true);
    }

    private static function verifyRawSignature(string $message, string $signature, string $publicKey): bool
    {
        $publicKeyPem = self::coinToPem($publicKey);
        $signatureBin = self::base58Decode($signature);

        $key = openssl_pkey_get_public($publicKeyPem);
        if ($key === false) {
            return false;
        }

        return openssl_verify($message, $signatureBin, $key, OPENSSL_ALGO_SHA256) === 1;
    }

    private static function getAddressFromPublicKey(string $publicKey): string
    {
        $hash1 = hash('sha256', $publicKey);
        $hash2 = hash('ripemd160', $hash1);
        $baseAddress = '38' . $hash2;
        $checksum = substr(hash('sha256', hash('sha256', hash('sha256', $baseAddress))), 0, 8);

        return self::base58Encode(hex2bin($baseAddress . $checksum));
    }

    private static function coinToPem(string $data): string
    {
        $decoded = self::base58Decode($data);
        $base64 = chunk_split(base64_encode($decoded), 64, "\n");

        return "-----BEGIN PUBLIC KEY-----\n" . $base64 . "-----END PUBLIC KEY-----\n";
    }

    private static function base58Decode(string $input): string
    {
        $alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        $indexes = array_flip(str_split($alphabet));
        $bytes = [0];

        foreach (str_split($input) as $char) {
            if (!isset($indexes[$char])) {
                throw new InvalidArgumentException('Invalid Base58 string.');
            }

            $carry = $indexes[$char];

            for ($i = 0, $size = count($bytes); $i < $size; $i++) {
                $carry += $bytes[$i] * 58;
                $bytes[$i] = $carry & 0xff;
                $carry >>= 8;
            }

            while ($carry > 0) {
                $bytes[] = $carry & 0xff;
                $carry >>= 8;
            }
        }

        $result = '';
        foreach (str_split($input) as $char) {
            if ($char !== '1') {
                break;
            }
            $result .= "\x00";
        }

        for ($i = count($bytes) - 1; $i >= 0; $i--) {
            $result .= chr($bytes[$i]);
        }

        return $result;
    }

    private static function base58Encode(string $input): string
    {
        if ($input === '') {
            return '';
        }

        $alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        $bytes = array_values(unpack('C*', $input));
        $digits = [0];

        foreach ($bytes as $byte) {
            $carry = $byte;

            for ($i = 0, $size = count($digits); $i < $size; $i++) {
                $carry += $digits[$i] << 8;
                $digits[$i] = $carry % 58;
                $carry = intdiv($carry, 58);
            }

            while ($carry > 0) {
                $digits[] = $carry % 58;
                $carry = intdiv($carry, 58);
            }
        }

        $result = '';
        foreach ($bytes as $byte) {
            if ($byte !== 0) {
                break;
            }
            $result .= '1';
        }

        for ($i = count($digits) - 1; $i >= 0; $i--) {
            $result .= $alphabet[$digits[$i]];
        }

        return $result;
    }
}
