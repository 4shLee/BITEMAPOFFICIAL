import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Header } from '../Layout/Header';
import { Badge } from '../UI/Badge';
import { Button } from '../UI/Button';
import { incidentsAPI } from '../../../lib/services/api';
import { canPerformAction, getStoredUser } from '../../../lib/auth/roleAccess';
import { IncidentFormModal } from './IncidentFormModal';

export function IncidentListPage() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const canCreateIncident = canPerformAction(currentUser?.role, 'incidents.create');
  const canUpdateIncident = canPerformAction(currentUser?.role, 'incidents.update');
  const canDeleteIncident = canPerformAction(currentUser?.role, 'incidents.delete');
  const [searchTerm, setSearchTerm] = useState('');
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIncident, setEditingIncident] = useState<any>(null);

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const response = await incidentsAPI.getAll();
      if (response.success) {
        setIncidents(response.data);
      }
    } catch (error) {
      toast.error('Failed to load incidents');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this incident? The patient record will also be removed if this is their only incident.')) return;

    try {
      await incidentsAPI.delete(id);
      toast.success('Incident deleted successfully');
      loadIncidents();
    } catch (error) {
      toast.error('Failed to delete incident');
    }
  };

  const handleEdit = (incident: any) => {
    setEditingIncident(incident);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingIncident(null);
    setShowModal(true);
  };

  const handleModalClose = (shouldReload?: boolean) => {
    setShowModal(false);
    setEditingIncident(null);
    if (shouldReload) {
      loadIncidents();
    }
  };

  const getCategoryVariant = (category: string) => {
    switch (category) {
      case 'Category I': return 'success';
      case 'Category II': return 'warning';
      case 'Category III': return 'danger';
      default: return 'neutral';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Active': return 'info';
      case 'Completed': return 'success';
      case 'Pending': return 'warning';
      default: return 'neutral';
    }
  };

  const filteredIncidents = incidents.filter((incident) =>
    incident.patient?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    incident.barangay?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1">
      <Header title="Incident Management" breadcrumbs={['Incidents', 'All Incidents']} />

      <div className="p-8">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search incidents by patient, barangay..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-input-background border border-input rounded-lg text-sm"
                />
              </div>
              <Button variant="outline" size="md">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
              {canCreateIncident && (
                <Button variant="primary" size="md" onClick={handleCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Incident
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted text-xs font-medium text-muted-foreground">
                  <th className="text-left px-6 py-3">Patient Name</th>
                  <th className="text-left px-6 py-3">Date</th>
                  <th className="text-left px-6 py-3">Animal Type</th>
                  <th className="text-left px-6 py-3">Bite Location</th>
                  <th className="text-left px-6 py-3">Barangay</th>
                  <th className="text-left px-6 py-3">WHO Category</th>
                  <th className="text-left px-6 py-3">Status</th>
                  <th className="text-left px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-muted-foreground">
                      Loading incidents...
                    </td>
                  </tr>
                ) : filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-muted-foreground">
                      No incidents found
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map((incident) => (
                    <tr key={incident.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {incident.patient?.full_name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(incident.incident_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{incident.animal_type}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{incident.bite_location}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {incident.barangay?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getCategoryVariant(incident.who_category)}>
                          {incident.who_category}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusVariant(incident.status)}>
                          {incident.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/patients/${incident.patient?.id}`)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/15"
                            title="View Details"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {canUpdateIncident && (
                            <button
                              onClick={() => handleEdit(incident)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/15"
                              title="Edit"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                          )}
                          {canDeleteIncident && (
                            <button
                              onClick={() => handleDelete(incident.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10 text-destructive shadow-sm transition-colors hover:border-destructive/40 hover:bg-destructive/15"
                              title="Delete"
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
              Showing {filteredIncidents.length} incident{filteredIncidents.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {showModal && (canCreateIncident || canUpdateIncident) && (
        <IncidentFormModal
          incident={editingIncident}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
