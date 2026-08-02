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

const PUBLIC_RATE_LIMIT_WINDOW_MS = 60_000;
const PUBLIC_RATE_LIMIT_MAX_REQUESTS = 60;
const publicRequestBuckets = new Map<string, { count: number; resetAt: number }>();

app.use("/make-server-e1d15c13/public/*", async (c, next) => {
  const forwardedFor = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = forwardedFor || c.req.header("cf-connecting-ip") || "anonymous";
  const now = Date.now();
  const current = publicRequestBuckets.get(clientKey);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + PUBLIC_RATE_LIMIT_WINDOW_MS }
    : current;

  bucket.count += 1;
  publicRequestBuckets.set(clientKey, bucket);

  c.header("RateLimit-Limit", String(PUBLIC_RATE_LIMIT_MAX_REQUESTS));
  c.header("RateLimit-Remaining", String(Math.max(0, PUBLIC_RATE_LIMIT_MAX_REQUESTS - bucket.count)));
  c.header("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > PUBLIC_RATE_LIMIT_MAX_REQUESTS) {
    c.header("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    return c.json({ success: false, error: "Too many public requests. Please try again shortly." }, 429);
  }

  await next();
});

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

// Authenticated staff GIS aggregation. This route is deliberately separate from
// the public contract and cannot be requested without a valid staff session.
const DIGOS_BARANGAY_POINTS: Record<string, { latitude: number; longitude: number }> = {
  Aplaya: { latitude: 6.74164834, longitude: 125.37245251 },
  Balabag: { latitude: 6.85685429, longitude: 125.26978155 },
  "San Jose": { latitude: 6.73125205, longitude: 125.35463070 },
  Binaton: { latitude: 6.84838618, longitude: 125.33803610 },
  Cogon: { latitude: 6.75742356, longitude: 125.37724579 },
  Colorado: { latitude: 6.75506963, longitude: 125.29556990 },
  Dawis: { latitude: 6.73009357, longitude: 125.36827608 },
  Dulangan: { latitude: 6.83769091, longitude: 125.31446776 },
  Goma: { latitude: 6.85286242, longitude: 125.29052371 },
  Igpit: { latitude: 6.73338652, longitude: 125.31541972 },
  Kiagot: { latitude: 6.78090818, longitude: 125.35800284 },
  Lungag: { latitude: 6.79466699, longitude: 125.27767847 },
  Mahayahay: { latitude: 6.79668215, longitude: 125.29340182 },
  Matti: { latitude: 6.76590191, longitude: 125.30570925 },
  Kapatagan: { latitude: 6.92605084, longitude: 125.31445063 },
  Ruparan: { latitude: 6.79071808, longitude: 125.32848162 },
  "San Agustin": { latitude: 6.77762873, longitude: 125.31501883 },
  "San Miguel": { latitude: 6.73901160, longitude: 125.34085046 },
  "San Roque": { latitude: 6.77930377, longitude: 125.28642543 },
  Sinawilan: { latitude: 6.77581148, longitude: 125.37787301 },
  Soong: { latitude: 6.81067777, longitude: 125.35310403 },
  Tiguman: { latitude: 6.75099690, longitude: 125.32413033 },
  "Tres De Mayo": { latitude: 6.76795080, longitude: 125.33903558 },
  "Zone 1": { latitude: 6.75787339, longitude: 125.35641175 },
  "Zone 2": { latitude: 6.75207111, longitude: 125.35295619 },
  "Zone 3": { latitude: 6.74419295, longitude: 125.35539780 },
};

