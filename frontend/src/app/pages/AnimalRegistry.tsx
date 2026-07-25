import { useCallback, useState, useEffect } from 'react';
import { Search, Filter, Plus, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Layout/Header';
import { Badge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { animalsAPI } from '../../lib/services/api';
import { AnimalFormModal } from '../components/Animals/AnimalFormModal';

type AnimalRegistryRow = {
  id: number | string;
  animal_type?: string | null;
  breed?: string | null;
  owner_name?: string | null;
  owner_contact?: string | null;
  barangay?: { name?: string | null } | null;
  vaccination_status?: string | null;
  vaccination_date?: string | null;
};

export function AnimalRegistry() {
  const [searchTerm, setSearchTerm] = useState('');
  const [animals, setAnimals] = useState<AnimalRegistryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<AnimalRegistryRow | null>(null);

  const loadAnimals = useCallback(async () => {
    try {
      setLoading(true);
      const response = await animalsAPI.getAll();
      if (response.success) {
        setAnimals(response.data);
      }
    } catch {
      toast.error('Failed to load animals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadAnimals(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadAnimals]);

  const handleEdit = (animal: AnimalRegistryRow) => {
    setEditingAnimal(animal);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingAnimal(null);
    setShowModal(true);
  };

  const handleModalClose = (shouldReload?: boolean) => {
    setShowModal(false);
    setEditingAnimal(null);
    if (shouldReload) {
      loadAnimals();
    }
  };

  const filteredAnimals = animals.filter((animal) =>
    animal.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    animal.animal_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    animal.breed?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const vaccinatedCount = animals.filter(a => a.vaccination_status === 'Vaccinated').length;
  const overdueCount = animals.filter(a => a.vaccination_status === 'Overdue').length;

  return (
    <div className="flex-1">
      <Header title="Animal Vaccination Registry" breadcrumbs={['Registry', 'Animals']} />

      <div className="p-8">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by owner, animal type, breed..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-input-background border border-input rounded-lg text-sm"
                />
              </div>
              <Button variant="outline" size="md">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
              <Button variant="primary" size="md" onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Register Animal
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted text-xs font-medium text-muted-foreground">
                  <th className="text-left px-6 py-3">Type</th>
                  <th className="text-left px-6 py-3">Breed</th>
                  <th className="text-left px-6 py-3">Owner</th>
                  <th className="text-left px-6 py-3">Contact</th>
                  <th className="text-left px-6 py-3">Barangay</th>
                  <th className="text-left px-6 py-3">Vaccination Status</th>
                  <th className="text-left px-6 py-3">Last Vaccination</th>
                  <th className="text-left px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-muted-foreground">
                      Loading animals...
                    </td>
                  </tr>
                ) : filteredAnimals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-muted-foreground">
                      No animals found
                    </td>
                  </tr>
                ) : (
                  filteredAnimals.map((animal) => (
                    <tr key={animal.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">{animal.animal_type}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{animal.breed || '-'}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{animal.owner_name}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{animal.owner_contact}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{animal.barangay?.name || 'Unknown'}</td>
                      <td className="px-6 py-4">
                        <Badge variant={animal.vaccination_status === 'Vaccinated' ? 'success' : animal.vaccination_status === 'Overdue' ? 'danger' : 'warning'}>
                          {animal.vaccination_status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {animal.vaccination_date ? new Date(animal.vaccination_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(animal)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/15"
                            title="Edit"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
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
              Showing {filteredAnimals.length} animal{filteredAnimals.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-xs text-muted-foreground mb-2">Total Registered Animals</p>
            <p className="text-2xl font-semibold text-foreground">{animals.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-xs text-muted-foreground mb-2">Vaccinated</p>
            <p className="text-2xl font-semibold text-success">{vaccinatedCount}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-xs text-muted-foreground mb-2">Overdue Vaccination</p>
            <p className="text-2xl font-semibold text-destructive">{overdueCount}</p>
          </div>
        </div>
      </div>

      {showModal && (
        <AnimalFormModal
          animal={editingAnimal}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
