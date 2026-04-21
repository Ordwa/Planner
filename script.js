const STORAGE_KEY = "flowboard-planner-state";
const NOTES_STORAGE_KEY = "flowboard-planner-notes";
const SIDEBAR_BREAKPOINT = 1600;

const COLUMN_CONFIG = [
  {
    key: "backlog",
    title: "Backlog",
    subtitle: "Capture ideas and future activities.",
  },
  {
    key: "todo",
    title: "To Do",
    subtitle: "Ready to start and clearly prioritized.",
  },
  {
    key: "progress",
    title: "In Progress",
    subtitle: "Current work that is actively moving.",
  },
  {
    key: "done",
    title: "Done",
    subtitle: "Completed tasks and shipped results.",
  },
];

const DEFAULT_TASKS = [
  {
    id: generateId(),
    title: "Plan weekly priorities",
    description: "Review upcoming activities and break them into small actions.",
    owner: "Operations",
    project: "Planning",
    dueDate: "",
    priority: "high",
    status: "todo",
    createdAt: Date.now(),
    order: 1,
  },
  {
    id: generateId(),
    title: "Update project board",
    description: "Move current tasks to reflect the real project status.",
    owner: "Product Team",
    project: "Product",
    dueDate: "",
    priority: "medium",
    status: "progress",
    createdAt: Date.now() + 1,
    order: 1,
  },
  {
    id: generateId(),
    title: "Archive completed items",
    description: "Clean up the board and keep only relevant finished work.",
    owner: "Admin",
    project: "Operations",
    dueDate: "",
    priority: "low",
    status: "done",
    createdAt: Date.now() + 2,
    order: 1,
  },
];

const state = {
  tasks: loadTasks(),
  notes: loadNotes(),
  filters: {
    search: "",
    priority: "all",
  },
  columnSorts: Object.fromEntries(COLUMN_CONFIG.map((column) => [column.key, "manual"])),
  openColumnMenuKey: null,
  openTaskMenuId: null,
  editingTaskId: null,
  modalTaskStatus: "backlog",
  modalChecklist: [],
  modalComments: [],
};

const taskForm = document.querySelector("#task-form");
const submitButton = document.querySelector("#submit-button");
const resetButton = document.querySelector("#reset-button");
const searchInput = document.querySelector("#search-input");
const priorityFilter = document.querySelector("#priority-filter");
const clearFiltersButton = document.querySelector("#clear-filters");
const filtersToggle = document.querySelector("#filters-toggle");
const filtersPanel = document.querySelector("#filters-panel");
const filtersMenu = document.querySelector(".filters-menu");
const notificationsMenu = document.querySelector(".notifications-menu");
const sidebar = document.querySelector(".sidebar");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const sidebarBackdrop = document.querySelector("#sidebar-backdrop");
const openTaskModalButton = document.querySelector("#open-task-modal");
const closeTaskModalButton = document.querySelector("#close-task-modal");
const notificationsButton = document.querySelector("#notifications-button");
const notificationsBadge = document.querySelector("#notifications-badge");
const notificationsPanel = document.querySelector("#notifications-panel");
const notificationsList = document.querySelector("#notifications-list");
const notesButton = document.querySelector("#notes-button");
const notesDrawer = document.querySelector("#notes-drawer");
const closeNotesDrawerButton = document.querySelector("#close-notes-drawer");
const notesToolbar = document.querySelector(".notes-toolbar");
const notesEditor = document.querySelector("#notes-editor");
const taskModal = document.querySelector("#task-modal");
const taskModalTitle = document.querySelector("#task-modal-title");
const taskOwnerAvatar = document.querySelector("#task-owner-avatar");
const checklistInput = document.querySelector("#checklist-input");
const showChecklistOnCardInput = document.querySelector("#show-checklist-on-card");
const addChecklistItemButton = document.querySelector("#add-checklist-item");
const checklistList = document.querySelector("#checklist-list");
const commentInput = document.querySelector("#comment-input");
const addCommentButton = document.querySelector("#add-comment");
const commentsList = document.querySelector("#comments-list");
const board = document.querySelector("#kanban-board");
const columnTemplate = document.querySelector("#column-template");
const taskTemplate = document.querySelector("#task-template");

const fieldRefs = {
  id: document.querySelector("#task-id"),
  title: document.querySelector("#task-title"),
  description: document.querySelector("#task-description"),
  dueDate: document.querySelector("#task-due-date"),
  priority: document.querySelector("#task-priority"),
};

let draggedTaskId = null;
let draggedModalChecklistItemId = null;

taskModalTitle.addEventListener("input", handleInlineTitleInput);
taskModalTitle.addEventListener("keydown", handleInlineTitleKeydown);
taskModalTitle.addEventListener("blur", handleInlineTitleBlur);

taskForm.addEventListener("submit", handleTaskSubmit);
resetButton.addEventListener("click", closeTaskModal);
openTaskModalButton.addEventListener("click", () => openTaskModal());
closeTaskModalButton?.addEventListener("click", closeTaskModal);
addChecklistItemButton.addEventListener("click", addChecklistItem);
addCommentButton.addEventListener("click", addComment);
sidebarToggle.addEventListener("click", () => {
  setSidebarOpen(!document.body.classList.contains("sidebar-open"));
});
sidebarBackdrop.addEventListener("click", closeSidebar);
notesButton.addEventListener("click", () => {
  closeSidebar();
  setFiltersOpen(false);
  setNotificationsOpen(false);
  setNotesDrawerOpen(notesDrawer.hidden);
});
closeNotesDrawerButton.addEventListener("click", closeNotesDrawer);
notesEditor.addEventListener("input", handleNotesInput);
notesEditor.addEventListener("click", handleNotesEditorClick);
notesEditor.addEventListener("change", handleNotesEditorChange);
notesEditor.addEventListener("keydown", handleNotesEditorKeydown);
notesToolbar.addEventListener("click", handleNotesToolbarClick);
notesToolbar.addEventListener("mousedown", handleNotesToolbarMouseDown);

[fieldRefs.title, fieldRefs.description, fieldRefs.dueDate].forEach((field) => {
  field.addEventListener("input", autoSaveEditingTask);
});

[fieldRefs.priority, showChecklistOnCardInput].forEach((field) => {
  field.addEventListener("change", autoSaveEditingTask);
});

checklistInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addChecklistItem();
  }
});

commentInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    addComment();
  }
});

taskModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-modal='true']")) {
    closeTaskModal();
  }
});

notesDrawer.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-notes='true']")) {
    closeNotesDrawer();
  }
});

searchInput.addEventListener("input", () => {
  state.filters.search = searchInput.value.trim().toLowerCase();
  render();
});

priorityFilter.addEventListener("change", () => {
  state.filters.priority = priorityFilter.value;
  render();
});

clearFiltersButton.addEventListener("click", () => {
  state.filters.search = "";
  state.filters.priority = "all";
  searchInput.value = "";
  priorityFilter.value = "all";
  closeSidebar();
  setFiltersOpen(false);
  render();
});

filtersToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  closeSidebar();
  setNotificationsOpen(false);
  setFiltersOpen(filtersPanel.hidden);
});

notificationsButton.addEventListener("click", (event) => {
  event.stopPropagation();
  closeSidebar();
  setFiltersOpen(false);
  setNotificationsOpen(notificationsPanel.hidden);
});

document.addEventListener("click", (event) => {
  if (!filtersMenu.contains(event.target)) {
    setFiltersOpen(false);
  }

  if (!notificationsMenu.contains(event.target)) {
    setNotificationsOpen(false);
  }

  if (!event.target.closest(".kanban-column__menu")) {
    closeColumnMenu();
  }

  if (!event.target.closest(".task-card__menu")) {
    closeTaskMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSidebar();
    setFiltersOpen(false);
    setNotificationsOpen(false);
    closeColumnMenu();
    closeTaskMenu();
    closeNotesDrawer();

    if (!taskModal.hidden) {
      closeTaskModal();
    }
  }
});

