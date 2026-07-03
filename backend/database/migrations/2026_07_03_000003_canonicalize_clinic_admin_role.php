<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','system_admin','clinic_admin','Clinic Admin','Health Officer','doctor','Doctor','nurse_vaccinator','Nurse/Vaccinator','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'nurse_vaccinator'");
        DB::table('users')
            ->where('role', 'Clinic Admin')
            ->update(['role' => 'clinic_admin']);
    }

    public function down(): void
    {
        DB::table('users')
            ->where('role', 'clinic_admin')
            ->update(['role' => 'Clinic Admin']);

        DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','system_admin','Clinic Admin','Health Officer','doctor','Doctor','nurse_vaccinator','Nurse/Vaccinator','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'nurse_vaccinator'");
    }
};
