<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->boolean('sms_consent')->default(true)->after('contact_number');
        });

        DB::table('patients')->orderBy('id')->each(function (object $patient): void {
            $notes = DB::table('incidents')
                ->where('patient_id', $patient->id)
                ->latest('incident_date')
                ->latest('id')
                ->value('notes');

            if (preg_match('/^SMS Consent:\s*(.+)$/mi', (string) $notes, $matches) !== 1) {
                return;
            }

            $declined = in_array(strtolower(trim($matches[1])), ['declined', 'not allowed', 'no', 'false'], true);
            DB::table('patients')->where('id', $patient->id)->update(['sms_consent' => ! $declined]);
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn('sms_consent');
        });
    }
};
