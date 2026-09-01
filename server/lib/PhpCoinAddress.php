<?php

declare(strict_types=1);

// Standalone PHPCoin address checksum validation, matching Account::valid() in
// node/include/class/Account.php. Self-contained (not sharing WalletAuth.php's
// private base58 helpers) to avoid touching that already-verified login flow.

final class PhpCoinAddress
{
    private const CHAIN_PREFIX = '38';

    public static function isValid(string $address): bool
    {
        if ($address === '') {
            return false;
        }

        try {
            $bin = self::base58Decode($address);
        } catch (InvalidArgumentException $e) {
            return false;
        }

        $hex = bin2hex($bin);
        if (strlen($hex) < 8) {
            return false;
        }

        $checksum = substr($hex, -8);
        $base = substr($hex, 0, -8);

        if (substr($base, 0, 2) !== self::CHAIN_PREFIX) {
            return false;
        }

        $calculated = substr(hash('sha256', hash('sha256', hash('sha256', $base))), 0, 8);
        return hash_equals($calculated, $checksum);
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
}