window.addEventListener("resize", () => {
  positionTopbarPopover(filtersPanel, filtersToggle);
  positionTopbarPopover(notificationsPanel, notificationsButton);

  if (window.innerWidth > SIDEBAR_BREAKPOINT) {
    closeSidebar();
  }
});

renderNotesEditor();
render();

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return DEFAULT_TASKS.map(normalizeTask);
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeTask) : DEFAULT_TASKS.map(normalizeTask);
  } catch (error) {
    console.error("Unable to read planner state:", error);
    return DEFAULT_TASKS.map(normalizeTask);
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  } catch (error) {
    console.error("Unable to save planner state:", error);
  }
}

function loadNotes() {
  try {
    const stored = localStorage.getItem(NOTES_STORAGE_KEY);

    if (!stored) {
      return createEmptyNotesState();
    }

    const parsed = JSON.parse(stored);
    return normalizeNotes(parsed);
  } catch (error) {
    const legacyValue = localStorage.getItem(NOTES_STORAGE_KEY) ?? "";

    if (legacyValue) {
      return normalizeNotes({
        title: "",
        content: plainTextToHtml(legacyValue),
        updatedAt: Date.now(),
      });
    }

    console.error("Unable to read notes state:", error);
    return createEmptyNotesState();
  }
}

function saveNotes() {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(state.notes));
  } catch (error) {
    console.error("Unable to save notes state:", error);
  }
}

function handleNotesInput() {
  state.notes = {
    ...state.notes,
    content: sanitizeNotesHtml(notesEditor.innerHTML),
    updatedAt: Date.now(),
  };
  saveNotes();
}

function handleNotesEditorChange(event) {
  const checkbox = event.target.closest(".notes-checklist__checkbox");

  if (!checkbox) {
    return;
  }

  const checklistItem = checkbox.closest(".notes-checklist-item");

  if (!checklistItem) {
    return;
  }

  checklistItem.classList.toggle("is-checked", checkbox.checked);
  syncNotesChecklistItem(checklistItem);
  handleNotesInput();
}

function handleNotesEditorClick(event) {
  const marker = event.target.closest(".notes-checklist__marker");

  if (!marker) {
    return;
  }

  event.preventDefault();
  const checklistItem = marker.closest(".notes-checklist-item");

  if (!checklistItem) {
    return;
  }

  toggleNotesChecklistItemState(checklistItem);
  handleNotesInput();
  placeCaretAtEnd(checklistItem.querySelector(".notes-checklist__text"));
}

function handleNotesEditorKeydown(event) {
  const selection = window.getSelection();

  if (!selection?.isCollapsed) {
    return;
  }

  const checklistItem = findNearestChecklistItem(selection.anchorNode);

  if (!checklistItem) {
    return;
  }

  const textNode = checklistItem.querySelector(".notes-checklist__text");

  if (!textNode || !isCaretAtStartOfNode(selection, textNode)) {
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    replaceNotesChecklistItem(checklistItem);
    handleNotesInput();
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
  }
}

function handleNotesToolbarMouseDown(event) {
  if (event.target.closest("[data-note-command]")) {
    event.preventDefault();
  }
}

function handleNotesToolbarClick(event) {
  const button = event.target.closest("[data-note-command]");

  if (!button) {
    return;
  }

  const { noteCommand } = button.dataset;
  focusNotesEditor();

  switch (noteCommand) {
    case "bold":
      document.execCommand("bold");
      break;
    case "italic":
      document.execCommand("italic");
      break;
    case "underline":
      document.execCommand("underline");
      break;
    case "bulletList":
      toggleNotesList("UL");
      break;
    case "numberList":
      toggleNotesList("OL");
      break;
    case "heading":
      toggleNotesBlockTag("H2");
      break;
    case "quote":
      toggleNotesBlockTag("BLOCKQUOTE");
      break;
    case "checklist":
      toggleNotesChecklist();
      break;
    default:
      return;
  }

  handleNotesInput();
}

function renderNotesEditor() {
  notesEditor.innerHTML = state.notes.content || "";
  notesEditor
    .querySelectorAll(".notes-checklist-item")
    .forEach((checklistItem) => syncNotesChecklistItem(checklistItem));
}

function focusNotesEditor() {
  notesEditor.focus();
}

function toggleNotesChecklist() {
  const selection = window.getSelection();
  const checklistItem = findNearestChecklistItem(selection?.anchorNode);
  const listItem = findNearestListItem(selection?.anchorNode);

  if (checklistItem) {
    replaceNotesChecklistItem(checklistItem);
    return;
  }

  if (listItem) {
    replaceNotesListItemWithChecklist(listItem);
    return;
  }

  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

  if (range && !range.collapsed) {
    const extracted = range.extractContents();
    const wrapper = document.createElement("div");
    wrapper.appendChild(extracted);
    const { fragment, lastItem } = buildChecklistFragmentFromHtml(wrapper.innerHTML);
    range.insertNode(fragment);

    if (lastItem) {
      placeCaretAtEnd(lastItem.querySelector(".notes-checklist__text"));
    }

    return;
  }

  const currentBlock = selection?.anchorNode ? findNearestBlockElement(selection.anchorNode) : null;

  if (currentBlock && currentBlock !== notesEditor && currentBlock.tagName !== "LI") {
    replaceNotesBlockWithChecklist(currentBlock);
    return;
  }

  document.execCommand(
    "insertHTML",
    false,
    '<div class="notes-checklist-item"><span class="notes-checklist__marker" contenteditable="false" aria-hidden="true"></span><span class="notes-checklist__text">\u200B</span></div>'
  );
}

function createEmptyNotesState() {
  return {
    content: "",
    updatedAt: null,
  };
}

function normalizeNotes(notes) {
  return {
    content: sanitizeNotesHtml(String(notes?.content ?? "")),
    updatedAt: Number.isFinite(notes?.updatedAt) ? notes.updatedAt : null,
  };
}

function toggleNotesBlockTag(tagName) {
  const selection = window.getSelection();
  const anchorNode = selection?.anchorNode;
  const checklistItem = findNearestChecklistItem(anchorNode);
  const listItem = findNearestListItem(anchorNode);
  const currentBlock = anchorNode instanceof Node ? findNearestBlockElement(anchorNode) : null;

  if (checklistItem) {
    replaceNotesChecklistItemWithBlock(checklistItem, tagName);
    return;
  }

  if (listItem) {
    const currentList = listItem.closest("ul, ol");
    if (currentList && currentList.tagName === tagName) {
      replaceNotesListItemWithBlock(listItem, "P");
      return;
    }

    replaceNotesListItemWithBlock(listItem, tagName);
    return;
  }

  if (currentBlock?.tagName === tagName) {
    replaceNotesBlockElement(currentBlock, "P");
    return;
  }

  if (currentBlock && currentBlock !== notesEditor && currentBlock.tagName !== "LI") {
    replaceNotesBlockElement(currentBlock, tagName);
    return;
  }

  document.execCommand("formatBlock", false, `<${tagName.toLowerCase()}>`);
}