app.get("/make-server-e1d15c13/gis/heatmap", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) return c.json({ success: false, error: "Unauthorized" }, 401);

    const db = supabase();
    let query = db
      .from("incidents")
      .select("id, incident_date, barangay_id, animal_type, who_category, status, location_lat, location_lng, barangay:barangays(name)");
    const dateFrom = c.req.query("date_from");
    const dateTo = c.req.query("date_to");
    const animalType = c.req.query("animal_type");
    const category = c.req.query("who_category");
    if (dateFrom) query = query.gte("incident_date", dateFrom);
    if (dateTo) query = query.lte("incident_date", dateTo);
    if (animalType && animalType !== "All") query = query.eq("animal_type", animalType);
    if (category && category !== "All") query = query.eq("who_category", category);

    const { data: incidents, error } = await query;
    if (error) throw error;

    const groups = new Map<string, any>();
    (incidents || []).forEach((incident: any) => {
      if (!incident.barangay_id) return;
      const current = groups.get(incident.barangay_id) || {
        barangay_name: incident.barangay?.name || "Unknown",
        ids: [], count: 0, completed: 0, incidentPoints: [],
        animals: new Map<string, number>()
      };
      current.ids.push(incident.id);
      current.count += 1;
      if (incident.status === "Completed") current.completed += 1;
      current.animals.set(incident.animal_type, (current.animals.get(incident.animal_type) || 0) + 1);
      if (incident.location_lat != null && incident.location_lng != null) {
        current.incidentPoints.push({
          incident_id: incident.id,
          barangay_name: current.barangay_name,
          latitude: Number(incident.location_lat),
          longitude: Number(incident.location_lng),
        });
      }
      groups.set(incident.barangay_id, current);
    });

    const data = Array.from(groups.values()).filter((group) => DIGOS_BARANGAY_POINTS[group.barangay_name]).map((group) => {
      const topAnimal = Array.from(group.animals.entries()).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "Not available";
      const aggregatePoint = DIGOS_BARANGAY_POINTS[group.barangay_name];
      return {
        incident_id: null,
        incident_ids: group.ids,
        barangay_name: group.barangay_name,
        latitude: aggregatePoint.latitude,
        longitude: aggregatePoint.longitude,
        coordinate_source: "validated_fallback",
        total_incident_count: group.count,
        total_incidents: group.count,
        top_animal_type: topAnimal,
        pep_compliance_rate: group.count ? Number(((group.completed / group.count) * 100).toFixed(1)) : 0,
        risk_level: group.count > 20 ? "HIGH RISK" : group.count > 10 ? "MODERATE RISK" : "LOW RISK"
      };
    });
    const maxCount = Math.max(1, ...data.map((item) => item.total_incident_count));
    const heat_points = data.map((item) => ({
      barangay_name: item.barangay_name,
      latitude: item.latitude,
      longitude: item.longitude,
      intensity: item.total_incident_count / maxCount,
      total_incident_count: item.total_incident_count
    }));
    const incident_points = Array.from(groups.values()).flatMap((group) => group.incidentPoints);

    return c.json({ success: true, data, heat_points, incident_points });
  } catch (error) {
    console.error("Authenticated GIS heatmap error:", error);
    return c.json({ success: false, error: "Unable to load staff GIS data." }, 500);
  }
});

// ============ PRIVACY-SAFE PUBLIC API ENDPOINTS (No Auth Required) ============

const PUBLIC_MINIMUM_CELL_COUNT = 5;
const PUBLIC_ANIMAL_TYPES = new Set(["All", "Dog", "Cat", "Other"]);
const PUBLIC_RISK_LEVELS = new Set(["All", "LOW", "MODERATE", "HIGH"]);
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function publicRiskLevel(count: number) {
  if (count === 0) return "NO DATA";
  if (count < PUBLIC_MINIMUM_CELL_COUNT) return "SUPPRESSED";
  if (count <= 10) return "LOW";
  if (count <= 20) return "MODERATE";
  return "HIGH";
}

