<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('incident_id')->nullable()->constrained('incidents')->cascadeOnDelete();
            $table->enum('notification_type', ['SMS', 'Email', 'Both']);
            $table->string('recipient', 150);
            $table->text('message');
            $table->enum('status', ['Pending', 'Sent', 'Failed', 'Delivered'])->default('Pending');
            $table->timestamp('sent_at')->nullable();
            $table->text('delivery_response')->nullable();
            $table->timestamps();

            $table->index(['patient_id', 'status']);
            $table->index('sent_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
