<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PEP_DOSE_DAY_OFFSETS = [0, 3, 7, 14, 28];

    public function up(): void
    {
        if (! Schema::hasTable('incidents') || ! Schema::hasTable('pep_schedules')) {
            return;
        }

        DB::table('incidents')
            ->select(['id', 'incident_date'])
            ->orderBy('id')
            ->chunkById(100, function ($incidents): void {
                foreach ($incidents as $incident) {
                    $schedules = DB::table('pep_schedules')
                        ->where('incident_id', $incident->id)
                        ->whereIn('dose_day', self::PEP_DOSE_DAY_OFFSETS)
                        ->get()
                        ->keyBy('dose_day');

                    if ($schedules->count() !== count(self::PEP_DOSE_DAY_OFFSETS) || ! $schedules->has(0)) {
                        continue;
                    }

                    $scheduleStartDate = Carbon::parse($schedules->get(0)->scheduled_date);
                    $incidentDate = Carbon::parse($incident->incident_date);
                    if ($scheduleStartDate->isSameDay($incidentDate)) {
                        continue;
                    }

                    $isCoherentStandardSchedule = collect(self::PEP_DOSE_DAY_OFFSETS)->every(function (int $day) use ($schedules, $scheduleStartDate): bool {
                        $schedule = $schedules->get($day);

                        return $schedule
                            && Carbon::parse($schedule->scheduled_date)->isSameDay($scheduleStartDate->copy()->addDays($day));
                    });

                    if (! $isCoherentStandardSchedule) {
                        continue;
                    }

                    foreach (self::PEP_DOSE_DAY_OFFSETS as $day) {
                        DB::table('pep_schedules')
                            ->where('incident_id', $incident->id)
                            ->where('dose_day', $day)
                            ->update([
                                'scheduled_date' => $incidentDate->copy()->addDays($day)->toDateString(),
                                'updated_at' => now(),
                            ]);
                    }
                }
            });
    }

    public function down(): void
    {
        // Corrected schedule dates cannot be safely inferred back to their invalid legacy values.
    }
};
