<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class DefaultAdminAccount
{
    public const EMAIL = 'admin@bitemap.local';

    public const PASSWORD = 'password';

    public const NAME = 'System Administrator';

    public const PHONE = '09170000000';

    public const ROLE = 'system_admin';

    public static function shouldRepairForLogin(string $email, string $password): bool
    {
        return app()->environment(['local', 'testing'])
            && strtolower(trim($email)) === self::EMAIL
            && hash_equals(self::PASSWORD, $password);
    }

    public static function reset(): User
    {
        $values = [
            'name' => self::NAME,
            'password' => Hash::make(self::PASSWORD),
            'role' => self::ROLE,
            'phone' => self::PHONE,
            'is_active' => true,
        ];

        if (Schema::hasColumn('users', 'approval_status')) {
            $values['approval_status'] = 'approved';
        }

        return User::updateOrCreate(['email' => self::EMAIL], $values);
    }
}
