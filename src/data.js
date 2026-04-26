(function (window) {
  const App = window.MentoringWorkspace = window.MentoringWorkspace || {};
  const { Config, Utils } = App;

  function normalizeData(data) {
    const fallback = createDefaultData();
    const source = data && typeof data === "object" ? data : {};
    const project = normalizeProject(source.project || fallback.project);
    const tasks = Array.isArray(source.tasks) ? source.tasks.map(normalizeTask).filter((task) => task.title) : fallback.tasks;
    const dailyLogs = Array.isArray(source.dailyLogs) ? source.dailyLogs.map(normalizeLog).filter((log) => log.date) : [];
    const people = Utils.unique([...(project.people || []), ...tasks.map((task) => task.owner)]);

    return {
      version: 4,
      project: {
        ...project,
        people: people.length ? people : Config.defaults.people,
      },
      tasks,
      dailyLogs,
      sync: {
        mode: "local",
        docName: Config.defaults.docName,
        docUrl: "",
        sheetName: Config.defaults.sheetName,
        sheetUrl: "",
        lastSync: "",
        ...(source.sync || {}),
      },
    };
  }

  function normalizeProject(project) {
    const title = sanitizePublicLabel(project.title, Config.defaults.title);
    const mentor = sanitizePublicLabel(project.mentor, Config.defaults.mentor);
    const mentee = sanitizePublicLabel(project.mentee || project.intern, Config.defaults.mentee);
    const people = Array.isArray(project.people) ? project.people : [mentor, mentee];

    return {
      title,
      mentor,
      mentee,
      people: Utils.unique(people.map((person) => sanitizePublicLabel(person, ""))).concat(
        Config.defaults.people.filter((person) => !people.includes(person))
      ),
      startDate: Utils.isDateInput(project.startDate) ? project.startDate : Config.defaults.startDate,
    };
  }

  function sanitizePublicLabel(value, fallback) {
    const text = String(value || "").trim();
    if (!text) return fallback;
    return text;
  }

  function normalizeTask(task) {
    const normalizedStatus = Config.statusAliases[task.status] || task.status;
    const status = Config.statusLabels[normalizedStatus] ? normalizedStatus : "not_started";
    const scheduledDate = task.scheduledDate || task.doDate;
    return {
      id: task.id || Utils.createId("task"),
      title: String(task.title || "").trim(),
      status,
      owner: String(task.owner || task.assignee || Config.defaults.mentee).trim(),
      scheduledDate: Utils.isDateInput(scheduledDate) ? scheduledDate : "",
      deadline: Utils.isDateInput(task.deadline) ? task.deadline : "",
      updatedAt: task.updatedAt || new Date().toISOString(),
    };
  }

  function normalizeLog(log) {
    const figures = normalizeFigures(log);
    const firstFigure = figures[0] || {};
    const figureDescription = String(log.figureDescription || firstFigure.description || "").trim();

    return {
      id: log.id || Utils.createId("log"),
      date: Utils.isDateInput(log.date) ? log.date : Utils.todayInput(),
      workedOn: String(log.workedOn || "").trim(),
      notes: String(log.notes || "").trim(),
      blockers: String(log.blockers || "").trim(),
      nextStep: String(log.nextStep || "").trim(),
      createdAt: log.createdAt || new Date().toISOString(),
      figureName: String(log.figureName || firstFigure.name || "").trim(),
      figureDescription,
      figureNames: String(log.figureNames || figures.map((figure) => figure.name).filter(Boolean).join("\n")).trim(),
      figureDescriptions: String(log.figureDescriptions || figureDescription).trim(),
      figures,
    };
  }

  function normalizeFigures(log) {
    const source = Array.isArray(log.figures) && log.figures.length
      ? log.figures
      : log.figureName || log.figureDescription
        ? [{
            name: log.figureName,
            description: log.figureDescription,
          }]
        : [];

    return source
      .map((figure) => ({
        name: String(figure.name || figure.figureName || "").trim(),
        description: String(figure.description || figure.figureDescription || "").trim(),
        mimeType: String(figure.mimeType || figure.figureMimeType || "").trim(),
      }))
      .filter((figure) => figure.name || figure.description);
  }

  function createDefaultData() {
    const startDate = Config.defaults.startDate;
    return {
      version: 4,
      project: {
        title: Config.defaults.title,
        mentor: Config.defaults.mentor,
        mentee: Config.defaults.mentee,
        people: [...Config.defaults.people],
        startDate,
      },
      tasks: [
        task("Define goals and success criteria", "in_progress", "Mentor", startDate, Utils.toDateInput(Utils.addDays(Utils.parseDate(startDate), 2))),
        task("Set up the shared workspace", "not_started", "Mentee", Utils.toDateInput(Utils.addDays(Utils.parseDate(startDate), 1)), Utils.toDateInput(Utils.addDays(Utils.parseDate(startDate), 4))),
        task("Review background materials", "waiting", "Mentee", Utils.toDateInput(Utils.addDays(Utils.parseDate(startDate), 2)), Utils.toDateInput(Utils.addDays(Utils.parseDate(startDate), 6))),
        task("Confirm the first checkpoint meeting", "done", "Mentor", startDate, startDate),
        task("Prepare midpoint progress summary", "not_started", "Mentee", Utils.toDateInput(Utils.addDays(Utils.parseDate(startDate), 42)), Utils.toDateInput(Utils.addDays(Utils.parseDate(startDate), 48))),
      ],
      dailyLogs: [],
      sync: {
        mode: "local",
        docName: Config.defaults.docName,
        docUrl: "",
        sheetName: Config.defaults.sheetName,
        sheetUrl: "",
        lastSync: "",
      },
    };
  }

  function task(title, status, owner, scheduledDate = "", deadline = "") {
    return normalizeTask({
      id: Utils.createId("task"),
      title,
      status,
      owner,
      scheduledDate,
      deadline,
      updatedAt: new Date().toISOString(),
    });
  }

  function getPeople(data) {
    return Utils.unique([
      ...(data.project?.people || []),
      data.project?.mentor,
      data.project?.mentee,
      ...data.tasks.map((taskItem) => taskItem.owner),
      ...Config.defaults.people,
    ]);
  }

  App.Data = {
    createDefaultData,
    getPeople,
    normalizeData,
    normalizeFigures,
    normalizeLog,
    normalizeTask,
  };
})(window);
