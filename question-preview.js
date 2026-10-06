function getQuestionPreviewDialog() {
  let dialog = document.querySelector(".question-preview-dialog");
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.className = "question-preview-dialog";
  dialog.setAttribute("aria-label", "Full question preview");
  dialog.innerHTML = `
    <button type="button" class="question-preview-close" aria-label="Close preview">&times;</button>
    <img alt="">
  `;

  const previewImage = dialog.querySelector("img");
  dialog.querySelector(".question-preview-close").addEventListener("click", () => dialog.close());
  previewImage.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => previewImage.removeAttribute("src"));
  document.body.appendChild(dialog);
  return dialog;
}

document.addEventListener("click", event => {
  const trigger = event.target.closest(".question-preview-trigger");
  if (!trigger) return;

  const dialog = getQuestionPreviewDialog();
  const previewImage = dialog.querySelector("img");
  previewImage.src = trigger.dataset.previewSrc;
  previewImage.alt = trigger.dataset.previewAlt || "Full question paper";
  dialog.showModal();
});