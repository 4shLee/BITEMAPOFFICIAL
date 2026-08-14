<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class DemoUserSeeder extends Seeder
{
    public const PASSWORD = 'BitemapDemo2026!';

    public const EMAILS = [
        'system_admin' => 'demo.system.admin@example.invalid',
        'clinic_admin' => 'demo.clinic.admin@example.invalid',
        'doctor' => 'demo.doctor@example.invalid',
        'nurse_vaccinator' => 'demo.nurse@example.invalid',
    ];

    /**
     * Seed only the fictional local demo accounts.
     */
    public function run(): void
    {
        $this->guardLocalDatabase();
        DB::transaction(fn (): array => $this->seedUsers(), 3);

        $this->command?->info('BITEMAP demo accounts are ready.');
        $this->command?->info('Verified all four password hashes and account status requirements.');
        $this->command?->warn('Development-only password: '.self::PASSWORD);
        $this->command?->line('Demo user emails: '.implode(', ', array_values(self::EMAILS)));
    }

    /**
     * @return array<string, User>
     */
    public function seedUsers(): array
    {
        $definitions = [
            'system_admin' => ['Demo', 'System', 'Administrator', '09000001001'],
            'clinic_admin' => ['Demo', 'Clinic', 'Administrator', '09000001002'],
            'doctor' => ['Demo', 'Clinical', 'Doctor', '09000001003'],
            'nurse_vaccinator' => ['Demo', 'Nurse', 'Vaccinator', '09000001004'],
        ];
        $users = [];

        if (Schema::hasColumn('users', 'deleted_at')) {
            DB::table('users')
                ->whereIn('email', array_values(self::EMAILS))
                ->update(['deleted_at' => null]);
        }

        foreach ($definitions as $role => [$firstName, $middleName, $lastName, $phone]) {
            $users[$role] = User::updateOrCreate(
                ['email' => self::EMAILS[$role]],
                [
                    'name' => implode(' ', [$firstName, $middleName, $lastName]),
                    'first_name' => $firstName,
                    'middle_name' => $middleName,
                    'last_name' => $lastName,
                    'suffix' => null,
                    'password' => Hash::make(self::PASSWORD),
                    'role' => $role,
                    'phone' => $phone,
                    'is_active' => true,
                    'approval_status' => 'approved',
                    'email_verified_at' => now(),
                ]
            );
        }

        foreach ($users as $user) {
            if (! Hash::check(self::PASSWORD, $user->password)
                || ! $user->is_active
                || $user->approval_status !== 'approved'
                || $user->email_verified_at === null
            ) {
                throw new RuntimeException('A demo account failed credential or account-status verification.');
            }
        }

        return $users;
    }

    private function guardLocalDatabase(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('DemoUserSeeder is restricted to local and testing environments.');
        }

        if (app()->environment('testing')) {
            return;
        }

        $connection = (array) config('database.connections.'.config('database.default'), []);
        $actual = [
            'host' => (string) ($connection['host'] ?? ''),
            'port' => (string) ($connection['port'] ?? ''),
            'database' => (string) ($connection['database'] ?? ''),
        ];
        $expected = [
            'host' => '127.0.0.1',
            'port' => '3307',
            'database' => 'bitemap_db',
        ];

        if ($actual !== $expected) {
            throw new RuntimeException(sprintf(
                'Refusing to seed demo users. Expected %s:%s/%s; connected configuration is %s:%s/%s.',
                $expected['host'],
                $expected['port'],
                $expected['database'],
                $actual['host'],
                $actual['port'],
                $actual['database']
            ));
        }
    }
}