function toggleNotesList(listTagName) {
  const selection = window.getSelection();
  const anchorNode = selection?.anchorNode;
  const checklistItem = findNearestChecklistItem(anchorNode);
  const listItem = findNearestListItem(anchorNode);
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

  if (checklistItem) {
    replaceNotesChecklistItemWithList(checklistItem, listTagName);
    return;
  }

  if (listItem) {
    const currentList = listItem.closest("ul, ol");

    if (currentList?.tagName === listTagName) {
      replaceNotesListItemWithBlock(listItem, "P");
      return;
    }

    replaceNotesListItemWithList(listItem, listTagName);
    return;
  }

  if (range && !range.collapsed) {
    const extracted = range.extractContents();
    const wrapper = document.createElement("div");
    wrapper.appendChild(extracted);
    const { fragment, lastItem } = buildNotesListFragmentFromHtml(wrapper.innerHTML, listTagName);
    range.insertNode(fragment);

    if (lastItem) {
      placeCaretAtEnd(lastItem);
    }

    return;
  }

  const currentBlock = anchorNode instanceof Node ? findNearestBlockElement(anchorNode) : null;

  if (currentBlock && currentBlock !== notesEditor) {
    if (currentBlock.tagName === listTagName) {
      replaceNotesBlockElement(currentBlock, "P");
      return;
    }

    replaceNotesBlockWithList(currentBlock, listTagName);
    return;
  }

  const list = createNotesListElement(listTagName, ["<br>"]);
  notesEditor.appendChild(list);
  const item = list.querySelector("li");
  if (item) {
    placeCaretAtEnd(item);
  }
}

function findNearestBlockElement(node) {
  let current = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;

  while (current && current !== notesEditor) {
    if (["P", "H2", "H3", "BLOCKQUOTE", "LI", "DIV"].includes(current.tagName)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function findNearestChecklistItem(node) {
  const current = node instanceof Element ? node : node?.parentElement;
  return current?.closest(".notes-checklist-item") ?? null;
}

function findNearestListItem(node) {
  const current = node instanceof Element ? node : node?.parentElement;
  return current?.closest("li") ?? null;
}

function sanitizeNotesHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;

  const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "BLOCKQUOTE", "H2", "H3", "DIV", "SPAN", "INPUT"]);

  const cleanNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent ?? "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createDocumentFragment();
    }

    if (!allowedTags.has(node.tagName)) {
      const fragment = document.createDocumentFragment();
      Array.from(node.childNodes).forEach((child) => {
        fragment.appendChild(cleanNode(child));
      });
      return fragment;
    }

    const element = document.createElement(node.tagName.toLowerCase());

    if (node.tagName === "DIV" && node.classList.contains("notes-checklist-item")) {
      element.className = "notes-checklist-item";

      if (
        node.classList.contains("is-checked") ||
        node.dataset.checked === "true" ||
        node.querySelector(".notes-checklist__checkbox[checked]") ||
        node.querySelector(".notes-checklist__checkbox:checked")
      ) {
        element.classList.add("is-checked");
      }
    }

    if (node.tagName === "SPAN" && node.classList.contains("notes-checklist__text")) {
      element.className = "notes-checklist__text";
    }

    if (node.tagName === "SPAN" && node.classList.contains("notes-checklist__marker")) {
      element.className = "notes-checklist__marker";
      element.setAttribute("contenteditable", "false");
      element.setAttribute("aria-hidden", "true");
    }

    if (node.tagName === "INPUT") {
      element.className = "notes-checklist__marker";
      element.setAttribute("contenteditable", "false");
      element.setAttribute("aria-hidden", "true");
      return element;
    }

    Array.from(node.childNodes).forEach((child) => {
      element.appendChild(cleanNode(child));
    });

    if (node.tagName === "DIV" && element.classList.contains("notes-checklist-item")) {
      if (!element.querySelector(".notes-checklist__marker")) {
        const marker = document.createElement("span");
        marker.className = "notes-checklist__marker";
        marker.setAttribute("contenteditable", "false");
        marker.setAttribute("aria-hidden", "true");
        element.prepend(marker);
      }
    }

    return element;
  };

  const fragment = document.createDocumentFragment();
  Array.from(template.content.childNodes).forEach((child) => {
    fragment.appendChild(cleanNode(child));
  });

  const wrapper = document.createElement("div");
  wrapper.appendChild(fragment);
  return wrapper.innerHTML.trim();
}

function plainTextToHtml(text) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setSidebarOpen(isOpen) {
  document.body.classList.toggle("sidebar-open", isOpen);
  sidebarToggle.setAttribute("aria-expanded", String(isOpen));
  sidebar.setAttribute("aria-hidden", String(!isOpen && window.innerWidth <= SIDEBAR_BREAKPOINT));
  sidebarBackdrop.hidden = !isOpen;
}

function closeSidebar() {
  if (!document.body.classList.contains("sidebar-open")) {
    return;
  }

  setSidebarOpen(false);
}

function replaceNotesBlockElement(element, nextTagName) {
  const replacement = document.createElement(nextTagName.toLowerCase());
  replacement.innerHTML = element.innerHTML || "<br>";
  element.replaceWith(replacement);
  placeCaretAtEnd(replacement);
}

function replaceNotesBlockWithChecklist(element) {
  const checklistItem = createNotesChecklistItemElement(element.innerHTML || "<br>");
  element.replaceWith(checklistItem);
  placeCaretAtEnd(checklistItem.querySelector(".notes-checklist__text"));
}

function replaceNotesBlockWithList(element, listTagName) {
  const list = createNotesListElement(listTagName, [element.innerHTML || "<br>"]);
  element.replaceWith(list);
  const item = list.querySelector("li");
  if (item) {
    placeCaretAtEnd(item);
  }
}

function replaceNotesChecklistItem(checklistItem) {
  const replacement = document.createElement("p");
  const text = checklistItem.querySelector(".notes-checklist__text");
  replacement.innerHTML = text?.innerHTML?.trim() || "<br>";
  checklistItem.replaceWith(replacement);
  placeCaretAtStart(replacement);
}

function replaceNotesChecklistItemWithBlock(checklistItem, tagName) {
  const replacement = document.createElement(tagName.toLowerCase());
  const text = checklistItem.querySelector(".notes-checklist__text");
  replacement.innerHTML = text?.innerHTML?.trim() || "<br>";
  checklistItem.replaceWith(replacement);
  placeCaretAtEnd(replacement);
}

function replaceNotesChecklistItemWithList(checklistItem, listTagName) {
  const text = checklistItem.querySelector(".notes-checklist__text");
  const list = createNotesListElement(listTagName, [text?.innerHTML?.trim() || "<br>"]);
  checklistItem.replaceWith(list);
  const item = list.querySelector("li");
  if (item) {
    placeCaretAtEnd(item);
  }
}

function replaceNotesListItemWithChecklist(listItem) {
  const checklistItem = createNotesChecklistItemElement(listItem.innerHTML || "<br>");
  replaceNotesListItemWithNode(listItem, checklistItem);
  placeCaretAtEnd(checklistItem.querySelector(".notes-checklist__text"));
}

function replaceNotesListItemWithBlock(listItem, tagName) {
  const replacement = document.createElement(tagName.toLowerCase());
  replacement.innerHTML = listItem.innerHTML || "<br>";
  replaceNotesListItemWithNode(listItem, replacement);
  placeCaretAtEnd(replacement);
}

function replaceNotesListItemWithList(listItem, listTagName) {
  const list = createNotesListElement(listTagName, [listItem.innerHTML || "<br>"]);
  replaceNotesListItemWithNode(listItem, list);
  const item = list.querySelector("li");
  if (item) {
    placeCaretAtEnd(item);
  }
}

function replaceNotesListItemWithNode(listItem, replacement) {
  const list = listItem.parentElement;
  const parent = list?.parentNode;

  if (!list || !parent) {
    return;
  }

  const items = Array.from(list.children);
  const index = items.indexOf(listItem);
  const beforeItems = items.slice(0, index);
  const afterItems = items.slice(index + 1);

  if (beforeItems.length) {
    const beforeList = document.createElement(list.tagName.toLowerCase());
    beforeItems.forEach((item) => beforeList.appendChild(item));
    parent.insertBefore(beforeList, list);
  }

  parent.insertBefore(replacement, list);

  if (afterItems.length) {
    const afterList = document.createElement(list.tagName.toLowerCase());
    afterItems.forEach((item) => afterList.appendChild(item));
    parent.insertBefore(afterList, list);
  }

  list.remove();
}

