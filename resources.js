const STORAGE_BUCKET = "question-files";

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function resourceSelect() {
  return "id,uploader_id,course_id,resource_type,description,file_name,content_type,storage_path,page_files,status,rejection_reason,created_at,reviewed_at,reviewed_by," +
    "course:courses!resources_course_id_fkey(code,title,department_id,level,semester,department:departments!courses_department_id_fkey(name))," +
    "uploader:profiles!resources_uploader_id_fkey(full_name,matric_number,email,department:departments!profiles_department_id_fkey(name))";
}

async function mapResource(row, includeFileLink = true) {
  const fileEntries = Array.isArray(row.page_files) && row.page_files.length
    ? row.page_files
    : [{ storage_path: row.storage_path, file_name: row.file_name, content_type: row.content_type }];
  let pages = fileEntries.map(page => ({
    fileName: page.file_name || row.file_name,
    contentType: page.content_type || row.content_type || "",
    storagePath: page.storage_path,
    url: ""
  }));
  let fileAccessError = "";
  if (includeFileLink) {
    pages = await Promise.all(pages.map(async page => {
      const { data, error } = await getSupabaseClient()
        .storage.from(STORAGE_BUCKET)
        .createSignedUrl(page.storagePath, 3600);
      if (error) {
        console.error(`Could not access stored question "${page.storagePath}":`, error);
        fileAccessError = error.message || "Supabase Storage could not create a file link.";
        return page;
      }
      return { ...page, url: data.signedUrl };
    }));
  }

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
    pages,
    fileDataUrl: pages[0]?.url || "",
    fileAccessError,
    storagePath: row.storage_path,
    status: row.status,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at
  };
}

async function getAllResources(includeFileLinks = true) {
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
  return Promise.all(rows.map(row => mapResource(row, includeFileLinks)));
}

async function uploadResourceFile(file, userId) {
  if (!file) throw new Error("Choose a file to upload.");
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const storagePath = `${userId}/${uid()}-${safeName}`;
  const { data, error } = await getSupabaseClient().storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw error;
  return data.path;
}

async function uploadResourcePages(files, userId) {
  if (!files.length) throw new Error("Choose at least one image page or one PDF/document.");
  if (files.length > 1 && files.some(file => !file.type.startsWith("image/"))) {
    throw new Error("Select multiple image pages, or upload a single PDF/document.");
  }

  const uploaded = [];
  try {
    for (const file of files) {
      const storagePath = await uploadResourceFile(file, userId);
      uploaded.push({
        storage_path: storagePath,
        file_name: file.name,
        content_type: file.type || "application/octet-stream"
      });
    }
  } catch (error) {
    if (uploaded.length) {
      const { error: cleanupError } = await getSupabaseClient().storage.from(STORAGE_BUCKET)
        .remove(uploaded.map(page => page.storage_path));
      if (cleanupError) console.error("Could not remove question pages after upload failed:", cleanupError);
    }
    throw error;
  }
  return uploaded;
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
  const pages = await uploadResourcePages(entry.files || [entry.file].filter(Boolean), user.id);

  const { error } = await client.from("resources").insert({
    uploader_id: user.id,
    course_id: course.id,
    resource_type: entry.resourceType,
    description: entry.description || null,
    file_name: pages[0].file_name,
    content_type: pages[0].content_type,
    storage_path: pages[0].storage_path,
    page_files: pages,
    status: "pending"
  });

  if (error) {
    const { error: cleanupError } = await client.storage.from(STORAGE_BUCKET)
      .remove(pages.map(page => page.storage_path));
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
      const pages = await uploadResourcePages(entry.files || [entry.file].filter(Boolean), admin.id);
      uploadedPaths.push(...pages.map(page => page.storage_path));
      rows.push({
        uploader_id: admin.id,
        course_id: course.id,
        resource_type: entry.resourceType || "Past Question",
        description: entry.description || null,
        file_name: pages[0].file_name,
        content_type: pages[0].content_type,
        storage_path: pages[0].storage_path,
        page_files: pages,
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

function questionPreviewMarkup(resource) {
  const pages = resource.pages || [];
  if (!pages.length || pages.some(page => !page.url || !page.contentType.startsWith("image/"))) return "";
  const courseCode = escapeHtml(resource.courseCode);
  const previewPages = pages.map(page => ({ url: page.url, fileName: page.fileName }));
  const pageCount = pages.length;
  const label = pageCount > 1
    ? `Paper preview · ${pageCount} pages · Click to browse`
    : "Paper heading · Click to view full question";
  return `
    <button type="button" class="question-preview question-preview-trigger"
      data-preview-pages="${escapeHtml(JSON.stringify(previewPages))}"
      data-preview-alt="Full ${courseCode} question"
      aria-label="Open full ${courseCode} question"
      title="Click to view the full question">
      <img src="${escapeHtml(pages[0].url)}" alt="" loading="lazy">
      <span class="question-preview-label">${label}</span>
    </button>
  `;
}

function resourceDownloadMarkup(resource, label) {
  const pages = resource.pages || [];
  const availablePages = pages.filter(page => page.url);
  if (!availablePages.length) return `<span>${escapeHtml(resource.fileName)}</span>`;
  if (availablePages.length === 1) {
    return `<a href="${escapeHtml(availablePages[0].url)}" download="${escapeHtml(availablePages[0].fileName)}" class="feed-card-download">${label} ${escapeHtml(availablePages[0].fileName)}</a>`;
  }
  return `<div class="feed-card-download-list">${availablePages.map((page, index) =>
    `<a href="${escapeHtml(page.url)}" download="${escapeHtml(page.fileName)}" class="feed-card-download">${label} page ${index + 1}</a>`
  ).join("")}</div>`;
}

async function deleteAllResources() {
  const client = getSupabaseClient();
  const batchSize = 500;
  while (true) {
    const { data, error: listError } = await client
      .from("resources")
      .select("id,storage_path,page_files")
      .limit(batchSize);
    if (listError) throw listError;
    if (!data.length) return;

    const { error: deleteError } = await client
      .from("resources")
      .delete()
      .in("id", data.map(resource => resource.id));
    if (deleteError) throw deleteError;

    const storagePaths = data.flatMap(resource =>
      Array.isArray(resource.page_files) && resource.page_files.length
        ? resource.page_files.map(page => page.storage_path)
        : [resource.storage_path]
    );
    const { error: storageError } = await client.storage.from(STORAGE_BUCKET).remove(storagePaths);
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
