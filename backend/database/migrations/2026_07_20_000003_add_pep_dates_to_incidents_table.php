<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->date('first_consult_date')->nullable()->after('incident_time');
            $table->date('pep_start_date')->nullable()->after('first_consult_date');
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropColumn(['first_consult_date', 'pep_start_date']);
        });
    }
};
