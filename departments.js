const LEVELS = ["100", "200", "300", "400"];
const SEMESTERS = ["First Semester", "Second Semester"];

async function getDepartmentOptions() {
  const { data, error } = await getSupabaseClient()
    .from("departments")
    .select("id,name")
    .order("name");
  if (error) throw error;
  return data;
}

async function getDepartments() {
  const client = getSupabaseClient();
  const [departments, coursesResult] = await Promise.all([
    getDepartmentOptions(),
    client.from("courses").select("id,department_id,level,semester,code,title").order("code")
  ]);
  if (coursesResult.error) throw coursesResult.error;

  return departments.map(department => ({
    id: department.id,
    name: department.name,
    courses: Object.fromEntries(LEVELS.map(level => [
      level,
      Object.fromEntries(SEMESTERS.map(semester => [
        semester,
        coursesResult.data
          .filter(course => course.department_id === department.id && course.level === level && course.semester === semester)
          .map(course => ({ id: course.id, code: course.code, title: course.title }))
      ]))
    ]))
  }));
}

async function getDepartmentById(id) {
  return (await getDepartments()).find(department => department.id === id) || null;
}

async function createDepartment(name) {
  const client = getSupabaseClient();
  const { data: existing, error: lookupError } = await client
    .from("departments")
    .select("id")
    .ilike("name", name.trim())
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return { ok: false, message: "A department with this name already exists." };

  const { data, error } = await client
    .from("departments")
    .insert({ name: name.trim() })
    .select("id,name")
    .single();
  if (error) return { ok: false, message: error.message };
  return { ok: true, department: { ...data, courses: emptyCourseSkeleton() } };
}

function emptyCourseSkeleton() {
  return Object.fromEntries(LEVELS.map(level => [
    level,
    Object.fromEntries(SEMESTERS.map(semester => [semester, []]))
  ]));
}

async function deleteDepartment(id) {
  const { error } = await getSupabaseClient().from("departments").delete().eq("id", id);
  if (error) throw error;
}

async function addCourseToDepartment(deptId, level, semester, code, title) {
  const client = getSupabaseClient();
  const { data: existing, error: lookupError } = await client
    .from("courses")
    .select("id")
    .eq("department_id", deptId)
    .eq("level", level)
    .eq("semester", semester)
    .ilike("code", code.trim())
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return { ok: false, message: "This course code already exists for that level/semester." };

  const { error } = await client.from("courses").insert({
    department_id: deptId,
    level,
    semester,
    code: code.trim(),
    title: title.trim()
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

async function removeCourseFromDepartment(deptId, level, semester, code) {
  const { error } = await getSupabaseClient()
    .from("courses")
    .delete()
    .eq("department_id", deptId)
    .eq("level", level)
    .eq("semester", semester)
    .eq("code", code);
  if (error) throw error;
}

async function getCoursesFor(deptId, level, semester) {
  if (!deptId || !level || !semester) return [];
  const { data, error } = await getSupabaseClient()
    .from("courses")
    .select("id,code,title")
    .eq("department_id", deptId)
    .eq("level", level)
    .eq("semester", semester)
    .order("code");
  if (error) throw error;
  return data;
}
