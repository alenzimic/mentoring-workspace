(function (window) {
  const App = window.MentoringWorkspace = window.MentoringWorkspace || {};

  App.Config = {
    storageKey: "mentoring-workspace-v4",
    statusLabels: {
      not_started: "Not started",
      in_progress: "In progress",
      waiting: "Waiting",
      blocked: "Blocked",
      done: "Done",
    },
    statusAliases: {
      open: "in_progress",
    },
    defaults: {
      title: "Mentoring Workspace",
      mentor: "Mentor",
      mentee: "Mentee",
      people: ["Mentor", "Mentee"],
      startDate: "2026-06-01",
      docName: "Local daily log",
      sheetName: "Local task table",
    },
  };
})(window);
