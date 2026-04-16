const STORAGE_KEY = "flowboard-planner-state";

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
    dueDate: "",
    priority: "high",
    status: "todo",
    createdAt: Date.now(),
  },
  {
    id: generateId(),
    title: "Update project board",
    description: "Move current tasks to reflect the real project status.",
    owner: "Product Team",
    dueDate: "",
    priority: "medium",
    status: "progress",
    createdAt: Date.now() + 1,
  },
  {
    id: generateId(),
    title: "Archive completed items",
    description: "Clean up the board and keep only relevant finished work.",
    owner: "Admin",
    dueDate: "",
    priority: "low",
    status: "done",
    createdAt: Date.now() + 2,
  },
];

const state = {
  tasks: loadTasks(),
  filters: {
    search: "",
    priority: "all",
  },
  editingTaskId: null,
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
const openTaskModalButton = document.querySelector("#open-task-modal");
const closeTaskModalButton = document.querySelector("#close-task-modal");
const taskModal = document.querySelector("#task-modal");
const taskModalTitle = document.querySelector("#task-modal-title");
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
  owner: document.querySelector("#task-owner"),
  dueDate: document.querySelector("#task-due-date"),
  priority: document.querySelector("#task-priority"),
  status: document.querySelector("#task-status"),
};

let draggedTaskId = null;

taskForm.addEventListener("submit", handleTaskSubmit);
resetButton.addEventListener("click", closeTaskModal);
openTaskModalButton.addEventListener("click", () => openTaskModal());
closeTaskModalButton.addEventListener("click", closeTaskModal);
addChecklistItemButton.addEventListener("click", addChecklistItem);
addCommentButton.addEventListener("click", addComment);

[fieldRefs.title, fieldRefs.description, fieldRefs.owner, fieldRefs.dueDate].forEach((field) => {
  field.addEventListener("input", autoSaveEditingTask);
});

[fieldRefs.priority, fieldRefs.status, showChecklistOnCardInput].forEach((field) => {
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
  setFiltersOpen(false);
  render();
});

filtersToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  setFiltersOpen(filtersPanel.hidden);
});

document.addEventListener("click", (event) => {
  if (!filtersMenu.contains(event.target)) {
    setFiltersOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setFiltersOpen(false);

    if (!taskModal.hidden) {
      closeTaskModal();
    }
  }
});

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

