// Declarative menubar data. Pure factory: all behavior comes from ctx.
export function buildMenus(ctx) {
  const {
    mod,
    isMac,
    store,
    isSaving,
    canGroup,
    gridVisible,
    snapEnabled,
    currentTheme,
    newProject,
    loadProject,
    saveProject,
    saveToServer,
    browseServer,
    openExport,
    openRender,
    showShortcuts,
    showAbout,
    toggleGrid,
    toggleSnap,
    groupSelected,
  } = ctx;
  return [
    {
      id: 'file',
      label: 'File',
      items: [
        { id: 'f-new', label: 'New Project', action: () => newProject() },
        { id: 'f-open', label: 'Open…', action: () => loadProject(), shortcut: `${mod}O` },
        { type: 'separator' },
        { id: 'f-save', label: 'Save', action: () => saveProject(), shortcut: `${mod}S` },
        {
          id: 'f-sync',
          label: 'Save to Server',
          action: () => saveToServer(),
          disabled: () => isSaving.value,
        },
        { id: 'f-browse', label: 'Server Projects…', action: () => browseServer() },
        { type: 'separator' },
        { id: 'f-export', label: 'Export .py', action: () => openExport() },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { id: 'e-undo', label: 'Undo', action: () => store.undo(), shortcut: `${mod}Z` },
        {
          id: 'e-redo',
          label: 'Redo',
          action: () => store.redo(),
          shortcut: isMac ? '⇧⌘Z' : 'Ctrl+Y',
        },
        { type: 'separator' },
        { id: 'e-copy', label: 'Copy', action: () => store.copySelection(), shortcut: `${mod}C` },
        {
          id: 'e-paste',
          label: 'Paste',
          action: () => store.pasteSelection(),
          shortcut: `${mod}V`,
        },
        { type: 'separator' },
        {
          id: 'e-group',
          label: 'Group Selection',
          action: () => groupSelected(),
          shortcut: `${mod}G`,
          disabled: () => !canGroup.value,
        },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        {
          id: 'v-grid',
          label: 'Grid',
          type: 'toggle',
          action: () => toggleGrid(),
          checked: () => gridVisible.value,
        },
        {
          id: 'v-snap',
          label: 'Snap',
          type: 'toggle',
          action: () => toggleSnap(),
          checked: () => snapEnabled.value,
        },
        { type: 'separator' },
        {
          id: 'v-theme',
          label: 'Theme',
          type: 'submenu',
          children: [
            {
              id: 'v-t-light',
              label: 'Light',
              action: () => store.setTheme('light'),
              active: () => currentTheme.value === 'light',
            },
            {
              id: 'v-t-dark',
              label: 'Dark',
              action: () => store.setTheme('dark'),
              active: () => currentTheme.value === 'dark',
            },
          ],
        },
      ],
    },
    {
      id: 'tools',
      label: 'Tools',
      items: [{ id: 't-render', label: 'Render HQ…', action: () => openRender() }],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { id: 'h-keys', label: 'Keyboard Shortcuts', action: () => showShortcuts() },
        { type: 'separator' },
        { id: 'h-about', label: 'About Manim Motion', action: () => showAbout() },
      ],
    },
  ];
}
