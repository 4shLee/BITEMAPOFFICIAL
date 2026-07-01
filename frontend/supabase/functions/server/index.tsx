import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Create Supabase client
const supabase = () => createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper function to get authenticated user
async function getAuthUser(authHeader: string | null) {
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase().auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Helper function to log audit trail
async function logAudit(userId: string | null, action: string, module: string, details: any, ipAddress?: string) {
  try {
    await supabase()
      .from("audit_log")
      .insert([{
        user_id: userId,
        action,
        module,
        details: JSON.stringify(details),
        ip_address: ipAddress
      }]);
  } catch (error) {
    console.error("Audit log error:", error);
  }
}

// Health check endpoint
app.get("/make-server-e1d15c13/health", (c) => {
  return c.json({ status: "ok" });
});

// ============ AUTHENTICATION ENDPOINTS ============

// Sign up
app.post("/make-server-e1d15c13/auth/signup", async (c) => {
  try {
    const { email, password, fullName, role, phone } = await c.req.json();

    const db = supabase();
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since email server not configured
      user_metadata: { full_name: fullName, role }
    });

    if (authError) {
      console.error("Signup auth error:", authError);
      return c.json({ success: false, error: authError.message }, 400);
    }

    // Create profile record
    const { error: profileError } = await db
      .from("profiles")
      .insert([{
        id: authData.user.id,
        email,
        full_name: fullName,
        role,
        phone,
        is_active: true
      }]);

    if (profileError) {
      console.error("Signup profile error:", profileError);
      return c.json({ success: false, error: profileError.message }, 400);
    }

    await logAudit(authData.user.id, "SIGNUP", "auth", { email, role });

    return c.json({
      success: true,
      message: "User created successfully",
      userId: authData.user.id
    });
  } catch (error) {
    console.error("Signup error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Sign in
app.post("/make-server-e1d15c13/auth/signin", async (c) => {
  try {
    const { email, password } = await c.req.json();

    const db = supabase();
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error("Signin error:", error);
      return c.json({ success: false, error: error.message }, 401);
    }

    // Get user profile
    const { data: profile } = await db
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    await logAudit(data.user.id, "SIGNIN", "auth", { email });

    return c.json({
      success: true,
      accessToken: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: profile?.full_name,
        role: profile?.role,
        phone: profile?.phone
      }
    });
  } catch (error) {
    console.error("Signin error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get current session
app.get("/make-server-e1d15c13/auth/session", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Not authenticated" }, 401);
    }

    const { data: profile } = await supabase()
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: profile?.full_name,
        role: profile?.role,
        phone: profile?.phone
      }
    });
  } catch (error) {
    console.error("Session error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ DASHBOARD STATISTICS ============
app.get("/make-server-e1d15c13/dashboard/stats", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const db = supabase();

    // Get total cases
    const { count: totalCases } = await db
      .from("incidents")
      .select("*", { count: "exact", head: true });

    // Get active cases
    const { count: activeCases } = await db
      .from("incidents")
      .select("*", { count: "exact", head: true })
      .eq("status", "Active");

    // Get completed
    const { count: completedVaccinations } = await db
      .from("incidents")
      .select("*", { count: "exact", head: true })
      .eq("status", "Completed");

    // Get pending doses
    const { count: pendingDoses } = await db
      .from("pep_schedule")
      .select("*", { count: "exact", head: true })
      .in("status", ["Pending", "Upcoming"]);

    // Get high-risk barangays (barangays with >5 active incidents)
    const { data: barangayCounts } = await db
      .from("incidents")
      .select("barangay_id")
      .eq("status", "Active");

    const barangayMap = new Map();
    barangayCounts?.forEach(item => {
      if (item.barangay_id) {
        barangayMap.set(item.barangay_id, (barangayMap.get(item.barangay_id) || 0) + 1);
      }
    });
    const highRiskBarangays = Array.from(barangayMap.values()).filter(count => count > 5).length;

    // Get recent incidents
    const { data: recentIncidents } = await db
      .from("incidents")
      .select(`
        id,
        incident_date,
        who_category,
        status,
        patient:patients(full_name),
        barangay:barangays(name)
      `)
      .order("incident_date", { ascending: false })
      .limit(10);

    // Get inventory low stock items
    const { data: lowStockItems } = await db
      .from("inventory")
      .select("*")
      .lt("current_stock", "reorder_level");

    return c.json({
      success: true,
      stats: {
        totalCases: totalCases || 0,
        activeCases: activeCases || 0,
        completedVaccinations: completedVaccinations || 0,
        pendingDoses: pendingDoses || 0,
        highRiskBarangays
      },
      recentIncidents: recentIncidents || [],
      lowStockItems: lowStockItems || []
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ INCIDENTS ENDPOINTS ============

// Get all incidents
app.get("/make-server-e1d15c13/incidents", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const { data, error } = await supabase()
      .from("incidents")
      .select(`
        *,
        patient:patients(*),
        barangay:barangays(*),
        reported_by_user:profiles!incidents_reported_by_fkey(full_name)
      `)
      .order("incident_date", { ascending: false });

    if (error) throw error;

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Get incidents error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get single incident
app.get("/make-server-e1d15c13/incidents/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const { data, error } = await supabase()
      .from("incidents")
      .select(`
        *,
        patient:patients(*),
        barangay:barangays(*),
        reported_by_user:profiles!incidents_reported_by_fkey(full_name),
        pep_schedule(*)
      `)
      .eq("id", id)
      .single();

    if (error) throw error;

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Get incident error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create incident
app.post("/make-server-e1d15c13/incidents", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const incidentData = await c.req.json();
    const { data, error } = await supabase()
      .from("incidents")
      .insert([{ ...incidentData, reported_by: user.id }])
      .select()
      .single();

    if (error) throw error;

    await logAudit(user.id, "CREATE", "incidents", data);

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Create incident error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update incident
app.put("/make-server-e1d15c13/incidents/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const incidentData = await c.req.json();

    const { data, error } = await supabase()
      .from("incidents")
      .update(incidentData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await logAudit(user.id, "UPDATE", "incidents", { id, ...incidentData });

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Update incident error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete incident
app.delete("/make-server-e1d15c13/incidents/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const { error } = await supabase()
      .from("incidents")
      .delete()
      .eq("id", id);

    if (error) throw error;

    await logAudit(user.id, "DELETE", "incidents", { id });

    return c.json({ success: true, message: "Incident deleted" });
  } catch (error) {
    console.error("Delete incident error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ PATIENTS ENDPOINTS ============

// Get all patients
app.get("/make-server-e1d15c13/patients", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const { data, error } = await supabase()
      .from("patients")
      .select(`
        *,
        barangay:barangays(name)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Get patients error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get single patient
app.get("/make-server-e1d15c13/patients/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const { data, error } = await supabase()
      .from("patients")
      .select(`
        *,
        barangay:barangays(*),
        incidents(
          *,
          pep_schedule(*)
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Get patient error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create patient
app.post("/make-server-e1d15c13/patients", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const patientData = await c.req.json();
    const { data, error } = await supabase()
      .from("patients")
      .insert([patientData])
      .select()
      .single();

    if (error) throw error;

    await logAudit(user.id, "CREATE", "patients", data);

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Create patient error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update patient
app.put("/make-server-e1d15c13/patients/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const patientData = await c.req.json();

    const { data, error } = await supabase()
      .from("patients")
      .update(patientData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await logAudit(user.id, "UPDATE", "patients", { id, ...patientData });

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Update patient error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ PEP SCHEDULE ENDPOINTS ============

// Get PEP schedules
app.get("/make-server-e1d15c13/pep-schedule", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const { data, error } = await supabase()
      .from("pep_schedule")
      .select(`
        *,
        incident:incidents(
          *,
          patient:patients(*)
        ),
        administered_by_user:profiles!pep_schedule_administered_by_fkey(full_name)
      `)
      .order("scheduled_date", { ascending: true });

    if (error) throw error;

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Get PEP schedule error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update PEP schedule (mark as done)
app.put("/make-server-e1d15c13/pep-schedule/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const updateData = await c.req.json();

    const { data, error } = await supabase()
      .from("pep_schedule")
      .update({ ...updateData, administered_by: user.id })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await logAudit(user.id, "UPDATE", "pep_schedule", { id, ...updateData });

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Update PEP schedule error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ INVENTORY ENDPOINTS ============

// Get all inventory
app.get("/make-server-e1d15c13/inventory", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const { data, error } = await supabase()
      .from("inventory")
      .select(`
        *,
        updated_by_user:profiles!inventory_updated_by_fkey(full_name)
      `)
      .order("item_name");

    if (error) throw error;

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Get inventory error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update inventory stock
app.put("/make-server-e1d15c13/inventory/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const { current_stock, transaction_type, notes } = await c.req.json();

    // Update inventory
    const { data: inventoryData, error: inventoryError } = await supabase()
      .from("inventory")
      .update({ current_stock, updated_by: user.id, last_updated: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (inventoryError) throw inventoryError;

    // Log transaction
    if (transaction_type) {
      const { error: transactionError } = await supabase()
        .from("inventory_transactions")
        .insert([{
          inventory_id: id,
          transaction_type,
          quantity: current_stock,
          notes,
          created_by: user.id
        }]);

      if (transactionError) console.error("Transaction log error:", transactionError);
    }

    await logAudit(user.id, "UPDATE", "inventory", { id, current_stock, transaction_type });

    return c.json({ success: true, data: inventoryData });
  } catch (error) {
    console.error("Update inventory error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ ANIMALS ENDPOINTS ============

// Get all animals
app.get("/make-server-e1d15c13/animals", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const { data, error } = await supabase()
      .from("animals")
      .select(`
        *,
        barangay:barangays(name)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Get animals error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create animal
app.post("/make-server-e1d15c13/animals", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const animalData = await c.req.json();
    const { data, error } = await supabase()
      .from("animals")
      .insert([animalData])
      .select()
      .single();

    if (error) throw error;

    await logAudit(user.id, "CREATE", "animals", data);

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Create animal error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update animal
app.put("/make-server-e1d15c13/animals/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const animalData = await c.req.json();

    const { data, error } = await supabase()
      .from("animals")
      .update(animalData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await logAudit(user.id, "UPDATE", "animals", { id, ...animalData });

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Update animal error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ USER MANAGEMENT ENDPOINTS ============

// Get all users (Admin only)
app.get("/make-server-e1d15c13/users", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    // Check if user is admin
    const { data: profile } = await supabase()
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "Admin") {
      return c.json({ success: false, error: "Forbidden - Admin only" }, 403);
    }

    const { data, error } = await supabase()
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Get users error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update user (Admin only)
app.put("/make-server-e1d15c13/users/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    // Check if user is admin
    const { data: profile } = await supabase()
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "Admin") {
      return c.json({ success: false, error: "Forbidden - Admin only" }, 403);
    }

    const id = c.req.param("id");
    const userData = await c.req.json();

    const { data, error } = await supabase()
      .from("profiles")
      .update(userData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await logAudit(user.id, "UPDATE", "users", { id, ...userData });

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Update user error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ AUDIT LOG ENDPOINTS ============

// Get audit logs (Admin and Health Officer only)
app.get("/make-server-e1d15c13/audit-logs", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    // Check if user is admin or health officer
    const { data: profile } = await supabase()
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!["Admin", "Health Officer"].includes(profile?.role || "")) {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const { data, error } = await supabase()
      .from("audit_log")
      .select(`
        *,
        user:profiles(full_name, email)
      `)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Get audit logs error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ SETTINGS ENDPOINTS ============

// Get settings
app.get("/make-server-e1d15c13/settings", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const { data, error } = await supabase()
      .from("settings")
      .select("*");

    if (error) throw error;

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Get settings error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update setting
app.put("/make-server-e1d15c13/settings/:key", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const key = c.req.param("key");
    const { value } = await c.req.json();

    const { data, error } = await supabase()
      .from("settings")
      .update({ setting_value: value, updated_by: user.id })
      .eq("setting_key", key)
      .select()
      .single();

    if (error) throw error;

    await logAudit(user.id, "UPDATE", "settings", { key, value });

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Update setting error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ NOTIFICATIONS ENDPOINTS ============

// Get notifications
app.get("/make-server-e1d15c13/notifications", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const { data, error } = await supabase()
      .from("notifications")
      .select(`
        *,
        patient:patients(full_name),
        incident:incidents(*)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Get notifications error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ BARANGAYS ENDPOINT ============

// Get all barangays
app.get("/make-server-e1d15c13/barangays", async (c) => {
  try {
    const { data, error } = await supabase()
      .from("barangays")
      .select("*")
      .order("name");

    if (error) throw error;

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Get barangays error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ SMS NOTIFICATION ENDPOINT ============
app.post("/make-server-e1d15c13/send-sms", async (c) => {
  try {
    const { phone, message, patientId, incidentId } = await c.req.json();

    const SMS_API_KEY = Deno.env.get("SMS_API_KEY");
    const SMS_API_URL = Deno.env.get("SMS_API_URL") || "https://api.semaphore.co/api/v4/messages";
    const SMS_SENDER_NAME = Deno.env.get("SMS_SENDER_NAME") || "BITEMAP";

    if (!SMS_API_KEY) {
      return c.json({ success: false, error: "SMS_API_KEY not configured" }, 500);
    }

    // Send SMS via Semaphore
    const smsResponse = await fetch(SMS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: SMS_API_KEY,
        number: phone,
        message: message,
        sendername: SMS_SENDER_NAME
      })
    });

    const smsResult = await smsResponse.json();

    // Log notification
    await supabase()
      .from("notifications")
      .insert([{
        patient_id: patientId,
        incident_id: incidentId,
        notification_type: "SMS",
        recipient: phone,
        message: message,
        status: smsResponse.ok ? "Sent" : "Failed",
        sent_at: new Date().toISOString(),
        delivery_status: JSON.stringify(smsResult)
      }]);

    return c.json({
      success: smsResponse.ok,
      data: smsResult,
      message: smsResponse.ok ? "SMS sent successfully" : "Failed to send SMS"
    });
  } catch (error) {
    console.error("SMS error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ EMAIL NOTIFICATION ENDPOINT ============
app.post("/make-server-e1d15c13/send-email", async (c) => {
  try {
    const { to, subject, message, patientId, incidentId } = await c.req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SMTP_FROM = Deno.env.get("SMTP_FROM") || "noreply@digos.gov.ph";

    if (!RESEND_API_KEY) {
      return c.json({ success: false, error: "Email provider not configured" }, 500);
    }

    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #2C2C2A; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1D9E75; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #ffffff; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #888780; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>BITEMAP</h1>
              <p>Animal Bite Tracking - Digos City</p>
            </div>
            <div class="content">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <div class="footer">
              <p>Digos City Health Office - Cor Jesu College</p>
              <p>Department of Health - Philippines</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: SMTP_FROM,
        to: [to],
        subject: subject,
        html: emailHTML
      })
    });

    const emailResult = await emailResponse.json();

    // Log notification
    await supabase()
      .from("notifications")
      .insert([{
        patient_id: patientId,
        incident_id: incidentId,
        notification_type: "Email",
        recipient: to,
        message: message,
        status: emailResponse.ok ? "Sent" : "Failed",
        sent_at: new Date().toISOString(),
        delivery_status: JSON.stringify(emailResult)
      }]);

    return c.json({
      success: emailResponse.ok,
      data: emailResult,
      message: emailResponse.ok ? "Email sent successfully" : "Failed to send email"
    });
  } catch (error) {
    console.error("Email error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ PUBLIC API ENDPOINTS (No Auth Required) ============

// Public statistics
app.get("/make-server-e1d15c13/public/statistics", async (c) => {
  try {
    const db = supabase();

    const { count: totalCases } = await db
      .from("incidents")
      .select("*", { count: "exact", head: true });

    const { count: activeCases } = await db
      .from("incidents")
      .select("*", { count: "exact", head: true })
      .eq("status", "Active");

    const { count: completedVaccinations } = await db
      .from("incidents")
      .select("*", { count: "exact", head: true })
      .eq("status", "Completed");

    const { count: pendingDoses } = await db
      .from("pep_schedule")
      .select("*", { count: "exact", head: true })
      .in("status", ["Pending", "Upcoming"]);

    return c.json({
      success: true,
      totalCases: totalCases || 0,
      activeCases: activeCases || 0,
      completedVaccinations: completedVaccinations || 0,
      pendingDoses: pendingDoses || 0
    });
  } catch (error) {
    console.error("Public statistics error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Public heatmap data
app.get("/make-server-e1d15c13/public/heatmap", async (c) => {
  try {
    const { data, error } = await supabase()
      .from("incidents")
      .select("location_lat, location_lng, who_category")
      .not("location_lat", "is", null)
      .not("location_lng", "is", null);

    if (error) throw error;

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Public heatmap error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Public barangay statistics
app.get("/make-server-e1d15c13/public/barangay-stats", async (c) => {
  try {
    const { data: incidents } = await supabase()
      .from("incidents")
      .select(`
        barangay:barangays(name),
        who_category,
        status
      `);

    const stats = {};
    incidents?.forEach(incident => {
      const barangayName = incident.barangay?.name || "Unknown";
      if (!stats[barangayName]) {
        stats[barangayName] = { total: 0, active: 0, completed: 0 };
      }
      stats[barangayName].total++;
      if (incident.status === "Active") stats[barangayName].active++;
      if (incident.status === "Completed") stats[barangayName].completed++;
    });

    return c.json({ success: true, data: stats });
  } catch (error) {
    console.error("Public barangay stats error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

Deno.serve(app.fetch);