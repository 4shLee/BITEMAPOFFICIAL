import { Link } from 'react-router';
import { ArrowLeft, MapPin, Clock, Phone, Mail, Navigation } from 'lucide-react';
import { Badge } from '../components/UI/Badge';

export function PublicClinics() {
  const clinics = [
    {
      id: 1,
      name: 'Digos City Health Office - Main',
      address: 'City Hall Complex, Rizal Avenue, Zone 1, Digos City',
      barangay: 'Zone 1',
      phone: '+63 82 553 1234',
      email: 'health@digos.gov.ph',
      hours: 'Mon-Fri: 8:00 AM - 5:00 PM, Sat: 8:00 AM - 12:00 PM',
      services: ['Anti-rabies Vaccination', 'Wound Treatment', 'PEP Schedule Management', 'eRIG/hRIG Available'],
      status: 'Open',
      distance: '1.2 km'
    },
    {
      id: 2,
      name: 'Barangay Health Station - Aplaya',
      address: 'Purok 5, Aplaya, Digos City',
      barangay: 'Aplaya',
      phone: '+63 82 553 5678',
      email: 'aplaya.bhs@digos.gov.ph',
      hours: 'Mon-Sat: 8:00 AM - 5:00 PM',
      services: ['Anti-rabies Vaccination', 'Basic Wound Care', 'Patient Registration'],
      status: 'Open',
      distance: '3.5 km'
    },
    {
      id: 3,
      name: 'San Jose Rural Health Unit',
      address: 'San Jose National Highway, Digos City',
      barangay: 'San Jose',
      phone: '+63 82 553 7890',
      email: 'sanjose.rhu@digos.gov.ph',
      hours: 'Mon-Sat: 7:30 AM - 4:30 PM',
      services: ['Anti-rabies Vaccination', 'Wound Treatment', 'Animal Bite Assessment'],
      status: 'Open',
      distance: '5.8 km'
    },
    {
      id: 4,
      name: 'Digos District Hospital - Emergency',
      address: 'National Highway, Zone 2, Digos City',
      barangay: 'Zone 2',
      phone: '+63 82 553 9999',
      email: 'emergency@digoshospital.gov.ph',
      hours: '24/7 Emergency Services',
      services: ['Emergency Bite Treatment', 'Anti-rabies Vaccination', 'Critical Care', 'All Immunoglobulins Available'],
      status: 'Open 24/7',
      distance: '2.1 km'
    },
    {
      id: 5,
      name: 'Mahayahay Barangay Clinic',
      address: 'Mahayahay Proper, Digos City',
      barangay: 'Mahayahay',
      phone: '+63 82 553 4567',
      email: 'mahayahay.clinic@digos.gov.ph',
      hours: 'Mon-Fri: 8:00 AM - 5:00 PM',
      services: ['Anti-rabies Vaccination', 'Basic Wound Care'],
      status: 'Open',
      distance: '7.2 km'
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/public"
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Vaccination Clinics</h1>
              <p className="text-xs text-muted-foreground">Find anti-rabies treatment centers near you</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-primary-bg border border-primary/20 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-3">
            <Navigation className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-primary mb-2">Getting Treatment</h2>
              <p className="text-sm text-primary mb-3">
                If you've been bitten by an animal, seek medical attention immediately. All clinics below provide anti-rabies vaccination.
                For severe bites (Category III), visit facilities with immunoglobulin availability.
              </p>
              <div className="flex gap-3">
                <Badge variant="success">Free for Residents</Badge>
                <Badge variant="info">No Appointment Needed</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">{clinics.length} Treatment Centers Available</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {clinics.map((clinic) => (
            <div key={clinic.id} className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-foreground mb-1">{clinic.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <MapPin className="w-4 h-4" />
                      <span>{clinic.barangay} • {clinic.distance} away</span>
                    </div>
                  </div>
                  <Badge variant={clinic.status === 'Open 24/7' ? 'success' : 'info'} size="sm">
                    {clinic.status}
                  </Badge>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <p className="text-muted-foreground">{clinic.address}</p>
                  </div>

                  <div className="flex items-start gap-3 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <p className="text-muted-foreground">{clinic.hours}</p>
                  </div>

                  <div className="flex items-start gap-3 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <a href={`tel:${clinic.phone}`} className="text-primary hover:underline">
                      {clinic.phone}
                    </a>
                  </div>

                  <div className="flex items-start gap-3 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <a href={`mailto:${clinic.email}`} className="text-primary hover:underline">
                      {clinic.email}
                    </a>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Services Available:</p>
                  <div className="flex flex-wrap gap-2">
                    {clinic.services.map((service, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 bg-muted border-t border-border flex gap-3">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
                >
                  Get Directions
                </a>
                <a
                  href={`tel:${clinic.phone}`}
                  className="flex-1 text-center px-4 py-2 border border-border bg-card rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                >
                  Call Now
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-card border border-border rounded-lg p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">What to Bring</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-foreground">Valid ID</p>
                <p className="text-sm text-muted-foreground">Government-issued ID or Barangay clearance</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-foreground">Incident Details</p>
                <p className="text-sm text-muted-foreground">Date, time, location, and type of animal</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-foreground">PhilHealth Card (if available)</p>
                <p className="text-sm text-muted-foreground">Treatment is free, but card helps with records</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-foreground">Contact Information</p>
                <p className="text-sm text-muted-foreground">Phone number and current address</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
