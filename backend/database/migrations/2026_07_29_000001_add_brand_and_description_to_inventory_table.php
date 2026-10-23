<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            if (! Schema::hasColumn('inventory', 'brand')) {
                $table->string('brand', 100)->nullable()->after('item_name');
            }
            if (! Schema::hasColumn('inventory', 'description')) {
                $table->text('description')->nullable()->after('expiry_date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            $columns = array_values(array_filter(
                ['brand', 'description'],
                fn (string $column) => Schema::hasColumn('inventory', $column)
            ));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
