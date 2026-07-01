<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('barangay_id')->nullable()->constrained('barangays')->nullOnDelete();
            $table->date('incident_date');
            $table->time('incident_time')->nullable();
            $table->enum('animal_type', ['Dog', 'Cat', 'Other']);
            $table->text('animal_description')->nullable();
            $table->string('bite_site', 150);
            $table->enum('who_category', ['I', 'II', 'III']);
            $table->decimal('location_lat', 10, 8)->nullable();
            $table->decimal('location_lng', 11, 8)->nullable();
            $table->enum('status', ['Active', 'Completed', 'Missed', 'Lost to Follow-up'])->default('Active');
            $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['incident_date', 'barangay_id']);
            $table->index(['who_category', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incidents');
    }
};
