<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->string('location_scope', 20)->nullable()->after('barangay_id')->index();
            $table->string('incident_city_municipality', 100)->nullable()->after('location_lng');
            $table->string('incident_province', 100)->nullable()->after('incident_city_municipality');
            $table->string('incident_specific_location', 200)->nullable()->after('incident_province');
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropIndex(['location_scope']);
            $table->dropColumn([
                'location_scope',
                'incident_city_municipality',
                'incident_province',
                'incident_specific_location',
            ]);
        });
    }
};
