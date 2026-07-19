<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->json('exposure_contact_types')->nullable()->after('bite_site');
            $table->string('exposure_skin_condition', 20)->nullable()->after('exposure_contact_types');
            $table->boolean('exposure_bleeding_present')->nullable()->after('exposure_skin_condition');
            $table->boolean('exposure_transdermal')->nullable()->after('exposure_bleeding_present');
            $table->string('exposure_saliva_contact_site', 30)->nullable()->after('exposure_transdermal');
            $table->boolean('exposure_direct_bat_contact')->nullable()->after('exposure_saliva_contact_site');
            $table->string('suggested_who_category', 3)->nullable()->after('who_category');
            $table->string('who_category_suggestion_reason', 500)->nullable()->after('suggested_who_category');
            $table->text('who_category_override_reason')->nullable()->after('who_category_suggestion_reason');
            $table->foreignId('who_category_confirmed_by')->nullable()->after('who_category_override_reason')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('who_category_confirmed_at')->nullable()->after('who_category_confirmed_by');
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropForeign(['who_category_confirmed_by']);
            $table->dropColumn([
                'exposure_contact_types',
                'exposure_skin_condition',
                'exposure_bleeding_present',
                'exposure_transdermal',
                'exposure_saliva_contact_site',
                'exposure_direct_bat_contact',
                'suggested_who_category',
                'who_category_suggestion_reason',
                'who_category_override_reason',
                'who_category_confirmed_by',
                'who_category_confirmed_at',
            ]);
        });
    }
};
