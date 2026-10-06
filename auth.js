function normalizeRegNumber(regNumber) {
  return String(regNumber || "").replace(/\s+/g, "").toLowerCase();
}

function profileFromRow(row, email = "") {
  return {
    id: row.id,
    email: row.email || email,
    fullName: row.full_name,
    regNumber: row.matric_number,
    department: row.department_id,
    departmentName: row.department?.name || "",
    role: row.role
  };
}

async function getUsers() {
  const { data, error } = await getSupabaseClient()
    .from("profiles")
    .select("id,email,full_name,matric_number,department_id,role,department:departments(name)")
    .eq("role", "student")
    .order("full_name");
  if (error) throw error;
  return data.map(profile => profileFromRow(profile));
}

async function findUserByEmail(email) {
  const { data, error } = await getSupabaseClient()
    .from("profiles")
    .select("id,email,full_name,matric_number,department_id,role,department:departments(name)")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data ? profileFromRow(data) : null;
}

async function registerUser({ fullName, regNumber, email, password, department }) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        matric_number: regNumber.trim(),
        department_id: department,
        role: "student"
      }
    }
  });

  if (error) {
    const message = error.message || "Could not create your account.";
    if (/matric_number|profiles_matric_number_unique/i.test(message)) {
      return { ok: false, message: "An account with this matric number already exists." };
    }
    if (/database error saving new user|duplicate key value/i.test(message)) {
      return {
        ok: false,
        message: "The account profile could not be created. The matric number may already be registered; check it and try again."
      };
    }
    if (/already registered|already been registered/i.test(message)) {
      return { ok: false, message: "An account with this email already exists." };
    }
    return { ok: false, message };
  }

  return { ok: true, needsEmailConfirmation: !data.session };
}

async function loginUser(email, password) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim(),
    password
  });
  if (error) {
    if (error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message || "")) {
      return {
        ok: false,
        message: "Email confirmation is still enabled in Supabase. Turn off Authentication → Providers → Email → Confirm email, then try again."
      };
    }
    return {
      ok: false,
      message: error.status === 400 ? "Incorrect email or password." : (error.message || "Could not connect to Supabase.")
    };
  }

  let profile;
  try {
    profile = await getCurrentUser();
  } catch (profileError) {
    await getSupabaseClient().auth.signOut();
    throw profileError;
  }
  if (!profile) {
    await getSupabaseClient().auth.signOut();
    return {
      ok: false,
      message: "Your account profile is not ready. Contact the administrator to check the Supabase profile setup."
    };
  }
  if (profile.role !== "student") {
    await getSupabaseClient().auth.signOut();
    return { ok: false, message: "This account does not have student access. Use the admin login." };
  }
  return { ok: true, user: profile, session: data.session };
}

async function getCurrentUser() {
  const client = getSupabaseClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user) return null;

  const { data, error } = await client
    .from("profiles")
    .select("id,email,full_name,matric_number,department_id,role,department:departments(name)")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? profileFromRow(data, user.email || "") : null;
}

async function logout() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
  window.location.href = "login.html";
}

async function requireAuth() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      await getSupabaseClient().auth.signOut();
      window.location.href = "login.html";
      return null;
    }
    return user;
  } catch (error) {
    showPageError(error);
    return null;
  }
}

async function getCurrentAdmin() {
  const client = getSupabaseClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user) return null;

  const { data, error } = await client
    .from("profiles")
    .select("id,email,full_name,matric_number,department_id,role,department:departments(name)")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data && data.role === "admin" ? profileFromRow(data, user.email || "") : null;
}

async function showPageError(error) {
  console.error("PastVault request failed:", error);
  let box = document.getElementById("supabasePageError");
  if (!box) {
    box = document.createElement("div");
    box.id = "supabasePageError";
    box.setAttribute("role", "alert");
    box.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:10000;max-width:90vw;padding:12px 18px;background:#FDEAE6;border:1px solid #F3C2B6;color:#B23A29;font:13px Inter,sans-serif;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.12)";
    document.body.appendChild(box);
  }
  box.textContent = error.message || "Could not connect to Supabase. Check your setup and try again.";
}

function showError(el, message) {
  el.textContent = message;
  el.classList.add("show");
}
