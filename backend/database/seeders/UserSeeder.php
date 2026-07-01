<?php

namespace Database\Seeders;

use App\Models\User;
use App\Support\DefaultAdminAccount;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $legacyDoctor = User::where('email', 'health.officer@bitemap.local')->first();
        $doctorExists = User::where('email', 'doctor@bitemap.local')->exists();

        if ($legacyDoctor && ! $doctorExists) {
            $legacyValues = [
                'name' => 'Doctor',
                'email' => 'doctor@bitemap.local',
                'password' => Hash::make(DefaultAdminAccount::PASSWORD),
                'role' => 'Doctor',
                'is_active' => true,
            ];

            if (Schema::hasColumn('users', 'approval_status')) {
                $legacyValues['approval_status'] = 'approved';
            }

            $legacyDoctor->forceFill($legacyValues)->save();
        } elseif ($legacyDoctor) {
            $legacyDoctor->forceFill(['is_active' => false])->save();
        }

        $accounts = [
            [
                'name' => DefaultAdminAccount::NAME,
                'email' => DefaultAdminAccount::EMAIL,
                'phone' => DefaultAdminAccount::PHONE,
                'role' => DefaultAdminAccount::ROLE,
            ],
            [
                'name' => 'Doctor',
                'email' => 'doctor@bitemap.local',
                'phone' => '09170000001',
                'role' => 'Doctor',
            ],
            [
                'name' => 'Nurse/Vaccinator',
                'email' => 'nurse@bitemap.local',
                'phone' => '09170000002',
                'role' => 'Nurse/Vaccinator',
            ],
            [
                'name' => 'Clinic Administrator',
                'email' => 'clinic.admin@bitemap.local',
                'phone' => '09170000003',
                'role' => 'Clinic Admin',
            ],
        ];


        $inactiveUpdates = ['is_active' => false];

        if (Schema::hasColumn('users', 'approval_status')) {
            $inactiveUpdates['approval_status'] = 'rejected';
        }

        User::whereIn('email', ['bhw@bitemap.local', 'test@example.com'])->update($inactiveUpdates);

        foreach ($accounts as $account) {
            $values = [
                'name' => $account['name'],
                'password' => Hash::make(DefaultAdminAccount::PASSWORD),
                'role' => $account['role'],
                'is_active' => true,
            ];

            if (Schema::hasColumn('users', 'phone')) {
                $values['phone'] = $account['phone'];
            }

            if (Schema::hasColumn('users', 'approval_status')) {
                $values['approval_status'] = 'approved';
            }

            User::updateOrCreate(
                ['email' => $account['email']],
                $values
            );
        }
    }
}
