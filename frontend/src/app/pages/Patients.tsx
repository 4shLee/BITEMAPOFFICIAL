import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Edit, Eye, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { patientsAPI } from '../../lib/services/api';
import { canPerformAction, getStoredUser } from '../../lib/auth/roleAccess';

export function Patients() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const canCreatePatient = canPerformAction(currentUser?.role, 'patients.create');
  const canUpdatePatient = canPerformAction(currentUser?.role, 'patients.update');
  const canDeletePatient = canPerformAction(currentUser?.role, 'patients.delete');
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const response = await patientsAPI.getAll();
      if (response.success) {
        setPatients(response.data);
      }
    } catch (error) {
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (patient: any) => {
    navigate('/patients/' + patient.id + '/edit');
  };

  const handleDelete = async (patient: any) => {
    if (!confirm('Delete this patient record? Related incidents, PEP schedules, and notifications will also be removed.')) return;

    try {
      await patientsAPI.delete(String(patient.id));
      toast.success('Patient deleted successfully');
      loadPatients();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete patient');
    }
  };

  const handleCreate = () => {
    navigate('/patients/new');
  };

  const filteredPatients = patients.filter((patient) =>
    patient.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.barangay?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1">
      <Header title="Patient Registry" breadcrumbs={['Patients', 'Registry']} />

      <div className="p-8">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search patients by name, barangay..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-input-background border border-input rounded-lg text-sm"
                />
              </div>
              <Button variant="outline" size="md">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
              {canCreatePatient && (
                <Button variant="primary" size="md" onClick={handleCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Patient
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted text-xs font-medium text-muted-foreground">
                  <th className="text-left px-6 py-3">Patient Name</th>
                  <th className="text-left px-6 py-3">Age</th>
                  <th className="text-left px-6 py-3">Sex</th>
                  <th className="text-left px-6 py-3">Barangay</th>
                  <th className="text-left px-6 py-3">Contact Number</th>
                  <th className="text-left px-6 py-3">Date Registered</th>
                  <th className="text-left px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground">
                      Loading patients...
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground">
                      No patients found
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">{patient.full_name}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{patient.age}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{patient.sex}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{patient.barangay?.name || 'Unknown'}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{patient.contact_number}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(patient.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/patients/${patient.id}`)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/15"
                            title="View Details"
                            aria-label="View patient details"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {canUpdatePatient && (
                            <button
                              onClick={() => handleEdit(patient)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/15"
                              title="Edit"
                              aria-label="Edit patient"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                          )}
                          {canDeletePatient && (
                            <button
                              onClick={() => handleDelete(patient)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10 text-destructive shadow-sm transition-colors hover:border-destructive/40 hover:bg-destructive/15"
                              title="Delete"
                              aria-label="Delete patient"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