function parsePublicFilters(c: any) {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const requestedYear = Number(c.req.query("year") || currentYear);
  const year = Number.isInteger(requestedYear) && requestedYear >= currentYear - 5 && requestedYear <= currentYear
    ? requestedYear
    : currentYear;
  const defaultEndMonth = year === currentYear ? now.getUTCMonth() + 1 : 12;
  const monthStart = Number(c.req.query("month_start") || 1);
  const monthEnd = Number(c.req.query("month_end") || defaultEndMonth);
  const animalType = c.req.query("animal_type") || "All";
  const riskLevel = c.req.query("risk_level") || "All";

  if (!Number.isInteger(monthStart) || !Number.isInteger(monthEnd) || monthStart < 1 || monthEnd > 12 || monthEnd < monthStart) {
    return { error: "Choose a valid broad month range." };
  }

  if (monthEnd - monthStart + 1 < 3) {
    return { error: "Public filters require a reporting period of at least three months." };
  }

  if (!PUBLIC_ANIMAL_TYPES.has(animalType) || !PUBLIC_RISK_LEVELS.has(riskLevel)) {
    return { error: "One or more public filters are invalid." };
  }

  return { year, monthStart, monthEnd, animalType, riskLevel };
}

async function getPublicBarangayAggregation(filters: any) {
  const db = supabase();
  const startDate = `${filters.year}-${String(filters.monthStart).padStart(2, "0")}-01`;
  const endBoundary = filters.monthEnd === 12
    ? `${filters.year + 1}-01-01`
    : `${filters.year}-${String(filters.monthEnd + 1).padStart(2, "0")}-01`;

  const [{ data: barangays, error: barangayError }, incidentResult] = await Promise.all([
    db.from("barangays").select("id, name, population").order("name"),
    (() => {
      let query = db
        .from("incidents")
        .select("barangay_id, animal_type, status")
        .gte("incident_date", startDate)
        .lt("incident_date", endBoundary);
      if (filters.animalType !== "All") query = query.eq("animal_type", filters.animalType);
      return query;
    })()
  ]);

  if (barangayError || incidentResult.error) throw barangayError || incidentResult.error;

  const grouped = new Map<string, any>();
  (barangays || []).forEach((barangay: any) => grouped.set(barangay.id, {
    barangay_name: barangay.name,
    latitude: DIGOS_BARANGAY_POINTS[barangay.name]?.latitude ?? null,
    longitude: DIGOS_BARANGAY_POINTS[barangay.name]?.longitude ?? null,
    population: Number(barangay.population || 0),
    count: 0,
    completed: 0,
    animals: new Map<string, number>()
  }));

  (incidentResult.data || []).forEach((incident: any) => {
    const group = grouped.get(incident.barangay_id);
    if (!group) return;
    group.count += 1;
    if (incident.status === "Completed") group.completed += 1;
    group.animals.set(incident.animal_type, (group.animals.get(incident.animal_type) || 0) + 1);
  });

  const rawRows = Array.from(grouped.values());
  const cityTotal = rawRows.reduce((sum, row) => sum + row.count, 0);
  const recordedBarangays = rawRows.filter((row) => row.count > 0).length;
  const cityAverage = recordedBarangays > 0 ? cityTotal / recordedBarangays : 0;

  let rows = rawRows.map((row) => {
    const suppressed = row.count > 0 && row.count < PUBLIC_MINIMUM_CELL_COUNT;
    const riskLevel = publicRiskLevel(row.count);
    const topAnimal = !suppressed && row.count > 0
      ? Array.from(row.animals.entries()).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || null
      : null;

    return {
      barangay_name: row.barangay_name,
      latitude: row.latitude,
      longitude: row.longitude,
      incident_count: suppressed ? null : row.count,
      count_label: suppressed ? "Fewer than 5 incidents" : row.count === 0 ? "No recorded data" : `${row.count} incidents`,
      suppressed,
      risk_level: riskLevel,
      incident_rate_per_1000: suppressed || !row.population ? null : Number(((row.count / row.population) * 1000).toFixed(2)),
      most_common_animal: topAnimal,
      comparison_to_city_average: suppressed || row.count === 0 ? null : Number((row.count - cityAverage).toFixed(1))
    };
  });

  if (filters.riskLevel !== "All") rows = rows.filter((row) => row.risk_level === filters.riskLevel);

  const reportLabel = `${MONTH_NAMES[filters.monthStart - 1]}–${MONTH_NAMES[filters.monthEnd - 1]} ${filters.year}`;
  const highest = rawRows.filter((row) => row.count >= PUBLIC_MINIMUM_CELL_COUNT).sort((a, b) => b.count - a.count)[0];

  return {
    reporting_period: {
      year: filters.year,
      month_start: filters.monthStart,
      month_end: filters.monthEnd,
      label: reportLabel
    },
    classification_basis: "Case count: Low 5–10, Moderate 11–20, High 21+. Counts below 5 are suppressed.",
    summary: {
      total_incidents: cityTotal >= PUBLIC_MINIMUM_CELL_COUNT ? cityTotal : null,
      total_incidents_label: cityTotal > 0 && cityTotal < PUBLIC_MINIMUM_CELL_COUNT ? "Fewer than 5 incidents" : `${cityTotal} incidents`,
      barangays_with_recorded_incidents: recordedBarangays,
      highest_reported_barangay: highest?.barangay_name || null,
      pep_completion_rate: cityTotal >= PUBLIC_MINIMUM_CELL_COUNT ? Number(((rawRows.reduce((sum, row) => sum + row.completed, 0) / cityTotal) * 100).toFixed(1)) : null,
      city_average_incidents: recordedBarangays > 0 ? Number(cityAverage.toFixed(1)) : null
    },
    data: rows
  };
}

