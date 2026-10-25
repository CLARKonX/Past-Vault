function getQuestionPreviewDialog() {
  let dialog = document.querySelector(".question-preview-dialog");
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.className = "question-preview-dialog";
  dialog.setAttribute("aria-label", "Full question preview");
  dialog.innerHTML = `
    <button type="button" class="question-preview-close" aria-label="Close preview">&times;</button>
    <div class="question-preview-controls">
      <button type="button" class="question-preview-nav" data-preview-previous aria-label="Previous page">‹</button>
      <span class="question-preview-counter" aria-live="polite"></span>
      <button type="button" class="question-preview-nav" data-preview-next aria-label="Next page">›</button>
    </div>
    <img alt="">
  `;

  const previewImage = dialog.querySelector("img");
  const counter = dialog.querySelector(".question-preview-counter");
  const controls = dialog.querySelector(".question-preview-controls");
  const previousButton = dialog.querySelector("[data-preview-previous]");
  const nextButton = dialog.querySelector("[data-preview-next]");
  let pages = [];
  let currentPage = 0;

  function showPage(index) {
    currentPage = index;
    const page = pages[currentPage];
    controls.hidden = pages.length < 2;
    previewImage.src = page.url;
    previewImage.alt = `${dialog.dataset.previewAlt || "Full question paper"} · Page ${currentPage + 1}`;
    counter.textContent = `Page ${currentPage + 1} of ${pages.length}${page.fileName ? ` · ${page.fileName}` : ""}`;
    previousButton.disabled = currentPage === 0;
    nextButton.disabled = currentPage === pages.length - 1;
  }

  dialog.querySelector(".question-preview-close").addEventListener("click", () => dialog.close());
  previewImage.addEventListener("click", () => dialog.close());
  previousButton.addEventListener("click", () => {
    if (currentPage > 0) showPage(currentPage - 1);
  });
  nextButton.addEventListener("click", () => {
    if (currentPage < pages.length - 1) showPage(currentPage + 1);
  });
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    pages = [];
    previewImage.removeAttribute("src");
    counter.textContent = "";
  });
  dialog.showQuestionPages = (questionPages, alt) => {
    pages = questionPages;
    dialog.dataset.previewAlt = alt;
    showPage(0);
  };
  document.body.appendChild(dialog);
  return dialog;
}

document.addEventListener("click", event => {
  const trigger = event.target instanceof Element
    ? event.target.closest(".question-preview-trigger")
    : null;
  if (!trigger) return;

  const dialog = getQuestionPreviewDialog();
  let pages;
  try {
    pages = JSON.parse(trigger.dataset.previewPages || "[]");
  } catch (error) {
    console.error("Could not read question preview pages:", error);
    return;
  }
  if (!pages.length && trigger.dataset.previewSrc) {
    pages = [{ url: trigger.dataset.previewSrc, fileName: "" }];
  }
  if (!pages.length) return;
  dialog.showQuestionPages(pages, trigger.dataset.previewAlt || "Full question paper");
  dialog.showModal();
});