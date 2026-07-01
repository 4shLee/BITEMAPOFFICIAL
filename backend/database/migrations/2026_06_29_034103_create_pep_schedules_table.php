<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pep_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('incident_id')->constrained('incidents')->cascadeOnDelete();
            $table->unsignedSmallInteger('dose_day');
            $table->date('scheduled_date');
            $table->date('administered_date')->nullable();
            $table->string('vaccine_type', 100)->default('Anti-rabies Vaccine');
            $table->string('vaccine_lot_number', 100)->nullable();
            $table->foreignId('administered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['Pending', 'Upcoming', 'Done', 'Missed', 'Skipped'])->default('Pending');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['incident_id', 'dose_day']);
            $table->index(['scheduled_date', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pep_schedules');
    }
};
