async function adminLogin(email, password) {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim(),
    password
  });
  if (error) {
    if (error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message || "")) {
      return {
        ok: false,
        message: "Email confirmation is still enabled in Supabase. Turn it off under Authentication → Providers → Email → Confirm email."
      };
    }
    return {
      ok: false,
      message: error.status === 400 ? "Incorrect email or password." : (error.message || "Could not connect to Supabase.")
    };
  }

  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      await getSupabaseClient().auth.signOut();
      return { ok: false, message: "This account does not have admin access." };
    }
    return { ok: true, user: admin };
  } catch (error) {
    await getSupabaseClient().auth.signOut();
    return { ok: false, message: error.message || "Could not verify admin access." };
  }
}

async function requireAdminAuth() {
  try {
    const admin = await getCurrentAdmin();
    if (admin) return admin;
    await getSupabaseClient().auth.signOut();
    window.location.href = "admin-login.html";
    return null;
  } catch (error) {
    showPageError(error);
    return null;
  }
}

async function adminLogout() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
  window.location.href = "admin-login.html";
}
