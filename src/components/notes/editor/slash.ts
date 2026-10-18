import { Extension, type Editor, type Range } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';

/**
 * The `/` menu's items (added 18 Oct 2026). Labels are Indonesian; the
 * aliases let an English word find the same item (`/todo`, `/heading`).
 */
export interface SlashItem {
  id: 'text' | 'h1' | 'h2' | 'h3' | 'bullet' | 'number' | 'checklist' | 'divider';
  label: string;
  aliases: readonly string[];
  run(editor: Editor, range: Range): void;
}

/** Remove the typed `/query`, then turn the current block into `type`. */
const at = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

export const SLASH_ITEMS: readonly SlashItem[] = [
  { id: 'text', label: 'Teks', aliases: ['text', 'paragraf', 'paragraph'], run: (e, r) => at(e, r).setParagraph().run() },
  { id: 'h1', label: 'Judul 1', aliases: ['h1', 'heading', 'title'], run: (e, r) => at(e, r).setHeading({ level: 1 }).run() },
  { id: 'h2', label: 'Judul 2', aliases: ['h2', 'heading'], run: (e, r) => at(e, r).setHeading({ level: 2 }).run() },
  { id: 'h3', label: 'Judul 3', aliases: ['h3', 'heading'], run: (e, r) => at(e, r).setHeading({ level: 3 }).run() },
  { id: 'bullet', label: 'Daftar berpoin', aliases: ['bullet', 'list', 'poin'], run: (e, r) => at(e, r).toggleBulletList().run() },
  { id: 'number', label: 'Daftar bernomor', aliases: ['number', 'numbered', 'nomor', 'ordered'], run: (e, r) => at(e, r).toggleOrderedList().run() },
  {
    id: 'checklist',
    label: 'Checklist',
    aliases: ['todo', 'checkbox', 'centang', 'tugas'],
    run: (e, r) => at(e, r).toggleList('checklist', 'checklistItem').run(),
  },
  { id: 'divider', label: 'Pemisah', aliases: ['divider', 'garis', 'hr', 'line'], run: (e, r) => at(e, r).setHorizontalRule().run() },
];

/** Items whose label words or aliases start with (or contain) the query, in menu order. */
export function filterSlash(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SLASH_ITEMS];
  return SLASH_ITEMS.filter((item) =>
    [item.label.toLowerCase(), ...item.label.toLowerCase().split(/\s+/), ...item.aliases].some((word) =>
      word.includes(q),
    ),
  );
}

/** Shared with the menu, which closes the suggestion by this key on Esc. */
export const SLASH_PLUGIN_KEY = new PluginKey('catatanSlash');

export type SlashRender = NonNullable<SuggestionOptions<SlashItem>['render']>;

export const SlashCommand = Extension.create<{ render: SlashRender | null }>({
  name: 'catatanSlash',

  addOptions() {
    return { render: null };
  },

  addProseMirrorPlugins() {
    const render = this.options.render;
    if (!render) return [];
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        pluginKey: SLASH_PLUGIN_KEY,
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        items: ({ query }) => filterSlash(query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render,
      }),
    ];
  },
});