function placeCaretAtEnd(element) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function placeCaretAtStart(element) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function isCaretAtStartOfNode(selection, element) {
  const range = selection.getRangeAt(0).cloneRange();
  const startRange = document.createRange();
  startRange.selectNodeContents(element);
  startRange.setEnd(range.startContainer, range.startOffset);
  return startRange.toString().length === 0;
}

function syncNotesChecklistItem(checklistItem) {
  if (!checklistItem.querySelector(".notes-checklist__marker")) {
    const marker = document.createElement("span");
    marker.className = "notes-checklist__marker";
    marker.setAttribute("contenteditable", "false");
    marker.setAttribute("aria-hidden", "true");
    checklistItem.prepend(marker);
  }
}

function buildChecklistFragmentFromHtml(html) {
  const lines = extractNotesLinesFromHtml(html);
  const template = document.createElement("template");
  const fragment = document.createDocumentFragment();
  let lastItem = null;

  const addItem = (contentHtml) => {
    const item = createNotesChecklistItemElement(contentHtml);
    fragment.appendChild(item);
    lastItem = item;
  };

  if (!lines.length) {
    addItem("<br>");
    return { fragment, lastItem };
  }

  lines.forEach((line) => addItem(line));

  return { fragment, lastItem };
}

function buildNotesListFragmentFromHtml(html, listTagName) {
  const lines = extractNotesLinesFromHtml(html);
  const list = createNotesListElement(listTagName, lines.length ? lines : ["<br>"]);
  return {
    fragment: list,
    lastItem: list.lastElementChild,
  };
}

function extractNotesLinesFromHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const lines = [];

  const addLine = (contentHtml) => {
    const normalized = contentHtml?.trim();
    lines.push(normalized || "<br>");
  };

  const addTextLines = (text) => {
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => addLine(escapeHtml(line)));
  };

  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) {
        addTextLines(node.textContent);
      }
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (node.classList.contains("notes-checklist-item")) {
      addLine(node.querySelector(".notes-checklist__text")?.innerHTML || "<br>");
      return;
    }

    if (node.matches("ul, ol")) {
      Array.from(node.children).forEach((child) => {
        if (child instanceof HTMLElement && child.tagName === "LI") {
          addLine(child.innerHTML || "<br>");
        }
      });
      return;
    }

    if (["P", "DIV", "H2", "H3", "BLOCKQUOTE", "LI"].includes(node.tagName)) {
      addLine(node.innerHTML || "<br>");
      return;
    }

    if (node.children.length) {
      Array.from(node.childNodes).forEach(walk);
      return;
    }

    addLine(node.outerHTML);
  };

  Array.from(template.content.childNodes).forEach(walk);

  return lines;
}

function createNotesChecklistItemElement(contentHtml) {
  const item = document.createElement("div");
  item.className = "notes-checklist-item";

  const checkbox = document.createElement("span");
  checkbox.className = "notes-checklist__marker";
  checkbox.setAttribute("contenteditable", "false");
  checkbox.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.className = "notes-checklist__text";
  text.innerHTML = contentHtml || "<br>";

  item.append(checkbox, text);
  return item;
}

function toggleNotesChecklistItemState(checklistItem) {
  checklistItem.classList.toggle("is-checked");
  syncNotesChecklistItem(checklistItem);
}

function createNotesListElement(listTagName, itemsHtml) {
  const list = document.createElement(listTagName.toLowerCase());

  itemsHtml.forEach((contentHtml) => {
    const item = document.createElement("li");
    item.innerHTML = contentHtml || "<br>";
    list.appendChild(item);
  });

  return list;
}

function buildTaskFromForm(fallbackTask) {
  const nextStatus = fallbackTask?.status ?? state.modalTaskStatus ?? "backlog";

  return normalizeTask({
    id: state.editingTaskId ?? generateId(),
    title: fieldRefs.title.value.trim() || fallbackTask?.title || "",
    description: fieldRefs.description.value.trim(),
    owner: fallbackTask?.owner ?? "",
    project: fallbackTask?.project ?? "General",
    dueDate: fieldRefs.dueDate.value,
    priority: fieldRefs.priority.value,
    status: nextStatus,
    createdAt: state.editingTaskId ? fallbackTask?.createdAt ?? Date.now() : Date.now(),
    order: state.editingTaskId ? fallbackTask?.order ?? getNextTaskOrder(nextStatus) : getNextTaskOrder(nextStatus),
    showChecklistOnCard: showChecklistOnCardInput.checked,
    checklist: state.modalChecklist,
    comments: state.modalComments,
  });
}

function upsertTask(task) {
  const existingTask = state.tasks.some((item) => item.id === task.id);

  state.tasks = existingTask
    ? state.tasks.map((item) => (item.id === task.id ? task : item))
    : [task, ...state.tasks];

  saveTasks();
  render();
}

function autoSaveEditingTask() {
  if (!state.editingTaskId) {
    return;
  }

  syncTitleInputFromInlineTitle();
  const currentTask = findTaskById(state.editingTaskId);

  if (!currentTask) {
    return;
  }

  upsertTask(buildTaskFromForm(currentTask));
}

function handleTaskSubmit(event) {
  event.preventDefault();
  syncTitleInputFromInlineTitle();

  if (state.editingTaskId) {
    autoSaveEditingTask();
    return;
  }

  const normalizedTask = buildTaskFromForm();

  if (!normalizedTask.title) {
    fieldRefs.title.focus();
    return;
  }

  upsertTask(normalizedTask);
  closeTaskModal();
}

function handleInlineTitleInput() {
  syncTitleInputFromInlineTitle();
  autoSaveEditingTask();
}

function handleInlineTitleKeydown(event) {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  taskModalTitle.blur();
}

function handleInlineTitleBlur() {
  syncTitleInputFromInlineTitle();

  if (!fieldRefs.title.value) {
    setInlineTaskTitle("New Activity");
  }

  autoSaveEditingTask();
}

function syncTitleInputFromInlineTitle() {
  fieldRefs.title.value = taskModalTitle.textContent.trim();
}

function setInlineTaskTitle(title) {
  taskModalTitle.textContent = title || "New Activity";
  syncTitleInputFromInlineTitle();
}

function resetForm() {
  taskForm.reset();
  state.editingTaskId = null;
  state.modalTaskStatus = "backlog";
  state.modalChecklist = [];
  state.modalComments = [];
  fieldRefs.id.value = "";
  fieldRefs.title.value = "";
  setInlineTaskTitle("New Activity");
  updateOwnerAvatar(taskOwnerAvatar, "");
  fieldRefs.priority.value = "medium";
  showChecklistOnCardInput.checked = false;
  checklistInput.value = "";
  commentInput.value = "";
  resetButton.hidden = false;
  renderModalCollections();
}

function openTaskModal(task, options = {}) {
  const { isClone = false } = options;

  closeSidebar();
  setNotesDrawerOpen(false);
  setFiltersOpen(false);
  setNotificationsOpen(false);

  if (task && !isClone) {
    fillForm(task);
    submitButton.hidden = true;
    resetButton.hidden = true;
  } else if (task && isClone) {
    fillForm(task, { isClone: true });
    submitButton.hidden = false;
    submitButton.textContent = "Create copy";
    resetButton.hidden = false;
    resetButton.textContent = "Cancel";
  } else {
    resetForm();
    submitButton.hidden = false;
    submitButton.textContent = "Create task";
    resetButton.hidden = false;
    resetButton.textContent = "Cancel";
  }

  renderModalCollections();
  taskModal.hidden = false;
  syncOverlayState();
}

function closeTaskModal() {
  taskModal.hidden = true;
  syncOverlayState();
  resetForm();
}

function setFiltersOpen(isOpen) {
  filtersPanel.hidden = !isOpen;
  filtersToggle.setAttribute("aria-expanded", String(isOpen));

  if (isOpen) {
    positionTopbarPopover(filtersPanel, filtersToggle);
  }
}

