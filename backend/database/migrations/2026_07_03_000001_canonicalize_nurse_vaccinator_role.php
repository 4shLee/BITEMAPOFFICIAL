<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','system_admin','Clinic Admin','Health Officer','Doctor','nurse_vaccinator','Nurse/Vaccinator','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'nurse_vaccinator'");
        DB::table('users')
            ->whereIn('role', ['Nurse/Vaccinator', 'Nurse', 'Vaccinator', 'nurse', 'vaccinator'])
            ->update(['role' => 'nurse_vaccinator']);
    }

    public function down(): void
    {
        DB::table('users')
            ->where('role', 'nurse_vaccinator')
            ->update(['role' => 'Nurse/Vaccinator']);

        DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','system_admin','Clinic Admin','Health Officer','Doctor','Nurse/Vaccinator','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'Nurse/Vaccinator'");
    }
};
