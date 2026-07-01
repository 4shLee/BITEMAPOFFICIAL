// Mock data for development without Supabase

export const mockDashboardStats = {
  success: true,
  get stats() {
    const activeCases = mockIncidentsData.filter(i => i.status === 'Active').length;
    const completedCases = mockIncidentsData.filter(i => i.status === 'Completed').length;

    return {
      totalCases: mockIncidentsData.length,
      activeCases: activeCases,
      completedVaccinations: completedCases,
      pendingDoses: mockPEPSchedule.data.filter((s: any) => s.status === 'Pending' || s.status === 'Upcoming').length,
      highRiskBarangays: 5
    };
  },
  get recentIncidents() {
    return mockIncidentsData.slice(0, 10).map(incident => ({
      id: incident.id,
      incident_date: incident.incident_date,
      who_category: incident.who_category,
      status: incident.status,
      patient: incident.patient,
      barangay: incident.barangay
    }));
  },
  get lowStockItems() {
    return mockInventoryData
      .filter(item => item.current_stock < item.reorder_level)
      .map(item => ({
        id: item.id,
        item_name: item.item_name,
        current_stock: item.current_stock,
        reorder_level: item.reorder_level,
        unit: item.unit
      }))
      .slice(0, 5);
  }
};

// Keep track of incidents (for mock mode only)
let mockIncidentsData = [
  {
    id: '1',
    patient_id: 'p1',
    barangay_id: 'b1',
    incident_date: '2026-05-09',
    who_category: 'Category III',
    status: 'Active',
    animal_type: 'Dog',
    bite_location: 'Left arm',
    provoked: false,
    notes: '',
    patient: { id: 'p1', full_name: 'Juan Dela Cruz', age: 35, sex: 'Male' },
    barangay: { id: 'b1', name: 'Poblacion' },
    reported_by_user: { full_name: 'Admin User' }
  },
  {
    id: '2',
    patient_id: 'p2',
    barangay_id: 'b2',
    incident_date: '2026-05-08',
    who_category: 'Category II',
    status: 'Active',
    animal_type: 'Cat',
    bite_location: 'Right hand',
    provoked: true,
    notes: '',
    patient: { id: 'p2', full_name: 'Maria Santos', age: 28, sex: 'Female' },
    barangay: { id: 'b2', name: 'San Agustin' },
    reported_by_user: { full_name: 'Admin User' }
  }
];

export const mockIncidents = {
  success: true,
  get data() {
    return mockIncidentsData;
  }
};

// Helper functions for incidents (mock mode)
export function addMockIncident(incidentData: any) {
  // Resolve patient — support both patient_id (legacy) and patient_name (free-text)
  let patientRecord: any = null;

  if (incidentData.patient_id) {
    patientRecord = mockPatientsData.find(p => p.id === incidentData.patient_id) || null;
  }

  if (!patientRecord && incidentData.patient_name) {
    // Try to find by exact name (case-insensitive)
    patientRecord = mockPatientsData.find(
      p => p.full_name.toLowerCase() === incidentData.patient_name.trim().toLowerCase()
    ) || null;

    // New patient — add them to the patients list so Patients page shows them
    if (!patientRecord) {
      const barangayForPatient = mockBarangays.data.find((b: any) => b.id === incidentData.barangay_id);
      patientRecord = {
        id: `p${Date.now()}`,
        full_name: incidentData.patient_name.trim(),
        age: null,
        sex: null,
        contact_number: incidentData.contact_number || '',
        email: '',
        address: '',
        barangay_id: incidentData.barangay_id || '',
        barangay: barangayForPatient || null,
        created_at: new Date().toISOString(),
      };
      mockPatientsData.push(patientRecord);
    }
  }

  const patient = patientRecord
    ? { id: patientRecord.id, full_name: patientRecord.full_name, age: patientRecord.age, sex: patientRecord.sex, contact_number: patientRecord.contact_number }
    : null;

  const barangay = mockBarangays.data.find((b: any) => b.id === incidentData.barangay_id);

  const newIncident = {
    id: `${Date.now()}`,
    ...incidentData,
    patient,
    contact_number: incidentData.contact_number || patientRecord?.contact_number || '',
    barangay: barangay || null,
    reported_by_user: { full_name: 'Demo User' },
  };
  mockIncidentsData.unshift(newIncident);
  return newIncident;
}