function setNotificationsOpen(isOpen) {
  notificationsPanel.hidden = !isOpen;
  notificationsButton.setAttribute("aria-expanded", String(isOpen));

  if (isOpen) {
    positionTopbarPopover(notificationsPanel, notificationsButton);
  }
}

function setNotesDrawerOpen(isOpen) {
  if (isOpen) {
    closeSidebar();
  }

  notesDrawer.hidden = !isOpen;
  notesButton.setAttribute("aria-expanded", String(isOpen));
  syncOverlayState();

  if (isOpen) {
    renderNotesEditor();
  }
}

function closeNotesDrawer() {
  if (notesDrawer.hidden) {
    return;
  }

  setNotesDrawerOpen(false);
}

function syncOverlayState() {
  document.body.classList.toggle("modal-open", !taskModal.hidden || !notesDrawer.hidden);
}

function positionTopbarPopover(panel, trigger) {
  if (!panel || panel.hidden || !trigger) {
    return;
  }

  const viewportPadding = 12;
  const gap = 10;
  const triggerRect = trigger.getBoundingClientRect();
  const panelWidth = panel.offsetWidth;
  const panelHeight = panel.offsetHeight;
  const maxLeft = window.innerWidth - panelWidth - viewportPadding;
  const maxTop = window.innerHeight - panelHeight - viewportPadding;

  const nextLeft = Math.min(
    Math.max(viewportPadding, triggerRect.left),
    Math.max(viewportPadding, maxLeft)
  );

  let nextTop = triggerRect.bottom + gap;

  if (nextTop > maxTop) {
    nextTop = Math.max(viewportPadding, triggerRect.top - panelHeight - gap);
  }

  panel.style.left = `${nextLeft}px`;
  panel.style.top = `${Math.max(viewportPadding, nextTop)}px`;
}

function render() {
  renderNotificationBadge();
  renderNotificationsPanel();
  renderBoard();
}

function renderNotificationBadge() {
  const overdueCount = getOverdueTasks().length;

  notificationsBadge.hidden = overdueCount === 0;

  if (overdueCount > 0) {
    notificationsBadge.textContent = overdueCount > 9 ? "9+" : String(overdueCount);
    notificationsButton.setAttribute(
      "aria-label",
      `${overdueCount} overdue activit${overdueCount === 1 ? "y" : "ies"}`
    );
  } else {
    notificationsButton.setAttribute("aria-label", "Notifications");
  }
}

function renderNotificationsPanel() {
  const overdueTasks = getOverdueTasks();
  notificationsList.innerHTML = "";

  if (!overdueTasks.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "notifications-empty";
    emptyState.textContent = "No overdue activities right now.";
    notificationsList.appendChild(emptyState);
    return;
  }

  overdueTasks.forEach((task) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "notification-item";
    item.addEventListener("click", () => {
      setNotificationsOpen(false);
      openTaskModal(findTaskById(task.id));
    });

    const title = document.createElement("span");
    title.className = "notification-item__title";
    title.textContent = task.title;

    const meta = document.createElement("span");
    meta.className = "notification-item__meta";
    meta.textContent = `${formatDate(task.dueDate)} · ${
      COLUMN_CONFIG.find((column) => column.key === task.status)?.title ?? task.status
    }`;

    const preview = document.createElement("span");
    preview.className = "notification-item__preview";
    preview.textContent = getCardPreviewText(task);

    item.append(title, meta, preview);
    notificationsList.appendChild(item);
  });
}

function renderModalCollections() {
  renderChecklist();
  renderComments();
}

function renderBoard() {
  const filteredTasks = getFilteredTasks();
  board.innerHTML = "";

  COLUMN_CONFIG.forEach((column) => {
    const fragment = columnTemplate.content.cloneNode(true);
    const columnNode = fragment.querySelector(".kanban-column");
    const titleNode = fragment.querySelector(".kanban-column__title");
    const countNode = fragment.querySelector(".kanban-column__count");
    const listNode = fragment.querySelector(".kanban-column__list");
    const menuToggle = fragment.querySelector(".kanban-column__menu-toggle");
    const dropdown = fragment.querySelector(".kanban-column__dropdown");

    const columnTasks = sortColumnTasks(
      filteredTasks.filter((task) => task.status === column.key),
      state.columnSorts[column.key]
    );

    columnNode.dataset.column = column.key;
    titleNode.textContent = column.title;
    countNode.textContent = String(columnTasks.length);
    menuToggle.closest(".kanban-column__menu")?.classList.toggle("is-open", state.openColumnMenuKey === column.key);
    menuToggle.setAttribute("aria-expanded", String(state.openColumnMenuKey === column.key));
    dropdown.hidden = state.openColumnMenuKey !== column.key;

    columnNode.addEventListener("dragover", handleColumnDragOver);
    columnNode.addEventListener("dragleave", handleColumnDragLeave);
    columnNode.addEventListener("drop", handleColumnDrop);
    menuToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      state.openTaskMenuId = null;
      state.openColumnMenuKey = state.openColumnMenuKey === column.key ? null : column.key;
      renderBoard();
    });
    dropdown.addEventListener("click", (event) => {
      const sortButton = event.target.closest("[data-sort]");

      if (!sortButton) {
        return;
      }

      state.columnSorts[column.key] = sortButton.dataset.sort;
      state.openColumnMenuKey = null;
      renderBoard();
    });

    if (!columnTasks.length) {
      const emptyState = document.createElement("p");
      emptyState.className = "kanban-column__empty";
      emptyState.textContent = "No tasks in this bucket yet.";
      listNode.appendChild(emptyState);
    }

    columnTasks.forEach((task) => {
      listNode.appendChild(createTaskCard(task));
    });

    board.appendChild(fragment);
  });
}

function sortColumnTasks(tasks, sortKey) {
  const priorityRank = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return [...tasks].sort((left, right) => {
    switch (sortKey) {
      case "manual":
        return (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) || right.createdAt - left.createdAt;
      case "oldest":
        return left.createdAt - right.createdAt;
      case "dueDate":
        return compareDueDates(left, right) || right.createdAt - left.createdAt;
      case "priority":
        return (
          (priorityRank[left.priority] ?? Number.MAX_SAFE_INTEGER) -
            (priorityRank[right.priority] ?? Number.MAX_SAFE_INTEGER) ||
          right.createdAt - left.createdAt
        );
      case "newest":
      default:
        return right.createdAt - left.createdAt;
    }
  });
}

function compareDueDates(left, right) {
  if (!left.dueDate && !right.dueDate) {
    return 0;
  }

  if (!left.dueDate) {
    return 1;
  }

  if (!right.dueDate) {
    return -1;
  }

  return left.dueDate.localeCompare(right.dueDate);
}

function closeColumnMenu() {
  if (state.openColumnMenuKey === null) {
    return;
  }

  state.openColumnMenuKey = null;
  renderBoard();
}

function closeTaskMenu() {
  if (state.openTaskMenuId === null) {
    return;
  }

  state.openTaskMenuId = null;
  renderBoard();
}

