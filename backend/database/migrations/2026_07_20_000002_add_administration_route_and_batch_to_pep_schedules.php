<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pep_schedules', function (Blueprint $table) {
            $table->enum('administration_route', ['Intradermal', 'Intramuscular'])
                ->nullable()
                ->after('administered_date');
            $table->foreignId('inventory_batch_id')
                ->nullable()
                ->after('vaccine_lot_number')
                ->constrained('inventory_batches')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('pep_schedules', function (Blueprint $table) {
            $table->dropConstrainedForeignId('inventory_batch_id');
            $table->dropColumn('administration_route');
        });
    }
};
