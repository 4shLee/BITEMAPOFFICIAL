import { supabase } from './client';
import type { Patient, Incident, PEPSchedule, Inventory, Animal, Notification } from './client';

// ============ PATIENTS ============

export async function getPatients() {
  const { data, error } = await supabase
    .from('patients')
    .select(`
      *,
      barangay:barangays(name),
      incidents(
        id,
        who_category,
        status,
        incident_date
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getPatientById(id: string) {
  const { data, error } = await supabase
    .from('patients')
    .select(`
      *,
      barangay:barangays(name),
      incidents(
        *,
        barangay:barangays(name),
        pep_schedule(*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createPatient(patient: Omit<Patient, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('patients')
    .insert([patient])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePatient(id: string, updates: Partial<Patient>) {
  const { data, error } = await supabase
    .from('patients')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============ INCIDENTS ============

export async function getIncidents() {
  const { data, error } = await supabase
    .from('incidents')
    .select(`
      *,
      patient:patients(full_name, age, sex, contact_number),
      barangay:barangays(name),
      reported_by_profile:profiles(full_name)
    `)
    .order('incident_date', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createIncident(incident: Omit<Incident, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('incidents')
    .insert([incident])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateIncidentStatus(id: string, status: Incident['status']) {
  const { data, error } = await supabase
    .from('incidents')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============ PEP SCHEDULE ============

export async function getPEPScheduleByIncident(incidentId: string) {
  const { data, error } = await supabase
    .from('pep_schedule')
    .select(`
      *,
      administered_by_profile:profiles(full_name)
    `)
    .eq('incident_id', incidentId)
    .order('dose_day', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getUpcomingDoses() {
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('pep_schedule')
    .select(`
      *,
      incident:incidents(
        patient:patients(full_name, contact_number, email)
      )
    `)
    .in('status', ['Pending', 'Upcoming'])
    .gte('scheduled_date', today)
    .lte('scheduled_date', nextWeek)
    .order('scheduled_date', { ascending: true });

  if (error) throw error;
  return data;
}

export async function administerDose(
  scheduleId: string,
  lotNumber: string,
  administeredBy: string
) {
  const { data, error } = await supabase
    .from('pep_schedule')
    .update({
      administered_date: new Date().toISOString().split('T')[0],
      vaccine_lot_number: lotNumber,
      administered_by: administeredBy,
      status: 'Done'
    })
    .eq('id', scheduleId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============ INVENTORY ============

export async function getInventory() {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .order('item_name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getLowStockItems() {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .or('current_stock.lte.reorder_level')
    .order('current_stock', { ascending: true });

  if (error) throw error;
  return data;
}

export async function updateInventoryStock(
  id: string,
  quantity: number,
  transactionType: 'Used' | 'Restocked' | 'Adjusted' | 'Expired',
  userId: string,
  notes?: string
) {
  // Update inventory
  const { data: inventory, error: inventoryError } = await supabase
    .from('inventory')
    .update({
      current_stock: quantity,
      last_updated: new Date().toISOString(),
      updated_by: userId
    })
    .eq('id', id)
    .select()
    .single();

  if (inventoryError) throw inventoryError;

  // Log transaction
  const { error: transactionError } = await supabase
    .from('inventory_transactions')
    .insert([{
      inventory_id: id,
      transaction_type: transactionType,
      quantity: quantity - (inventory?.current_stock || 0),
      notes,
      created_by: userId
    }]);

  if (transactionError) throw transactionError;

  return inventory;
}

// ============ ANIMALS ============

export async function getAnimals() {
  const { data, error } = await supabase
    .from('animals')
    .select(`
      *,
      barangay:barangays(name)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function registerAnimal(animal: Omit<Animal, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('animals')
    .insert([animal])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAnimalVaccination(
  id: string,
  vaccinationDate: string,
  nextDue: string
) {
  const { data, error } = await supabase
    .from('animals')
    .update({
      is_vaccinated: true,
      last_vaccination_date: vaccinationDate,
      next_vaccination_due: nextDue
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============ NOTIFICATIONS ============

export async function getNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      patient:patients(full_name, contact_number)
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}

export async function createNotification(notification: Omit<Notification, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('notifications')
    .insert([notification])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============ BARANGAYS ============

export async function getBarangays() {
  const { data, error } = await supabase
    .from('barangays')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

// ============ STATISTICS ============

export async function getStatistics() {
  // Get total cases
  const { count: totalCases } = await supabase
    .from('incidents')
    .select('*', { count: 'exact', head: true });

  // Get active cases
  const { count: activeCases } = await supabase
    .from('incidents')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Active');

  // Get completed vaccinations
  const { count: completedVaccinations } = await supabase
    .from('incidents')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Completed');

  // Get pending doses
  const { count: pendingDoses } = await supabase
    .from('pep_schedule')
    .select('*', { count: 'exact', head: true })
    .in('status', ['Pending', 'Upcoming']);

  // Get incidents by barangay
  const { data: incidentsByBarangay } = await supabase
    .from('incidents')
    .select(`
      barangay:barangays(name),
      count
    `)
    .order('count', { ascending: false });

  return {
    totalCases: totalCases || 0,
    activeCases: activeCases || 0,
    completedVaccinations: completedVaccinations || 0,
    pendingDoses: pendingDoses || 0,
    incidentsByBarangay: incidentsByBarangay || []
  };
}

// ============ AUDIT LOG ============

export async function logAction(
  action: string,
  module: string,
  details?: string,
  userId?: string
) {
  const { error } = await supabase
    .from('audit_log')
    .insert([{
      user_id: userId || null,
      action,
      module,
      details
    }]);

  if (error) console.error('Audit log error:', error);
}
