/*
  courses.js — the department's course list, organized by level and semester.

  EDIT THIS FILE to match your actual department's real courses.
  Everything below is placeholder Computer Science course data —
  swap it for your real course codes/titles. The structure (levels ->
  semesters -> courses) must stay the same shape so the rest of the
  site keeps working.

  Format for each course: { code: "CSC 201", title: "Course Title" }
*/

const COURSES = {
  "100": {
    "First Semester": [
      { code: "GNS 101", title: "Use of English I" },
      { code: "MTH 101", title: "Elementary Mathematics I" },
      { code: "PHY 101", title: "General Physics I" },
      { code: "CSC 101", title: "Introduction to Computer Science" },
      { code: "CSC 103", title: "Introduction to Programming" }
    ],
    "Second Semester": [
      { code: "GNS 102", title: "Use of English II" },
      { code: "MTH 102", title: "Elementary Mathematics II" },
      { code: "STA 101", title: "Statistics I" },
      { code: "CSC 102", title: "Computer Appreciation" },
      { code: "CSC 104", title: "Programming Fundamentals" }
    ]
  },
  "200": {
    "First Semester": [
      { code: "CSC 201", title: "Computer Programming I" },
      { code: "CSC 203", title: "Discrete Structures" },
      { code: "MTH 201", title: "Mathematical Methods I" },
      { code: "GNS 201", title: "Nigerian Peoples and Culture" }
    ],
    "Second Semester": [
      { code: "CSC 202", title: "Computer Programming II" },
      { code: "CSC 204", title: "Data Structures" },
      { code: "CSC 206", title: "Digital Logic Design" }
    ]
  },
  "300": {
    "First Semester": [
      { code: "CSC 301", title: "Database Management Systems I" },
      { code: "CSC 303", title: "Operating Systems" },
      { code: "CSC 305", title: "Software Engineering I" }
    ],
    "Second Semester": [
      { code: "CSC 302", title: "Database Management Systems II" },
      { code: "CSC 304", title: "Computer Networks" },
      { code: "CSC 306", title: "Web Technologies" }
    ]
  },
  "400": {
    "First Semester": [
      { code: "CSC 401", title: "Artificial Intelligence" },
      { code: "CSC 403", title: "Compiler Construction" },
      { code: "CSC 405", title: "Project I" }
    ],
    "Second Semester": [
      { code: "CSC 402", title: "Distributed Systems" },
      { code: "CSC 404", title: "Mobile Application Development" },
      { code: "CSC 406", title: "Project II" }
    ]
  }
};

const LEVELS = Object.keys(COURSES); // ["100", "200", "300", "400"]
const SEMESTERS = ["First Semester", "Second Semester"];

function getCoursesFor(level, semester) {
  return (COURSES[level] && COURSES[level][semester]) || [];
}
