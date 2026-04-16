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
};

const taskForm = document.querySelector("#task-form");
const submitButton = document.querySelector("#submit-button");
const resetButton = document.querySelector("#reset-button");
const searchInput = document.querySelector("#search-input");
const priorityFilter = document.querySelector("#priority-filter");
const clearFiltersButton = document.querySelector("#clear-filters");
const board = document.querySelector("#kanban-board");
const statsPanel = document.querySelector("#stats-panel");
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
resetButton.addEventListener("click", resetForm);
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
  render();
});

render();

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [...DEFAULT_TASKS];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [...DEFAULT_TASKS];
  } catch (error) {
    console.error("Unable to read planner state:", error);
    return [...DEFAULT_TASKS];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  } catch (error) {
    console.error("Unable to save planner state:", error);
  }
}

function handleTaskSubmit(event) {
  event.preventDefault();

  const task = {
    id: state.editingTaskId ?? generateId(),
    title: fieldRefs.title.value.trim(),
    description: fieldRefs.description.value.trim(),
    owner: fieldRefs.owner.value.trim(),
    dueDate: fieldRefs.dueDate.value,
    priority: fieldRefs.priority.value,
    status: fieldRefs.status.value,
    createdAt: state.editingTaskId
      ? findTaskById(state.editingTaskId)?.createdAt ?? Date.now()
      : Date.now(),
  };

  if (!task.title) {
    fieldRefs.title.focus();
    return;
  }

  if (state.editingTaskId) {
    state.tasks = state.tasks.map((item) => (item.id === task.id ? task : item));
  } else {
    state.tasks = [task, ...state.tasks];
  }

  saveTasks();
  resetForm();
  render();
}

function resetForm() {
  taskForm.reset();
  state.editingTaskId = null;
  fieldRefs.id.value = "";
  fieldRefs.priority.value = "medium";
  fieldRefs.status.value = "backlog";
  submitButton.textContent = "Add task";
}

function render() {
  renderStats();
  renderBoard();
}

function renderStats() {
  if (!statsPanel) {
    return;
  }

  const filteredTasks = getFilteredTasks();
  const doneTasks = state.tasks.filter((task) => task.status === "done").length;
  const progressTasks = state.tasks.filter((task) => task.status === "progress").length;
  const overdueTasks = state.tasks.filter(isOverdue).length;

  const stats = [
    { label: "Tasks", value: filteredTasks.length },
    { label: "In progress", value: progressTasks },
    { label: "Completed", value: doneTasks },
    { label: "Overdue", value: overdueTasks },
  ];

  statsPanel.innerHTML = "";
  stats.forEach((stat) => {
    const card = document.createElement("article");
    card.className = "stat-card";
    card.innerHTML = `
      <span class="stat-card__label">${stat.label}</span>
      <strong class="stat-card__value">${stat.value}</strong>
    `;
    statsPanel.appendChild(card);
  });
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
  descriptionNode.textContent = task.description || "No description added.";

  if (task.dueDate) {
    const overdue = isOverdue(task);
    dateNode.textContent = overdue ? `Overdue: ${formatDate(task.dueDate)}` : `Due: ${formatDate(task.dueDate)}`;
    dateNode.classList.toggle("is-overdue", overdue);
  } else {
    dateNode.textContent = "No due date";
  }

  if (task.owner) {
    metaNode.appendChild(createPill(task.owner));
  }

  metaNode.appendChild(createPill(COLUMN_CONFIG.find((column) => column.key === task.status)?.title ?? task.status));

  card.addEventListener("dragstart", () => {
    draggedTaskId = task.id;
    card.classList.add("is-dragging");
  });

  card.addEventListener("dragend", () => {
    draggedTaskId = null;
    card.classList.remove("is-dragging");
    clearDropTargets();
  });

  const actionButtons = buildTaskActions(task);
  actionButtons.forEach((button) => actionsNode.appendChild(button));

  return fragment;
}

function buildTaskActions(task) {
  const buttons = [];
  const currentIndex = COLUMN_CONFIG.findIndex((column) => column.key === task.status);

  if (currentIndex > 0) {
    buttons.push(
      createButton("Previous", "button button--ghost button--small", () => {
        moveTask(task.id, COLUMN_CONFIG[currentIndex - 1].key);
      })
    );
  }

  if (currentIndex < COLUMN_CONFIG.length - 1) {
    buttons.push(
      createButton("Next", "button button--ghost button--small", () => {
        moveTask(task.id, COLUMN_CONFIG[currentIndex + 1].key);
      })
    );
  }

  buttons.push(
    createButton("Edit", "button button--ghost button--small", () => {
      fillForm(task);
    })
  );

  buttons.push(
    createButton("Delete", "button button--danger button--small", () => {
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
  button.addEventListener("click", onClick);
  return button;
}

function createPill(text) {
  const pill = document.createElement("span");
  pill.className = "task-card__pill";
  pill.textContent = text;
  return pill;
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
  submitButton.textContent = "Update task";
  fieldRefs.title.focus();
}

function deleteTask(taskId) {
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  if (state.editingTaskId === taskId) {
    resetForm();
  }
  saveTasks();
  render();
}

function moveTask(taskId, nextStatus) {
  state.tasks = state.tasks.map((task) =>
    task.id === taskId ? { ...task, status: nextStatus } : task
  );
  if (state.editingTaskId === taskId) {
    const currentTask = findTaskById(taskId);
    if (currentTask) {
      fieldRefs.status.value = currentTask.status;
    }
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
      : [task.title, task.description, task.owner]
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

function generateId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
