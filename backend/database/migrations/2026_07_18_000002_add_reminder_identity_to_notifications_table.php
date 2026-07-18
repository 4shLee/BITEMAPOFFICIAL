<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('pep_schedule_id')->nullable()->after('incident_id')->constrained('pep_schedules')->nullOnDelete();
            $table->string('reminder_type', 80)->nullable()->after('notification_type');
            $table->date('scheduled_date')->nullable()->after('reminder_type');
            $table->string('reminder_key', 64)->nullable()->after('scheduled_date')->unique();
            $table->index(['patient_id', 'incident_id', 'pep_schedule_id'], 'notifications_reminder_lookup');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_reminder_lookup');
            $table->dropUnique(['reminder_key']);
            $table->dropConstrainedForeignId('pep_schedule_id');
            $table->dropColumn(['reminder_type', 'scheduled_date', 'reminder_key']);
        });
    }
};
