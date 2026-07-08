<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_id')->constrained('inventory')->cascadeOnDelete();
            $table->string('batch_number', 100);
            $table->integer('quantity_received');
            $table->integer('quantity_remaining');
            $table->date('expiry_date');
            $table->date('received_date');
            $table->string('supplier')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['inventory_id', 'batch_number']);
            $table->index(['inventory_id', 'expiry_date']);
        });

        Schema::table('inventory_transactions', function (Blueprint $table) {
            $table->foreignId('inventory_batch_id')->nullable()->after('inventory_id')->constrained('inventory_batches')->nullOnDelete();
            $table->date('transaction_date')->nullable()->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('inventory_batch_id');
            $table->dropColumn('transaction_date');
        });

        Schema::dropIfExists('inventory_batches');
    }
};
