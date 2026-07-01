Design a complete high-fidelity web application UI in Figma for "BITEMAP" — a GIS-Based Animal Bite Incident Tracking & Anti-Rabies Vaccination Monitoring System for Digos City, Davao del Sur, Philippines.

The system is used by: Nurses/Vaccinators, Health Officers, Barangay Health Workers, LGU Officials, and Admins. It runs in a web browser (Chrome/Firefox/Edge). No mobile app needed.

DESIGN STYLE:

Clean, clinical, and government-grade. Think DOH/LGU dashboards — functional, trustworthy, not flashy.
Primary color: teal/green (health + Philippines gov branding). Accent: deep blue or coral for alerts.
Typography: Inter or Noto Sans. Body 14px, labels 12px, headings 18–24px.
Sidebar navigation layout (fixed left nav, scrollable main content area).
Use card-based layouts for data. Tables for records. Maps as full-width panels.
SCREENS TO DESIGN (13 total):

Login Page — role-aware login with Digos City / CJC branding
Main Dashboard — summary cards (total bites, vaccinated, pending, high-risk barangays), recent incidents table, mini GIS heatmap widget, low stock alert banner
Animal Bite Incident Report Form — patient demographics, bite details, WHO wound category (I/II/III) selector, animal type, incident location picker on map
Patient Registration & Categorization — patient list with search/filter, WHO category badge, status tags (Active, Completed, Missed)
PEP Schedule Management — patient vaccination timeline (Day 0, 3, 7, 14, 28), color-coded dose status (Done / Upcoming / Missed), SMS/email reminder toggle
Vaccine Inventory Monitor — stock table (anti-rabies vaccine, eRIG, hRIG, tetanus toxoid, ATS, wound care), quantity badges, low-stock warning indicators, restock log
GIS Heatmap & Barangay Analysis — full-width interactive map of Digos City barangays, color-coded by incident density (green → yellow → red), click-to-inspect panel showing: animal type breakdown, victim demographics, PEP compliance rate
Animal Vaccination Registry — dog/cat vaccination records per barangay, managed by CVO, searchable table with vaccination status
Report Generation — report type selector (monthly/annual), date range picker, format export buttons (PDF / Excel), preview panel
User Management & Role-Based Access Control — user list table, role assignment dropdown (Admin, Health Officer, Nurse/Vaccinator, BHW, Vet Staff), add/edit/deactivate actions
Patient Record Detail Page — full patient profile, bite incident summary, complete PEP dose history, compliance status, notification log
Notifications / Reminders Panel — upcoming dose reminders list, sent SMS/email log, mark-as-sent action
Audit Log / System Activity — timestamped log of all system actions per user, filterable by role and date
COMPONENT LIBRARY to include:

Navigation sidebar with role-based menu items
Top header bar with user avatar, notification bell, and breadcrumb
Summary stat cards (icon + number + label + trend indicator)
WHO Category badge (Cat I = green, Cat II = amber, Cat III = red)
Dose status pill (Done = teal, Upcoming = blue, Missed = red)
Data table with sort, filter, pagination
Map component with heatmap overlay and click panel
Stock level indicator bar (green / yellow / red threshold)
Modal dialogs for form submission and confirmation
Alert/banner component for low stock and missed doses
Empty states for tables and maps
RESPONSIVE: Desktop only (1280px+ viewport). No mobile needed.

Please organize frames in Figma by: (1) Auth, (2) Dashboard, (3) Incident Management, (4) Patient & PEP, (5) Inventory, (6) GIS & Reports, (7) Admin & Settings. Use auto-layout throughout. Include a cover frame with the BITEMAP system name and Cor Jesu College branding.

SCREEN 1 — Login Page: Design a login page for BITEMAP. Include: Cor Jesu College logo top-left, system name "BITEMAP" with tagline "Animal Bite Tracking & Vaccination Monitoring — Digos City", username + password fields, role selector dropdown (Nurse, Health Officer, Admin, BHW, Vet Staff), "Sign In" button in teal, and a subtle Philippines health department footer note. Flat white card centered on a light gray background.

SCREEN 2 — Main Dashboard: Design a dashboard with a fixed left sidebar (nav items: Dashboard, Incidents, Patients, PEP Schedule, Inventory, GIS Map, Reports, Users, Settings). Main area: 4 stat cards at top (Total Bite Cases, Fully Vaccinated, Pending Doses, High-Risk Barangays). Below: a two-column layout — left = recent incidents table (date, patient name, barangay, category badge, status), right = mini heatmap of Digos City barangays + low stock alert card.

SCREEN 3 — Incident Report Form: Design a multi-section form: Section 1 "Patient Information" (name, age, sex, address, contact), Section 2 "Bite Details" (date/time, animal type radio buttons, bite site body diagram, WHO category I/II/III selector with descriptions), Section 3 "Incident Location" (embedded map with pin-drop to select barangay). Save and Cancel buttons at bottom.

