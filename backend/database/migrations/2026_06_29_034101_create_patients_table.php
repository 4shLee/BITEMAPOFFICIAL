<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->string('full_name', 150);
            $table->unsignedInteger('age');
            $table->enum('sex', ['Male', 'Female']);
            $table->text('address');
            $table->foreignId('barangay_id')->nullable()->constrained('barangays')->nullOnDelete();
            $table->string('contact_number', 30);
            $table->string('email', 150)->nullable();
            $table->timestamps();

            $table->index(['full_name', 'barangay_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};
