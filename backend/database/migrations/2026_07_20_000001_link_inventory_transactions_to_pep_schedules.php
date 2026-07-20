<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_transactions', function (Blueprint $table) {
            $table->foreignId('pep_schedule_id')
                ->nullable()
                ->after('inventory_batch_id')
                ->constrained('pep_schedules')
                ->nullOnDelete();
            $table->unique('pep_schedule_id');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_transactions', function (Blueprint $table) {
            $table->dropUnique(['pep_schedule_id']);
            $table->dropConstrainedForeignId('pep_schedule_id');
        });
    }
};
