<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $isSqlite = Schema::getConnection()->getDriverName() === 'sqlite';

        Schema::table('users', function (Blueprint $table) use ($isSqlite) {
            if ($isSqlite) {
                // Historical role migrations normalize several legacy aliases.
                // Keep SQLite unconstrained until the canonical-role migration.
                $table->string('role', 50)->default('Nurse')->after('password');
            } else {
                $table->enum('role', ['Admin', 'Health Officer', 'Doctor', 'Nurse', 'Vaccinator', 'BHW'])
                    ->default('Nurse')
                    ->after('password');
            }

            $table->string('phone', 30)->nullable()->after('role');
            $table->boolean('is_active')->default(true)->after('phone');
            $table->timestamp('last_login_at')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'phone', 'is_active', 'last_login_at']);
        });
    }
};
