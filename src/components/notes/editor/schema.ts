import { Extension, Node, mergeAttributes, wrappingInputRule, type AnyExtension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style';

import { tickPlugin, toggleChecklistAtCaret } from './commands';

/**
 * The Catatan document schema (added 18 Oct 2026, replacing the
 * contentEditable + execCommand editor and its DOM repairs in checklistDom).
 *
 * STORED FORMAT IS UNCHANGED: checklists are written as
 * `<ul class="cl"><li data-checked="true|false">…</li></ul>`, the shape every
 * reader of a note body already understands (checklistProgress, notePlainText,
 * search, previews). That is why the checklist is its own pair of nodes and
 * not TipTap's TaskList/TaskItem: TaskItem always renders an `<input>` inside
 * a `<label>`, and `extend()` cannot remove its NodeView. The box is drawn by
 * CSS (`.note-editor ul.cl > li::before`), as before.
 */

/** Width of the tick zone from a checklist row's left edge. Matches the CSS. */
export const CHECK_ZONE_PX = 32;

export const ChecklistItem = Node.create({
  name: 'checklistItem',
  content: 'paragraph block*',
  defining: true,

  addAttributes() {
    return {
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-checked') === 'true',
        renderHTML: (attributes: { checked?: boolean }) => ({
          'data-checked': String(attributes.checked === true),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'ul.cl > li', priority: 60 }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['li', HTMLAttributes, 0];
  },

  addInputRules() {
    // `[]`, `[ ]` or `[x]` then a space, at the start of a line. On the item,
    // not the list, so `[x]` can set the item's state; the list wrapper is
    // found by the schema (checklist > checklistItem).
    return [
      wrappingInputRule({
        find: /^\s*\[( |x|X)?\]\s$/,
        type: this.type,
        getAttributes: (match) => ({ checked: (match[1] ?? '').toLowerCase() === 'x' }),
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      Tab: () => this.editor.commands.sinkListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
      'Mod-Enter': () =>
        this.editor.commands.command(({ state, dispatch }) => toggleChecklistAtCaret(state, dispatch)),
    };
  },

  addProseMirrorPlugins() {
    return [tickPlugin()];
  },
});

export const Checklist = Node.create({
  name: 'checklist',
  group: 'block list',
  content: 'checklistItem+',

  parseHTML() {
    return [{ tag: 'ul.cl', priority: 60 }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes(HTMLAttributes, { class: 'cl' }), 0];
  },
});

const LIST_ITEMS = ['checklistItem', 'listItem'] as const;

/** The list item type around the caret, if any. */
export function listItemTypeAtCaret(editor: import('@tiptap/core').Editor): string | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if ((LIST_ITEMS as readonly string[]).includes(name)) return name;
  }
  return null;
}

/**
 * Notion-style list keys the starter kit does not give (18 Oct 2026):
 * Backspace at the very start of a list item turns it back into text (lifts
 * it one level) instead of joining it into the item above.
 */
const ListBehaviour = Extension.create({
  name: 'catatanListBehaviour',
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { selection } = this.editor.state;
        if (!selection.empty || selection.$from.parentOffset !== 0) return false;
        const type = listItemTypeAtCaret(this.editor);
        if (!type) return false;
        // Only the item's FIRST paragraph: a later paragraph joins as usual.
        const { $from } = selection;
        if ($from.index($from.depth - 1) !== 0) return false;
        return this.editor.commands.liftListItem(type);
      },
    };
  },
});

/**
 * Paste is plain text only (as before: rich paste from WhatsApp Web or a lab
 * portal brought fonts, tables and inline styles). Several lines pasted into
 * a list item become one item per line, all unticked; elsewhere, paragraphs.
 */
const PlainPaste = Extension.create({
  name: 'catatanPlainPaste',

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey('catatanPlainPaste'),
        props: {
          handlePaste: (_view, event) => {
            const text = event.clipboardData?.getData('text/plain');
            if (text === undefined) return false;
            const lines = text.replace(/\r\n?/g, '\n').split('\n');
            const itemType = listItemTypeAtCaret(editor);
            if (lines.length === 1) {
              editor.commands.insertContent({ type: 'text', text: lines[0] ?? '' });
              return true;
            }
            if (itemType) {
              let chain = editor.chain();
              lines.forEach((line, index) => {
                if (index > 0) chain = chain.splitListItem(itemType);
                if (line) chain = chain.insertContent({ type: 'text', text: line });
              });
              chain.run();
              return true;
            }
            editor.commands.insertContent(
              lines.map((line) => ({
                type: 'paragraph',
                ...(line ? { content: [{ type: 'text', text: line }] } : {}),
              })),
            );
            return true;
          },
        },
      }),
    ];
  },
});

export function noteExtensions(options: { placeholder?: string } = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: false,
      code: false,
      codeBlock: false,
      blockquote: false,
      strike: false,
      listKeymap: {
        listTypes: [
          { itemName: 'listItem', wrapperNames: ['bulletList', 'orderedList'] },
          { itemName: 'checklistItem', wrapperNames: ['checklist'] },
        ],
      },
    }),
    Checklist,
    ChecklistItem,
    TextStyle,
    Color,
    FontSize,
    ListBehaviour,
    PlainPaste,
    Placeholder.configure({ placeholder: options.placeholder ?? 'Ketik, atau / untuk pilihan' }),
  ];
}
