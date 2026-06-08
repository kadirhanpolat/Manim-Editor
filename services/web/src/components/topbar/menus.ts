import type { Ref } from 'vue';

/** A reactive boolean-valued ref or computed exposed by the menubar context. */
type BoolRef = Ref<boolean>;
type StringRef = Ref<string>;

/** The store subset that menus need. */
interface MenuStore {
  undo: () => void;
  redo: () => void;
  copySelection: () => void;
  pasteSelection: () => void;
  setTheme: (id: string) => void;
}

/** Context bag passed from MenuBar.vue to buildMenus(). */
export interface MenuCtx {
  mod: string;
  isMac: boolean;
  store: MenuStore;
  isSaving: BoolRef;
  canGroup: BoolRef;
  gridVisible: BoolRef;
  snapEnabled: BoolRef;
  currentTheme: StringRef;
  newProject: () => void;
  loadProject: () => void;
  saveProject: () => void;
  saveToServer: () => void;
  browseServer: () => void;
  openExport: () => void;
  openRender: () => void;
  showShortcuts: () => void;
  showAbout: () => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  groupSelected: () => void;
}

/** A leaf menu item. */
export interface MenuItem {
  id?: string;
  label?: string;
  type?: 'separator' | 'toggle' | 'submenu';
  action?: () => void;
  shortcut?: string;
  disabled?: () => boolean;
  checked?: () => boolean;
  active?: () => boolean;
  children?: MenuItem[];
}

/** A top-level menu group. */
export interface Menu {
  id: string;
  label: string;
  items: MenuItem[];
}

// Declarative menubar data. Pure factory: all behavior comes from ctx.
export function buildMenus(ctx: MenuCtx): Menu[] {
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