export function updateMockIncident(id: string, incidentData: any) {
  const index = mockIncidentsData.findIndex(i => i.id === id);
  if (index === -1) return null;

  // Resolve patient by name or id (same logic as addMockIncident)
  let patientRecord: any = null;
  if (incidentData.patient_id) {
    patientRecord = mockPatientsData.find(p => p.id === incidentData.patient_id) || null;
  }
  if (!patientRecord && incidentData.patient_name) {
    patientRecord = mockPatientsData.find(
      p => p.full_name.toLowerCase() === incidentData.patient_name.trim().toLowerCase()
    ) || null;
    if (!patientRecord) {
      patientRecord = {
        id: `p${Date.now()}`,
        full_name: incidentData.patient_name.trim(),
        age: null, sex: null,
        contact_number: incidentData.contact_number || '',
        email: '', address: '',
        barangay_id: incidentData.barangay_id || '',
        barangay: mockBarangays.data.find((b: any) => b.id === incidentData.barangay_id) || null,
        created_at: new Date().toISOString(),
      };
      mockPatientsData.push(patientRecord);
    }
  }

  const patient = patientRecord
    ? { id: patientRecord.id, full_name: patientRecord.full_name, age: patientRecord.age, sex: patientRecord.sex, contact_number: patientRecord.contact_number }
    : mockIncidentsData[index].patient;

  const barangay = mockBarangays.data.find((b: any) => b.id === incidentData.barangay_id);

  mockIncidentsData[index] = {
    ...mockIncidentsData[index],
    ...incidentData,
    patient,
    contact_number: incidentData.contact_number || patientRecord?.contact_number || mockIncidentsData[index].contact_number || '',
    barangay: barangay || mockIncidentsData[index].barangay,
  };
  return mockIncidentsData[index];
}

export function deleteMockIncident(id: string) {
  const index = mockIncidentsData.findIndex(i => i.id === id);
  if (index !== -1) {
    mockIncidentsData.splice(index, 1);
    return true;
  }
  return false;
}

// Keep track of created patients (for mock mode only)
let mockPatientsData = [
  {
    id: 'p1',
    full_name: 'Juan Dela Cruz',
    age: 35,
    sex: 'Male',
    contact_number: '09171234567',
    email: 'juan.delacruz@email.com',
    address: '123 Main St, Poblacion',
    barangay_id: 'b1',
    barangay: { id: 'b1', name: 'Poblacion' },
    created_at: '2026-05-01T08:00:00'
  },
  {
    id: 'p2',
    full_name: 'Maria Santos',
    age: 28,
    sex: 'Female',
    contact_number: '09187654321',
    email: 'maria.santos@email.com',
    address: '456 Oak Ave, San Agustin',
    barangay_id: 'b2',
    barangay: { id: 'b2', name: 'San Agustin' },
    created_at: '2026-05-02T10:30:00'
  },
  {
    id: 'p3',
    full_name: 'Pedro Reyes',
    age: 45,
    sex: 'Male',
    contact_number: '09191112222',
    email: '',
    address: '789 Pine St, Dulangan',
    barangay_id: 'b3',
    barangay: { id: 'b3', name: 'Dulangan' },
    created_at: '2026-05-03T14:15:00'
  },
  {
    id: 'p4',
    full_name: 'Ana Lopez',
    age: 19,
    sex: 'Female',
    contact_number: '09183334444',
    email: 'ana.lopez@email.com',
    address: '321 Maple Dr, Cogon',
    barangay_id: 'b4',
    barangay: { id: 'b4', name: 'Cogon' },
    created_at: '2026-05-04T09:00:00'
  }
];

export const mockPatients = {
  success: true,
  get data() {
    return mockPatientsData;
  }
};

// Helper function to add a patient (for mock mode)
export function addMockPatient(patientData: any) {
  const newPatient = {
    id: `p${mockPatientsData.length + 1}`,
    ...patientData,
    created_at: new Date().toISOString(),
    barangay: mockBarangays.data.find((b: any) => b.id === patientData.barangay_id)
  };
  mockPatientsData.push(newPatient);
  return newPatient;
}

// Helper function to update a patient (for mock mode)
export function updateMockPatient(id: string, patientData: any) {
  const index = mockPatientsData.findIndex(p => p.id === id);
  if (index !== -1) {
    mockPatientsData[index] = {
      ...mockPatientsData[index],
      ...patientData,
      barangay: mockBarangays.data.find((b: any) => b.id === patientData.barangay_id)
    };
    return mockPatientsData[index];
  }
  return null;
}