function createTaskCard(task) {
  const fragment = taskTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".task-card");
  const headerNode = fragment.querySelector(".task-card__header");
  const dateNode = fragment.querySelector(".task-card__date");
  const titleNode = fragment.querySelector(".task-card__title");
  const metaNode = fragment.querySelector(".task-card__meta");
  const ownerNode = fragment.querySelector(".task-card__owner");
  const actionsNode = fragment.querySelector(".task-card__actions");

  card.dataset.taskId = task.id;
  card.classList.add(`task-card--${task.priority}`);
  card.classList.toggle("is-menu-open", state.openTaskMenuId === task.id);

  titleNode.textContent = task.title;

  if (task.showChecklistOnCard && task.checklist.length) {
    const checklistPreview = createChecklistPreview(task);

    if (checklistPreview) {
      titleNode.after(checklistPreview);
    }
  }

  if (task.dueDate) {
    const overdue = isOverdue(task);
    dateNode.textContent = formatDate(task.dueDate);
    dateNode.classList.toggle("is-overdue", overdue);
  } else {
    dateNode.remove();
    headerNode.remove();
  }

  ownerNode.appendChild(createOwnerAvatar(task.owner));

  if (getOpenChecklistCount(task.checklist) > 0) {
    metaNode.appendChild(createIconPill(createCheckedIcon(), getChecklistSummary(task.checklist)));
  }

  if (task.comments.length) {
    const commentCount = task.comments.length;
    metaNode.appendChild(createIconPill(createChatIcon(), String(commentCount)));
  }

  card.addEventListener("click", (event) => {
    if (event.target.closest(".task-card__actions")) {
      return;
    }

    openTaskModal(task);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openTaskModal(task);
    }
  });

  card.addEventListener("dragstart", (event) => {
    draggedTaskId = task.id;
    state.openTaskMenuId = null;
    state.openColumnMenuKey = null;
    setTaskDragImage(event, card);
    card.classList.add("is-dragging");
  });

  card.addEventListener("dragend", () => {
    draggedTaskId = null;
    card.classList.remove("is-dragging");
    clearDropTargets();
  });

  card.addEventListener("dragover", handleTaskCardDragOver);
  card.addEventListener("dragleave", handleTaskCardDragLeave);
  card.addEventListener("drop", handleTaskCardDrop);

  actionsNode.appendChild(createTaskActionMenu(task));

  return fragment;
}

function createTaskActionMenu(task) {
  const wrapper = document.createElement("div");
  wrapper.className = "task-card__menu";
  wrapper.classList.toggle("is-open", state.openTaskMenuId === task.id);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "button button--ghost button--small task-card__menu-toggle";
  toggle.textContent = "...";
  toggle.setAttribute("aria-label", "Card actions");
  toggle.setAttribute("aria-expanded", String(state.openTaskMenuId === task.id));
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    state.openColumnMenuKey = null;
    state.openTaskMenuId = state.openTaskMenuId === task.id ? null : task.id;
    renderBoard();
  });

  const dropdown = document.createElement("div");
  dropdown.className = "task-card__dropdown";
  dropdown.hidden = state.openTaskMenuId !== task.id;

  const cloneButton = document.createElement("button");
  cloneButton.type = "button";
  cloneButton.textContent = "Clone";
  cloneButton.addEventListener("click", (event) => {
    event.stopPropagation();
    state.openTaskMenuId = null;
    openTaskModal(task, { isClone: true });
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "is-danger";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    state.openTaskMenuId = null;
    deleteTask(task.id);
  });

  dropdown.append(cloneButton, deleteButton);
  wrapper.append(toggle, dropdown);
  return wrapper;
}

function createButton(text, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function createIconButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("aria-label", label);
  button.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  `;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function createPill(text) {
  const pill = document.createElement("span");
  pill.className = "task-card__pill";
  pill.textContent = text;
  return pill;
}

function createIconPill(icon, text) {
  const pill = document.createElement("span");
  pill.className = "task-card__pill";
  pill.append(icon, document.createTextNode(text));
  return pill;
}

function createOwnerAvatar(owner) {
  const avatar = document.createElement("span");
  avatar.className = "owner-avatar";
  updateOwnerAvatar(avatar, owner);
  return avatar;
}

function updateOwnerAvatar(avatar, owner) {
  if (!avatar) {
    return;
  }

  const ownerName = String(owner ?? "").trim();
  avatar.classList.toggle("is-unassigned", !ownerName);
  avatar.title = ownerName ? `Owner: ${ownerName}` : "No owner assigned";
  avatar.setAttribute("aria-label", avatar.title);
  avatar.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  `;
}

function createCheckedIcon() {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("class", "task-card__pill-icon");
  icon.innerHTML = `
    <rect x="3" y="3" width="18" height="18" rx="4"></rect>
    <path d="m8 12 3 3 5-6"></path>
  `;
  return icon;
}

function createChatIcon() {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("class", "task-card__pill-icon");
  icon.innerHTML = `
    <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H7l-4 2 1.5-4A8.5 8.5 0 1 1 21 12Z"></path>
  `;
  return icon;
}

function getCardPreviewText(task) {
  if (task.comments.length) {
    const latestComment = task.comments.reduce((latest, comment) =>
      comment.createdAt > latest.createdAt ? comment : latest
    );

    return latestComment.text;
  }

  return task.description || "No description added.";
}

function createChecklistPreview(task) {
  const visibleItems = task.checklist.filter((item) => !item.done);

  if (!visibleItems.length) {
    return null;
  }

  const previewItems = visibleItems.slice(0, 3);
  const list = document.createElement("ul");
  list.className = "task-card__checklist";

  previewItems.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.className = "task-card__checklist-item";

    const checkmark = document.createElement("button");
    checkmark.type = "button";
    checkmark.className = "task-card__checkmark";
    checkmark.textContent = "";
    checkmark.setAttribute("aria-label", `Mark complete: ${item.text}`);
    checkmark.setAttribute("aria-pressed", "false");
    checkmark.addEventListener("click", (event) => {
      event.stopPropagation();
      animateAndCompleteChecklistItem(listItem, task.id, item.id);
    });

    const text = document.createElement("span");
    text.className = "task-card__checklist-text";
    text.textContent = item.text;

    listItem.append(checkmark, text);
    list.appendChild(listItem);
  });

  if (visibleItems.length > previewItems.length) {
    const moreItem = document.createElement("li");
    moreItem.className = "task-card__checklist-more";
    moreItem.textContent = `+${visibleItems.length - previewItems.length} more`;
    list.appendChild(moreItem);
  }

  return list;
}

function animateAndCompleteChecklistItem(listItem, taskId, checklistItemId) {
  listItem.classList.add("is-completing");
  listItem.querySelector(".task-card__checkmark")?.setAttribute("aria-pressed", "true");

  window.setTimeout(() => {
    toggleChecklistItem(taskId, checklistItemId);
  }, 260);
}

function getOpenChecklistCount(checklist) {
  return checklist.filter((item) => !item.done).length;
}

function toggleChecklistItem(taskId, checklistItemId) {
  state.tasks = state.tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    return {
      ...task,
      checklist: task.checklist.map((item) =>
        item.id === checklistItemId ? { ...item, done: !item.done } : item
      ),
    };
  });

  saveTasks();
  render();
}

function fillForm(task, options = {}) {
  const { isClone = false } = options;

  state.editingTaskId = isClone ? null : task.id;
  state.modalTaskStatus = task.status;
  fieldRefs.id.value = isClone ? "" : task.id;
  setInlineTaskTitle(task.title);
  updateOwnerAvatar(taskOwnerAvatar, task.owner);
  fieldRefs.description.value = task.description;
  fieldRefs.dueDate.value = task.dueDate;
  fieldRefs.priority.value = task.priority;
  showChecklistOnCardInput.checked = task.showChecklistOnCard;
  state.modalChecklist = task.checklist.map((item) => cloneChecklistItem(item, { assignNewId: isClone }));
  state.modalComments = task.comments.map((comment) => cloneComment(comment, { assignNewId: isClone }));
  checklistInput.value = "";
  commentInput.value = "";
}

function deleteTask(taskId) {
  const task = findTaskById(taskId);
  const shouldDelete = window.confirm(
    `Delete "${task?.title ?? "this task"}"?`
  );

  if (!shouldDelete) {
    return;
  }

  state.tasks = state.tasks.filter((task) => task.id !== taskId);

  if (state.editingTaskId === taskId) {
    closeTaskModal();
  }

  saveTasks();
  render();
}

function moveTask(taskId, nextStatus) {
  moveTaskToColumnEnd(taskId, nextStatus);
}

