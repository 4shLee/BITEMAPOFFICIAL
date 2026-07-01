<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','system_admin','Clinic Admin','Health Officer','Doctor','Nurse/Vaccinator','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'Nurse/Vaccinator'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','system_admin','Health Officer','Doctor','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'Nurse'");
    }
};
