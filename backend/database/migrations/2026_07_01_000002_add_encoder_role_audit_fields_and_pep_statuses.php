<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $isMySqlFamily = in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'], true);

        if ($isMySqlFamily && Schema::hasTable('users')) {
            DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','Health Officer','Doctor','Nurse','Vaccinator','Encoder','BHW') NOT NULL DEFAULT 'Nurse'");
        }

        if (Schema::hasTable('audit_logs')) {
            Schema::table('audit_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('audit_logs', 'user_name')) {
                    $table->string('user_name', 150)->nullable()->after('user_id');
                }
                if (! Schema::hasColumn('audit_logs', 'user_role')) {
                    $table->string('user_role', 80)->nullable()->after('user_name');
                }
                if (! Schema::hasColumn('audit_logs', 'action_type')) {
                    $table->string('action_type', 100)->nullable()->after('action');
                }
                if (! Schema::hasColumn('audit_logs', 'record_id')) {
                    $table->string('record_id', 80)->nullable()->after('module');
                }
                if (! Schema::hasColumn('audit_logs', 'description')) {
                    $table->text('description')->nullable()->after('record_id');
                }
                if (! Schema::hasColumn('audit_logs', 'user_agent')) {
                    $table->text('user_agent')->nullable()->after('ip_address');
                }
            });
        }

        if ($isMySqlFamily && Schema::hasTable('pep_schedules')) {
            DB::statement("ALTER TABLE pep_schedules MODIFY status ENUM('Pending','Upcoming','Done','Completed','Missed','Skipped','Rescheduled','Cancelled') NOT NULL DEFAULT 'Pending'");
        }
    }

    public function down(): void
    {
        $isMySqlFamily = in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'], true);

        if ($isMySqlFamily && Schema::hasTable('pep_schedules')) {
            DB::statement("ALTER TABLE pep_schedules MODIFY status ENUM('Pending','Upcoming','Done','Missed','Skipped') NOT NULL DEFAULT 'Pending'");
        }

        if ($isMySqlFamily && Schema::hasTable('users')) {
            DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','Health Officer','Doctor','Nurse','Vaccinator','BHW') NOT NULL DEFAULT 'Nurse'");
        }

        if (Schema::hasTable('audit_logs')) {
            Schema::table('audit_logs', function (Blueprint $table) {
                foreach (['user_name', 'user_role', 'action_type', 'record_id', 'description', 'user_agent'] as $column) {
                    if (Schema::hasColumn('audit_logs', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
