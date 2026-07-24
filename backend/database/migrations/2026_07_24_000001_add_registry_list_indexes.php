<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            // Foreign keys already index patient_id and barangay_id, while the
            // original migration covers incident_date as the leading column.
            $table->index(['status', 'incident_date'], 'incidents_status_date_index');
            $table->index(['barangay_id', 'incident_date'], 'incidents_barangay_date_index');
        });

        Schema::table('patients', function (Blueprint $table) {
            // barangay_id is indexed by its foreign key.
            $table->index('last_name', 'patients_last_name_index');
            $table->index('first_name', 'patients_first_name_index');
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropIndex('incidents_status_date_index');
            $table->dropIndex('incidents_barangay_date_index');
        });

        Schema::table('patients', function (Blueprint $table) {
            $table->dropIndex('patients_last_name_index');
            $table->dropIndex('patients_first_name_index');
        });
    }
};
