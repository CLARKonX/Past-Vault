/*
  password-toggle.js — wires up every ".password-toggle" button on the page
  to show/hide the password field it sits next to. Works for any number of
  password fields on a page (register.html has two, login/admin-login have
  one each) since it just loops over all of them.
*/

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".password-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      const eyeIcon = btn.querySelector(".icon-eye");
      const eyeOffIcon = btn.querySelector(".icon-eye-off");

      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      eyeIcon.style.display = isHidden ? "none" : "block";
      eyeOffIcon.style.display = isHidden ? "block" : "none";
      btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    });
  });
});
