<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','system_admin','Clinic Admin','Health Officer','Doctor','Nurse/Vaccinator','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'Nurse/Vaccinator'");
        }
    }

    public function down(): void
    {
        if (in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','system_admin','Health Officer','Doctor','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'Nurse'");
        }
    }
};