function buildTaskFromForm(fallbackTask) {
  return normalizeTask({
    id: state.editingTaskId ?? generateId(),
    title: fieldRefs.title.value.trim() || fallbackTask?.title || "",
    description: fieldRefs.description.value.trim(),
    owner: fieldRefs.owner.value.trim(),
    dueDate: fieldRefs.dueDate.value,
    priority: fieldRefs.priority.value,
    status: fieldRefs.status.value,
    createdAt: state.editingTaskId ? fallbackTask?.createdAt ?? Date.now() : Date.now(),
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

  const currentTask = findTaskById(state.editingTaskId);

  if (!currentTask) {
    return;
  }

  upsertTask(buildTaskFromForm(currentTask));
}

function handleTaskSubmit(event) {
  event.preventDefault();

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

function resetForm() {
  taskForm.reset();
  state.editingTaskId = null;
  state.modalChecklist = [];
  state.modalComments = [];
  fieldRefs.id.value = "";
  fieldRefs.priority.value = "medium";
  fieldRefs.status.value = "backlog";
  showChecklistOnCardInput.checked = false;
  checklistInput.value = "";
  commentInput.value = "";
  renderModalCollections();
}

function openTaskModal(task) {
  if (task) {
    fillForm(task);
    taskModalTitle.textContent = "Edit Activity";
    submitButton.hidden = true;
    resetButton.textContent = "Close";
  } else {
    resetForm();
    taskModalTitle.textContent = "New Activity";
    submitButton.hidden = false;
    submitButton.textContent = "Create task";
    resetButton.textContent = "Cancel";
  }

  renderModalCollections();
  taskModal.hidden = false;
  document.body.classList.add("modal-open");
  fieldRefs.title.focus();
}

function closeTaskModal() {
  taskModal.hidden = true;
  document.body.classList.remove("modal-open");
  resetForm();
}

function setFiltersOpen(isOpen) {
  filtersPanel.hidden = !isOpen;
  filtersToggle.setAttribute("aria-expanded", String(isOpen));
}

function render() {
  renderBoard();
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
    const subtitleNode = fragment.querySelector(".kanban-column__subtitle");
    const countNode = fragment.querySelector(".kanban-column__count");
    const listNode = fragment.querySelector(".kanban-column__list");

    const columnTasks = filteredTasks
      .filter((task) => task.status === column.key)
      .sort((left, right) => right.createdAt - left.createdAt);

    columnNode.dataset.column = column.key;
    titleNode.textContent = column.title;
    subtitleNode.textContent = column.subtitle;
    countNode.textContent = String(columnTasks.length);

    columnNode.addEventListener("dragover", handleColumnDragOver);
    columnNode.addEventListener("dragleave", handleColumnDragLeave);
    columnNode.addEventListener("drop", handleColumnDrop);

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

function createTaskCard(task) {
  const fragment = taskTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".task-card");
  const priorityNode = fragment.querySelector(".task-card__priority");
  const dateNode = fragment.querySelector(".task-card__date");
  const titleNode = fragment.querySelector(".task-card__title");
  const descriptionNode = fragment.querySelector(".task-card__description");
  const metaNode = fragment.querySelector(".task-card__meta");
  const actionsNode = fragment.querySelector(".task-card__actions");

  card.dataset.taskId = task.id;
  card.classList.add(`task-card--${task.priority}`);

  priorityNode.textContent = `${task.priority} priority`;
  priorityNode.classList.add(`priority-${task.priority}`);

  titleNode.textContent = task.title;
  descriptionNode.textContent = getCardPreviewText(task);

  if (task.showChecklistOnCard && task.checklist.length) {
    const checklistPreview = createChecklistPreview(task);

    if (checklistPreview) {
      descriptionNode.after(checklistPreview);
    }
  }

  if (task.dueDate) {
    const overdue = isOverdue(task);
    dateNode.textContent = overdue
      ? `Overdue: ${formatDate(task.dueDate)}`
      : formatDate(task.dueDate);
    dateNode.classList.toggle("is-overdue", overdue);
  } else {
    dateNode.remove();
  }

  if (task.owner) {
    metaNode.appendChild(createPill(task.owner));
  }

  metaNode.appendChild(
    createPill(COLUMN_CONFIG.find((column) => column.key === task.status)?.title ?? task.status)
  );

  if (task.checklist.length) {
    metaNode.appendChild(createPill(getChecklistSummary(task.checklist)));
  }

  if (task.comments.length) {
    const commentCount = task.comments.length;
    metaNode.appendChild(createPill(`${commentCount} comment${commentCount === 1 ? "" : "s"}`));
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

  card.addEventListener("dragstart", () => {
    draggedTaskId = task.id;
    card.classList.add("is-dragging");
  });

  card.addEventListener("dragend", () => {
    draggedTaskId = null;
    card.classList.remove("is-dragging");
    clearDropTargets();
  });

  buildTaskActions(task).forEach((button) => actionsNode.appendChild(button));

  return fragment;
}

function buildTaskActions(task) {
  const buttons = [];

  buttons.push(
    createIconButton("Delete task", "button button--danger button--small button--icon", () => {
      deleteTask(task.id);
    })
  );

  return buttons;
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
      toggleChecklistItem(task.id, item.id);
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

function fillForm(task) {
  state.editingTaskId = task.id;
  fieldRefs.id.value = task.id;
  fieldRefs.title.value = task.title;
  fieldRefs.description.value = task.description;
  fieldRefs.owner.value = task.owner;
  fieldRefs.dueDate.value = task.dueDate;
  fieldRefs.priority.value = task.priority;
  fieldRefs.status.value = task.status;
  showChecklistOnCardInput.checked = task.showChecklistOnCard;
  state.modalChecklist = task.checklist.map(cloneChecklistItem);
  state.modalComments = task.comments.map(cloneComment);
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
  state.tasks = state.tasks.map((task) =>
    task.id === taskId ? { ...task, status: nextStatus } : task
  );

  if (state.editingTaskId === taskId) {
    fieldRefs.status.value = nextStatus;
  }

  saveTasks();
  render();
}

function handleColumnDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add("is-drop-target");
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

  moveTask(draggedTaskId, nextStatus);
}

function clearDropTargets() {
  document
    .querySelectorAll(".kanban-column.is-drop-target")
    .forEach((column) => column.classList.remove("is-drop-target"));
}

function getFilteredTasks() {
  return state.tasks.filter((task) => {
    const matchesSearch = !state.filters.search
      ? true
      : [
          task.title,
          task.description,
          task.owner,
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

    const removeButton = createMiniActionButton("Remove checklist item", "Remove", () => {
      state.modalChecklist = state.modalChecklist.filter((entry) => entry.id !== item.id);
      renderChecklist();
      autoSaveEditingTask();
    });

    if (item.done) {
      textInput.classList.add("is-complete");
    }

    main.append(checkbox, textInput);
    row.append(main, removeButton);
    checklistList.appendChild(row);
  });
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

    const removeButton = createMiniActionButton("Remove comment", "Remove", () => {
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

function createMiniActionButton(label, text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button--ghost button--tiny";
  button.setAttribute("aria-label", label);
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function getChecklistSummary(checklist) {
  const completed = checklist.filter((item) => item.done).length;
  return `${completed}/${checklist.length} done`;
}

function normalizeTask(task) {
  return {
    id: task.id ?? generateId(),
    title: String(task.title ?? "").trim(),
    description: String(task.description ?? "").trim(),
    owner: String(task.owner ?? "").trim(),
    dueDate: task.dueDate ?? "",
    priority: ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium",
    status: COLUMN_CONFIG.some((column) => column.key === task.status) ? task.status : "backlog",
    createdAt: task.createdAt ?? Date.now(),
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

function cloneChecklistItem(item) {
  return {
    id: item.id,
    text: item.text,
    done: item.done,
  };
}

function cloneComment(comment) {
  return {
    id: comment.id,
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