SCREEN 4 — PEP Schedule View: Design a patient's vaccination schedule card. Show patient name + category badge at top. Below: a horizontal timeline showing 5 doses (Day 0, 3, 7, 14, 28) with status icons — checkmark (done/teal), clock (upcoming/blue), X (missed/red). Each dose node shows: date, vaccine lot number, administered by. Below timeline: SMS/email reminder toggle and next dose countdown chip.

SCREEN 5 — GIS Heatmap Page: Design a full-width map page. Left panel (280px): filter controls (date range, animal type, category, barangay). Main area: choropleth map of Digos City barangays, color-coded by incident count (light green = 0–5, yellow = 6–15, orange = 16–30, red = 31+). Clicking a barangay opens a right drawer panel showing: incident count, top animal type, age/sex breakdown donut chart, PEP compliance bar.

SCREEN 6 — Vaccine Inventory: Design a stock management page. Table columns: Vaccine/Supply Name, Current Stock, Unit, Reorder Level, Status (OK/Low/Critical badge), Last Updated, Action (Adjust Stock). Above table: 3 summary cards (Total Items, Low Stock Items, Critical Items). Below table: Recent Stock Transactions log.

SCREEN 7 — Report Generation: Design a report builder page. Left panel: report type selector (Monthly Incident Report, Annual Vaccination Summary, Inventory Report, Compliance Report), date range picker, barangay filter, format toggle (PDF / Excel). Right panel: live preview of report structure (table of contents style). Bottom: Generate Report button (teal, prominent).

Create a BITEMAP design system and component library in Figma with the following:

COLOR TOKENS:

Primary: Teal (#0F6E56 dark, #1D9E75 default, #5DCAA5 light, #E1F5EE bg)
Danger/Alert: Coral-red (#D85A30 default, #FAECE7 bg)
Warning: Amber (#BA7517 default, #FAEEDA bg)
Info: Blue (#185FA5 default, #E6F1FB bg)
Neutral: Gray (#5F5E5A default, #F1EFE8 bg)
Text primary: #2C2C2A, Text secondary: #888780
Surface: white, Page bg: #F8F7F4
TYPOGRAPHY SCALE:

H1: 24px / 500 — page titles
H2: 18px / 500 — section headings
H3: 16px / 500 — card headers
Body: 14px / 400 — default text
Label: 12px / 500 — form labels, table headers
Micro: 11px / 400 — timestamps, meta info
COMPONENTS TO BUILD:

Sidebar navigation — collapsed (icons only) + expanded (icon + label) states
Stat card — icon left, number large, label muted, optional trend arrow
WHO Category badge — Cat I (green), Cat II (amber), Cat III (red) — pill shape
Dose status pill — Done (teal), Upcoming (blue), Missed (red), Skipped (gray)
Data table — header row (gray bg, 12px label), data rows (14px, alternating white/light), pagination bar, sort arrows, filter chip row
Map drawer panel — slides from right, 320px wide, header with barangay name, scrollable content area
Stock level bar — horizontal bar with color fill: green >50%, amber 20–50%, red <20%
Alert banner — full-width, icon left, message, dismiss X — variants: info/warning/danger
Form field — label above, input with border, error state (red border + message), helper text
Modal dialog — overlay bg, white card 480px, title, content area, Cancel + Confirm buttons
Avatar chip — initials circle + name + role badge — for user cards and table rows
Notification item — icon, message, timestamp, unread dot indicator
Please build all components with Figma auto-layout, variants (default/hover/active/disabled/error), and proper component properties. Organize in a dedicated "🧩 Components" page.

Create a Figma prototype showing the following 3 key user flows for BITEMAP:

FLOW 1 — Nurse records a new animal bite incident: Login (Nurse role) → Dashboard → click "New Incident" button → Incident Report Form (fill patient info) → select WHO Category III → pin location on map → Submit → success toast → redirected to Patient Detail page → PEP Schedule auto-generated → system shows Day 0 dose as "Due Today"

FLOW 2 — Health Officer reviews GIS heatmap and generates report: Login (Health Officer role) → Dashboard → click "GIS Map" in sidebar → Heatmap loads → click on high-density barangay → right drawer opens with barangay stats → click "View Full Report" → Report Generation page → select "Monthly Incident Report" → set date range → click "Generate PDF" → PDF preview modal opens → Download

FLOW 3 — Admin manages users and access: Login (Admin role) → Dashboard → click "Users" in sidebar → User list table → click "Add User" → Add User modal (name, email, role dropdown) → Save → new user appears in table → click existing user → Edit User modal → change role from Nurse to Health Officer → Save → role badge updates in table

For each flow, use Figma's prototype connections with "After delay" or "On click" triggers. Add a flow start frame label. Keep transitions as "Instant" or "Smart animate" for smooth feel.