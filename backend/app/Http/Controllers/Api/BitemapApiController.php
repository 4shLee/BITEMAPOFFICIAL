<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Barangay;
use App\Models\Incident;
use App\Models\Inventory;
use App\Models\InventoryBatch;
use App\Models\InventoryTransaction;
use App\Models\Notification;
use App\Models\Patient;
use App\Models\PepSchedule;
use App\Models\Setting;
use App\Models\User;
use App\Support\DefaultAdminAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class BitemapApiController extends Controller
{
    private const DIGOS_CENTER = ['lat' => 6.7497, 'lng' => 125.3572];

    private const PEP_DOSE_DAY_OFFSETS = [0, 3, 7, 14, 28];

    private const DIGOS_BOUNDS = [
        'south' => 6.63,
        'west' => 125.25,
        'north' => 6.88,
        'east' => 125.48,
    ];

    private const USER_ROLE_OPTIONS = ['system_admin', 'clinic_admin', 'Clinic Admin', 'doctor', 'Doctor', 'Health Officer', 'nurse_vaccinator', 'Nurse/Vaccinator', 'Nurse', 'Vaccinator', 'nurse', 'vaccinator'];

    private const PUBLIC_SIGNUP_ROLE_OPTIONS = ['clinic_admin', 'Clinic Admin', 'doctor', 'Doctor', 'Health Officer', 'nurse_vaccinator', 'Nurse/Vaccinator', 'Nurse', 'Vaccinator', 'nurse', 'vaccinator'];

    private const DIGOS_BARANGAY_COORDINATES = [
        'Aplaya' => ['lat' => 6.7600, 'lng' => 125.3425],
        'Balabag' => ['lat' => 6.7400, 'lng' => 125.3575],
        'Binaton' => ['lat' => 6.8300, 'lng' => 125.3700],
        'Cogon' => ['lat' => 6.7650, 'lng' => 125.3875],
        'Colorado' => ['lat' => 6.7560, 'lng' => 125.3150],
        'Dawis' => ['lat' => 6.7600, 'lng' => 125.3725],
        'Dulangan' => ['lat' => 6.8100, 'lng' => 125.3600],
        'Goma' => ['lat' => 6.7400, 'lng' => 125.3200],
        'Igpit' => ['lat' => 6.7240, 'lng' => 125.3480],
        'Kapatagan' => ['lat' => 6.8050, 'lng' => 125.3300],
        'Kiagot' => ['lat' => 6.7830, 'lng' => 125.3910],
        'Lungag' => ['lat' => 6.6700, 'lng' => 125.3000],
        'Mahayahay' => ['lat' => 6.7400, 'lng' => 125.3425],
        'Matti' => ['lat' => 6.7560, 'lng' => 125.3340],
        'Ruparan' => ['lat' => 6.7800, 'lng' => 125.3500],
        'San Agustin' => ['lat' => 6.7650, 'lng' => 125.3500],
        'San Jose' => ['lat' => 6.7600, 'lng' => 125.3575],
        'San Miguel' => ['lat' => 6.7330, 'lng' => 125.3580],
        'San Roque' => ['lat' => 6.7550, 'lng' => 125.3250],
        'Sinawilan' => ['lat' => 6.7750, 'lng' => 125.4100],
        'Soong' => ['lat' => 6.7000, 'lng' => 125.3200],
        'Tiguman' => ['lat' => 6.7400, 'lng' => 125.3725],
        'Tres De Mayo' => ['lat' => 6.7610, 'lng' => 125.3660],
        'Zone 1' => ['lat' => 6.7500, 'lng' => 125.3525],
        'Zone 2' => ['lat' => 6.7500, 'lng' => 125.3675],
        'Zone 3' => ['lat' => 6.7480, 'lng' => 125.3800],
    ];

    public function signIn(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $email = strtolower(trim($credentials['email']));

        if (DefaultAdminAccount::shouldRepairForLogin($email, $credentials['password'])) {
            DefaultAdminAccount::reset();
        }

        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid email or password.',
            ], 401);
        }

        $approvalStatus = Schema::hasColumn('users', 'approval_status')
            ? ($user->approval_status ?? 'approved')
            : ($user->is_active ? 'approved' : 'pending');

        if ($approvalStatus === 'pending') {
            return response()->json([
                'success' => false,
                'error' => 'Your account request is still waiting for admin approval.',
            ], 403);
        }

        if ($approvalStatus === 'rejected') {
            return response()->json([
                'success' => false,
                'error' => 'Your account request was rejected. Please contact the system administrator.',
            ], 403);
        }

        if (! $user->is_active) {
            return response()->json([
                'success' => false,
                'error' => 'This account is inactive.',
            ], 403);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $this->writeAudit($request, 'Login', 'Authentication', $user->id, 'User signed in.', $user);
        $token = $user->createToken('bitemap-web')->plainTextToken;

        return response()->json([
            'success' => true,
            'accessToken' => $token,
            'user' => $this->userPayload($user->fresh()),
        ]);
    }

    public function signUp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'fullName' => ['required', 'string', 'max:255'],
            'role' => ['required', Rule::in(self::PUBLIC_SIGNUP_ROLE_OPTIONS)],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $values = [
            'name' => $data['fullName'],
            'email' => strtolower(trim($data['email'])),
            'password' => $data['password'],
            'role' => $this->storableUserRole($data['role']),
            'phone' => $data['phone'] ?? null,
            'is_active' => false,
        ];

        if (Schema::hasColumn('users', 'approval_status')) {
            $values['approval_status'] = 'pending';
        }

        $user = User::create($values);

        return response()->json([
            'success' => true,
            'message' => 'Account request submitted. Please wait for admin approval before signing in.',
            'user' => $this->userPayload($user),
        ], 201);
    }

    public function session(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'user' => $this->userPayload($request->user()),
        ]);
    }

    public function signOut(Request $request): JsonResponse
    {
        $this->writeAudit($request, 'Logout', 'Authentication', $request->user()?->id, 'User signed out.');
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'success' => true,
            'message' => 'Signed out successfully.',
        ]);
    }

    public function dashboardStats(): JsonResponse
    {
        $totalCases = Incident::count();
        $activeCases = Incident::where('status', 'Active')->count();
        $completedVaccinations = Incident::where('status', 'Completed')->count();
        $pendingDoses = PepSchedule::whereIn('status', ['Pending', 'Upcoming'])->count();
        $highRiskBarangays = Barangay::withCount('incidents')
            ->having('incidents_count', '>=', 5)
            ->count();

        $recentIncidents = Incident::with(['patient', 'barangay'])
            ->latest('incident_date')
            ->latest('id')
            ->limit(5)
            ->get()
            ->map(fn (Incident $incident) => $this->incidentPayload($incident))
            ->values();

        $lowStockItems = Inventory::whereColumn('current_stock', '<=', 'reorder_level')
            ->orderBy('current_stock')
            ->get()
            ->map(fn (Inventory $item) => $this->inventoryPayload($item))
            ->values();

        return response()->json([
            'success' => true,
            'stats' => [
                'totalCases' => $totalCases,
                'activeCases' => $activeCases,
                'completedVaccinations' => $completedVaccinations,
                'pendingDoses' => $pendingDoses,
                'highRiskBarangays' => $highRiskBarangays,
            ],
            'recentIncidents' => $recentIncidents,
            'lowStockItems' => $lowStockItems,
        ]);
    }

    public function barangays(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => Barangay::orderBy('name')->get(),
        ]);
    }

    public function patients(): JsonResponse
    {
        $patients = Patient::with('barangay')
            ->latest('id')
            ->get()
            ->map(fn (Patient $patient) => $this->patientPayload($patient))
            ->values();

        return response()->json(['success' => true, 'data' => $patients]);
    }

    public function showPatient(Patient $patient): JsonResponse
    {
        $patient->load(['barangay', 'incidents.barangay', 'incidents.pepSchedules', 'notifications']);

        return response()->json([
            'success' => true,
            'data' => array_merge($this->patientPayload($patient), [
                'incidents' => $patient->incidents->map(fn (Incident $incident) => $this->incidentPayload($incident))->values(),
                'notifications' => $patient->notifications->values(),
            ]),
        ]);
    }

    public function storePatient(Request $request): JsonResponse
    {
        $data = $this->validatePatient($request, true);
        $patient = Patient::create($data);

        return response()->json([
            'success' => true,
            'data' => $this->patientPayload($patient->load('barangay')),
        ], 201);
    }

    public function updatePatient(Request $request, Patient $patient): JsonResponse
    {
        $patient->update($this->validatePatient($request, false));

        return response()->json([
            'success' => true,
            'data' => $this->patientPayload($patient->fresh('barangay')),
        ]);
    }

    public function deletePatient(Patient $patient): JsonResponse
    {
        $patientName = $patient->full_name;
        $patientId = $patient->id;
        $patient->delete();
        $this->writeAudit($request, 'Delete record', 'Patients', $patientId, 'Deleted patient record for '.$patientName.'.');

        return response()->json([
            'success' => true,
            'message' => 'Patient deleted.',
        ]);
    }

    public function incidents(): JsonResponse
    {
        $incidents = Incident::with(['patient', 'barangay', 'pepSchedules'])
            ->latest('incident_date')
            ->latest('id')
            ->get()
            ->map(fn (Incident $incident) => $this->incidentPayload($incident))
            ->values();

        return response()->json(['success' => true, 'data' => $incidents]);
    }

    public function showIncident(Incident $incident): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->incidentPayload($incident->load(['patient', 'barangay', 'pepSchedules'])),
        ]);
    }

    public function storeIncident(Request $request): JsonResponse
    {
        $patient = $this->resolveIncidentPatient($request);
        $incident = Incident::create($this->incidentData($request, $patient));
        $this->createPepScheduleForIncident($incident);

        return response()->json([
            'success' => true,
            'data' => $this->incidentPayload($incident->fresh(['patient', 'barangay', 'pepSchedules'])),
        ], 201);
    }

    public function updateIncident(Request $request, Incident $incident): JsonResponse
    {
        DB::transaction(function () use ($request, $incident): void {
            $patient = $this->resolveIncidentPatient($request, $incident->patient);
            $incidentData = $this->incidentData($request, $patient);
            $incidentDateChanged = $incident->incident_date?->toDateString() !== $incidentData['incident_date'];

            $incident->update($incidentData);
            $updatedIncident = $incident->fresh();
            $shouldRecalculateSchedule = $incidentDateChanged || $this->hasStaleStandardPepSchedule($updatedIncident);
            $this->syncPepScheduleForIncident($updatedIncident, $shouldRecalculateSchedule);
        });

        return response()->json([
            'success' => true,
            'data' => $this->incidentPayload($incident->fresh(['patient', 'barangay', 'pepSchedules'])),
        ]);
    }

    public function deleteIncident(Incident $incident): JsonResponse
    {
        $patient = $incident->patient;

        $incidentId = $incident->id;
        $patientName = $patient?->full_name ?? 'Unknown patient';
        $incident->delete();
        $this->writeAudit($request, 'Delete record', 'Incidents', $incidentId, 'Deleted incident record for '.$patientName.'.');

        if ($patient && ! $patient->incidents()->exists()) {
            $patient->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Incident deleted.',
        ]);
    }

    public function pepSchedule(): JsonResponse
    {
        $schedule = PepSchedule::with(['incident.patient', 'incident.barangay', 'administrator'])
            ->orderBy('scheduled_date')
            ->get()
            ->map(fn (PepSchedule $item) => $this->pepSchedulePayload($item))
            ->values();

        return response()->json(['success' => true, 'data' => $schedule]);
    }

    public function updatePepSchedule(Request $request, PepSchedule $schedule): JsonResponse
    {
        $data = $request->validate([
            'administered_date' => ['nullable', 'date'],
            'scheduled_date' => ['nullable', 'date'],
            'vaccine_type' => ['nullable', 'string', 'max:100'],
            'vaccine_lot_number' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['Pending', 'Upcoming', 'Done', 'Completed', 'Missed', 'Skipped', 'Rescheduled', 'Cancelled'])],
            'notes' => ['nullable', 'string'],
        ]);

        if (($data['status'] ?? null) === 'Completed' || ($data['status'] ?? null) === 'Done') {
            $data['status'] = 'Done';
            $data['administered_date'] = $data['administered_date'] ?? now()->toDateString();
            $data['administered_by'] = $request->user()?->id;
        }

        $schedule->update($data);
        $action = match ($data['status'] ?? null) {
            'Completed', 'Done' => 'Mark vaccination as completed',
            'Rescheduled' => 'Reschedule appointment',
            'Cancelled' => 'Cancel appointment',
            default => 'Edit record',
        };
        $this->writeAudit($request, $action, 'PEP Schedule', $schedule->id, 'Updated PEP schedule dose day '.$schedule->dose_day.'.');

        return response()->json([
            'success' => true,
            'data' => $this->pepSchedulePayload($schedule->fresh(['incident.patient', 'administrator'])),
        ]);
    }

    public function reschedulePepSchedule(Request $request, PepSchedule $schedule): JsonResponse
    {
        $data = $request->validate([
            'scheduled_date' => ['required', 'date', 'after_or_equal:today'],
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        if ($schedule->administered_date || in_array($schedule->status, ['Done', 'Completed'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Completed doses cannot be rescheduled.',
            ], 422);
        }

        if (! $schedule->scheduled_date || ! $schedule->scheduled_date->isBefore(today())) {
            return response()->json([
                'success' => false,
                'message' => 'Only overdue doses can be rescheduled.',
            ], 422);
        }

        $originalDate = $schedule->scheduled_date->toDateString();
        $newDate = Carbon::parse($data['scheduled_date'])->toDateString();
        $historyEntry = sprintf(
            'Manually rescheduled from %s to %s by %s. Reason: %s',
            $originalDate,
            $newDate,
            $request->user()?->name ?? $request->user()?->full_name ?? 'Authorized staff',
            trim($data['reason'])
        );

        $schedule->update([
            'scheduled_date' => $newDate,
            'status' => 'Upcoming',
            'notes' => collect([$schedule->notes, $historyEntry])->filter()->implode("\n"),
        ]);

        $this->writeAudit(
            $request,
            'Reschedule appointment',
            'PEP Schedule',
            $schedule->id,
            'Rescheduled PEP dose day '.$schedule->dose_day.' from '.$originalDate.' to '.$newDate.'.'
        );

        return response()->json([
            'success' => true,
            'data' => $this->pepSchedulePayload($schedule->fresh(['incident.patient', 'administrator'])),
        ]);
    }

    public function inventory(): JsonResponse
    {
        $items = Inventory::with(['batches', 'transactions'])
            ->orderBy('item_name')
            ->get()
            ->map(fn (Inventory $item) => $this->inventoryPayload($item))
            ->values();

        return response()->json(['success' => true, 'data' => $items]);
    }

    public function storeInventory(Request $request): JsonResponse
    {
        $item = Inventory::create($this->inventoryData($request));

        return response()->json([
            'success' => true,
            'data' => $this->inventoryPayload($item),
        ], 201);
    }

    public function updateInventory(Request $request, Inventory $inventory): JsonResponse
    {
        if ($this->isNurseVaccinator($request->user()) && collect($request->only(['item_name', 'item_type', 'unit', 'reorder_level', 'expiry_date']))->filter(fn ($value) => $value !== null && $value !== '')->isNotEmpty()) {
            return response()->json([
                'success' => false,
                'error' => 'Nurse/Vaccinator can record usage but cannot edit inventory item details.',
            ], 403);
        }

        $oldStock = $inventory->current_stock;
        $data = $this->inventoryData($request, true);
        $newStock = array_key_exists('current_stock', $data) ? (int) $data['current_stock'] : (int) $oldStock;
        $stockDelta = $newStock - (int) $oldStock;
        $batch = null;

        if ($this->isNurseVaccinator($request->user())) {
            if (! in_array($request->input('transaction_type'), ['Used', 'Dispensed'], true) || $stockDelta >= 0) {
                return response()->json([
                    'success' => false,
                    'error' => 'Nurse/Vaccinator can only record used or dispensed stock.',
                ], 403);
            }

            if ($inventory->batches()->where('quantity_remaining', '>', 0)->exists() && ! $request->filled('inventory_batch_id')) {
                return response()->json([
                    'success' => false,
                    'error' => 'Please select the affected batch/lot.',
                ], 422);
            }
        }

        if ($request->filled('inventory_batch_id')) {
            $batch = $inventory->batches()->whereKey($request->input('inventory_batch_id'))->first();

            if (! $batch) {
                return response()->json([
                    'success' => false,
                    'error' => 'Selected batch was not found for this inventory item.',
                ], 422);
            }

            if ($stockDelta < 0 && abs($stockDelta) > (int) $batch->quantity_remaining) {
                return response()->json([
                    'success' => false,
                    'error' => 'Selected batch does not have enough remaining stock.',
                ], 422);
            }
        }

        DB::transaction(function () use ($request, $inventory, $data, $oldStock, $stockDelta, $batch) {
            $inventory->update($data);

            if ($batch && $stockDelta !== 0) {
                $batch->update([
                    'quantity_remaining' => max(0, (int) $batch->quantity_remaining + $stockDelta),
                ]);
                $this->syncInventoryNearestExpiry($inventory->fresh());
            }

            if ($request->filled('transaction_type') || $oldStock !== $inventory->current_stock) {
                InventoryTransaction::create([
                    'inventory_id' => $inventory->id,
                    'inventory_batch_id' => $batch?->id,
                    'transaction_type' => $this->normalizeTransactionType($request->input('transaction_type')),
                    'quantity' => abs((int) $inventory->current_stock - (int) $oldStock),
                    'transaction_date' => $request->input('transaction_date') ?: now()->toDateString(),
                    'notes' => $request->input('notes'),
                    'created_by' => $request->user()?->id,
                ]);
            }
        });

        return response()->json([
            'success' => true,
            'data' => $this->inventoryPayload($inventory->fresh(['batches', 'transactions'])),
        ]);
    }

    public function inventoryBatches(Inventory $inventory): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $inventory->batches()
                ->orderBy('expiry_date')
                ->get()
                ->map(fn (InventoryBatch $batch) => $this->inventoryBatchPayload($batch))
                ->values(),
        ]);
    }

    public function storeInventoryBatch(Request $request, Inventory $inventory): JsonResponse
    {
        $data = $request->validate([
            'batch_number' => ['required', 'string', 'max:100', Rule::unique('inventory_batches')->where('inventory_id', $inventory->id)],
            'quantity_received' => ['required', 'integer', 'min:1'],
            'expiry_date' => ['required', 'date'],
            'received_date' => ['required', 'date', 'before_or_equal:today'],
            'supplier' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string'],
        ]);

        $batch = DB::transaction(function () use ($request, $inventory, $data) {
            $batch = $inventory->batches()->create([
                ...$data,
                'quantity_remaining' => $data['quantity_received'],
                'created_by' => $request->user()?->id,
            ]);

            $inventory->increment('current_stock', $data['quantity_received']);
            $this->syncInventoryNearestExpiry($inventory->fresh());

            InventoryTransaction::create([
                'inventory_id' => $inventory->id,
                'inventory_batch_id' => $batch->id,
                'transaction_type' => 'Restocked',
                'quantity' => $data['quantity_received'],
                'transaction_date' => $data['received_date'],
                'notes' => 'Batch/Lot '.$data['batch_number'].' received.'.($data['notes'] ? ' '.$data['notes'] : ''),
                'created_by' => $request->user()?->id,
            ]);

            return $batch;
        });

        return response()->json([
            'success' => true,
            'data' => $this->inventoryPayload($inventory->fresh(['batches', 'transactions'])),
            'batch' => $this->inventoryBatchPayload($batch->fresh()),
        ], 201);
    }

    public function users(): JsonResponse
    {
        $query = User::query();

        if (Schema::hasColumn('users', 'approval_status')) {
            $query->orderByRaw("CASE approval_status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END");
        } else {
            $query->orderBy('is_active');
        }

        return response()->json([
            'success' => true,
            'data' => $query
                ->orderBy('name')
                ->get()
                ->map(fn (User $user) => $this->userPayload($user))
                ->values(),
        ]);
    }

    public function storeUser(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'role' => ['required', Rule::in(self::USER_ROLE_OPTIONS)],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['nullable', 'string', 'min:8'],
            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
        ]);

        if ($this->isClinicAdmin($request->user()) && $this->canonicalUserRole($data['role']) === 'system_admin') {
            return $this->systemAdminUserForbiddenResponse();
        }

        $values = [
            'name' => $data['name'],
            'email' => strtolower(trim($data['email'])),
            'role' => $this->storableUserRole($data['role']),
            'phone' => $data['phone'] ?? null,
            'password' => $data['password'] ?? DefaultAdminAccount::PASSWORD,
            'is_active' => ($data['status'] ?? 'Active') === 'Active',
        ];

        if (Schema::hasColumn('users', 'approval_status')) {
            $values['approval_status'] = 'approved';
        }

        $user = User::create($values);
        $this->writeAudit($request, 'Create record', 'User Management', $user->id, 'Created user account for '.$user->name.'.');

        return response()->json(['success' => true, 'data' => $this->userPayload($user)], 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['sometimes', Rule::in(self::USER_ROLE_OPTIONS)],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['nullable', 'string', 'min:8'],
            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
        ]);

        if ($this->isClinicAdmin($request->user())) {
            if ($this->isSystemAdminUser($user) || (isset($data['role']) && $this->canonicalUserRole($data['role']) === 'system_admin')) {
                return $this->systemAdminUserForbiddenResponse();
            }
        }

        if (array_key_exists('status', $data)) {
            $data['is_active'] = $data['status'] === 'Active';
            unset($data['status']);
        }

        $oldRole = $user->role;
        if (isset($data['role'])) {
            $data['role'] = $this->storableUserRole($data['role']);
        }

        $user->update($data);
        $action = isset($data['role']) && $data['role'] !== $oldRole ? 'Update role' : 'Edit record';
        $this->writeAudit($request, $action, 'User Management', $user->id, 'Updated user account for '.$user->name.'.');

        return response()->json(['success' => true, 'data' => $this->userPayload($user->fresh())]);
    }

    public function approveUser(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'role' => ['nullable', Rule::in(self::USER_ROLE_OPTIONS)],
        ]);

        if ($this->isClinicAdmin($request->user())) {
            if ($this->isSystemAdminUser($user) || (! blank($data['role'] ?? null) && $this->canonicalUserRole($data['role']) === 'system_admin')) {
                return $this->systemAdminUserForbiddenResponse();
            }
        }

        $updates = ['is_active' => true];

        if (Schema::hasColumn('users', 'approval_status')) {
            $updates['approval_status'] = 'approved';
        }

        if (! blank($data['role'] ?? null)) {
            $updates['role'] = $this->storableUserRole($data['role']);
        }

        $user->update($updates);
        $this->writeAudit($request, 'Approve user', 'User Management', $user->id, 'Approved account request for '.$user->name.'.');

        return response()->json([
            'success' => true,
            'message' => 'Account approved successfully.',
            'data' => $this->userPayload($user->fresh()),
        ]);
    }

    public function rejectUser(Request $request, User $user): JsonResponse
    {
        if ($this->isClinicAdmin($request->user()) && $this->isSystemAdminUser($user)) {
            return $this->systemAdminUserForbiddenResponse();
        }

        $updates = ['is_active' => false];

        if (Schema::hasColumn('users', 'approval_status')) {
            $updates['approval_status'] = 'rejected';
        }

        $user->update($updates);
        $this->writeAudit($request, 'Reject user', 'User Management', $user->id, 'Rejected account request for '.$user->name.'.');

        return response()->json([
            'success' => true,
            'message' => 'Account request rejected.',
            'data' => $this->userPayload($user->fresh()),
        ]);
    }

    public function settings(): JsonResponse
    {
        $keys = $this->allowedSettingKeysForRole(request()->user()?->role);

        return response()->json([
            'success' => true,
            'data' => Setting::whereIn('setting_key', $keys)->orderBy('setting_key')->get(),
            'meta' => [
                'sms_credentials_configured' => $this->smsCredentialsConfigured(),
            ],
        ]);
    }

    public function updateSetting(Request $request, string $key): JsonResponse
    {
        abort_unless(in_array($key, $this->allowedSettingKeysForRole($request->user()?->role), true), 403, 'This setting is not available for your role.');

        $data = $request->validate(['value' => ['required']]);
        $setting = Setting::updateOrCreate(
            ['setting_key' => $key],
            [
                'setting_value' => (string) $data['value'],
                'updated_by' => $request->user()?->id,
            ]
        );

        $this->writeAudit($request, 'Edit record', 'Settings', $setting->id, 'Updated setting '.$key.'.');

        return response()->json(['success' => true, 'data' => $setting]);
    }

    public function updateSmsCredentials(Request $request): JsonResponse
    {
        $data = $request->validate([
            'account_sid' => ['required', 'string', 'max:255'],
            'auth_token' => ['required', 'string', 'max:255'],
            'from_number' => ['required', 'string', 'max:30'],
        ]);

        foreach ([
            'twilio_account_sid' => $data['account_sid'],
            'twilio_auth_token' => $data['auth_token'],
            'twilio_from_number' => $data['from_number'],
        ] as $key => $value) {
            Setting::updateOrCreate(
                ['setting_key' => $key],
                [
                    'setting_value' => $value,
                    'updated_by' => $request->user()?->id,
                ]
            );
        }

        $this->writeAudit($request, 'Edit record', 'Settings', null, 'Updated SMS service credentials.');

        return response()->json([
            'success' => true,
            'message' => 'SMS credentials updated.',
            'meta' => [
                'sms_credentials_configured' => $this->smsCredentialsConfigured(),
            ],
        ]);
    }

    public function testSms(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'regex:/^(09|\+639)\d{9}$/'],
            'message' => ['required', 'string', 'max:320'],
        ]);

        $phone = str_starts_with($data['phone'], '09') ? '+63'.substr($data['phone'], 1) : $data['phone'];
        [$status, $deliveryResponse] = $this->sendSmsThroughGateway($phone, $data['message']);

        $this->writeAudit($request, 'Send SMS', 'Settings', null, 'Sent test SMS to '.$phone.' marked as '.$status.'.');

        return response()->json([
            'success' => $status !== 'Failed',
            'message' => 'Test SMS '.$status.'.',
            'data' => [
                'status' => $status,
                'delivery_response' => $deliveryResponse,
            ],
        ], $status === 'Failed' ? 422 : 200);
    }

    public function todayScheduleAlerts(): JsonResponse
    {
        $schedules = PepSchedule::with(['incident.patient', 'incident.barangay'])
            ->whereDate('scheduled_date', '<=', today())
            ->whereNotIn('status', ['Done', 'Completed', 'Cancelled', 'Skipped'])
            ->orderBy('scheduled_date')
            ->orderBy('id')
            ->get()
            ->map(function (PepSchedule $schedule) {
                $incident = $schedule->incident;
                $patient = $incident?->patient;
                $barangay = $incident?->barangay;

                return [
                    'id' => $schedule->id,
                    'incident_id' => $schedule->incident_id,
                    'patient_name' => $patient?->full_name ?? 'Unknown Patient',
                    'contact_number' => $patient?->contact_number,
                    'barangay' => $barangay?->name ?? 'Unknown',
                    'dose_day' => $schedule->dose_day,
                    'scheduled_date' => optional($schedule->scheduled_date)->toDateString(),
                    'status' => $schedule->status,
                    'alert_type' => $schedule->scheduled_date?->isBefore(today()) ? 'overdue' : 'due_today',
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'count' => $schedules->count(),
            'data' => $schedules,
            'message' => $schedules->count() === 0
                ? 'No due or overdue PEP reminders.'
                : $schedules->count().' PEP reminder(s) require attention.',
        ]);
    }

    public function notifications(): JsonResponse
    {
        $notifications = Notification::with(['patient', 'incident'])
            ->latest('id')
            ->get()
            ->map(fn (Notification $notification) => [
                ...$notification->toArray(),
                'type' => $notification->notification_type,
                'sentAt' => optional($notification->sent_at)->format('Y-m-d H:i'),
                'read' => $notification->status !== 'Pending',
            ])
            ->values();

        $smsServiceEnabled = $this->smsServiceEnabled();
        $attentionSchedules = PepSchedule::with('incident:id,patient_id')
            ->whereDate('scheduled_date', '<=', today())
            ->whereNotIn('status', ['Done', 'Completed', 'Cancelled', 'Skipped'])
            ->get();
        $overduePatients = $attentionSchedules
            ->filter(fn (PepSchedule $schedule) => $schedule->scheduled_date?->isBefore(today()))
            ->pluck('incident.patient_id')->filter()->unique()->count();
        $dueTodayPatients = $attentionSchedules
            ->filter(fn (PepSchedule $schedule) => $schedule->scheduled_date?->isToday())
            ->pluck('incident.patient_id')->filter()->unique()->count();
        $pendingSms = Notification::where('notification_type', 'SMS')->where('status', 'Pending')->count();
        $failedSms = Notification::where('notification_type', 'SMS')->where('status', 'Failed')->count();
        [$priorityCategory, $priorityCount] = match (true) {
            $overduePatients > 0 => ['overdue_patients', $overduePatients],
            $failedSms > 0 => ['failed_sms', $failedSms],
            $dueTodayPatients > 0 => ['due_today_patients', $dueTodayPatients],
            $pendingSms > 0 => ['pending_sms', $pendingSms],
            default => [null, 0],
        };

        return response()->json([
            'success' => true,
            'data' => $notifications,
            'meta' => [
                'sms_service' => [
                    'enabled' => $smsServiceEnabled,
                    'mode' => $smsServiceEnabled ? 'enabled' : 'simulation',
                    'provider' => $smsServiceEnabled
                        ? $this->settingValue('sms_provider', config('services.sms.provider', 'SMS Provider'))
                        : null,
                ],
                'summary' => [
                    'overdue_patients' => $overduePatients,
                    'failed_sms' => $failedSms,
                    'due_today_patients' => $dueTodayPatients,
                    'pending_sms' => $pendingSms,
                ],
                'priority_alert' => [
                    'category' => $priorityCategory,
                    'count' => $priorityCount,
                ],
            ],
        ]);
    }

    public function sendSms(Request $request): JsonResponse
    {
        return $this->storeNotificationLog($request, 'SMS');
    }

    public function sendEmail(Request $request): JsonResponse
    {
        return $this->storeNotificationLog($request, 'Email');
    }

    public function auditLogs(Request $request): JsonResponse
    {
        $filters = $this->auditLogFilters($request);
        $query = $this->auditLogQuery($filters);
        $total = (clone $query)->count();
        $todayCount = (clone $query)->whereDate('created_at', today())->count();
        $hasActionType = Schema::hasColumn('audit_logs', 'action_type');
        $criticalQuery = clone $query;
        $criticalCount = $hasActionType
            ? $criticalQuery->whereIn('action_type', ['Delete record', 'Approve user', 'Reject user', 'Update role'])->count()
            : $criticalQuery->whereIn('action', ['Delete record', 'Approve user', 'Reject user', 'Update role'])->count();
        $paginator = (clone $query)
            ->latest('id')
            ->paginate($filters['per_page'], ['*'], 'page', $filters['page']);

        return response()->json([
            'success' => true,
            'data' => collect($paginator->items())->map(fn (AuditLog $log) => $this->auditLogPayload($log))->values(),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'summary' => [
                'total' => $total,
                'today' => $todayCount,
                'critical' => $criticalCount,
            ],
        ]);
    }

    public function downloadAuditLogs(Request $request)
    {
        $filters = $this->auditLogFilters($request);
        $format = $filters['format'];
        $logs = $this->auditLogQuery($filters)->latest('id')->get();
        $report = $this->auditLogReport($logs, $filters);
        $config = [
            'date_from' => $filters['date_from'],
            'date_to' => $filters['date_to'],
            'barangay' => 'All',
            'format' => $format,
        ];
        $baseName = $this->reportFileBaseName($report['title'], $config);

        $this->writeAudit($request, 'Export report', 'Audit Logs', null, 'Exported audit log report as '.$format.'.');

        if ($format === 'Excel') {
            $excel = $this->reportExcelContent($report, $config);

            return response($excel['content'], 200, [
                'Content-Type' => $excel['mime'],
                'Content-Disposition' => 'attachment; filename="'.$baseName.'.'.$excel['extension'].'"',
                'Cache-Control' => 'no-store, no-cache, must-revalidate',
            ]);
        }

        return response($this->reportPdfContent($report, $config), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$baseName.'.pdf"',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    public function devStatus(): JsonResponse
    {
        try {
            $admin = User::where('email', DefaultAdminAccount::EMAIL)->first();

            return response()->json([
                'success' => true,
                'database' => 'connected',
                'counts' => [
                    'users' => User::count(),
                    'barangays' => Barangay::count(),
                    'patients' => Patient::count(),
                    'incidents' => Incident::count(),
                    'inventory' => Inventory::count(),
                ],
                'admin' => [
                    'exists' => (bool) $admin,
                    'active' => (bool) $admin?->is_active,
                    'role' => $admin?->role,
                    'password_matches_seed' => $admin ? Hash::check(DefaultAdminAccount::PASSWORD, $admin->password) : false,
                ],
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'success' => false,
                'database' => 'error',
                'error' => $exception->getMessage(),
            ], 500);
        }
    }

    public function reportSummary(Request $request): JsonResponse
    {
        $config = $this->reportConfig($request);
        $report = $this->buildReportData($config);

        return response()->json([
            'success' => true,
            'data' => $this->reportSummaryPayload($report, $config),
        ]);
    }

    public function downloadReport(Request $request)
    {
        $config = $this->reportConfig($request);
        $report = $this->buildReportData($config);
        $baseName = $this->reportFileBaseName($report['title'], $config);

        if ($config['format'] === 'Excel') {
            $excel = $this->reportExcelContent($report, $config);

            $this->writeAudit($request, 'Export report', 'Reports', null, 'Exported '.$report['title'].' as Excel.');

            return response($excel['content'], 200, [
                'Content-Type' => $excel['mime'],
                'Content-Disposition' => 'attachment; filename="'.$baseName.'.'.$excel['extension'].'"',
                'Cache-Control' => 'no-store, no-cache, must-revalidate',
            ]);
        }

        $this->writeAudit($request, 'Export report', 'Reports', null, 'Exported '.$report['title'].' as PDF.');

        return response($this->reportPdfContent($report, $config), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$baseName.'.pdf"',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    private function reportConfig(Request $request): array
    {
        $data = $request->validate([
            'type' => ['nullable', Rule::in(['monthly-incident', 'annual-vaccination', 'inventory', 'compliance', 'barangay-analysis'])],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'barangay' => ['nullable', 'string', 'max:150'],
            'format' => ['nullable', Rule::in(['PDF', 'Excel'])],
        ]);

        $dateFrom = Carbon::parse($data['date_from'] ?? now()->startOfMonth()->toDateString())->startOfDay();
        $dateTo = Carbon::parse($data['date_to'] ?? now()->toDateString())->endOfDay();

        if ($dateFrom->gt($dateTo)) {
            [$dateFrom, $dateTo] = [$dateTo->copy()->startOfDay(), $dateFrom->copy()->endOfDay()];
        }

        return [
            'type' => $data['type'] ?? 'monthly-incident',
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'barangay' => $data['barangay'] ?? 'All',
            'format' => $data['format'] ?? 'PDF',
        ];
    }

    private function buildReportData(array $config): array
    {
        return match ($config['type']) {
            'annual-vaccination' => $this->vaccinationReportData($config),
            'inventory' => $this->inventoryReportData($config),
            'compliance' => $this->complianceReportData($config),
            'barangay-analysis' => $this->barangayReportData($config),
            default => $this->incidentReportData($config),
        };
    }

    private function incidentReportData(array $config): array
    {
        $incidents = $this->filteredIncidentQuery($config)
            ->with(['patient', 'barangay'])
            ->orderBy('incident_date')
            ->get();

        $categoryCounts = $incidents->groupBy(fn (Incident $incident) => $this->displayCategory($incident->who_category))
            ->map->count()
            ->sortKeys();
        $animalCounts = $incidents->groupBy('animal_type')->map->count()->sortKeys();
        $barangayCounts = $incidents->groupBy(fn (Incident $incident) => $incident->barangay?->name ?? 'Unknown')
            ->map->count()
            ->sortDesc();

        return [
            'title' => 'Monthly Incident Report',
            'sections' => ['Executive Summary', 'Cases by Barangay', 'WHO Category Distribution', 'Animal Type Breakdown', 'Patient Demographics', 'Incident Register'],
            'summary' => [
                ['label' => 'Total Bite Cases', 'value' => $incidents->count()],
                ['label' => 'Active Cases', 'value' => $incidents->where('status', 'Active')->count()],
                ['label' => 'Completed Cases', 'value' => $incidents->where('status', 'Completed')->count()],
                ['label' => 'Top Barangay', 'value' => $barangayCounts->keys()->first() ?? 'None'],
                ['label' => 'Top Animal Type', 'value' => $animalCounts->sortDesc()->keys()->first() ?? 'None'],
            ],
            'headers' => ['Date', 'Patient', 'Age/Sex', 'Barangay', 'Animal', 'Bite Site', 'WHO', 'Status'],
            'rows' => $incidents->map(fn (Incident $incident) => [
                optional($incident->incident_date)->toDateString(),
                $incident->patient?->full_name ?? 'Unknown',
                ($incident->patient?->age ?? '-').'/'.($incident->patient?->sex ?? '-'),
                $incident->barangay?->name ?? 'Unknown',
                $incident->animal_type,
                $incident->bite_site,
                $this->displayCategory($incident->who_category),
                $incident->status,
            ])->values()->all(),
            'breakdowns' => [
                'WHO Categories' => $this->collectionToPairs($categoryCounts),
                'Animal Types' => $this->collectionToPairs($animalCounts),
                'Barangays' => $this->collectionToPairs($barangayCounts),
            ],
        ];
    }

    private function vaccinationReportData(array $config): array
    {
        $schedules = $this->filteredPepScheduleQuery($config)
            ->with(['incident.patient', 'incident.barangay', 'administrator'])
            ->orderBy('scheduled_date')
            ->get();

        $done = $schedules->where('status', 'Done')->count();
        $total = $schedules->count();
        $statusCounts = $schedules->groupBy('status')->map->count()->sortKeys();

        return [
            'title' => 'Annual Vaccination Summary',
            'sections' => ['Dose Summary', 'PEP Completion', 'Doses by Status', 'Vaccination Register'],
            'summary' => [
                ['label' => 'Scheduled Doses', 'value' => $total],
                ['label' => 'Completed Doses', 'value' => $done],
                ['label' => 'Pending/Upcoming', 'value' => $schedules->whereIn('status', ['Pending', 'Upcoming'])->count()],
                ['label' => 'Missed Doses', 'value' => $schedules->where('status', 'Missed')->count()],
                ['label' => 'Completion Rate', 'value' => $total > 0 ? round(($done / $total) * 100, 1).'%' : '0%'],
            ],
            'headers' => ['Schedule Date', 'Patient', 'Barangay', 'Dose Day', 'Status', 'Administered Date', 'Vaccine', 'Administered By'],
            'rows' => $schedules->map(fn (PepSchedule $schedule) => [
                optional($schedule->scheduled_date)->toDateString(),
                $schedule->incident?->patient?->full_name ?? 'Unknown',
                $schedule->incident?->barangay?->name ?? 'Unknown',
                'Day '.$schedule->dose_day,
                $schedule->status,
                optional($schedule->administered_date)->toDateString() ?? '-',
                $schedule->vaccine_type,
                $schedule->administrator?->name ?? '-',
            ])->values()->all(),
            'breakdowns' => [
                'Dose Status' => $this->collectionToPairs($statusCounts),
            ],
        ];
    }

    private function inventoryReportData(array $config): array
    {
        $items = Inventory::with('updatedBy')->orderBy('item_name')->get();
        $transactions = InventoryTransaction::whereBetween('created_at', [$config['date_from'], $config['date_to']])->count();
        $lowStock = $items->filter(fn (Inventory $item) => $item->current_stock > 0 && $item->current_stock < $item->reorder_level)->count();
        $critical = $items->where('current_stock', '<=', 0)->count();

        return [
            'title' => 'Inventory Report',
            'sections' => ['Current Stock Levels', 'Low Stock Alerts', 'Critical Items', 'Reorder Recommendations'],
            'summary' => [
                ['label' => 'Total Items', 'value' => $items->count()],
                ['label' => 'Low Stock Items', 'value' => $lowStock],
                ['label' => 'Critical Items', 'value' => $critical],
                ['label' => 'Transactions in Period', 'value' => $transactions],
            ],
            'headers' => ['Item', 'Type', 'Current Stock', 'Unit', 'Reorder Level', 'Status', 'Expiry Date', 'Last Updated By'],
            'rows' => $items->map(function (Inventory $item) {
                $status = $item->current_stock <= 0 ? 'Critical' : ($item->current_stock < $item->reorder_level ? 'Low' : 'OK');

                return [
                    $item->item_name,
                    $item->item_type,
                    $item->current_stock,
                    $item->unit,
                    $item->reorder_level,
                    $status,
                    optional($item->expiry_date)->toDateString() ?? '-',
                    $item->updatedBy?->name ?? '-',
                ];
            })->values()->all(),
            'breakdowns' => [
                'Stock Status' => [
                    ['label' => 'OK', 'value' => $items->count() - $lowStock - $critical],
                    ['label' => 'Low', 'value' => $lowStock],
                    ['label' => 'Critical', 'value' => $critical],
                ],
            ],
        ];
    }

    private function complianceReportData(array $config): array
    {
        $incidents = $this->filteredIncidentQuery($config)
            ->with(['patient', 'barangay', 'pepSchedules'])
            ->orderBy('incident_date')
            ->get();

        $totalSchedules = $incidents->flatMap(fn (Incident $incident) => $incident->pepSchedules)->count();
        $doneSchedules = $incidents->flatMap(fn (Incident $incident) => $incident->pepSchedules)->where('status', 'Done')->count();

        return [
            'title' => 'PEP Compliance Report',
            'sections' => ['Overall Compliance Rate', 'Compliance by Patient', 'Missed Appointments', 'Follow-up Priorities'],
            'summary' => [
                ['label' => 'Patients/Incidents Reviewed', 'value' => $incidents->count()],
                ['label' => 'Total PEP Doses', 'value' => $totalSchedules],
                ['label' => 'Completed Doses', 'value' => $doneSchedules],
                ['label' => 'Missed Doses', 'value' => $incidents->flatMap(fn (Incident $incident) => $incident->pepSchedules)->where('status', 'Missed')->count()],
                ['label' => 'Overall Compliance', 'value' => $totalSchedules > 0 ? round(($doneSchedules / $totalSchedules) * 100, 1).'%' : '0%'],
            ],
            'headers' => ['Patient', 'Barangay', 'Incident Date', 'WHO', 'Completed Doses', 'Total Doses', 'Compliance', 'Case Status'],
            'rows' => $incidents->map(function (Incident $incident) {
                $total = $incident->pepSchedules->count();
                $done = $incident->pepSchedules->where('status', 'Done')->count();

                return [
                    $incident->patient?->full_name ?? 'Unknown',
                    $incident->barangay?->name ?? 'Unknown',
                    optional($incident->incident_date)->toDateString(),
                    $this->displayCategory($incident->who_category),
                    $done,
                    $total,
                    $total > 0 ? round(($done / $total) * 100, 1).'%' : '0%',
                    $incident->status,
                ];
            })->values()->all(),
            'breakdowns' => [],
        ];
    }

    private function barangayReportData(array $config): array
    {
        $incidents = $this->filteredIncidentQuery($config)
            ->with(['barangay', 'pepSchedules'])
            ->get();

        $groups = $incidents->groupBy(fn (Incident $incident) => $incident->barangay?->name ?? 'Unknown')->sortKeys();

        return [
            'title' => 'Barangay Analysis Report',
            'sections' => ['Barangay Risk Summary', 'Incident Density', 'Animal Type Patterns', 'PEP Compliance by Barangay'],
            'summary' => [
                ['label' => 'Barangays With Cases', 'value' => $groups->count()],
                ['label' => 'Total Incidents', 'value' => $incidents->count()],
                ['label' => 'High Risk Barangays', 'value' => $groups->filter(fn ($items) => $items->count() >= 21)->count()],
                ['label' => 'Moderate Risk Barangays', 'value' => $groups->filter(fn ($items) => $items->count() >= 11 && $items->count() <= 20)->count()],
            ],
            'headers' => ['Barangay', 'Total Incidents', 'Risk Level', 'Top Animal Type', 'Category I', 'Category II', 'Category III', 'PEP Compliance'],
            'rows' => $groups->map(function ($items, string $barangay) {
                $total = $items->count();
                $pepSchedules = $items->flatMap(fn (Incident $incident) => $incident->pepSchedules);
                $pepTotal = $pepSchedules->count();
                $pepDone = $pepSchedules->where('status', 'Done')->count();
                $animalCounts = $items->groupBy('animal_type')->map->count()->sortDesc();

                return [
                    $barangay,
                    $total,
                    $this->riskLevelForIncidentCount($total),
                    $animalCounts->keys()->first() ?? 'None',
                    $items->where('who_category', 'I')->count(),
                    $items->where('who_category', 'II')->count(),
                    $items->where('who_category', 'III')->count(),
                    $pepTotal > 0 ? round(($pepDone / $pepTotal) * 100, 1).'%' : '0%',
                ];
            })->values()->all(),
            'breakdowns' => [],
        ];
    }

    private function filteredIncidentQuery(array $config)
    {
        $query = Incident::query()
            ->whereBetween('incident_date', [
                $config['date_from']->toDateString(),
                $config['date_to']->toDateString(),
            ]);

        if (($config['barangay'] ?? 'All') !== 'All') {
            $query->whereHas('barangay', fn ($barangayQuery) => $barangayQuery->where('name', $config['barangay']));
        }

        return $query;
    }

    private function filteredPepScheduleQuery(array $config)
    {
        $query = PepSchedule::query()
            ->whereBetween('scheduled_date', [
                $config['date_from']->toDateString(),
                $config['date_to']->toDateString(),
            ]);

        if (($config['barangay'] ?? 'All') !== 'All') {
            $query->whereHas('incident.barangay', fn ($barangayQuery) => $barangayQuery->where('name', $config['barangay']));
        }

        return $query;
    }

    private function reportSummaryPayload(array $report, array $config): array
    {
        return [
            'title' => $report['title'],
            'period' => $config['date_from']->toDateString().' to '.$config['date_to']->toDateString(),
            'barangay' => $config['barangay'],
            'format' => $config['format'],
            'sections' => $report['sections'],
            'summary' => $report['summary'],
            'headers' => $report['headers'],
            'rows' => array_slice($report['rows'], 0, 10),
            'row_count' => count($report['rows']),
            'breakdowns' => $report['breakdowns'],
            'generated_at' => now()->toDateTimeString(),
        ];
    }

    private function reportExcelContent(array $report, array $config): array
    {
        if (! class_exists(\ZipArchive::class)) {
            return [
                'content' => $this->reportCsvContent($report, $config),
                'extension' => 'csv',
                'mime' => 'text/csv; charset=UTF-8',
            ];
        }

        $tempDir = storage_path('app/reports');

        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        $tempPath = tempnam($tempDir, 'bitemap_report_');
        $zip = new \ZipArchive;

        if ($tempPath === false || $zip->open($tempPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            return [
                'content' => $this->reportCsvContent($report, $config),
                'extension' => 'csv',
                'mime' => 'text/csv; charset=UTF-8',
            ];
        }

        $zip->addFromString('[Content_Types].xml', $this->xlsxContentTypes());
        $zip->addFromString('_rels/.rels', $this->xlsxRootRels());
        $zip->addFromString('docProps/app.xml', $this->xlsxAppXml());
        $zip->addFromString('docProps/core.xml', $this->xlsxCoreXml($report['title']));
        $zip->addFromString('xl/workbook.xml', $this->xlsxWorkbookXml());
        $zip->addFromString('xl/_rels/workbook.xml.rels', $this->xlsxWorkbookRels());
        $zip->addFromString('xl/styles.xml', $this->xlsxStylesXml());
        $zip->addFromString('xl/worksheets/sheet1.xml', $this->xlsxWorksheetXml($report, $config));
        $zip->close();

        $content = file_get_contents($tempPath) ?: $this->reportCsvContent($report, $config);
        @unlink($tempPath);

        return [
            'content' => $content,
            'extension' => 'xlsx',
            'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
    }

    private function reportCsvContent(array $report, array $config): string
    {
        $handle = fopen('php://temp', 'r+');

        fputcsv($handle, ['BITEMAP '.$report['title']]);
        fputcsv($handle, ['Period', $config['date_from']->toDateString().' to '.$config['date_to']->toDateString()]);
        fputcsv($handle, ['Barangay', $config['barangay']]);
        fputcsv($handle, ['Generated', now()->toDateTimeString()]);
        fputcsv($handle, []);
        fputcsv($handle, ['Summary']);

        foreach ($report['summary'] as $item) {
            fputcsv($handle, [$item['label'], $item['value']]);
        }

        fputcsv($handle, []);
        fputcsv($handle, ['Report Details']);
        fputcsv($handle, $report['headers']);

        foreach ($report['rows'] as $row) {
            fputcsv($handle, array_map(fn ($value) => (string) $value, $row));
        }

        foreach ($report['breakdowns'] as $title => $pairs) {
            fputcsv($handle, []);
            fputcsv($handle, [$title]);
            foreach ($pairs as $pair) {
                fputcsv($handle, [$pair['label'], $pair['value']]);
            }
        }

        rewind($handle);
        $content = stream_get_contents($handle) ?: '';
        fclose($handle);

        return "\xEF\xBB\xBF".$content;
    }

    private function xlsxWorksheetXml(array $report, array $config): string
    {
        $rows = [];
        $merges = [];
        $maxColumns = max(count($report['headers']), 6);
        $lastColumn = $this->xlsxColumnName($maxColumns);
        $rowNumber = 1;

        $rows[] = $this->xlsxRow($rowNumber, [
            $this->xlsxCell($rowNumber, 1, 'BITEMAP '.$report['title'], 1),
        ], 28);
        $merges[] = 'A1:'.$lastColumn.'1';
        $rowNumber++;

        $metadata = [
            ['Period', $config['date_from']->toDateString().' to '.$config['date_to']->toDateString()],
            ['Barangay', $config['barangay']],
            ['Generated', now()->toDateTimeString()],
        ];

        foreach ($metadata as $item) {
            $rows[] = $this->xlsxRow($rowNumber, [
                $this->xlsxCell($rowNumber, 1, $item[0], 2),
                $this->xlsxCell($rowNumber, 2, $item[1], 0),
            ]);
            $rowNumber++;
        }

        $rowNumber++;
        $rows[] = $this->xlsxRow($rowNumber, [$this->xlsxCell($rowNumber, 1, 'Executive Summary', 3)], 22);
        $merges[] = 'A'.$rowNumber.':'.$lastColumn.$rowNumber;
        $rowNumber++;

        foreach ($report['summary'] as $summary) {
            $rows[] = $this->xlsxRow($rowNumber, [
                $this->xlsxCell($rowNumber, 1, $summary['label'], 6),
                $this->xlsxCell($rowNumber, 2, $summary['value'], 7),
            ]);
            $rowNumber++;
        }

        $rowNumber++;
        $rows[] = $this->xlsxRow($rowNumber, [$this->xlsxCell($rowNumber, 1, 'Report Details', 3)], 22);
        $merges[] = 'A'.$rowNumber.':'.$lastColumn.$rowNumber;
        $rowNumber++;
        $tableHeaderRow = $rowNumber;

        $headerCells = [];
        foreach ($report['headers'] as $index => $header) {
            $headerCells[] = $this->xlsxCell($rowNumber, $index + 1, $header, 4);
        }
        $rows[] = $this->xlsxRow($rowNumber, $headerCells, 22);
        $rowNumber++;

        if ($report['rows'] === []) {
            $rows[] = $this->xlsxRow($rowNumber, [$this->xlsxCell($rowNumber, 1, 'No rows found for this report filter.', 5)]);
            $merges[] = 'A'.$rowNumber.':'.$lastColumn.$rowNumber;
            $rowNumber++;
        } else {
            foreach ($report['rows'] as $rowIndex => $row) {
                $cells = [];
                foreach ($row as $cellIndex => $value) {
                    $cells[] = $this->xlsxCell($rowNumber, $cellIndex + 1, $value, $rowIndex % 2 === 0 ? 5 : 8);
                }
                $rows[] = $this->xlsxRow($rowNumber, $cells);
                $rowNumber++;
            }
        }

        foreach ($report['breakdowns'] as $title => $pairs) {
            $rowNumber++;
            $rows[] = $this->xlsxRow($rowNumber, [$this->xlsxCell($rowNumber, 1, $title, 3)], 22);
            $merges[] = 'A'.$rowNumber.':B'.$rowNumber;
            $rowNumber++;

            foreach ($pairs as $pair) {
                $rows[] = $this->xlsxRow($rowNumber, [
                    $this->xlsxCell($rowNumber, 1, $pair['label'], 6),
                    $this->xlsxCell($rowNumber, 2, $pair['value'], 7),
                ]);
                $rowNumber++;
            }
        }

        $columnWidths = $this->xlsxColumnWidths($report['headers'], $maxColumns);
        $cols = '<cols>';
        foreach ($columnWidths as $index => $width) {
            $column = $index + 1;
            $cols .= '<col min="'.$column.'" max="'.$column.'" width="'.$width.'" customWidth="1"/>';
        }
        $cols .= '</cols>';

        $mergeXml = '';
        if ($merges !== []) {
            $mergeXml = '<mergeCells count="'.count($merges).'">'.implode('', array_map(fn ($range) => '<mergeCell ref="'.$range.'"/>', $merges)).'</mergeCells>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            .'<sheetViews><sheetView workbookViewId="0"><pane ySplit="'.max(1, $tableHeaderRow).'" topLeftCell="A'.($tableHeaderRow + 1).'" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            .'<sheetFormatPr defaultRowHeight="18"/>'
            .$cols
            .'<sheetData>'.implode('', $rows).'</sheetData>'
            .$mergeXml
            .'<autoFilter ref="A'.$tableHeaderRow.':'.$this->xlsxColumnName(max(1, count($report['headers']))).max($tableHeaderRow, $tableHeaderRow + count($report['rows'])).'"/>'
            .'<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>'
            .'</worksheet>';
    }

    private function xlsxRow(int $rowNumber, array $cells, ?int $height = null): string
    {
        $heightAttribute = $height ? ' ht="'.$height.'" customHeight="1"' : '';

        return '<row r="'.$rowNumber.'"'.$heightAttribute.'>'.implode('', $cells).'</row>';
    }

    private function xlsxCell(int $row, int $column, mixed $value, int $style = 0): string
    {
        $reference = $this->xlsxColumnName($column).$row;
        $styleAttribute = $style > 0 ? ' s="'.$style.'"' : '';

        if (is_int($value) || is_float($value)) {
            return '<c r="'.$reference.'"'.$styleAttribute.'><v>'.$value.'</v></c>';
        }

        $text = htmlspecialchars((string) $value, ENT_QUOTES | ENT_XML1, 'UTF-8');

        return '<c r="'.$reference.'" t="inlineStr"'.$styleAttribute.'><is><t>'.$text.'</t></is></c>';
    }

    private function xlsxColumnName(int $column): string
    {
        $name = '';
        while ($column > 0) {
            $column--;
            $name = chr(65 + ($column % 26)).$name;
            $column = intdiv($column, 26);
        }

        return $name;
    }

    private function xlsxColumnWidths(array $headers, int $maxColumns): array
    {
        $signature = implode('|', $headers);
        $widths = match ($signature) {
            'Item|Type|Current Stock|Unit|Reorder Level|Status|Expiry Date|Last Updated By' => [28, 18, 16, 12, 16, 14, 16, 24],
            'Date|Patient|Age/Sex|Barangay|Animal|Bite Site|WHO|Status' => [14, 26, 12, 18, 14, 22, 16, 18],
            'Schedule Date|Patient|Barangay|Dose Day|Status|Administered Date|Vaccine|Administered By' => [16, 24, 18, 12, 14, 18, 22, 24],
            'Patient|Barangay|Incident Date|WHO|Completed Doses|Total Doses|Compliance|Case Status' => [24, 18, 16, 14, 18, 14, 14, 20],
            'Barangay|Total Incidents|Risk Level|Top Animal Type|Category I|Category II|Category III|PEP Compliance' => [20, 16, 18, 22, 14, 14, 14, 18],
            default => [],
        };

        if ($widths === []) {
            $widths = array_fill(0, max(1, count($headers)), 18);
        }

        while (count($widths) < $maxColumns) {
            $widths[] = 14;
        }

        return array_slice($widths, 0, $maxColumns);
    }

    private function xlsxContentTypes(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            .'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            .'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            .'<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
            .'<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
            .'</Types>';
    }

    private function xlsxRootRels(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            .'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
            .'<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
            .'</Relationships>';
    }

    private function xlsxWorkbookXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            .'<sheets><sheet name="bitemap-report" sheetId="1" r:id="rId1"/></sheets>'
            .'</workbook>';
    }

    private function xlsxWorkbookRels(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            .'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            .'</Relationships>';
    }

    private function xlsxAppXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
            .'<Application>BITEMAP</Application>'
            .'</Properties>';
    }

    private function xlsxCoreXml(string $title): string
    {
        $safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_XML1, 'UTF-8');
        $created = now()->toAtomString();

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            .'<dc:title>'.$safeTitle.'</dc:title>'
            .'<dc:creator>BITEMAP</dc:creator>'
            .'<cp:lastModifiedBy>BITEMAP</cp:lastModifiedBy>'
            .'<dcterms:created xsi:type="dcterms:W3CDTF">'.$created.'</dcterms:created>'
            .'<dcterms:modified xsi:type="dcterms:W3CDTF">'.$created.'</dcterms:modified>'
            .'</cp:coreProperties>';
    }

    private function xlsxStylesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<fonts count="4">'
            .'<font><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/></font>'
            .'<font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
            .'<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
            .'<font><b/><sz val="11"/><color rgb="FF14532D"/><name val="Calibri"/></font>'
            .'</fonts>'
            .'<fills count="6">'
            .'<fill><patternFill patternType="none"/></fill>'
            .'<fill><patternFill patternType="gray125"/></fill>'
            .'<fill><patternFill patternType="solid"><fgColor rgb="FF16A34A"/><bgColor indexed="64"/></patternFill></fill>'
            .'<fill><patternFill patternType="solid"><fgColor rgb="FFEAF7EF"/><bgColor indexed="64"/></patternFill></fill>'
            .'<fill><patternFill patternType="solid"><fgColor rgb="FFF7FBF8"/><bgColor indexed="64"/></patternFill></fill>'
            .'<fill><patternFill patternType="solid"><fgColor rgb="FFD9EAD3"/><bgColor indexed="64"/></patternFill></fill>'
            .'</fills>'
            .'<borders count="2">'
            .'<border><left/><right/><top/><bottom/><diagonal/></border>'
            .'<border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border>'
            .'</borders>'
            .'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            .'<cellXfs count="9">'
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            .'<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center"/></xf>'
            .'<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            .'<xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>'
            .'<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>'
            .'<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>'
            .'<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>'
            .'<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>'
            .'</cellXfs>'
            .'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
            .'</styleSheet>';
    }

    private function reportPdfContent(array $report, array $config): string
    {
        return $this->structuredReportPdf($report, $config);
    }

    private function structuredReportPdf(array $report, array $config): string
    {
        $pageWidth = 842;
        $pageHeight = 595;
        $margin = 36;
        $contentWidth = $pageWidth - ($margin * 2);
        $bottomY = 48;
        $headers = $report['headers'];
        $widths = $this->reportColumnWidths($headers, $contentWidth);
        $rowHeights = array_map(fn ($row) => $this->reportRowHeight($row, $widths), $report['rows']);
        $summaryHeight = max(58, (int) ceil(max(1, count($report['summary'])) / 4) * 58);
        $pages = [];
        $currentRows = [];
        $currentHeights = [];
        $currentHeight = 0;
        $pageIndex = 0;

        foreach ($report['rows'] as $index => $row) {
            $isFirstPage = $pageIndex === 0;
            $tableStartY = $isFirstPage ? (466 - $summaryHeight) : 462;
            $availableHeight = $tableStartY - $bottomY - 32;
            $rowHeight = $rowHeights[$index];

            if ($currentRows !== [] && ($currentHeight + $rowHeight) > $availableHeight) {
                $pages[] = ['rows' => $currentRows, 'heights' => $currentHeights, 'first' => $pageIndex === 0];
                $currentRows = [];
                $currentHeights = [];
                $currentHeight = 0;
                $pageIndex++;
            }

            $currentRows[] = $row;
            $currentHeights[] = $rowHeight;
            $currentHeight += $rowHeight;
        }

        if ($currentRows !== [] || $pages === []) {
            $pages[] = ['rows' => $currentRows, 'heights' => $currentHeights, 'first' => $pageIndex === 0];
        }

        $totalPages = count($pages);
        $streams = [];

        foreach ($pages as $index => $page) {
            $streams[] = $this->reportPdfPageStream($report, $config, $page, $headers, $widths, $index + 1, $totalPages, $pageWidth, $pageHeight, $margin, $contentWidth);
        }

        return $this->pdfFromStreams($streams, $pageWidth, $pageHeight);
    }

    private function reportPdfPageStream(array $report, array $config, array $page, array $headers, array $widths, int $pageNumber, int $totalPages, int $pageWidth, int $pageHeight, int $margin, int $contentWidth): string
    {
        $ops = [];
        $this->pdfRect($ops, 0, $pageHeight - 78, $pageWidth, 78, [0.07, 0.50, 0.22]);
        $this->pdfRect($ops, $margin, $pageHeight - 58, 34, 34, [1, 1, 1]);
        $this->pdfText($ops, '!', $margin + 13, $pageHeight - 38, 18, true, [0.07, 0.50, 0.22]);
        $this->pdfText($ops, 'BITEMAP', $margin + 48, $pageHeight - 30, 18, true, [1, 1, 1]);
        $this->pdfText($ops, $report['title'], $margin + 48, $pageHeight - 50, 11, false, [0.90, 1, 0.93]);

        $metaX = $pageWidth - 312;
        $this->pdfText($ops, 'Period: '.$config['date_from']->toDateString().' to '.$config['date_to']->toDateString(), $metaX, $pageHeight - 30, 9, false, [1, 1, 1]);
        $this->pdfText($ops, 'Barangay: '.$config['barangay'], $metaX, $pageHeight - 46, 9, false, [1, 1, 1]);
        $this->pdfText($ops, 'Generated: '.now()->toDateTimeString(), $metaX, $pageHeight - 62, 9, false, [1, 1, 1]);

        $y = $pageHeight - 104;
        if ($page['first']) {
            $this->pdfText($ops, 'Executive Summary', $margin, $y, 12, true, [0.08, 0.12, 0.18]);
            $y -= 12;
            $cardGap = 10;
            $cardWidth = ($contentWidth - ($cardGap * 3)) / 4;
            $cardHeight = 46;

            foreach ($report['summary'] as $index => $item) {
                $col = $index % 4;
                $row = intdiv($index, 4);
                $x = $margin + ($col * ($cardWidth + $cardGap));
                $cardY = $y - ($row * ($cardHeight + 10)) - $cardHeight;
                $this->pdfRect($ops, $x, $cardY, $cardWidth, $cardHeight, [0.94, 0.98, 0.95]);
                $this->pdfStrokeRect($ops, $x, $cardY, $cardWidth, $cardHeight, [0.78, 0.88, 0.80]);
                $this->pdfText($ops, (string) $item['label'], $x + 9, $cardY + 28, 7.5, false, [0.34, 0.41, 0.49]);
                $this->pdfText($ops, (string) $item['value'], $x + 9, $cardY + 12, 13, true, [0.03, 0.23, 0.11]);
            }

            $summaryRows = (int) ceil(max(1, count($report['summary'])) / 4);
            $y -= ($summaryRows * 56) + 22;
        }

        $this->pdfText($ops, 'Report Details', $margin, $y, 12, true, [0.08, 0.12, 0.18]);
        $y -= 22;
        $tableTop = $y;
        $headerHeight = 24;
        $this->pdfRect($ops, $margin, $tableTop - $headerHeight, $contentWidth, $headerHeight, [0.07, 0.50, 0.22]);

        $x = $margin;
        foreach ($headers as $index => $header) {
            $this->pdfText($ops, (string) $header, $x + 5, $tableTop - 15, 7.2, true, [1, 1, 1]);
            if ($index > 0) {
                $this->pdfLine($ops, $x, $tableTop, $x, $tableTop - $headerHeight, [0.58, 0.80, 0.64], 0.5);
            }
            $x += $widths[$index];
        }

        $y = $tableTop - $headerHeight;

        if ($page['rows'] === []) {
            $this->pdfRect($ops, $margin, $y - 34, $contentWidth, 34, [0.98, 0.99, 0.98]);
            $this->pdfStrokeRect($ops, $margin, $y - 34, $contentWidth, 34, [0.86, 0.90, 0.86]);
            $this->pdfText($ops, 'No rows found for this report filter.', $margin + 10, $y - 21, 9, false, [0.36, 0.42, 0.48]);
            $y -= 34;
        } else {
            foreach ($page['rows'] as $rowIndex => $row) {
                $rowHeight = $page['heights'][$rowIndex];
                $fill = $rowIndex % 2 === 0 ? [1, 1, 1] : [0.97, 0.99, 0.98];
                $this->pdfRect($ops, $margin, $y - $rowHeight, $contentWidth, $rowHeight, $fill);
                $this->pdfStrokeRect($ops, $margin, $y - $rowHeight, $contentWidth, $rowHeight, [0.86, 0.90, 0.86]);

                $x = $margin;
                foreach ($row as $cellIndex => $cell) {
                    if ($cellIndex > 0) {
                        $this->pdfLine($ops, $x, $y, $x, $y - $rowHeight, [0.90, 0.93, 0.90], 0.4);
                    }
                    $lines = $this->pdfWrapCell((string) $cell, $widths[$cellIndex], 7.3, 3);
                    foreach ($lines as $lineIndex => $line) {
                        $this->pdfText($ops, $line, $x + 5, $y - 13 - ($lineIndex * 10), 7.3, false, [0.10, 0.13, 0.18]);
                    }
                    $x += $widths[$cellIndex];
                }

                $y -= $rowHeight;
            }
        }

        $this->pdfLine($ops, $margin, 35, $pageWidth - $margin, 35, [0.82, 0.86, 0.82], 0.5);
        $this->pdfText($ops, 'BITEMAP - GIS-Based Anti-Rabies Vaccination Monitoring', $margin, 20, 7.5, false, [0.38, 0.45, 0.52]);
        $this->pdfText($ops, 'Page '.$pageNumber.' of '.$totalPages, $pageWidth - 92, 20, 7.5, false, [0.38, 0.45, 0.52]);

        return implode("\n", $ops);
    }

    private function reportColumnWidths(array $headers, int $contentWidth): array
    {
        $signature = implode('|', $headers);
        $widths = match ($signature) {
            'Item|Type|Current Stock|Unit|Reorder Level|Status|Expiry Date|Last Updated By' => [170, 95, 80, 55, 85, 70, 95, 120],
            'Date|Patient|Age/Sex|Barangay|Animal|Bite Site|WHO|Status' => [75, 150, 65, 115, 75, 120, 75, 95],
            'Schedule Date|Patient|Barangay|Dose Day|Status|Administered Date|Vaccine|Administered By' => [85, 130, 95, 65, 75, 90, 120, 110],
            'Patient|Barangay|Incident Date|WHO|Completed Doses|Total Doses|Compliance|Case Status' => [145, 110, 90, 70, 90, 75, 85, 105],
            'Barangay|Total Incidents|Risk Level|Top Animal Type|Category I|Category II|Category III|PEP Compliance' => [125, 85, 100, 120, 70, 70, 70, 130],
            default => [],
        };

        if ($widths === []) {
            return array_fill(0, count($headers), $contentWidth / max(1, count($headers)));
        }

        $scale = $contentWidth / array_sum($widths);

        return array_map(fn ($width) => $width * $scale, $widths);
    }

    private function reportRowHeight(array $row, array $widths): int
    {
        $maxLines = 1;
        foreach ($row as $index => $cell) {
            $maxLines = max($maxLines, count($this->pdfWrapCell((string) $cell, $widths[$index] ?? 80, 7.3, 3)));
        }

        return max(24, 12 + ($maxLines * 10));
    }

    private function pdfWrapCell(string $value, float $width, float $fontSize, int $maxLines): array
    {
        $value = $this->pdfSafeText($value);
        $maxChars = max(8, (int) floor(($width - 10) / ($fontSize * 0.52)));
        $wrapped = explode("\n", wordwrap($value === '' ? '-' : $value, $maxChars, "\n", true));
        $lines = array_slice($wrapped, 0, $maxLines);

        if (count($wrapped) > $maxLines) {
            $last = $lines[$maxLines - 1] ?? '';
            $lines[$maxLines - 1] = rtrim(substr($last, 0, max(0, $maxChars - 3))).'...';
        }

        return $lines ?: ['-'];
    }

    private function pdfFromStreams(array $streams, int $pageWidth, int $pageHeight): string
    {
        $objects = [];
        $objects[] = '<< /Type /Catalog /Pages 2 0 R >>';
        $pageObjectNumbers = [];
        $contentObjectNumbers = [];
        $nextObject = 5;

        foreach ($streams as $_) {
            $pageObjectNumbers[] = $nextObject++;
            $contentObjectNumbers[] = $nextObject++;
        }

        $kids = implode(' ', array_map(fn ($number) => $number.' 0 R', $pageObjectNumbers));
        $objects[] = '<< /Type /Pages /Kids ['.$kids.'] /Count '.count($streams).' >>';
        $objects[] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
        $objects[] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

        foreach ($streams as $index => $stream) {
            $contentObject = $contentObjectNumbers[$index];
            $objects[] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '.$pageWidth.' '.$pageHeight.'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '.$contentObject.' 0 R >>';
            $objects[] = '<< /Length '.strlen($stream).' >>'."\nstream\n".$stream."\nendstream";
        }

        $pdf = "%PDF-1.4\n";
        $offsets = [0];

        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1)." 0 obj\n".$object."\nendobj\n";
        }

        $xrefOffset = strlen($pdf);
        $pdf .= "xref\n0 ".(count($objects) + 1)."\n";
        $pdf .= "0000000000 65535 f \n";

        for ($i = 1; $i <= count($objects); $i++) {
            $pdf .= str_pad((string) $offsets[$i], 10, '0', STR_PAD_LEFT)." 00000 n \n";
        }

        return $pdf."trailer\n<< /Size ".(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n".$xrefOffset."\n%%EOF";
    }

    private function pdfText(array &$ops, string $text, float $x, float $y, float $size, bool $bold = false, array $color = [0, 0, 0]): void
    {
        $font = $bold ? 'F2' : 'F1';
        $ops[] = 'BT /'.$font.' '.$size.' Tf '.$color[0].' '.$color[1].' '.$color[2].' rg '.$x.' '.$y.' Td ('.$this->pdfEscape($this->pdfSafeText($text)).') Tj ET';
    }

    private function pdfRect(array &$ops, float $x, float $y, float $width, float $height, array $color): void
    {
        $ops[] = 'q '.$color[0].' '.$color[1].' '.$color[2].' rg '.$x.' '.$y.' '.$width.' '.$height.' re f Q';
    }

    private function pdfStrokeRect(array &$ops, float $x, float $y, float $width, float $height, array $color, float $lineWidth = 0.5): void
    {
        $ops[] = 'q '.$color[0].' '.$color[1].' '.$color[2].' RG '.$lineWidth.' w '.$x.' '.$y.' '.$width.' '.$height.' re S Q';
    }

    private function pdfLine(array &$ops, float $x1, float $y1, float $x2, float $y2, array $color, float $lineWidth = 0.5): void
    {
        $ops[] = 'q '.$color[0].' '.$color[1].' '.$color[2].' RG '.$lineWidth.' w '.$x1.' '.$y1.' m '.$x2.' '.$y2.' l S Q';
    }

    private function pdfSafeText(string $value): string
    {
        $value = preg_replace('/\s+/', ' ', trim($value)) ?? '';
        $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if ($converted !== false) {
            $value = $converted;
        }

        return preg_replace('/[^\x20-\x7E]/', '', $value) ?? '';
    }

    private function pdfEscape(string $value): string
    {
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $value);
    }

    private function reportFileBaseName(string $title, array $config): string
    {
        $slug = strtolower((string) preg_replace('/[^A-Za-z0-9]+/', '-', $title));
        $slug = trim($slug, '-') ?: 'report';

        return 'bitemap-'.$slug.'-'.$config['date_from']->toDateString().'-'.$config['date_to']->toDateString();
    }

    private function collectionToPairs($collection): array
    {
        return $collection->map(fn ($value, $label) => [
            'label' => (string) $label,
            'value' => $value,
        ])->values()->all();
    }

    public function publicStatistics(): JsonResponse
    {
        try {
            $year = (int) now()->year;
            $currentMonth = (int) now()->month;
            $incidents = Incident::with(['barangay', 'patient'])
                ->whereYear('incident_date', $year)
                ->get();

            $incidentIds = $incidents->pluck('id');
            $pepSchedules = PepSchedule::whereIn('incident_id', $incidentIds)->get();
            $totalDoses = $pepSchedules->count();
            $completedDoses = $pepSchedules->where('status', 'Done')->count();
            $vaccinationRate = $totalDoses > 0 ? round(($completedDoses / $totalDoses) * 100, 1) : 0;
            $animalCounts = $incidents
                ->groupBy(fn (Incident $incident) => $incident->animal_type ?: 'Unknown')
                ->map(fn ($group) => $group->count())
                ->sortDesc();
            $barangayCounts = $incidents
                ->filter(fn (Incident $incident) => $incident->barangay_id !== null)
                ->groupBy(fn (Incident $incident) => $incident->barangay?->name ?? 'Unknown')
                ->map(fn ($group) => $group->count())
                ->sortDesc();

            $monthlyCases = collect(range(1, $currentMonth))
                ->map(fn (int $month) => [
                    'month' => Carbon::create($year, $month, 1)->format('M'),
                    'cases' => $incidents
                        ->filter(fn (Incident $incident) => optional($incident->incident_date)->month === $month)
                        ->count(),
                ])
                ->values();

            $ageGroups = [
                ['group' => '0-17', 'min' => 0, 'max' => 17],
                ['group' => '18-35', 'min' => 18, 'max' => 35],
                ['group' => '36-50', 'min' => 36, 'max' => 50],
                ['group' => '51+', 'min' => 51, 'max' => null],
            ];

            $ageGroupDistribution = collect($ageGroups)
                ->map(fn (array $range) => [
                    'group' => $range['group'],
                    'cases' => $incidents
                        ->filter(function (Incident $incident) use ($range): bool {
                            $age = $incident->patient?->age;

                            if ($age === null) {
                                return false;
                            }

                            return $age >= $range['min'] && ($range['max'] === null || $age <= $range['max']);
                        })
                        ->count(),
                ])
                ->values();

            return response()->json([
                'success' => true,
                'year' => $year,
                'totalCases' => $incidents->count(),
                'activeCases' => $incidents->where('status', 'Active')->count(),
                'completedVaccinations' => $incidents->where('status', 'Completed')->count(),
                'completedDoses' => $completedDoses,
                'pendingDoses' => $pepSchedules->whereIn('status', ['Pending', 'Upcoming'])->count(),
                'vaccinationRate' => $vaccinationRate,
                'highRiskBarangays' => $barangayCounts->filter(fn (int $count) => $count >= 21)->count(),
                'averageCasesPerMonth' => $currentMonth > 0 ? round($incidents->count() / $currentMonth, 1) : 0,
                'topBarangay' => $barangayCounts->keys()->first() ?? 'N/A',
                'topAnimalType' => $animalCounts->keys()->first() ?? 'N/A',
                'monthlyCases' => $monthlyCases,
                'animalTypeDistribution' => $animalCounts
                    ->map(fn (int $count, string $animal) => ['name' => $animal, 'value' => $count])
                    ->values(),
                'ageGroupDistribution' => $ageGroupDistribution,
            ]);
        } catch (\Throwable $exception) {
            return $this->publicApiFailure(
                $exception,
                'Public statistics are temporarily unavailable. Please try again later.',
                'PUBLIC_STATISTICS_UNAVAILABLE'
            );
        }
    }

    public function publicHeatmap(Request $request): JsonResponse
    {
        try {
            $filters = $request->validate([
                'date_from' => ['nullable', 'date'],
                'date_to' => ['nullable', 'date'],
                'animal_type' => ['nullable', 'string'],
                'who_category' => ['nullable', 'string'],
            ]);

            $query = Incident::with(['barangay', 'pepSchedules']);

            if (! blank($filters['date_from'] ?? null)) {
                $query->whereDate('incident_date', '>=', $filters['date_from']);
            }

            if (! blank($filters['date_to'] ?? null)) {
                $query->whereDate('incident_date', '<=', $filters['date_to']);
            }

            if (! blank($filters['animal_type'] ?? null) && strtolower($filters['animal_type']) !== 'all') {
                $query->where('animal_type', $this->normalizeAnimalType($filters['animal_type']));
            }

            if (! blank($filters['who_category'] ?? null) && strtolower($filters['who_category']) !== 'all') {
                $query->where('who_category', $this->normalizeWhoCategory($filters['who_category']));
            }

            $incidents = $query->get()
                ->filter(fn (Incident $incident) => $this->incidentMapLocation($incident) !== null)
                ->values();

            $data = $incidents
                ->groupBy(fn (Incident $incident) => $incident->barangay->name)
                ->map(function ($group, string $barangayName): array {
                    $totalIncidents = $group->count();
                    $pepSchedules = $group->flatMap(fn (Incident $incident) => $incident->pepSchedules);
                    $pepScheduleCount = $pepSchedules->count();
                    $pepDoneCount = $pepSchedules->where('status', 'Done')->count();
                    $topAnimalType = $group
                        ->groupBy('animal_type')
                        ->map(fn ($animalGroup) => $animalGroup->count())
                        ->sortDesc()
                        ->keys()
                        ->first() ?? 'N/A';
                    $latestIncident = $group->sortByDesc('id')->first();
                    $locations = $group
                        ->map(fn (Incident $incident) => $this->incidentMapLocation($incident))
                        ->filter()
                        ->values();

                    return [
                        'incident_id' => $latestIncident?->id,
                        'incident_ids' => $group->pluck('id')->values(),
                        'barangay_name' => $barangayName,
                        'latitude' => round((float) $locations->avg('lat'), 8),
                        'longitude' => round((float) $locations->avg('lng'), 8),
                        'total_incident_count' => $totalIncidents,
                        'total_incidents' => $totalIncidents,
                        'top_animal_type' => $topAnimalType,
                        'pep_compliance_rate' => $pepScheduleCount > 0
                            ? round(($pepDoneCount / $pepScheduleCount) * 100, 1)
                            : 0,
                        'risk_level' => $this->riskLevelForIncidentCount($totalIncidents),
                    ];
                })
                ->sortByDesc('total_incident_count')
                ->values();

            $heatPoints = $data->map(fn (array $item) => [
                'barangay_name' => $item['barangay_name'],
                'latitude' => $item['latitude'],
                'longitude' => $item['longitude'],
                'intensity' => $this->heatIntensityForIncidentCount($item['total_incident_count']),
                'total_incident_count' => $item['total_incident_count'],
            ])->values();

            return response()->json([
                'success' => true,
                'data' => $data,
                'heat_points' => $heatPoints,
                'bounds' => [
                    'southwest' => [self::DIGOS_BOUNDS['south'], self::DIGOS_BOUNDS['west']],
                    'northeast' => [self::DIGOS_BOUNDS['north'], self::DIGOS_BOUNDS['east']],
                ],
                'center' => [self::DIGOS_CENTER['lat'], self::DIGOS_CENTER['lng']],
                'zoom' => 13,
                'generated_at' => now()->toDateTimeString(),
            ]);
        } catch (\Throwable $exception) {
            return $this->publicApiFailure($exception, 'Unable to load map data.', 'PUBLIC_MAP_UNAVAILABLE');
        }
    }

    public function publicBarangayStats(): JsonResponse
    {
        try {
            $year = (int) now()->year;
            $stats = Barangay::withCount([
                'incidents' => fn ($query) => $query->whereYear('incident_date', $year),
            ])
                ->orderByDesc('incidents_count')
                ->get()
                ->mapWithKeys(fn (Barangay $barangay) => [$barangay->name => $barangay->incidents_count]);

            return response()->json(['success' => true, 'year' => $year, 'data' => $stats]);
        } catch (\Throwable $exception) {
            return $this->publicApiFailure(
                $exception,
                'Public statistics are temporarily unavailable. Please try again later.',
                'PUBLIC_BARANGAY_STATISTICS_UNAVAILABLE'
            );
        }
    }

    public function publicClinics(): JsonResponse
    {
        try {
            $keys = [
                'clinic_public_listing_enabled',
                'clinic_name',
                'clinic_type',
                'clinic_address',
                'clinic_barangay',
                'contact_email',
                'contact_number',
                'clinic_operating_hours',
                'clinic_services',
                'clinic_latitude',
                'clinic_longitude',
                'clinic_public_notes',
                'clinic_verified_at',
            ];
            $settings = Setting::query()
                ->whereIn('setting_key', $keys)
                ->pluck('setting_value', 'setting_key');

            if (! filter_var($settings->get('clinic_public_listing_enabled', false), FILTER_VALIDATE_BOOL)) {
                return response()->json(['success' => true, 'data' => []]);
            }

            $name = trim((string) $settings->get('clinic_name', ''));
            if ($name === '') {
                return response()->json(['success' => true, 'data' => []]);
            }

            $servicesValue = $settings->get('clinic_services');
            $services = [];
            if (is_string($servicesValue) && $servicesValue !== '') {
                $decoded = json_decode($servicesValue, true);
                $services = is_array($decoded)
                    ? array_values(array_filter($decoded, 'is_string'))
                    : array_values(array_filter(array_map('trim', explode(',', $servicesValue))));
            }

            $latitude = is_numeric($settings->get('clinic_latitude')) ? (float) $settings->get('clinic_latitude') : null;
            $longitude = is_numeric($settings->get('clinic_longitude')) ? (float) $settings->get('clinic_longitude') : null;
            $verifiedAt = $settings->get('clinic_verified_at');
            $lastUpdated = Setting::query()->whereIn('setting_key', $keys)->max('updated_at');

            return response()->json([
                'success' => true,
                'data' => [[
                    'public_id' => 'primary-clinic',
                    'name' => $name,
                    'clinic_type' => $settings->get('clinic_type') ?: null,
                    'address' => $settings->get('clinic_address') ?: null,
                    'barangay' => $settings->get('clinic_barangay') ?: null,
                    'phone' => $settings->get('contact_number') ?: null,
                    'public_email' => $settings->get('contact_email') ?: null,
                    'operating_hours' => $settings->get('clinic_operating_hours') ?: null,
                    'services' => $services,
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'public_notes' => $settings->get('clinic_public_notes') ?: null,
                    'verified' => ! blank($verifiedAt),
                    'last_verified_at' => $verifiedAt ?: null,
                    'last_updated_at' => $lastUpdated ? Carbon::parse($lastUpdated)->toDateString() : null,
                    'open_now' => null,
                ]],
            ]);
        } catch (\Throwable $exception) {
            return $this->publicApiFailure(
                $exception,
                'Unable to load clinic information. Please try again later.',
                'PUBLIC_CLINIC_DIRECTORY_UNAVAILABLE'
            );
        }
    }

    private function publicApiFailure(\Throwable $exception, string $message, string $code): JsonResponse
    {
        Log::error('Public API request failed', [
            'exception' => $exception,
            'error_code' => $code,
        ]);

        return response()->json([
            'success' => false,
            'message' => $message,
            'error' => $message,
            'code' => $code,
        ], 500);
    }

    public function animals(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [],
            'message' => 'Animal registry is not part of the current MySQL schema.',
        ]);
    }

    private function validatePatient(Request $request, bool $creating): array
    {
        $input = $request->all();
        if (blank($input['full_name'] ?? null) && filled($input['patient_name'] ?? null)) {
            $input['full_name'] = $input['patient_name'];
        }
        $structuredNameFields = ['first_name', 'middle_name', 'last_name', 'suffix'];
        $structuredAddressFields = ['address_line', 'residence_barangay', 'city_municipality', 'province'];
        $hasStructuredName = collect($structuredNameFields)->contains(fn (string $field): bool => $request->exists($field));
        $hasStructuredAddress = collect($structuredAddressFields)->contains(fn (string $field): bool => $request->exists($field));

        foreach (array_merge($structuredNameFields, $structuredAddressFields, ['full_name', 'address', 'contact_number']) as $field) {
            if (array_key_exists($field, $input) && is_string($input[$field])) {
                $input[$field] = Patient::normalizeText($input[$field]);
            }
        }

        $nameRule = ['nullable', 'string', 'min:1', 'max:50', 'regex:/^(?=.*\p{L})[\p{L}\p{M}]+(?:[ \'\x{2019}-][\p{L}\p{M}]+)*$/u'];
        $validator = Validator::make($input, [
            'first_name' => [$hasStructuredName ? 'required' : 'nullable', 'string', 'min:2', 'max:50', 'regex:/^(?=.*\p{L})[\p{L}\p{M}]+(?:[ \'\x{2019}-][\p{L}\p{M}]+)*$/u'],
            'middle_name' => $nameRule,
            'last_name' => [$hasStructuredName ? 'required' : 'nullable', 'string', 'min:2', 'max:50', 'regex:/^(?=.*\p{L})[\p{L}\p{M}]+(?:[ \'\x{2019}-][\p{L}\p{M}]+)*$/u'],
            'suffix' => ['nullable', Rule::in(['Jr.', 'Sr.', 'II', 'III', 'IV', 'V'])],
            'full_name' => [$hasStructuredName ? 'nullable' : 'required', 'string', 'max:150'],
            'age' => ['required', 'integer', 'min:0', 'max:120'],
            'sex' => ['required', Rule::in(['Male', 'Female'])],
            'address_line' => [$hasStructuredAddress ? 'required' : 'nullable', 'string', 'min:3', 'max:150'],
            'residence_barangay' => [$hasStructuredAddress ? 'required' : 'nullable', 'string', 'min:2', 'max:80'],
            'city_municipality' => [$hasStructuredAddress ? 'required' : 'nullable', 'string', 'min:2', 'max:80'],
            'province' => [$hasStructuredAddress ? 'required' : 'nullable', 'string', 'min:2', 'max:80'],
            'address' => [$hasStructuredAddress ? 'nullable' : 'required', 'string', 'max:500'],
            'barangay_id' => ['nullable', 'exists:barangays,id'],
            'contact_number' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'sms_consent' => ['sometimes', 'nullable', 'boolean'],
        ], [
            'first_name.regex' => 'First name may contain letters, spaces, hyphens, and apostrophes only.',
            'middle_name.regex' => 'Middle name may contain letters, spaces, hyphens, and apostrophes only.',
            'last_name.regex' => 'Last name may contain letters, spaces, hyphens, and apostrophes only.',
            'age.max' => 'Age must not be greater than 120.',
        ]);

        $validator->after(function ($validator) use ($input): void {
            $contact = (string) ($input['contact_number'] ?? '');
            $smsConsent = filter_var($input['sms_consent'] ?? false, FILTER_VALIDATE_BOOLEAN);

            if ($contact !== '' && (preg_match('/^\d+$/', $contact) !== 1 || strlen($contact) !== 11)) {
                $validator->errors()->add('contact_number', 'Contact number must contain exactly 11 digits.');
            } elseif ($contact !== '' && ! str_starts_with($contact, '09')) {
                $validator->errors()->add('contact_number', 'Contact number must start with 09.');
            }

            if ($smsConsent && $contact === '') {
                $validator->errors()->add('contact_number', 'A valid contact number is required to enable SMS reminders.');
            }
        });

        $data = $validator->validate();
        if ($hasStructuredName) {
            $data['full_name'] = Patient::composeFullName($data);
        }
        if ($hasStructuredAddress) {
            $data['address'] = Patient::composeAddress($data);
        }

        $data['barangay_id'] = blank($data['barangay_id'] ?? null) ? null : $data['barangay_id'];
        $data['contact_number'] = blank($data['contact_number'] ?? null) ? null : $data['contact_number'];
        if ($creating) {
            $data['sms_consent'] = $request->boolean('sms_consent', false);
        } elseif ($request->has('sms_consent')) {
            $data['sms_consent'] = $request->boolean('sms_consent');
        } else {
            unset($data['sms_consent']);
        }

        return $data;
    }

    private function resolveIncidentPatient(Request $request, ?Patient $fallback = null): Patient
    {
        if ($request->filled('patient_id')) {
            return Patient::findOrFail($request->input('patient_id'));
        }

        if ($fallback) {
            return $fallback;
        }

        $patientData = $this->validatePatient($request, true);
        $patientData['barangay_id'] = null;

        return Patient::create($patientData)->fresh();
    }

    private function incidentData(Request $request, Patient $patient): array
    {
        $validator = Validator::make($request->all(), [
            'incident_date' => ['required', 'date', 'before_or_equal:today'],
            'incident_time' => ['nullable'],
            'animal_type' => ['nullable', 'string'],
            'bite_location' => ['nullable', 'string', 'max:150'],
            'bite_site' => ['nullable', 'string', 'max:150'],
            'who_category' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
            'barangay_id' => ['nullable', 'exists:barangays,id'],
            'location_lat' => ['nullable', 'numeric'],
            'location_lng' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string'],
            'sms_consent' => ['sometimes', 'nullable', 'boolean'],
        ]);

        $data = $validator->validate();
        $incidentDate = Carbon::parse($data['incident_date'])->toDateString();

        return [
            'patient_id' => $patient->id,
            'barangay_id' => blank($data['barangay_id'] ?? null) ? null : $data['barangay_id'],
            'incident_date' => $incidentDate,
            'incident_time' => $data['incident_time'] ?? null,
            'animal_type' => $this->normalizeAnimalType($data['animal_type'] ?? 'Dog'),
            'animal_description' => $request->input('animal_description'),
            'bite_site' => $data['bite_site'] ?? $data['bite_location'] ?? 'Not specified',
            'who_category' => $this->normalizeWhoCategory($data['who_category'] ?? 'Category II'),
            'location_lat' => $data['location_lat'] ?? null,
            'location_lng' => $data['location_lng'] ?? null,
            'status' => $this->normalizeIncidentStatus($data['status'] ?? 'Active'),
            'reported_by' => $request->user()?->id,
            'notes' => $data['notes'] ?? null,
        ];
    }

    private function inventoryData(Request $request, bool $partial = false): array
    {
        $rules = [
            'item_name' => [$partial ? 'sometimes' : 'required', 'string', 'max:150'],
            'item_type' => [$partial ? 'sometimes' : 'required', 'string'],
            'current_stock' => [$partial ? 'sometimes' : 'required', 'integer', 'min:0'],
            'unit' => [$partial ? 'sometimes' : 'required', 'string', 'max:50'],
            'reorder_level' => [$partial ? 'sometimes' : 'required', 'integer', 'min:0'],
            'expiry_date' => ['nullable', 'date'],
        ];

        $data = $request->validate($rules);

        if (isset($data['item_type'])) {
            $data['item_type'] = $this->normalizeInventoryType($data['item_type']);
        }

        return $data;
    }

    private function syncInventoryNearestExpiry(Inventory $inventory): void
    {
        $nearestExpiry = $inventory->batches()
            ->where('quantity_remaining', '>', 0)
            ->whereDate('expiry_date', '>=', today())
            ->orderBy('expiry_date')
            ->value('expiry_date');

        $inventory->update(['expiry_date' => $nearestExpiry]);
    }

    private function createPepScheduleForIncident(Incident $incident): void
    {
        $this->syncPepScheduleForIncident($incident);
    }

    private function syncPepScheduleForIncident(Incident $incident, bool $updateExisting = false): void
    {
        $startDate = Carbon::parse($incident->incident_date);

        foreach (self::PEP_DOSE_DAY_OFFSETS as $day) {
            $schedule = PepSchedule::firstOrNew([
                'incident_id' => $incident->id,
                'dose_day' => $day,
            ]);

            if (! $schedule->exists) {
                $schedule->status = $day === 0 ? 'Upcoming' : 'Pending';
            }

            if (! $schedule->exists || $updateExisting) {
                $schedule->scheduled_date = $startDate->copy()->addDays($day)->toDateString();
                $schedule->save();
            }
        }
    }

    private function hasStaleStandardPepSchedule(Incident $incident): bool
    {
        $schedules = $incident->pepSchedules()
            ->whereIn('dose_day', self::PEP_DOSE_DAY_OFFSETS)
            ->get()
            ->keyBy('dose_day');

        if ($schedules->count() !== count(self::PEP_DOSE_DAY_OFFSETS) || ! $schedules->has(0)) {
            return false;
        }

        $scheduleStartDate = Carbon::parse($schedules->get(0)->scheduled_date);
        if ($scheduleStartDate->isSameDay(Carbon::parse($incident->incident_date))) {
            return false;
        }

        foreach (self::PEP_DOSE_DAY_OFFSETS as $day) {
            $schedule = $schedules->get($day);
            if (! $schedule || ! Carbon::parse($schedule->scheduled_date)->isSameDay($scheduleStartDate->copy()->addDays($day))) {
                return false;
            }
        }

        return true;
    }

    private function storeNotificationLog(Request $request, string $channel): JsonResponse
    {
        $recipient = $channel === 'SMS' ? $request->input('phone') : $request->input('to');
        $message = $request->input('message', '');
        $patientId = $request->input('patientId') ?? $request->input('patient_id');
        $incidentId = $request->input('incidentId') ?? $request->input('incident_id');
        $pepScheduleId = $request->input('pepScheduleId') ?? $request->input('pep_schedule_id');
        $reminderType = $request->input('reminderType') ?? $request->input('reminder_type');
        $scheduledDate = $request->input('scheduledDate') ?? $request->input('scheduled_date');
        $retryNotificationId = $request->input('retryNotificationId') ?? $request->input('retry_notification_id');
        $status = 'Sent';
        $deliveryResponse = 'Logged locally. External gateway not configured yet.';

        $incident = $incidentId ? Incident::with('patient')->find($incidentId) : null;
        $patient = $incident?->patient ?? ($patientId ? Patient::find($patientId) : null);
        $schedule = $pepScheduleId ? PepSchedule::find($pepScheduleId) : null;

        if ($channel === 'SMS' && (! $patient || $patient->sms_consent !== true)) {
            return response()->json([
                'success' => false,
                'message' => 'Reminder skipped because explicit SMS consent is not available.',
                'data' => null,
            ], 422);
        }

        if ($channel === 'SMS' && (blank($recipient) || preg_match('/^(09|\+639)\d{9}$/', (string) $recipient) !== 1)) {
            return response()->json([
                'success' => false,
                'message' => 'Reminder skipped because a valid contact number is not available.',
                'data' => null,
            ], 422);
        }

        $resolvedIncidentId = $incident?->id ?? $schedule?->incident_id ?? $incidentId;
        $resolvedPatientId = $patient?->id ?? $patientId;
        $resolvedScheduledDate = $schedule?->scheduled_date?->toDateString() ?? ($scheduledDate ? Carbon::parse($scheduledDate)->toDateString() : null);
        $resolvedReminderType = trim((string) ($reminderType ?: 'Vaccination Reminder'));
        $reminderKey = $channel === 'SMS' && $resolvedPatientId && $resolvedIncidentId && $pepScheduleId && $resolvedScheduledDate
            ? hash('sha256', implode('|', [
                $resolvedPatientId,
                $resolvedIncidentId,
                $pepScheduleId,
                strtolower($resolvedReminderType),
                $resolvedScheduledDate,
            ]))
            : null;

        if ($channel === 'SMS' && $retryNotificationId) {
            $notification = Notification::whereKey($retryNotificationId)->where('notification_type', 'SMS')->first();
            if (! $notification || $notification->status !== 'Failed') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only failed SMS reminders can be retried.',
                    'data' => $notification,
                ], 422);
            }

            [$status, $deliveryResponse] = $this->sendSmsThroughGateway((string) $recipient, (string) $message);
            $notification->update([
                'recipient' => $recipient,
                'message' => $message,
                'status' => $status,
                'sent_at' => in_array($status, ['Sent', 'Delivered'], true) ? now() : null,
                'delivery_response' => $deliveryResponse,
            ]);

            return response()->json([
                'success' => $status !== 'Failed',
                'message' => $channel.' '.strtolower($status).'.',
                'data' => $notification->fresh(),
                'meta' => ['duplicate' => false, 'retried' => true],
            ], $status === 'Failed' ? 422 : 200);
        }

        $notification = null;
        if ($resolvedPatientId && $reminderKey) {
            $legacyPending = Notification::query()
                ->whereNull('reminder_key')
                ->where('patient_id', $resolvedPatientId)
                ->where('incident_id', $resolvedIncidentId)
                ->where('notification_type', $channel)
                ->where('recipient', $recipient)
                ->where('message', $message)
                ->where('status', 'Pending')
                ->first();

            if ($legacyPending) {
                return response()->json([
                    'success' => true,
                    'message' => 'This reminder is already recorded as Pending.',
                    'data' => $legacyPending,
                    'meta' => ['duplicate' => true, 'retried' => false],
                ]);
            }

            $notification = Notification::firstOrCreate(
                ['reminder_key' => $reminderKey],
                [
                    'patient_id' => $resolvedPatientId,
                    'incident_id' => $resolvedIncidentId,
                    'pep_schedule_id' => $pepScheduleId,
                    'notification_type' => $channel,
                    'reminder_type' => $resolvedReminderType,
                    'scheduled_date' => $resolvedScheduledDate,
                    'recipient' => $recipient,
                    'message' => $message,
                    'status' => 'Pending',
                    'delivery_response' => 'Reminder reserved for processing.',
                ]
            );

            if (! $notification->wasRecentlyCreated) {
                return response()->json([
                    'success' => true,
                    'message' => 'This reminder is already recorded as '.$notification->status.'.',
                    'data' => $notification,
                    'meta' => ['duplicate' => true, 'retried' => false],
                ]);
            }
        }

        if ($channel === 'SMS') {
            [$status, $deliveryResponse] = $this->sendSmsThroughGateway((string) $recipient, (string) $message);
        }

        if ($notification) {
            $notification->update([
                'status' => $status,
                'sent_at' => in_array($status, ['Sent', 'Delivered'], true) ? now() : null,
                'delivery_response' => $deliveryResponse,
            ]);
        } elseif ($resolvedPatientId) {
            $notification = Notification::create([
                'patient_id' => $resolvedPatientId,
                'incident_id' => $resolvedIncidentId,
                'pep_schedule_id' => $pepScheduleId,
                'notification_type' => $channel,
                'reminder_type' => $resolvedReminderType,
                'scheduled_date' => $resolvedScheduledDate,
                'reminder_key' => $reminderKey,
                'recipient' => $recipient,
                'message' => $message,
                'status' => $status,
                'sent_at' => $status === 'Sent' || $status === 'Delivered' ? now() : null,
                'delivery_response' => $deliveryResponse,
            ]);
        }

        $this->writeAudit($request, 'Send '.$channel, 'Notifications', $notification?->id, $channel.' reminder to '.$recipient.' marked as '.$status.'.');

        return response()->json([
            'success' => $status !== 'Failed',
            'message' => $channel.' '.strtolower($status).'.',
            'data' => $notification?->fresh(),
            'meta' => ['duplicate' => false, 'retried' => false],
        ], $status === 'Failed' ? 422 : 200);
    }

    private function allowedSettingKeysForRole(?string $role): array
    {
        return match ($role) {
            'system_admin' => [
                'sms_provider',
                'sms_sender_id',
                'retry_failed_sms_enabled',
                'max_sms_retry_attempts',
                'strong_passwords_required',
                'session_timeout_minutes',
                'max_failed_login_attempts',
                'account_lock_minutes',
                'force_password_change_approved_users',
                'security_alerts_enabled',
                'sms_service_failure_alerts_enabled',
                'queue_failure_alerts_enabled',
                'system_failure_alerts_enabled',
            ],
            'clinic_admin' => [
                'clinic_name',
                'contact_email',
                'contact_number',
                'clinic_address',
                'clinic_public_listing_enabled',
                'clinic_type',
                'clinic_barangay',
                'clinic_operating_hours',
                'clinic_services',
                'clinic_latitude',
                'clinic_longitude',
                'clinic_public_notes',
                'clinic_verified_at',
                'system_timezone',
                'system_language',
                'sms_reminders_enabled',
                'reminder_days_before',
                'low_stock_alert_enabled',
                'expiring_batch_alert_enabled',
            ],
            default => [],
        };
    }

    private function smsCredentialsConfigured(): bool
    {
        return ! blank($this->settingValue('twilio_account_sid', config('services.twilio.sid')))
            && ! blank($this->settingValue('twilio_auth_token', config('services.twilio.token')))
            && ! blank($this->settingValue('twilio_from_number', config('services.twilio.from')));
    }

    private function smsServiceEnabled(): bool
    {
        if (! $this->smsCredentialsConfigured()) {
            return false;
        }

        $configuredFlag = config('services.sms.enabled');

        return $configuredFlag === null
            ? true
            : filter_var($configuredFlag, FILTER_VALIDATE_BOOL);
    }

    private function settingValue(string $key, mixed $fallback = null): mixed
    {
        $value = Setting::where('setting_key', $key)->value('setting_value');

        return blank($value) ? $fallback : $value;
    }

    private function auditLogFilters(Request $request): array
    {
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:150'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'user' => ['nullable', 'string', 'max:150'],
            'role' => ['nullable', 'string', 'max:80'],
            'module' => ['nullable', 'string', 'max:100'],
            'action' => ['nullable', 'string', 'max:100'],
            'format' => ['nullable', Rule::in(['PDF', 'Excel'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', Rule::in([10, 15, 25, 50])],
        ]);

        return [
            'search' => $data['search'] ?? null,
            'date_from' => Carbon::parse($data['date_from'] ?? now()->startOfMonth()->toDateString())->startOfDay(),
            'date_to' => Carbon::parse($data['date_to'] ?? now()->toDateString())->endOfDay(),
            'user' => $data['user'] ?? 'All',
            'role' => $data['role'] ?? 'All',
            'module' => $data['module'] ?? 'All',
            'action' => $data['action'] ?? 'All',
            'format' => $data['format'] ?? 'PDF',
            'page' => $data['page'] ?? 1,
            'per_page' => $data['per_page'] ?? 10,
        ];
    }

    private function auditLogQuery(array $filters)
    {
        $query = AuditLog::with('user')
            ->whereBetween('created_at', [$filters['date_from'], $filters['date_to']]);

        $hasActionType = Schema::hasColumn('audit_logs', 'action_type');
        $hasDescription = Schema::hasColumn('audit_logs', 'description');
        $hasUserName = Schema::hasColumn('audit_logs', 'user_name');
        $hasUserRole = Schema::hasColumn('audit_logs', 'user_role');

        if (! blank($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($inner) use ($search, $hasActionType, $hasDescription, $hasUserName, $hasUserRole) {
                $inner->where('action', 'like', '%'.$search.'%')
                    ->orWhere('module', 'like', '%'.$search.'%')
                    ->orWhere('details', 'like', '%'.$search.'%');

                if ($hasActionType) {
                    $inner->orWhere('action_type', 'like', '%'.$search.'%');
                }
                if ($hasDescription) {
                    $inner->orWhere('description', 'like', '%'.$search.'%');
                }
                if ($hasUserName) {
                    $inner->orWhere('user_name', 'like', '%'.$search.'%');
                }
                if ($hasUserRole) {
                    $inner->orWhere('user_role', 'like', '%'.$search.'%');
                }

                $inner->orWhereHas('user', function ($userQuery) use ($search) {
                    $userQuery->where('name', 'like', '%'.$search.'%')
                        ->orWhere('role', 'like', '%'.$search.'%');
                });
            });
        }

        if (($filters['user'] ?? 'All') !== 'All') {
            if ($hasUserName) {
                $query->where('user_name', $filters['user']);
            } else {
                $query->whereHas('user', fn ($userQuery) => $userQuery->where('name', $filters['user']));
            }
        }

        if (($filters['role'] ?? 'All') !== 'All') {
            if ($hasUserRole) {
                $query->where('user_role', $filters['role']);
            } else {
                $query->whereHas('user', fn ($userQuery) => $userQuery->where('role', $filters['role']));
            }
        }

        if (($filters['module'] ?? 'All') !== 'All') {
            $query->where('module', $filters['module']);
        }

        if (($filters['action'] ?? 'All') !== 'All') {
            if ($hasActionType) {
                $query->where(function ($inner) use ($filters) {
                    $inner->where('action', $filters['action'])->orWhere('action_type', $filters['action']);
                });
            } else {
                $query->where('action', $filters['action']);
            }
        }

        return $query;
    }

    private function auditLogPayload(AuditLog $log): array
    {
        $user = $log->user;

        return [
            'id' => $log->id,
            'timestamp' => optional($log->created_at)->timezone('Asia/Manila')->format('Y-m-d H:i:s'),
            'user_id' => $log->user_id,
            'user_name' => $log->user_name ?: ($user?->name ?? 'System'),
            'user_role' => $log->user_role ?: ($user?->role ?? 'System'),
            'action' => $log->action_type ?: $log->action,
            'module' => $log->module,
            'record_id' => $log->record_id,
            'description' => $log->description ?: $log->details,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'created_at' => $log->created_at,
        ];
    }

    private function auditLogReport($logs, array $filters): array
    {
        $rows = $logs->map(fn (AuditLog $log) => [
            optional($log->created_at)->format('Y-m-d H:i:s'),
            $log->user_name ?: ($log->user?->name ?? 'System'),
            $log->user_role ?: ($log->user?->role ?? 'System'),
            $log->action_type ?: $log->action,
            $log->module,
            (string) ($log->record_id ?? '-'),
            $log->description ?: $log->details,
            $log->ip_address ?? '-',
        ])->values()->all();

        return [
            'title' => 'Audit Log Report',
            'summary' => [
                ['label' => 'Total Logs', 'value' => $logs->count()],
                ['label' => 'Date From', 'value' => $filters['date_from']->toDateString()],
                ['label' => 'Date To', 'value' => $filters['date_to']->toDateString()],
                ['label' => 'Role Filter', 'value' => $filters['role']],
                ['label' => 'Module Filter', 'value' => $filters['module']],
            ],
            'headers' => ['Timestamp', 'User', 'Role', 'Action', 'Module', 'Record ID', 'Description', 'IP Address'],
            'rows' => $rows,
            'breakdowns' => [
                'Actions' => $this->collectionToPairs($logs->groupBy(fn (AuditLog $log) => $log->action_type ?: $log->action)->map(fn ($items) => $items->count())->sortDesc()),
                'Modules' => $this->collectionToPairs($logs->groupBy('module')->map(fn ($items) => $items->count())->sortDesc()),
            ],
        ];
    }

    private function writeAudit(Request $request, string $action, string $module, mixed $recordId = null, ?string $description = null, ?User $actor = null): void
    {
        if (! Schema::hasTable('audit_logs')) {
            return;
        }

        $user = $actor ?? $request->user();
        $payload = [
            'user_id' => $user?->id,
            'action' => $action,
            'module' => $module,
            'details' => $description,
            'ip_address' => $request->ip(),
        ];

        if (Schema::hasColumn('audit_logs', 'user_name')) {
            $payload['user_name'] = $user?->name ?? 'System';
        }
        if (Schema::hasColumn('audit_logs', 'user_role')) {
            $payload['user_role'] = $user?->role ?? 'System';
        }
        if (Schema::hasColumn('audit_logs', 'action_type')) {
            $payload['action_type'] = $action;
        }
        if (Schema::hasColumn('audit_logs', 'record_id')) {
            $payload['record_id'] = $recordId === null ? null : (string) $recordId;
        }
        if (Schema::hasColumn('audit_logs', 'description')) {
            $payload['description'] = $description;
        }
        if (Schema::hasColumn('audit_logs', 'user_agent')) {
            $payload['user_agent'] = substr((string) $request->userAgent(), 0, 1000);
        }

        AuditLog::create($payload);
    }

    private function sendSmsThroughGateway(string $recipient, string $message): array
    {
        $sid = $this->settingValue('twilio_account_sid', config('services.twilio.sid'));
        $token = $this->settingValue('twilio_auth_token', config('services.twilio.token'));
        $from = $this->settingValue('twilio_from_number', config('services.twilio.from'));

        if (! $this->smsServiceEnabled() || blank($sid) || blank($token) || blank($from)) {
            return ['Pending', 'SMS simulation mode is active. No real SMS was sent; the reminder is recorded for testing and review.'];
        }

        try {
            $response = Http::asForm()
                ->withBasicAuth($sid, $token)
                ->post('https://api.twilio.com/2010-04-01/Accounts/'.$sid.'/Messages.json', [
                    'From' => $from,
                    'To' => $recipient,
                    'Body' => $message,
                ]);

            if ($response->successful()) {
                return ['Sent', $response->body()];
            }

            return ['Failed', $response->body()];
        } catch (\Throwable $exception) {
            return ['Failed', $exception->getMessage()];
        }
    }

    private function patientPayload(Patient $patient): array
    {
        $patient->loadMissing('barangay');

        return [
            'id' => $patient->id,
            'first_name' => $patient->first_name,
            'middle_name' => $patient->middle_name,
            'last_name' => $patient->last_name,
            'suffix' => $patient->suffix,
            'full_name' => $patient->full_name,
            'display_name' => $patient->displayName(),
            'age' => $patient->age,
            'sex' => $patient->sex,
            'address' => $patient->address,
            'address_line' => $patient->address_line,
            'residence_barangay' => $patient->residence_barangay,
            'city_municipality' => $patient->city_municipality,
            'province' => $patient->province,
            'barangay_id' => $patient->barangay_id,
            'barangay' => $patient->barangay,
            'contact_number' => $patient->contact_number,
            'email' => $patient->email,
            'sms_consent' => (bool) $patient->sms_consent,
            'created_at' => $patient->created_at,
            'updated_at' => $patient->updated_at,
        ];
    }

    private function incidentPayload(Incident $incident): array
    {
        $incident->loadMissing(['patient', 'barangay', 'pepSchedules']);

        return [
            'id' => $incident->id,
            'patient_id' => $incident->patient_id,
            'patient' => $incident->patient ? $this->patientPayload($incident->patient) : null,
            'contact_number' => $incident->patient?->contact_number,
            'barangay_id' => $incident->barangay_id,
            'barangay' => $incident->barangay,
            'incident_date' => optional($incident->incident_date)->toDateString(),
            'incident_time' => $incident->incident_time,
            'animal_type' => $incident->animal_type,
            'animal_description' => $incident->animal_description,
            'bite_site' => $incident->bite_site,
            'bite_location' => $incident->bite_site,
            'who_category' => $this->displayCategory($incident->who_category),
            'location_lat' => $incident->location_lat,
            'location_lng' => $incident->location_lng,
            'status' => $incident->status,
            'notes' => $incident->notes,
            'sms_consent' => $this->incidentAllowsSms($incident),
            'pep_schedules' => $incident->pepSchedules->map(fn (PepSchedule $schedule) => $this->pepSchedulePayload($schedule))->values(),
            'created_at' => $incident->created_at,
            'updated_at' => $incident->updated_at,
        ];
    }

    private function pepSchedulePayload(PepSchedule $schedule): array
    {
        $schedule->loadMissing(['incident.patient', 'incident.barangay', 'administrator']);

        return [
            'id' => $schedule->id,
            'incident_id' => $schedule->incident_id,
            'dose_day' => $schedule->dose_day,
            'scheduled_date' => optional($schedule->scheduled_date)->toDateString(),
            'administered_date' => optional($schedule->administered_date)->toDateString(),
            'vaccine_type' => $schedule->vaccine_type,
            'vaccine_lot_number' => $schedule->vaccine_lot_number,
            'administered_by' => $schedule->administered_by,
            'administrator' => $schedule->administrator,
            'status' => $schedule->status,
            'notes' => $schedule->notes,
            'patient' => $schedule->incident?->patient,
            'incident' => $schedule->incident ? $this->incidentSummaryPayload($schedule->incident) : null,
            'created_at' => $schedule->created_at,
            'updated_at' => $schedule->updated_at,
        ];
    }

    private function incidentSummaryPayload(Incident $incident): array
    {
        return [
            'id' => $incident->id,
            'incident_date' => optional($incident->incident_date)->toDateString(),
            'who_category' => $this->displayCategory($incident->who_category),
            'status' => $incident->status,
            'barangay' => $incident->barangay,
            'sms_consent' => $this->incidentAllowsSms($incident),
        ];
    }

    private function incidentAllowsSms(Incident $incident): bool
    {
        $incident->loadMissing('patient');

        return $incident->patient?->sms_consent === true;
    }

    private function inventoryPayload(Inventory $item): array
    {
        $item->loadMissing('batches');
        $batches = $item->batches
            ->sortBy('expiry_date')
            ->map(fn (InventoryBatch $batch) => $this->inventoryBatchPayload($batch))
            ->values();
        $activeBatch = $batches->first(fn (array $batch) => $batch['quantity_remaining'] > 0 && $batch['status'] !== 'Expired');

        return [
            'id' => $item->id,
            'item_name' => $item->item_name,
            'item_type' => $item->item_type,
            'current_stock' => $item->current_stock,
            'unit' => $item->unit,
            'reorder_level' => $item->reorder_level,
            'expiry_date' => optional($item->expiry_date)->toDateString(),
            'nearest_expiry_date' => optional($item->expiry_date)->toDateString(),
            'batch_number' => $activeBatch['batch_number'] ?? null,
            'lot_number' => $activeBatch['batch_number'] ?? null,
            'quantity_remaining' => $activeBatch['quantity_remaining'] ?? null,
            'batches' => $batches,
            'last_updated' => optional($item->updated_at)->toDateTimeString(),
            'created_at' => $item->created_at,
            'updated_at' => $item->updated_at,
        ];
    }

    private function inventoryBatchPayload(InventoryBatch $batch): array
    {
        $expiryDate = optional($batch->expiry_date)->toDateString();

        return [
            'id' => $batch->id,
            'inventory_id' => $batch->inventory_id,
            'batch_number' => $batch->batch_number,
            'lot_number' => $batch->batch_number,
            'quantity_received' => $batch->quantity_received,
            'quantity_remaining' => $batch->quantity_remaining,
            'expiry_date' => $expiryDate,
            'received_date' => optional($batch->received_date)->toDateString(),
            'supplier' => $batch->supplier,
            'notes' => $batch->notes,
            'status' => $this->inventoryBatchStatus($batch),
            'created_at' => $batch->created_at,
            'updated_at' => $batch->updated_at,
        ];
    }

    private function inventoryBatchStatus(InventoryBatch $batch): string
    {
        if ((int) $batch->quantity_remaining <= 0) {
            return 'Depleted';
        }

        if ($batch->expiry_date && $batch->expiry_date->isPast()) {
            return 'Expired';
        }

        if ($batch->expiry_date && $batch->expiry_date->diffInDays(today(), false) >= -60) {
            return 'Expiring Soon';
        }

        return 'Active';
    }

    private function userPayload(User $user): array
    {
        $approvalStatus = Schema::hasColumn('users', 'approval_status')
            ? ($user->approval_status ?? 'approved')
            : ($user->is_active ? 'approved' : 'pending');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'full_name' => $user->name,
            'email' => $user->email,
            'role' => $this->canonicalUserRole($user->role),
            'phone' => $user->phone,
            'is_active' => (bool) $user->is_active,
            'approval_status' => $approvalStatus,
            'approvalStatus' => $approvalStatus,
            'status' => $user->is_active ? 'Active' : 'Inactive',
            'lastLogin' => $user->last_login_at ? $user->last_login_at->format('Y-m-d H:i') : 'Never',
            'last_login_at' => $user->last_login_at,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ];
    }

    private function isClinicAdmin(?User $user): bool
    {
        return $this->canonicalUserRole($user?->role) === 'clinic_admin';
    }

    private function isNurseVaccinator(?User $user): bool
    {
        return $this->canonicalUserRole($user?->role) === 'nurse_vaccinator';
    }

    private function isSystemAdminUser(User $user): bool
    {
        return $this->canonicalUserRole($user->role) === 'system_admin';
    }

    private function systemAdminUserForbiddenResponse(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'error' => 'Clinic administrators cannot manage system administrator accounts.',
        ], 403);
    }

    private function canonicalUserRole(?string $role): string
    {
        $key = str($role ?? '')
            ->trim()
            ->squish()
            ->lower()
            ->replace([' ', '-', '/'], '_')
            ->toString();

        return match ($key) {
            'admin' => 'system_admin',
            'clinic_admin' => 'clinic_admin',
            'doctor', 'health_officer' => 'doctor',
            'nurse', 'vaccinator', 'nurse_vaccinator' => 'nurse_vaccinator',
            default => $role ?? '',
        };
    }

    private function storableUserRole(?string $role): string
    {
        $canonical = $this->canonicalUserRole($role);
        $enumFallbacks = [
            'clinic_admin' => 'Clinic Admin',
            'doctor' => 'Doctor',
            'nurse_vaccinator' => 'Nurse/Vaccinator',
        ];

        if (! array_key_exists($canonical, $enumFallbacks)) {
            return $canonical;
        }

        try {
            $column = DB::selectOne("SHOW COLUMNS FROM users WHERE Field = 'role'");
            if ($column && str_contains((string) $column->Type, "'{$canonical}'")) {
                return $canonical;
            }
        } catch (\Throwable) {
            return $canonical;
        }

        return $enumFallbacks[$canonical];
    }

    private function incidentMapLocation(Incident $incident): ?array
    {
        if ($this->isInsideDigosBounds($incident->location_lat, $incident->location_lng)) {
            return [
                'lat' => (float) $incident->location_lat,
                'lng' => (float) $incident->location_lng,
            ];
        }

        $barangay = $incident->barangay;
        if (! $barangay) {
            return null;
        }

        if ($this->isInsideDigosBounds($barangay->latitude, $barangay->longitude)) {
            return [
                'lat' => (float) $barangay->latitude,
                'lng' => (float) $barangay->longitude,
            ];
        }

        $fallback = self::DIGOS_BARANGAY_COORDINATES[$barangay->name] ?? null;
        if (! $fallback || ! $this->isInsideDigosBounds($fallback['lat'], $fallback['lng'])) {
            return null;
        }

        return $fallback;
    }

    private function incidentLocationFromRequestData(array $data, mixed $barangayId): array
    {
        if ($this->isInsideDigosBounds($data['location_lat'] ?? null, $data['location_lng'] ?? null)) {
            return [
                'lat' => (float) $data['location_lat'],
                'lng' => (float) $data['location_lng'],
            ];
        }

        if ($barangayId) {
            $barangay = Barangay::find($barangayId);

            if ($barangay && $this->isInsideDigosBounds($barangay->latitude, $barangay->longitude)) {
                return [
                    'lat' => (float) $barangay->latitude,
                    'lng' => (float) $barangay->longitude,
                ];
            }

            if ($barangay) {
                $fallback = self::DIGOS_BARANGAY_COORDINATES[$barangay->name] ?? null;
                if ($fallback && $this->isInsideDigosBounds($fallback['lat'], $fallback['lng'])) {
                    return $fallback;
                }
            }
        }

        return ['lat' => null, 'lng' => null];
    }

    private function isInsideDigosBounds(mixed $latitude, mixed $longitude): bool
    {
        if ($latitude === null || $longitude === null) {
            return false;
        }

        $lat = (float) $latitude;
        $lng = (float) $longitude;

        return $lat >= self::DIGOS_BOUNDS['south']
            && $lat <= self::DIGOS_BOUNDS['north']
            && $lng >= self::DIGOS_BOUNDS['west']
            && $lng <= self::DIGOS_BOUNDS['east'];
    }

    private function riskLevelForIncidentCount(int $incidentCount): string
    {
        if ($incidentCount <= 10) {
            return 'LOW RISK';
        }

        if ($incidentCount <= 20) {
            return 'MODERATE RISK';
        }

        return 'HIGH RISK';
    }

    private function heatIntensityForIncidentCount(int $incidentCount): float
    {
        if ($incidentCount <= 0) {
            return 0;
        }

        if ($incidentCount <= 10) {
            return round(max(0.25, $incidentCount / 10 * 0.45), 2);
        }

        if ($incidentCount <= 20) {
            return round(0.55 + (($incidentCount - 11) / 9 * 0.25), 2);
        }

        return 1.0;
    }

    private function normalizeWhoCategory(?string $category): string
    {
        $category = strtoupper((string) $category);

        if (str_contains($category, 'III')) {
            return 'III';
        }

        if (str_contains($category, 'II')) {
            return 'II';
        }

        return 'I';
    }

    private function displayCategory(?string $category): string
    {
        return 'Category '.$this->normalizeWhoCategory($category);
    }

    private function normalizeAnimalType(?string $type): string
    {
        return in_array($type, ['Dog', 'Cat', 'Other'], true) ? $type : 'Other';
    }

    private function normalizeIncidentStatus(?string $status): string
    {
        return in_array($status, ['Active', 'Completed', 'Missed', 'Lost to Follow-up'], true) ? $status : 'Active';
    }

    private function normalizeInventoryType(?string $type): string
    {
        return match ($type) {
            'Medication' => 'Medicine',
            'Medical Supply', 'Equipment' => 'Supply',
            'Vaccine', 'Immunoglobulin', 'Supply', 'Medicine' => $type,
            default => 'Supply',
        };
    }

    private function normalizeTransactionType(?string $type): string
    {
        return match ($type) {
            'Used', 'Dispensed' => 'Used',
            'Restock', 'Restocked', 'Received' => 'Restocked',
            'Expired' => 'Expired',
            default => 'Adjusted',
        };
    }
}