function moveTaskToColumnEnd(taskId, nextStatus) {
  const task = findTaskById(taskId);

  if (!task || !nextStatus) {
    return;
  }

  const sourceStatus = task.status;
  const sourceTasks = getManualColumnTasks(sourceStatus).filter((item) => item.id !== taskId);
  const targetTasks =
    sourceStatus === nextStatus
      ? sourceTasks
      : getManualColumnTasks(nextStatus);

  const movedTask = {
    ...task,
    status: nextStatus,
  };

  targetTasks.push(movedTask);
  applyColumnReorder(sourceStatus, sourceTasks, nextStatus, targetTasks);
}

function reorderTaskBeforeTarget(taskId, targetTaskId) {
  const draggedTask = findTaskById(taskId);
  const targetTask = findTaskById(targetTaskId);

  if (!draggedTask || !targetTask || draggedTask.id === targetTask.id) {
    return;
  }

  const sourceStatus = draggedTask.status;
  const targetStatus = targetTask.status;
  const sourceTasks = getManualColumnTasks(sourceStatus).filter((item) => item.id !== taskId);
  const targetTasks =
    sourceStatus === targetStatus
      ? sourceTasks
      : getManualColumnTasks(targetStatus);

  const insertIndex = targetTasks.findIndex((item) => item.id === targetTaskId);
  const movedTask = {
    ...draggedTask,
    status: targetStatus,
  };

  targetTasks.splice(insertIndex < 0 ? targetTasks.length : insertIndex, 0, movedTask);
  applyColumnReorder(sourceStatus, sourceTasks, targetStatus, targetTasks);
}

function applyColumnReorder(sourceStatus, sourceTasks, targetStatus, targetTasks) {
  const updates = new Map();

  sourceTasks.forEach((task, index) => {
    updates.set(task.id, {
      status: sourceStatus,
      order: index + 1,
    });
  });

  targetTasks.forEach((task, index) => {
    updates.set(task.id, {
      status: targetStatus,
      order: index + 1,
    });
  });

  state.tasks = state.tasks.map((task) => {
    const next = updates.get(task.id);

    if (!next) {
      return task;
    }

    return {
      ...task,
      status: next.status,
      order: next.order,
    };
  });

  if (state.editingTaskId && updates.has(state.editingTaskId)) {
    state.modalTaskStatus = updates.get(state.editingTaskId).status;
  }

  saveTasks();
  render();
}

function getManualColumnTasks(status) {
  return state.tasks
    .filter((task) => task.status === status)
    .sort((left, right) => {
      const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || right.createdAt - left.createdAt;
    });
}

function getNextTaskOrder(status) {
  const columnTasks = getManualColumnTasks(status);
  return columnTasks.length + 1;
}

function handleColumnDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add("is-drop-target");

  if (!draggedTaskId || event.target.closest(".task-card")) {
    return;
  }

  const draggedCard = board.querySelector(`.task-card[data-task-id="${draggedTaskId}"]`);
  const listNode = event.currentTarget.querySelector(".kanban-column__list");

  if (draggedCard && listNode && draggedCard.parentElement !== listNode) {
    listNode.appendChild(draggedCard);
  }
}

function handleColumnDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    event.currentTarget.classList.remove("is-drop-target");
  }
}

function handleColumnDrop(event) {
  event.preventDefault();
  const nextStatus = event.currentTarget.dataset.column;
  event.currentTarget.classList.remove("is-drop-target");

  if (!draggedTaskId || !nextStatus) {
    return;
  }

  if (event.target.closest(".task-card")) {
    return;
  }

  persistDraggedTaskOrderFromBoard();
}

function handleTaskCardDragOver(event) {
  event.preventDefault();
  event.stopPropagation();

  if (!draggedTaskId) {
    return;
  }

  const targetCard = event.currentTarget;

  if (targetCard.dataset.taskId === draggedTaskId) {
    return;
  }

  const draggedCard = board.querySelector(`.task-card[data-task-id="${draggedTaskId}"]`);
  const targetList = targetCard.closest(".kanban-column__list");

  if (!draggedCard || !targetList) {
    return;
  }

  const targetRect = targetCard.getBoundingClientRect();
  const insertAfter = event.clientY > targetRect.top + targetRect.height / 2;

  targetList.insertBefore(draggedCard, insertAfter ? targetCard.nextSibling : targetCard);
}

function handleTaskCardDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    event.currentTarget.classList.remove("is-drop-target");
  }
}

function handleTaskCardDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove("is-drop-target");
  persistDraggedTaskOrderFromBoard();
}

function setTaskDragImage(event, card) {
  if (!event.dataTransfer) {
    return;
  }

  const dragImage = card.cloneNode(true);
  const cardRect = card.getBoundingClientRect();
  const offsetX = event.clientX - cardRect.left;
  const offsetY = event.clientY - cardRect.top;
  dragImage.classList.remove("is-dragging", "is-drop-target", "is-menu-open");
  dragImage.style.position = "fixed";
  dragImage.style.top = "-1000px";
  dragImage.style.left = "-1000px";
  dragImage.style.width = `${cardRect.width}px`;
  dragImage.style.pointerEvents = "none";
  dragImage.style.opacity = "1";
  dragImage.style.transform = "none";
  document.body.appendChild(dragImage);
  event.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
  window.setTimeout(() => dragImage.remove(), 0);
}

function clearDropTargets() {
  document
    .querySelectorAll(".kanban-column.is-drop-target, .task-card.is-drop-target")
    .forEach((node) => node.classList.remove("is-drop-target"));
}

function persistDraggedTaskOrderFromBoard() {
  if (!draggedTaskId) {
    return;
  }

  const updates = new Map();

  board.querySelectorAll(".kanban-column").forEach((columnNode) => {
    const status = columnNode.dataset.column;

    columnNode.querySelectorAll(".task-card").forEach((card, index) => {
      updates.set(card.dataset.taskId, {
        status,
        order: index + 1,
      });
    });
  });

  state.tasks = state.tasks.map((task) => {
    const next = updates.get(task.id);

    if (!next) {
      return task;
    }

    return {
      ...task,
      status: next.status,
      order: next.order,
    };
  });

  if (state.editingTaskId && updates.has(state.editingTaskId)) {
    state.modalTaskStatus = updates.get(state.editingTaskId).status;
  }

  saveTasks();
  render();
}

function getFilteredTasks() {
  return state.tasks.filter((task) => {
    const matchesSearch = !state.filters.search
      ? true
      : [
          task.title,
          task.description,
          task.owner,
          task.project,
          ...task.checklist.map((item) => item.text),
          ...task.comments.map((comment) => comment.text),
        ]
          .join(" ")
          .toLowerCase()
          .includes(state.filters.search);

    const matchesPriority =
      state.filters.priority === "all" ? true : task.priority === state.filters.priority;

    return matchesSearch && matchesPriority;
  });
}

function getOverdueTasks() {
  return state.tasks
    .filter(isOverdue)
    .sort((left, right) => {
      const dueDelta = new Date(`${left.dueDate}T00:00:00`) - new Date(`${right.dueDate}T00:00:00`);

      if (dueDelta !== 0) {
        return dueDelta;
      }

      return right.createdAt - left.createdAt;
    });
}