export const mockPEPSchedule = {
  success: true,
  data: [
    {
      id: '1',
      dose_number: 1,
      scheduled_date: '2026-05-10',
      status: 'Pending',
      incident: {
        id: '1',
        patient: { id: 'p1', full_name: 'Juan Dela Cruz', contact_number: '09171234567' }
      }
    },
    {
      id: '2',
      dose_number: 2,
      scheduled_date: '2026-05-13',
      status: 'Upcoming',
      incident: {
        id: '1',
        patient: { id: 'p1', full_name: 'Juan Dela Cruz', contact_number: '09171234567' }
      }
    }
  ]
};

// Keep track of inventory (for mock mode only)
let mockInventoryData = [
  {
    id: '1',
    item_name: 'Anti-Rabies Vaccine',
    item_type: 'Vaccine',
    current_stock: 45,
    reorder_level: 50,
    unit: 'vials',
    description: '',
    last_updated: '2026-05-09T10:30:00',
    updated_by_user: { full_name: 'Admin User' }
  },
  {
    id: '2',
    item_name: 'Equine Rabies Immunoglobulin (eRIG)',
    item_type: 'Medication',
    current_stock: 120,
    reorder_level: 30,
    unit: 'vials',
    description: '',
    last_updated: '2026-05-08T14:20:00',
    updated_by_user: { full_name: 'Admin User' }
  },
  {
    id: '3',
    item_name: 'Human Rabies Immunoglobulin (hRIG)',
    item_type: 'Medication',
    current_stock: 8,
    reorder_level: 10,
    unit: 'vials',
    description: '',
    last_updated: '2026-05-09T09:15:00',
    updated_by_user: { full_name: 'Health Worker' }
  },
  {
    id: '4',
    item_name: 'Tetanus Toxoid',
    item_type: 'Vaccine',
    current_stock: 85,
    reorder_level: 40,
    unit: 'vials',
    description: '',
    last_updated: '2026-05-07T16:00:00',
    updated_by_user: { full_name: 'Admin User' }
  },
  {
    id: '5',
    item_name: 'Anti-Tetanus Serum (ATS)',
    item_type: 'Medication',
    current_stock: 22,
    reorder_level: 25,
    unit: 'vials',
    description: '',
    last_updated: '2026-05-09T11:45:00',
    updated_by_user: { full_name: 'Health Worker' }
  },
  {
    id: '6',
    item_name: 'Wound Care Kit',
    item_type: 'Medical Supply',
    current_stock: 156,
    reorder_level: 50,
    unit: 'sets',
    description: '',
    last_updated: '2026-05-08T08:30:00',
    updated_by_user: { full_name: 'Admin User' }
  },
  {
    id: '7',
    item_name: 'Syringes (5ml)',
    item_type: 'Medical Supply',
    current_stock: 0,
    reorder_level: 100,
    unit: 'pieces',
    description: '',
    last_updated: '2026-05-10T07:00:00',
    updated_by_user: { full_name: 'Health Worker' }
  }
];

export const mockInventory = {
  success: true,
  get data() {
    return mockInventoryData;
  }
};

// Helper functions for inventory (mock mode)
export function addMockInventoryItem(itemData: any) {
  const newItem = {
    id: `${mockInventoryData.length + 1}`,
    ...itemData,
    last_updated: new Date().toISOString(),
    updated_by_user: { full_name: 'Demo User' }
  };
  mockInventoryData.unshift(newItem);
  return newItem;
}

export function updateMockInventoryItem(id: string, itemData: any) {
  const index = mockInventoryData.findIndex(i => i.id === id);
  if (index !== -1) {
    mockInventoryData[index] = {
      ...mockInventoryData[index],
      ...itemData,
      last_updated: new Date().toISOString(),
      updated_by_user: { full_name: 'Demo User' }
    };
    return mockInventoryData[index];
  }
  return null;
}

