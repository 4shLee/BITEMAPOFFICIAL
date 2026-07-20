<?php

use App\Http\Controllers\Api\BitemapApiController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/signin', [BitemapApiController::class, 'signIn']);
Route::post('/auth/signup', [BitemapApiController::class, 'signUp']);

Route::get('/dev/status', [BitemapApiController::class, 'devStatus']);
Route::get('/barangays', [BitemapApiController::class, 'barangays']);
Route::get('/public/statistics', [BitemapApiController::class, 'publicStatistics']);
Route::get('/public/heatmap', [BitemapApiController::class, 'publicHeatmap']);
Route::get('/public/barangay-stats', [BitemapApiController::class, 'publicBarangayStats']);
Route::get('/public/clinics', [BitemapApiController::class, 'publicClinics'])->middleware('throttle:60,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/session', [BitemapApiController::class, 'session']);
    Route::post('/auth/signout', [BitemapApiController::class, 'signOut']);

    Route::get('/dashboard/stats', [BitemapApiController::class, 'dashboardStats'])
        ->middleware('role:clinic_admin,doctor,nurse_vaccinator');

    Route::get('/patients', [BitemapApiController::class, 'patients'])
        ->middleware('role:clinic_admin,doctor,nurse_vaccinator');
    Route::post('/patients', [BitemapApiController::class, 'storePatient'])
        ->middleware('role:clinic_admin,nurse_vaccinator');
    Route::get('/patients/{patient}', [BitemapApiController::class, 'showPatient'])
        ->middleware('role:clinic_admin,doctor,nurse_vaccinator');
    Route::put('/patients/{patient}', [BitemapApiController::class, 'updatePatient'])
        ->middleware('role:clinic_admin,nurse_vaccinator');
    Route::delete('/patients/{patient}', [BitemapApiController::class, 'deletePatient'])
        ->middleware('role:clinic_admin');

    Route::get('/incidents', [BitemapApiController::class, 'incidents'])
        ->middleware('role:clinic_admin,doctor,nurse_vaccinator');
    Route::post('/incidents', [BitemapApiController::class, 'storeIncident'])
        ->middleware('role:clinic_admin,nurse_vaccinator');
    Route::get('/incidents/{incident}', [BitemapApiController::class, 'showIncident'])
        ->middleware('role:clinic_admin,doctor,nurse_vaccinator');
    Route::put('/incidents/{incident}', [BitemapApiController::class, 'updateIncident'])
        ->middleware('role:clinic_admin,nurse_vaccinator');
    Route::delete('/incidents/{incident}', [BitemapApiController::class, 'deleteIncident'])
        ->middleware('role:clinic_admin');

    Route::get('/gis/heatmap', [BitemapApiController::class, 'gisHeatmap'])
        ->middleware('role:clinic_admin,doctor,nurse_vaccinator');

    Route::get('/pep-schedule', [BitemapApiController::class, 'pepSchedule'])
        ->middleware('role:clinic_admin,doctor,nurse_vaccinator');
    Route::put('/pep-schedule/{schedule}', [BitemapApiController::class, 'updatePepSchedule'])
        ->middleware('role:clinic_admin,nurse_vaccinator');
    Route::post('/pep-schedule/{schedule}/record-dose', [BitemapApiController::class, 'recordPepDose'])
        ->middleware('role:clinic_admin,nurse_vaccinator');
    Route::put('/pep-schedule/{schedule}/reschedule', [BitemapApiController::class, 'reschedulePepSchedule'])
        ->middleware('role:clinic_admin,nurse_vaccinator');

    Route::get('/inventory', [BitemapApiController::class, 'inventory'])
        ->middleware('role:clinic_admin,doctor,nurse_vaccinator');
    Route::post('/inventory', [BitemapApiController::class, 'storeInventory'])
        ->middleware('role:clinic_admin');
    Route::put('/inventory/{inventory}', [BitemapApiController::class, 'updateInventory'])
        ->middleware('role:clinic_admin,nurse_vaccinator');
    Route::get('/inventory/{inventory}/batches', [BitemapApiController::class, 'inventoryBatches'])
        ->middleware('role:clinic_admin,doctor,nurse_vaccinator');
    Route::post('/inventory/{inventory}/batches', [BitemapApiController::class, 'storeInventoryBatch'])
        ->middleware('role:clinic_admin');

    Route::get('/users', [BitemapApiController::class, 'users'])->middleware('role:system_admin,clinic_admin');
    Route::put('/users/{user}', [BitemapApiController::class, 'updateUser'])->middleware('role:system_admin,clinic_admin');
    Route::put('/users/{user}/approve', [BitemapApiController::class, 'approveUser'])->middleware('role:system_admin,clinic_admin');
    Route::put('/users/{user}/reject', [BitemapApiController::class, 'rejectUser'])->middleware('role:system_admin,clinic_admin');

    Route::get('/settings', [BitemapApiController::class, 'settings'])->middleware('role:system_admin,clinic_admin');
    Route::post('/settings/sms-credentials', [BitemapApiController::class, 'updateSmsCredentials'])->middleware('role:system_admin');
    Route::post('/settings/test-sms', [BitemapApiController::class, 'testSms'])->middleware('role:system_admin');
    Route::put('/settings/{key}', [BitemapApiController::class, 'updateSetting'])->middleware('role:system_admin,clinic_admin');

    Route::get('/notifications', [BitemapApiController::class, 'notifications'])
        ->middleware('role:clinic_admin,doctor,nurse_vaccinator');
    Route::get('/schedule-alerts/today', [BitemapApiController::class, 'todayScheduleAlerts'])
        ->middleware('role:clinic_admin,doctor,nurse_vaccinator');
    Route::post('/send-sms', [BitemapApiController::class, 'sendSms'])
        ->middleware('role:clinic_admin,nurse_vaccinator');
    Route::post('/send-email', [BitemapApiController::class, 'sendEmail'])
        ->middleware('role:clinic_admin,nurse_vaccinator');

    Route::get('/audit-logs', [BitemapApiController::class, 'auditLogs'])->middleware('role:system_admin');
    Route::get('/audit-logs/download', [BitemapApiController::class, 'downloadAuditLogs'])->middleware('role:system_admin');

    Route::get('/reports/summary', [BitemapApiController::class, 'reportSummary'])
        ->middleware('role:clinic_admin,doctor');
    Route::get('/reports/download', [BitemapApiController::class, 'downloadReport'])
        ->middleware('role:clinic_admin,doctor');

    Route::get('/animals', [BitemapApiController::class, 'animals'])->middleware('role:clinic_admin');
    Route::post('/animals', [BitemapApiController::class, 'animals'])->middleware('role:clinic_admin');
    Route::put('/animals/{id}', [BitemapApiController::class, 'animals'])->middleware('role:clinic_admin');
});
