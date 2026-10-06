const STORAGE_BUCKET = "question-files";

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function resourceSelect() {
  return "id,uploader_id,course_id,resource_type,description,file_name,content_type,storage_path,status,rejection_reason,created_at,reviewed_at,reviewed_by," +
    "course:courses!resources_course_id_fkey(code,title,department_id,level,semester,department:departments!courses_department_id_fkey(name))," +
    "uploader:profiles!resources_uploader_id_fkey(full_name,matric_number,email,department:departments!profiles_department_id_fkey(name))";
}

async function mapResource(row) {
  const { data, error } = await getSupabaseClient()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrl(row.storage_path, 3600);
  if (error) throw error;

  return {
    id: row.id,
    userId: row.uploader_id,
    userEmail: row.uploader?.email || "",
    authorName: row.uploader?.full_name || "School Admin",
    regNumber: row.uploader?.matric_number || "",
    department: row.course.department_id,
    departmentName: row.course.department?.name || row.uploader?.department?.name || "",
    level: row.course.level,
    semester: row.course.semester,
    courseId: row.course_id,
    courseCode: row.course.code,
    courseTitle: row.course.title,
    resourceType: row.resource_type,
    description: row.description || "",
    fileName: row.file_name,
    contentType: row.content_type || "",
    fileDataUrl: data.signedUrl,
    storagePath: row.storage_path,
    status: row.status,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at
  };
}

async function getAllResources() {
  const client = getSupabaseClient();
  const rows = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("resources")
      .select(resourceSelect())
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return Promise.all(rows.map(mapResource));
}

async function uploadResourceFile(file, userId) {
  if (!file) throw new Error("Choose a file to upload.");
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const storagePath = `${userId}/${uid()}-${safeName}`;
  const { error } = await getSupabaseClient().storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw error;
  return storagePath;
}

async function findCourse(departmentId, level, semester, courseCode) {
  const { data, error } = await getSupabaseClient()
    .from("courses")
    .select("id,code,title")
    .eq("department_id", departmentId)
    .eq("level", level)
    .eq("semester", semester)
    .eq("code", courseCode)
    .single();
  if (error) throw error;
  return data;
}

async function submitResource(entry) {
  const client = getSupabaseClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Please sign in again before uploading.");
  const course = await findCourse(entry.department, entry.level, entry.semester, entry.courseCode);
  const storagePath = await uploadResourceFile(entry.file, user.id);

  const { error } = await client.from("resources").insert({
    uploader_id: user.id,
    course_id: course.id,
    resource_type: entry.resourceType,
    description: entry.description || null,
    file_name: entry.file.name,
    content_type: entry.file.type || "application/octet-stream",
    storage_path: storagePath,
    status: "pending"
  });

  if (error) {
    const { error: cleanupError } = await client.storage.from(STORAGE_BUCKET).remove([storagePath]);
    if (cleanupError) console.error("Could not remove upload after resource insert failed:", cleanupError);
    throw error;
  }
}

async function publishAdminResources(entries) {
  const client = getSupabaseClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, message: "Admin access is required to publish questions." };
  const uploadedPaths = [];

  try {
    const rows = [];
    for (const entry of entries) {
      const course = await findCourse(entry.department, entry.level, entry.semester, entry.courseCode);
      const storagePath = await uploadResourceFile(entry.file, admin.id);
      uploadedPaths.push(storagePath);
      rows.push({
        uploader_id: admin.id,
        course_id: course.id,
        resource_type: entry.resourceType || "Past Question",
        description: entry.description || null,
        file_name: entry.file.name,
        content_type: entry.file.type || "application/octet-stream",
        storage_path: storagePath,
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.id
      });
    }

    const { error } = await client.from("resources").insert(rows);
    if (error) throw error;
    return { ok: true, count: rows.length };
  } catch (error) {
    if (uploadedPaths.length) {
      const { error: cleanupError } = await client.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
      if (cleanupError) console.error("Could not remove admin uploads after publish failed:", cleanupError);
    }
    return { ok: false, message: error.message || "Could not publish these questions." };
  }
}

async function getApprovedResources() {
  return (await getAllResources()).filter(resource => resource.status === "approved");
}

async function getPendingResources() {
  return (await getAllResources()).filter(resource => resource.status === "pending");
}

async function getResourcesByUser(email) {
  return (await getAllResources()).filter(resource => resource.userEmail.toLowerCase() === email.toLowerCase());
}

async function approveResource(id) {
  const admin = await getCurrentAdmin();
  const { error } = await getSupabaseClient()
    .from("resources")
    .update({ status: "approved", rejection_reason: null, reviewed_at: new Date().toISOString(), reviewed_by: admin.id })
    .eq("id", id);
  if (error) throw error;
}

async function rejectResource(id, reason) {
  const admin = await getCurrentAdmin();
  const { error } = await getSupabaseClient()
    .from("resources")
    .update({ status: "rejected", rejection_reason: reason, reviewed_at: new Date().toISOString(), reviewed_by: admin.id })
    .eq("id", id);
  if (error) throw error;
}

async function getRejectionCount(email) {
  const user = await findUserByEmail(email);
  if (!user) return 0;
  const { count, error } = await getSupabaseClient()
    .from("resources")
    .select("id", { count: "exact", head: true })
    .eq("status", "rejected")
    .eq("uploader_id", user.id);
  if (error) throw error;
  return count || 0;
}

async function getApprovedCountForLevel(deptId, level) {
  const { count, error } = await getSupabaseClient()
    .from("resources")
    .select("id,course:courses!inner(department_id,level)", { count: "exact", head: true })
    .eq("status", "approved")
    .eq("course.department_id", deptId)
    .eq("course.level", level);
  if (error) throw error;
  return count || 0;
}

async function getApprovedCountForCourse(deptId, level, semester, courseCode) {
  const { count, error } = await getSupabaseClient()
    .from("resources")
    .select("id,course:courses!inner(department_id,level,semester,code)", { count: "exact", head: true })
    .eq("status", "approved")
    .eq("course.department_id", deptId)
    .eq("course.level", level)
    .eq("course.semester", semester)
    .eq("course.code", courseCode);
  if (error) throw error;
  return count || 0;
}

async function getApprovedResourcesForCourse(deptId, level, semester, courseCode) {
  return (await getAllResources()).filter(resource =>
    resource.status === "approved" &&
    resource.department === deptId &&
    resource.level === level &&
    resource.semester === semester &&
    resource.courseCode === courseCode
  );
}

async function deleteAllResources() {
  const client = getSupabaseClient();
  const batchSize = 500;
  while (true) {
    const { data, error: listError } = await client
      .from("resources")
      .select("id,storage_path")
      .limit(batchSize);
    if (listError) throw listError;
    if (!data.length) return;

    const { error: deleteError } = await client
      .from("resources")
      .delete()
      .in("id", data.map(resource => resource.id));
    if (deleteError) throw deleteError;

    const { error: storageError } = await client.storage.from(STORAGE_BUCKET)
      .remove(data.map(resource => resource.storage_path));
    if (storageError) throw storageError;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function timeAgo(isoString) {
  if (!isoString) return "recently";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
