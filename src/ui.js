(function (window, document) {
  const App = window.MentoringWorkspace = window.MentoringWorkspace || {};
  const { Config, Data, Providers, Utils } = App;

  const state = {
    data: null,
    taskFilter: "all",
    timeline: {
      query: "",
      type: "all",
      person: "all",
      status: "all",
      date: "all",
    },
    editingTaskId: "",
    provider: null,
    busy: false,
  };

  const els = {};

  function init() {
    cacheElements();
    state.provider = Providers.createProvider();
    bindEvents();
    loadState();
  }

  function cacheElements() {
    Object.assign(els, {
      projectTitle: document.querySelector("#projectTitle"),
      peopleSummary: document.querySelector("#peopleSummary"),
      settingsButton: document.querySelector("#settingsButton"),
      dailyLogForm: document.querySelector("#dailyLogForm"),
      logDate: document.querySelector("#logDate"),
      submitLogButton: document.querySelector("#submitLogButton"),
      clearLogButton: document.querySelector("#clearLogButton"),
      newTaskTitle: document.querySelector("#newTaskTitle"),
      newTaskAssignee: document.querySelector("#newTaskAssignee"),
      newTaskStatus: document.querySelector("#newTaskStatus"),
      newTaskScheduledDate: document.querySelector("#newTaskScheduledDate"),
      newTaskDeadline: document.querySelector("#newTaskDeadline"),
      addTaskButton: document.querySelector("#addTaskButton"),
      taskStatusFilter: document.querySelector("#taskStatusFilter"),
      statusSummary: document.querySelector("#statusSummary"),
      taskList: document.querySelector("#taskList"),
      timelineSearch: document.querySelector("#timelineSearch"),
      timelineTypeFilter: document.querySelector("#timelineTypeFilter"),
      timelinePersonFilter: document.querySelector("#timelinePersonFilter"),
      timelineStatusFilter: document.querySelector("#timelineStatusFilter"),
      timelineDateFilter: document.querySelector("#timelineDateFilter"),
      timelineSummary: document.querySelector("#timelineSummary"),
      timelineList: document.querySelector("#timelineList"),
      syncMode: document.querySelector("#syncMode"),
      docLink: document.querySelector("#docLink"),
      docStatus: document.querySelector("#docStatus"),
      sheetLink: document.querySelector("#sheetLink"),
      sheetStatus: document.querySelector("#sheetStatus"),
      syncNowButton: document.querySelector("#syncNowButton"),
      taskDialog: document.querySelector("#taskDialog"),
      taskForm: document.querySelector("#taskForm"),
      taskDialogTitle: document.querySelector("#taskDialogTitle"),
      taskTitleInput: document.querySelector("#taskTitleInput"),
      taskAssigneeInput: document.querySelector("#taskAssigneeInput"),
      taskStatusInput: document.querySelector("#taskStatusInput"),
      taskScheduledDateInput: document.querySelector("#taskScheduledDateInput"),
      taskDeadlineInput: document.querySelector("#taskDeadlineInput"),
      closeTaskDialogButton: document.querySelector("#closeTaskDialogButton"),
      cancelTaskButton: document.querySelector("#cancelTaskButton"),
      settingsDialog: document.querySelector("#settingsDialog"),
      settingsMode: document.querySelector("#settingsMode"),
      settingsLastSync: document.querySelector("#settingsLastSync"),
      exportButton: document.querySelector("#exportButton"),
      resetButton: document.querySelector("#resetButton"),
      peopleOptions: document.querySelector("#peopleOptions"),
      toast: document.querySelector("#toast"),
    });
  }

  function bindEvents() {
    els.dailyLogForm.addEventListener("submit", submitDailyLog);
    els.clearLogButton.addEventListener("click", clearDailyForm);
    els.addTaskButton.addEventListener("click", addTask);
    els.newTaskTitle.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addTask();
      }
    });

    els.taskStatusFilter.addEventListener("input", () => {
      state.taskFilter = els.taskStatusFilter.value;
      renderTasks();
    });

    [
      els.timelineSearch,
      els.timelineTypeFilter,
      els.timelinePersonFilter,
      els.timelineStatusFilter,
      els.timelineDateFilter,
    ].forEach((control) => control.addEventListener("input", updateTimelineFilters));

    els.syncNowButton.addEventListener("click", () => loadState("Synced"));
    els.settingsButton.addEventListener("click", () => {
      renderSettings();
      els.settingsDialog.showModal();
    });
    els.exportButton.addEventListener("click", exportJson);
    els.resetButton.addEventListener("click", resetLocalData);
    els.taskForm.addEventListener("submit", saveTaskFromDialog);
    els.closeTaskDialogButton.addEventListener("click", closeTaskDialog);
    els.cancelTaskButton.addEventListener("click", closeTaskDialog);
  }

  async function loadState(successMessage = "") {
    await runAction(successMessage ? "Syncing..." : "", async () => {
      state.data = Data.normalizeData(await state.provider.loadState());
      els.logDate.value = Utils.todayInput();
      render();
      if (successMessage) showToast(successMessage);
    });
  }

  function render() {
    if (!state.data) return;
    renderProject();
    renderPeopleOptions();
    renderTasks();
    renderTimeline();
    renderSync();
    renderSettings();
  }

  function renderProject() {
    const { project } = state.data;
    const people = Data.getPeople(state.data).slice(0, 4);
    els.projectTitle.textContent = project.title;
    els.peopleSummary.textContent = people.join(" / ");
  }

  function renderPeopleOptions() {
    const people = Data.getPeople(state.data);
    els.peopleOptions.replaceChildren(
      ...people.map((person) => {
        const option = document.createElement("option");
        option.value = person;
        return option;
      })
    );

    const selectedPerson = els.timelinePersonFilter.value || "all";
    els.timelinePersonFilter.replaceChildren(
      option("all", "All"),
      ...people.map((person) => option(person, person))
    );
    els.timelinePersonFilter.value = people.includes(selectedPerson) ? selectedPerson : "all";

    if (!els.newTaskAssignee.value) els.newTaskAssignee.value = state.data.project.mentee;
  }

  function option(value, label) {
    const item = document.createElement("option");
    item.value = value;
    item.textContent = label;
    return item;
  }

  function renderTasks() {
    const tasks = state.data.tasks
      .filter((task) => matchesTaskFilter(task, state.taskFilter))
      .sort(sortTasks);

    const counts = countTasks();
    els.statusSummary.textContent = `${counts.not_started} not started / ${counts.in_progress} in progress / ${counts.waiting} waiting / ${counts.blocked} blocked / ${counts.done} done`;

    if (!tasks.length) {
      els.taskList.innerHTML = `<p class="empty-state">No tasks in this view.</p>`;
      return;
    }

    els.taskList.replaceChildren(...tasks.map(renderTaskRow));
  }

  function renderTaskRow(task) {
    const row = document.createElement("article");
    row.className = "task-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.status === "done";
    checkbox.setAttribute("aria-label", `Mark ${task.title} done`);
    checkbox.addEventListener("change", () => {
      updateTask({ ...task, status: checkbox.checked ? "done" : "in_progress" });
    });

    const titleWrap = document.createElement("div");
    titleWrap.className = "task-title";
    const titleButton = document.createElement("button");
    titleButton.className = "task-title-button";
    titleButton.type = "button";
    titleButton.textContent = task.title;
    titleButton.addEventListener("click", () => openTaskDialog(task.id));
    const meta = document.createElement("span");
    meta.className = "task-meta";
    meta.textContent = taskMeta(task);
    titleWrap.append(titleButton, meta, renderTaskDatePair(task));

    const status = document.createElement("select");
    status.className = `status-select ${task.status}`;
    status.setAttribute("aria-label", `Status for ${task.title}`);
    Object.entries(Config.statusLabels).forEach(([value, label]) => status.append(option(value, label)));
    status.value = task.status;
    status.addEventListener("change", () => updateTask({ ...task, status: status.value }));

    const edit = document.createElement("button");
    edit.className = "secondary-button compact-button";
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => openTaskDialog(task.id));

    const remove = document.createElement("button");
    remove.className = "delete-task";
    remove.type = "button";
    remove.textContent = "x";
    remove.setAttribute("aria-label", `Delete ${task.title}`);
    remove.addEventListener("click", () => deleteTask(task));

    row.append(checkbox, titleWrap, status, edit, remove);
    return row;
  }

  function renderTaskDatePair(task) {
    const wrap = document.createElement("span");
    wrap.className = "date-pair";

    if (!task.scheduledDate && !task.deadline) {
      const chip = document.createElement("span");
      chip.className = "date-chip empty";
      chip.textContent = "No dates";
      wrap.append(chip);
      return wrap;
    }

    if (task.scheduledDate) {
      const chip = document.createElement("span");
      chip.className = "date-chip do-date";
      chip.textContent = `Do ${Utils.formatShortDate(task.scheduledDate)}`;
      wrap.append(chip);
    }

    if (task.deadline) {
      const chip = document.createElement("span");
      chip.className = "date-chip deadline";
      chip.textContent = `Due ${Utils.formatShortDate(task.deadline)}`;
      wrap.append(chip);
    }

    return wrap;
  }

  function taskMeta(task) {
    const parts = [taskCode(task), `${task.owner || "Unassigned"}`];
    if (!task.scheduledDate && !task.deadline) parts.push("No dates");
    return parts.join(" / ");
  }

  function matchesTaskFilter(task, filter) {
    if (filter === "all") return true;
    if (filter === "active") return task.status !== "done";
    return task.status === filter;
  }

  function taskCode(task) {
    const raw = String(task.id || task.title || "task").replace(/[^a-z0-9]/gi, "");
    return `#${raw.slice(-4).toUpperCase().padStart(4, "0")}`;
  }

  function timelineTaskText(task, dateKind) {
    const pairedDate = dateKind === "do" && task.deadline
      ? `Due ${Utils.formatShortDate(task.deadline)}`
      : dateKind === "deadline" && task.scheduledDate
        ? `Do ${Utils.formatShortDate(task.scheduledDate)}`
        : "";
    return [
      task.owner || "Unassigned",
      Config.statusLabels[task.status],
      pairedDate,
    ].filter(Boolean).join(" / ");
  }

  function renderTimeline() {
    const items = getFilteredTimelineItems();
    els.timelineSummary.textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;

    if (!items.length) {
      els.timelineList.innerHTML = `<p class="empty-state">No timeline items match these filters.</p>`;
      return;
    }

    const groups = groupByDate(items);
    els.timelineList.replaceChildren(...groups.map(renderTimelineGroup));
  }

  function getFilteredTimelineItems() {
    return buildTimelineItems()
      .filter((item) => state.timeline.type === "all" || item.type === state.timeline.type)
      .filter((item) => state.timeline.person === "all" || item.person === state.timeline.person)
      .filter((item) => state.timeline.status === "all" || item.status === state.timeline.status)
      .filter((item) => matchesDateFilter(item))
      .filter((item) => {
        const query = state.timeline.query;
        if (!query) return true;
        return [item.title, item.text, item.person, item.label].some((value) => Utils.includesText(value, query));
      })
      .sort((a, b) => sortDateKey(a.date).localeCompare(sortDateKey(b.date)) || a.title.localeCompare(b.title));
  }

  function buildTimelineItems() {
    const items = [];
    state.data.dailyLogs.forEach((log) => {
      const sections = [log.workedOn, log.notes, log.blockers, log.nextStep].filter(Boolean).join(" ");
      items.push({
        id: log.id,
        type: "log",
        date: log.date,
        label: "Entry",
        title: "Daily entry",
        text: sections || "Entry saved.",
        person: "",
        status: "entry",
      });
    });

    state.data.tasks.forEach((task) => {
      const dates = [];
      if (task.scheduledDate) dates.push({ date: task.scheduledDate, kind: "do", label: "Do" });
      if (task.deadline) dates.push({ date: task.deadline, kind: "deadline", label: "Due" });
      if (!dates.length) dates.push({ date: "", kind: "unscheduled", label: "Unscheduled" });

      dates.forEach((date) => {
        items.push({
          id: `${task.id}-${date.kind}`,
          type: "task",
          date: date.date,
          dateKind: date.kind,
          label: date.label,
          title: task.title,
          text: timelineTaskText(task, date.kind),
          person: task.owner || "Unassigned",
          status: task.status,
          task,
        });
      });
    });

    return items;
  }

  function matchesDateFilter(item) {
    const filter = state.timeline.date;
    if (filter === "all") return true;
    if (filter === "unscheduled") return !item.date;
    if (!item.date) return false;

    const today = Utils.stripTime(new Date());
    const itemDate = Utils.parseDate(item.date);
    if (!itemDate) return false;
    if (filter === "today") return item.date === Utils.toDateInput(today);
    if (filter === "upcoming") return itemDate >= today;
    if (filter === "overdue") return item.type === "task" && item.status !== "done" && itemDate < today;
    return true;
  }

  function groupByDate(items) {
    const map = new Map();
    items.forEach((item) => {
      const key = item.date || "__unscheduled";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return Array.from(map.entries()).map(([date, groupItems]) => ({ date, items: groupItems }));
  }

  function renderTimelineGroup(group) {
    const section = document.createElement("section");
    section.className = "timeline-day";

    const heading = document.createElement("h3");
    heading.textContent = group.date === "__unscheduled" ? "Unscheduled" : Utils.formatLongDate(group.date);
    section.append(heading);

    const list = document.createElement("div");
    list.className = "timeline-items";
    list.replaceChildren(...group.items.map(renderTimelineItem));
    section.append(list);
    return section;
  }

  function renderTimelineItem(item) {
    const article = document.createElement("article");
    article.className = `timeline-item ${item.type} ${item.dateKind || ""}`;

    const badge = document.createElement("span");
    badge.className = `timeline-badge ${item.type} ${item.status} ${item.dateKind || ""}`;
    badge.textContent = item.type === "task" ? item.label : item.label;

    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.type === "task" ? `${taskCode(item.task)} ${item.title}` : item.title;
    const text = document.createElement("p");
    text.textContent = item.text;
    body.append(title, text);
    article.append(badge, body);

    if (item.type === "task") {
      const edit = document.createElement("button");
      edit.className = "secondary-button compact-button";
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => openTaskDialog(item.task.id));
      article.append(edit);
    }

    return article;
  }

  function renderSync() {
    const sync = state.data.sync || {};
    els.syncMode.textContent = state.provider.mode === "google" ? "Google Drive connected" : "Local preview";
    setSyncLink(els.docLink, els.docStatus, sync.docUrl, sync.docName || "Not connected");
    setSyncLink(els.sheetLink, els.sheetStatus, sync.sheetUrl, sync.sheetName || "Not connected");
  }

  function setSyncLink(link, status, url, label) {
    status.textContent = label;
    if (url) {
      link.href = url;
      link.removeAttribute("aria-disabled");
    } else {
      link.href = "#";
      link.setAttribute("aria-disabled", "true");
    }
  }

  function renderSettings() {
    if (!state.data) return;
    els.settingsMode.textContent = state.provider.mode === "google" ? "Google Apps Script" : "Local preview";
    els.settingsLastSync.textContent = Utils.formatDateTime(state.data.sync?.lastSync);
  }

  async function submitDailyLog(event) {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(els.dailyLogForm).entries());
    const hasContent = ["workedOn", "notes", "blockers", "nextStep"].some((key) => formData[key]?.trim());
    if (!hasContent) {
      showToast("Add at least one note before submitting");
      return;
    }

    const log = {
      id: Utils.createId("log"),
      date: formData.date,
      workedOn: formData.workedOn.trim(),
      notes: formData.notes.trim(),
      blockers: formData.blockers.trim(),
      nextStep: formData.nextStep.trim(),
      createdAt: new Date().toISOString(),
    };

    await runAction("Submitting...", async () => {
      state.data = Data.normalizeData(await state.provider.submitDailyLog(log));
      clearDailyForm();
      render();
      showToast(state.provider.mode === "google" ? "Submitted to Google Doc" : "Saved locally");
    });
  }

  async function addTask() {
    const title = els.newTaskTitle.value.trim();
    if (!title) {
      showToast("Add a task title");
      return;
    }

    const task = {
      id: Utils.createId("task"),
      title,
      status: els.newTaskStatus.value,
      owner: els.newTaskAssignee.value.trim() || state.data.project.mentee,
      scheduledDate: els.newTaskScheduledDate.value,
      deadline: els.newTaskDeadline.value,
      updatedAt: new Date().toISOString(),
    };

    await updateTask(task, "Task added");
    els.newTaskTitle.value = "";
    els.newTaskStatus.value = "not_started";
    els.newTaskScheduledDate.value = "";
    els.newTaskDeadline.value = "";
  }

  async function updateTask(task, message = "Task updated") {
    await runAction("Saving task...", async () => {
      state.data = Data.normalizeData(await state.provider.upsertTask({ ...task, updatedAt: new Date().toISOString() }));
      render();
      showToast(message);
    });
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete "${task.title}" from the task list?`)) return;
    await runAction("Deleting task...", async () => {
      state.data = Data.normalizeData(await state.provider.deleteTask(task.id));
      render();
      showToast("Task deleted");
    });
  }

  function openTaskDialog(taskId) {
    const task = state.data.tasks.find((item) => item.id === taskId);
    if (!task) return;
    state.editingTaskId = taskId;
    els.taskDialogTitle.textContent = task.title;
    els.taskTitleInput.value = task.title;
    els.taskAssigneeInput.value = task.owner || "";
    els.taskStatusInput.value = task.status;
    els.taskScheduledDateInput.value = task.scheduledDate || "";
    els.taskDeadlineInput.value = task.deadline || "";
    els.taskDialog.showModal();
  }

  function closeTaskDialog() {
    state.editingTaskId = "";
    els.taskDialog.close();
  }

  async function saveTaskFromDialog(event) {
    event.preventDefault();
    const existing = state.data.tasks.find((task) => task.id === state.editingTaskId);
    if (!existing) return;
    const updated = {
      ...existing,
      title: els.taskTitleInput.value.trim(),
      owner: els.taskAssigneeInput.value.trim() || "Unassigned",
      status: els.taskStatusInput.value,
      scheduledDate: els.taskScheduledDateInput.value,
      deadline: els.taskDeadlineInput.value,
    };
    if (!updated.title) {
      showToast("Task title is required");
      return;
    }
    await updateTask(updated);
    closeTaskDialog();
  }

  function updateTimelineFilters() {
    state.timeline = {
      query: els.timelineSearch.value.trim(),
      type: els.timelineTypeFilter.value,
      person: els.timelinePersonFilter.value,
      status: els.timelineStatusFilter.value,
      date: els.timelineDateFilter.value,
    };
    renderTimeline();
  }

  function clearDailyForm() {
    els.dailyLogForm.reset();
    els.logDate.value = Utils.todayInput();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mentoring-workspace.json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function resetLocalData() {
    if (state.provider.mode !== "local") {
      showToast("Reset is only available in local preview");
      return;
    }
    if (!window.confirm("Reset local data to the starter plan?")) return;
    localStorage.removeItem(Config.storageKey);
    loadState("Local data reset");
  }

  async function runAction(label, action) {
    if (state.busy) return;
    state.busy = true;
    setBusy(true, label);
    try {
      await action();
    } catch (error) {
      showToast(error.message || "Something went wrong");
    } finally {
      state.busy = false;
      setBusy(false);
    }
  }

  function setBusy(isBusy, label = "") {
    [
      els.submitLogButton,
      els.addTaskButton,
      els.syncNowButton,
    ].forEach((button) => {
      if (button) button.disabled = isBusy;
    });
    if (isBusy && label) showToast(label);
  }

  function countTasks() {
    return state.data.tasks
      .reduce(
        (counts, taskItem) => {
          counts[taskItem.status] += 1;
          return counts;
        },
        { not_started: 0, in_progress: 0, waiting: 0, blocked: 0, done: 0 }
      );
  }

  function sortTasks(a, b) {
    return statusRank(a.status) - statusRank(b.status)
      || dateRank(a.scheduledDate || a.deadline).localeCompare(dateRank(b.scheduledDate || b.deadline))
      || a.title.localeCompare(b.title);
  }

  function statusRank(status) {
    return { blocked: 0, waiting: 1, in_progress: 2, not_started: 3, done: 4 }[status] ?? 5;
  }

  function dateRank(value) {
    return value || "9999-99-99";
  }

  function sortDateKey(value) {
    return value || "9999-99-99";
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("visible"), 2400);
  }

  App.UI = {
    init,
  };
})(window, document);
