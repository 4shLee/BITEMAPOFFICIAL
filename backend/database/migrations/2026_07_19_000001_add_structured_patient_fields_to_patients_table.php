<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->string('first_name', 50)->nullable()->after('id');
            $table->string('middle_name', 50)->nullable()->after('first_name');
            $table->string('last_name', 50)->nullable()->after('middle_name');
            $table->string('suffix', 10)->nullable()->after('last_name');
            $table->string('address_line', 150)->nullable()->after('address');
            $table->string('residence_barangay', 80)->nullable()->after('address_line');
            $table->string('city_municipality', 80)->nullable()->after('residence_barangay');
            $table->string('province', 80)->nullable()->after('city_municipality');
            $table->string('contact_number', 30)->nullable()->change();
            $table->boolean('sms_consent')->default(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn([
                'first_name',
                'middle_name',
                'last_name',
                'suffix',
                'address_line',
                'residence_barangay',
                'city_municipality',
                'province',
            ]);
        });
    }
};
