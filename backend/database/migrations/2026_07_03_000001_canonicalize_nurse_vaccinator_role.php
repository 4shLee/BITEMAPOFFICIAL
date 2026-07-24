<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','system_admin','Clinic Admin','Health Officer','Doctor','nurse_vaccinator','Nurse/Vaccinator','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'nurse_vaccinator'");
        }

        DB::table('users')
            ->whereIn('role', ['Nurse/Vaccinator', 'Nurse', 'Vaccinator', 'nurse', 'vaccinator'])
            ->update(['role' => 'nurse_vaccinator']);
    }

    public function down(): void
    {
        DB::table('users')
            ->where('role', 'nurse_vaccinator')
            ->update(['role' => 'Nurse/Vaccinator']);

        if (in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','system_admin','Clinic Admin','Health Officer','Doctor','Nurse/Vaccinator','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'Nurse/Vaccinator'");
        }
    }
};