// Keep track of animals (for mock mode only)
let mockAnimalsData = [
  {
    id: '1',
    animal_type: 'Dog',
    breed: 'Aspin',
    owner_name: 'Pedro Garcia',
    owner_contact: '09171112222',
    barangay_id: 'b1',
    vaccination_status: 'Vaccinated',
    vaccination_date: '2026-01-15',
    next_vaccination_date: '2027-01-15',
    notes: '',
    barangay: { id: 'b1', name: 'Poblacion' }
  },
  {
    id: '2',
    animal_type: 'Cat',
    breed: 'Persian',
    owner_name: 'Ana Reyes',
    owner_contact: '09183334444',
    barangay_id: 'b2',
    vaccination_status: 'Not Vaccinated',
    vaccination_date: null,
    next_vaccination_date: null,
    notes: '',
    barangay: { id: 'b2', name: 'San Agustin' }
  },
  {
    id: '3',
    animal_type: 'Dog',
    breed: 'Labrador',
    owner_name: 'Carlos Miguel',
    owner_contact: '09195556666',
    barangay_id: 'b3',
    vaccination_status: 'Vaccinated',
    vaccination_date: '2026-03-10',
    next_vaccination_date: '2027-03-10',
    notes: '',
    barangay: { id: 'b3', name: 'Dulangan' }
  }
];

export const mockAnimals = {
  success: true,
  get data() {
    return mockAnimalsData;
  }
};

// Helper functions for animals (mock mode)
export function addMockAnimal(animalData: any) {
  const barangay = mockBarangays.data.find((b: any) => b.id === animalData.barangay_id);

  const newAnimal = {
    id: `${mockAnimalsData.length + 1}`,
    ...animalData,
    barangay: barangay || null
  };
  mockAnimalsData.unshift(newAnimal);
  return newAnimal;
}

export function updateMockAnimal(id: string, animalData: any) {
  const index = mockAnimalsData.findIndex(a => a.id === id);
  if (index !== -1) {
    const barangay = mockBarangays.data.find((b: any) => b.id === animalData.barangay_id);

    mockAnimalsData[index] = {
      ...mockAnimalsData[index],
      ...animalData,
      barangay: barangay || mockAnimalsData[index].barangay
    };
    return mockAnimalsData[index];
  }
  return null;
}

export const mockUsers = {
  success: true,
  data: [
    {
      id: 'u1',
      email: 'admin@bitemap.local',
      full_name: 'System Administrator',
      role: 'system_admin',
      phone: '09171234567',
      is_active: true,
      created_at: '2026-01-01'
    },
    {
      id: 'u2',
      email: 'nurse@bitemap.local',
      full_name: 'Nurse/Vaccinator',
      role: 'Nurse/Vaccinator',
      phone: '09187654321',
      is_active: true,
      created_at: '2026-01-15'
    }
  ]
};

export const mockAuditLogs = {
  success: true,
  data: [
    {
      id: '1',
      action: 'CREATE',
      module: 'incidents',
      details: '{"incident_id":"1"}',
      created_at: '2026-05-09T10:30:00Z',
      user: { full_name: 'Admin User', email: 'admin@digos.gov.ph' }
    },
    {
      id: '2',
      action: 'UPDATE',
      module: 'patients',
      details: '{"patient_id":"p1"}',
      created_at: '2026-05-09T11:15:00Z',
      user: { full_name: 'Health Worker', email: 'healthworker@digos.gov.ph' }
    }
  ]
};

export const mockSettings = {
  success: true,
  data: [
    { setting_key: 'clinic_name', setting_value: 'Digos City Health Office', description: 'Main clinic name' },
    { setting_key: 'clinic_address', setting_value: 'Cor Jesu College, Digos City', description: 'Clinic address' },
    { setting_key: 'contact_number', setting_value: '(082) 553-1234', description: 'Contact number' }
  ]
};

export const mockNotifications = {
  success: true,
  data: [
    {
      id: '1',
      notification_type: 'SMS',
      recipient: '09171234567',
      message: 'Reminder: Your next rabies vaccine dose is scheduled for May 13, 2026',
      status: 'Sent',
      sent_at: '2026-05-10T08:00:00Z',
      patient: { full_name: 'Juan Dela Cruz' }
    }
  ]
};

export const mockBarangays = {
  success: true,
  data: [
    { id: 'b1', name: 'Poblacion', code: 'POB' },
    { id: 'b2', name: 'San Agustin', code: 'SAG' },
    { id: 'b3', name: 'Dulangan', code: 'DUL' },
    { id: 'b4', name: 'Cogon', code: 'COG' }
  ]
};

export const mockPublicStats = {
  success: true,
  totalCases: 156,
  activeCases: 23,
  completedVaccinations: 128,
  pendingDoses: 45
};

export const mockHeatmapData = {
  success: true,
  data: [
    { location_lat: 6.7494, location_lng: 125.3569, who_category: 'Category III' },
    { location_lat: 6.7501, location_lng: 125.3575, who_category: 'Category II' },
    { location_lat: 6.7488, location_lng: 125.3562, who_category: 'Category III' }
  ]
};
