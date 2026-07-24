<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasColumn('users', 'role')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','system_admin','Health Officer','Doctor','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'Nurse'");
        }

        DB::table('users')->where('role', 'Admin')->update(['role' => 'system_admin']);

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE users MODIFY role ENUM('system_admin','Health Officer','Doctor','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'Nurse'");
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasColumn('users', 'role')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','system_admin','Health Officer','Doctor','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'Nurse'");
        }

        DB::table('users')->where('role', 'system_admin')->update(['role' => 'Admin']);

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','Health Officer','Doctor','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'Nurse'");
        }
    }
};