app.get("/make-server-e1d15c13/public/heatmap", async (c) => {
  try {
    const filters = parsePublicFilters(c);
    if (filters.error) return c.json({ success: false, error: filters.error }, 400);
    const aggregate = await getPublicBarangayAggregation(filters);
    c.header("Cache-Control", "public, max-age=60");
    return c.json({ success: true, ...aggregate });
  } catch (error) {
    console.error("Public heatmap aggregation error:", error);
    return c.json({ success: false, error: "Aggregated public map data is temporarily unavailable." }, 500);
  }
});

app.get("/make-server-e1d15c13/public/statistics", async (c) => {
  try {
    const filters = parsePublicFilters(c);
    if (filters.error) return c.json({ success: false, error: filters.error }, 400);
    const aggregate = await getPublicBarangayAggregation(filters);
    c.header("Cache-Control", "public, max-age=60");
    return c.json({
      success: true,
      year: aggregate.reporting_period.year,
      reportingPeriod: aggregate.reporting_period.label,
      totalCases: aggregate.summary.total_incidents,
      totalCasesLabel: aggregate.summary.total_incidents_label,
      vaccinationRate: aggregate.summary.pep_completion_rate,
      highRiskBarangays: aggregate.data.filter((row: any) => row.risk_level === "HIGH").length
    });
  } catch (error) {
    console.error("Public statistics aggregation error:", error);
    return c.json({ success: false, error: "Aggregated public statistics are temporarily unavailable." }, 500);
  }
});

app.get("/make-server-e1d15c13/public/barangay-stats", async (c) => {
  try {
    const filters = parsePublicFilters(c);
    if (filters.error) return c.json({ success: false, error: filters.error }, 400);
    const aggregate = await getPublicBarangayAggregation(filters);
    const stats = Object.fromEntries(aggregate.data.map((row: any) => [row.barangay_name, row.incident_count]));
    c.header("Cache-Control", "public, max-age=60");
    return c.json({ success: true, reportingPeriod: aggregate.reporting_period.label, data: stats });
  } catch (error) {
    console.error("Public barangay aggregation error:", error);
    return c.json({ success: false, error: "Aggregated barangay statistics are temporarily unavailable." }, 500);
  }
});

Deno.serve(app.fetch);
