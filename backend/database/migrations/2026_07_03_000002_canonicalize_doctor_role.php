<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $isMySqlFamily = in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'], true);

        if ($isMySqlFamily) {
            DB::statement("ALTER TABLE users MODIFY role VARCHAR(50) NOT NULL DEFAULT 'nurse_vaccinator'");
        }

        DB::table('users')->whereIn('role', ['Admin'])->update(['role' => 'system_admin']);
        DB::table('users')->whereIn('role', ['Clinic Admin'])->update(['role' => 'clinic_admin']);
        DB::table('users')->whereIn('role', ['Doctor', 'Health Officer'])->update(['role' => 'doctor']);
        DB::table('users')->whereIn('role', ['Nurse/Vaccinator', 'Nurse', 'Vaccinator', 'nurse', 'vaccinator', 'Encoder', 'BHW'])->update(['role' => 'nurse_vaccinator']);

        if ($isMySqlFamily) {
            DB::statement("ALTER TABLE users MODIFY role ENUM('system_admin','clinic_admin','doctor','nurse_vaccinator') NOT NULL DEFAULT 'nurse_vaccinator'");
        } else {
            Schema::table('users', function (Blueprint $table) {
                $table->enum('role', ['system_admin', 'clinic_admin', 'doctor', 'nurse_vaccinator'])
                    ->default('nurse_vaccinator')
                    ->change();
            });
        }
    }

    public function down(): void
    {
        $isMySqlFamily = in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'], true);

        if ($isMySqlFamily) {
            DB::statement("ALTER TABLE users MODIFY role VARCHAR(50) NOT NULL DEFAULT 'nurse_vaccinator'");
        } else {
            Schema::table('users', function (Blueprint $table) {
                $table->string('role', 50)
                    ->default('nurse_vaccinator')
                    ->change();
            });
        }

        DB::table('users')
            ->where('role', 'doctor')
            ->update(['role' => 'Doctor']);

        DB::table('users')
            ->where('role', 'clinic_admin')
            ->update(['role' => 'Clinic Admin']);

        DB::table('users')
            ->where('role', 'nurse_vaccinator')
            ->update(['role' => 'Nurse/Vaccinator']);

        if ($isMySqlFamily) {
            DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','system_admin','Clinic Admin','Health Officer','Doctor','Nurse/Vaccinator','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'Nurse/Vaccinator'");
        } else {
            Schema::table('users', function (Blueprint $table) {
                $table->enum('role', ['Admin', 'system_admin', 'Clinic Admin', 'Health Officer', 'Doctor', 'Nurse/Vaccinator', 'Nurse', 'Vaccinator', 'Encoder', 'BHW'])
                    ->default('Nurse/Vaccinator')
                    ->change();
            });
        }
    }
};