function isOverdue(task) {
  if (!task.dueDate || task.status === "done") {
    return false;
  }

  const today = new Date();
  const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDate = new Date(`${task.dueDate}T00:00:00`);

  return dueDate < todayAtMidnight;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function findTaskById(taskId) {
  return state.tasks.find((task) => task.id === taskId);
}

function addChecklistItem() {
  const text = checklistInput.value.trim();

  if (!text) {
    checklistInput.focus();
    return;
  }

  state.modalChecklist = [
    ...state.modalChecklist,
    { id: generateId(), text, done: false },
  ];
  checklistInput.value = "";
  renderChecklist();
  autoSaveEditingTask();
  checklistInput.focus();
}

function renderChecklist() {
  checklistList.innerHTML = "";

  if (!state.modalChecklist.length) {
    checklistList.appendChild(createEmptyState("No checklist items yet."));
    return;
  }

  state.modalChecklist.forEach((item) => {
    const row = document.createElement("div");
    row.className = "checklist-item";
    row.draggable = true;
    row.dataset.checklistItemId = item.id;

    const dragHandle = document.createElement("span");
    dragHandle.className = "checklist-item__drag-handle";
    dragHandle.setAttribute("aria-hidden", "true");
    dragHandle.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
      <span></span>
      <span></span>
      <span></span>
    `;

    const main = document.createElement("label");
    main.className = "checklist-item__main";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.done;
    checkbox.addEventListener("change", () => {
      state.modalChecklist = state.modalChecklist.map((entry) =>
        entry.id === item.id ? { ...entry, done: checkbox.checked } : entry
      );
      renderChecklist();
      autoSaveEditingTask();
    });

    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.value = item.text;
    textInput.className = "checklist-item__text";
    textInput.maxLength = 120;
    textInput.addEventListener("input", () => {
      state.modalChecklist = state.modalChecklist.map((entry) =>
        entry.id === item.id ? { ...entry, text: textInput.value } : entry
      );
      autoSaveEditingTask();
    });

    const removeButton = createMiniActionButton("Remove checklist item", () => {
      state.modalChecklist = state.modalChecklist.filter((entry) => entry.id !== item.id);
      renderChecklist();
      autoSaveEditingTask();
    });
    const assigneeSlot = document.createElement("span");
    assigneeSlot.className = "checklist-item__assignee-slot";
    assigneeSlot.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    `;
    assigneeSlot.setAttribute("aria-hidden", "true");

    row.addEventListener("dragstart", () => {
      draggedModalChecklistItemId = item.id;
      row.classList.add("is-dragging");
    });

    row.addEventListener("dragend", () => {
      draggedModalChecklistItemId = null;
      row.classList.remove("is-dragging");
      clearModalChecklistDropTargets();
    });

    row.addEventListener("dragover", handleModalChecklistDragOver);
    row.addEventListener("dragleave", handleModalChecklistDragLeave);
    row.addEventListener("drop", handleModalChecklistDrop);

    if (item.done) {
      textInput.classList.add("is-complete");
    }

    main.append(checkbox, textInput);
    row.append(dragHandle, main, assigneeSlot, removeButton);
    checklistList.appendChild(row);
  });
}

function handleModalChecklistDragOver(event) {
  event.preventDefault();

  if (!draggedModalChecklistItemId) {
    return;
  }

  const targetRow = event.currentTarget;

  if (targetRow.dataset.checklistItemId === draggedModalChecklistItemId) {
    return;
  }

  const draggedRow = checklistList.querySelector(
    `.checklist-item[data-checklist-item-id="${draggedModalChecklistItemId}"]`
  );

  if (!draggedRow) {
    return;
  }

  const targetRect = targetRow.getBoundingClientRect();
  const insertAfter = event.clientY > targetRect.top + targetRect.height / 2;
  checklistList.insertBefore(draggedRow, insertAfter ? targetRow.nextSibling : targetRow);
}

function handleModalChecklistDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    event.currentTarget.classList.remove("is-drop-target");
  }
}

function handleModalChecklistDrop(event) {
  event.preventDefault();

  if (!draggedModalChecklistItemId) {
    return;
  }

  persistModalChecklistOrderFromDom();
}

function persistModalChecklistOrderFromDom() {
  const nextOrder = Array.from(checklistList.querySelectorAll(".checklist-item"))
    .map((row) => row.dataset.checklistItemId)
    .filter(Boolean);

  if (!nextOrder.length) {
    return;
  }

  const itemsById = new Map(state.modalChecklist.map((item) => [item.id, item]));
  state.modalChecklist = nextOrder
    .map((id) => itemsById.get(id))
    .filter(Boolean);
  renderChecklist();
  autoSaveEditingTask();
}

function clearModalChecklistDropTargets() {
  checklistList
    .querySelectorAll(".checklist-item.is-drop-target")
    .forEach((item) => item.classList.remove("is-drop-target"));
}

function addComment() {
  const text = commentInput.value.trim();

  if (!text) {
    commentInput.focus();
    return;
  }

  state.modalComments = [
    {
      id: generateId(),
      text,
      createdAt: Date.now(),
    },
    ...state.modalComments,
  ];
  commentInput.value = "";
  renderComments();
  autoSaveEditingTask();
  commentInput.focus();
}

function renderComments() {
  commentsList.innerHTML = "";

  if (!state.modalComments.length) {
    commentsList.appendChild(createEmptyState("No comments yet."));
    return;
  }

  state.modalComments.forEach((comment) => {
    const item = document.createElement("article");
    item.className = "comment-item";

    const header = document.createElement("div");
    header.className = "comment-item__header";

    const timestamp = document.createElement("span");
    timestamp.className = "comment-item__timestamp";
    timestamp.textContent = formatCommentTime(comment.createdAt);

    const removeButton = createMiniActionButton("Remove comment", () => {
      state.modalComments = state.modalComments.filter((entry) => entry.id !== comment.id);
      renderComments();
      autoSaveEditingTask();
    });

    const text = document.createElement("p");
    text.className = "comment-item__text";
    text.textContent = comment.text;

    header.append(timestamp, removeButton);
    item.append(header, text);
    commentsList.appendChild(item);
  });
}

function createEmptyState(text) {
  const emptyState = document.createElement("p");
  emptyState.className = "task-form__empty";
  emptyState.textContent = text;
  return emptyState;
}

function createMiniActionButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button--ghost button--tiny button--icon mini-action-button";
  button.setAttribute("aria-label", label);
  button.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  `;
  button.addEventListener("click", onClick);
  return button;
}

function getChecklistSummary(checklist) {
  const completed = checklist.filter((item) => item.done).length;
  return `${completed}/${checklist.length}`;
}

function normalizeTask(task) {
  return {
    id: task.id ?? generateId(),
    title: String(task.title ?? "").trim(),
    description: String(task.description ?? "").trim(),
    owner: String(task.owner ?? "").trim(),
    project: String(task.project ?? "General").trim() || "General",
    dueDate: task.dueDate ?? "",
    priority: ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium",
    status: COLUMN_CONFIG.some((column) => column.key === task.status) ? task.status : "backlog",
    createdAt: task.createdAt ?? Date.now(),
    order: Number.isFinite(task.order) ? task.order : Number.MAX_SAFE_INTEGER,
    showChecklistOnCard: Boolean(task.showChecklistOnCard),
    checklist: Array.isArray(task.checklist)
      ? task.checklist
          .map(normalizeChecklistItem)
          .filter((item) => item.text)
      : [],
    comments: Array.isArray(task.comments)
      ? task.comments
          .map(normalizeComment)
          .filter((comment) => comment.text)
      : [],
  };
}

function normalizeChecklistItem(item) {
  return {
    id: item?.id ?? generateId(),
    text: String(item?.text ?? "").trim(),
    done: Boolean(item?.done),
  };
}

function normalizeComment(comment) {
  return {
    id: comment?.id ?? generateId(),
    text: String(comment?.text ?? "").trim(),
    createdAt: comment?.createdAt ?? Date.now(),
  };
}

function cloneChecklistItem(item, options = {}) {
  const { assignNewId = false } = options;

  return {
    id: assignNewId ? generateId() : item.id,
    text: item.text,
    done: item.done,
  };
}

function cloneComment(comment, options = {}) {
  const { assignNewId = false } = options;

  return {
    id: assignNewId ? generateId() : comment.id,
    text: comment.text,
    createdAt: comment.createdAt,
  };
}

function formatCommentTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function generateId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
