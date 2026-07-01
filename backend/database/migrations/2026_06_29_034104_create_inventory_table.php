<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory', function (Blueprint $table) {
            $table->id();
            $table->string('item_name', 150)->unique();
            $table->enum('item_type', ['Vaccine', 'Immunoglobulin', 'Supply', 'Medicine']);
            $table->integer('current_stock')->default(0);
            $table->string('unit', 50);
            $table->integer('reorder_level');
            $table->date('expiry_date')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['item_type', 'current_stock']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory');
    }
};
