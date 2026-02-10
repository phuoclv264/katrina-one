'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading2,
  Undo,
  Redo,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

const RichTextEditor = ({
  content,
  onChange,
  placeholder = 'Bắt đầu nhập...',
  className,
}: RichTextEditorProps) => {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        // StarterKit includes bold, italic, history etc by default.
        // We only need to configure specific aspects if they differ from defaults.
      }),
      Placeholder.configure({
        placeholder,
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: '-',
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      // Get the markdown content
      const markdown = (editor.storage as any).markdown.getMarkdown();
      if (markdown !== content) {
        onChange(markdown);
      }
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-slate prose-sm max-w-none focus:outline-none min-h-[100px] p-4 text-base leading-relaxed',
        ),
      },
    },
  });

  // Sync content if it changes externally (e.g. from a reset button or initial load)
  // But skip it if the editor is currently focused to avoid breaking shortcuts/cursor position
  useEffect(() => {
    if (!editor) return;

    const currentMarkdown = (editor.storage as any).markdown.getMarkdown();
    if (content !== currentMarkdown && !editor.isFocused) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn('flex flex-col rounded-2xl border border-muted-foreground/10 overflow-hidden bg-background focus-within:ring-2 focus-within:ring-primary/20 transition-all', className)}>
      <div className="flex items-center flex-wrap gap-1 p-1 bg-muted/30 border-b border-muted-foreground/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          className={cn('h-8 w-8 p-0 rounded-lg shadow-sm', editor.isActive('bold') ? 'bg-background shadow-inner text-primary' : 'hover:bg-background')}
          title="In đậm"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          className={cn('h-8 w-8 p-0 rounded-lg shadow-sm', editor.isActive('italic') ? 'bg-background shadow-inner text-primary' : 'hover:bg-background')}
          title="In nghiêng"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
          className={cn('h-8 w-8 p-0 rounded-lg shadow-sm', editor.isActive('underline') ? 'bg-background shadow-inner text-primary' : 'hover:bg-background')}
          title="Gạch chân"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-muted-foreground/20 mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}
          className={cn('h-8 w-8 p-0 rounded-lg shadow-sm', editor.isActive('heading', { level: 3 }) ? 'bg-background shadow-inner text-primary' : 'hover:bg-background')}
          title="Tiêu đề"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
          className={cn('h-8 w-8 p-0 rounded-lg shadow-sm', editor.isActive('bulletList') ? 'bg-background shadow-inner text-primary' : 'hover:bg-background')}
          title="Danh sách dấu chấm"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
          className={cn('h-8 w-8 p-0 rounded-lg shadow-sm', editor.isActive('orderedList') ? 'bg-background shadow-inner text-primary' : 'hover:bg-background')}
          title="Danh sách số"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.preventDefault(); editor.chain().focus().undo().run(); }}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0 hover:bg-background rounded-lg shadow-sm"
          title="Hoàn tác"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.preventDefault(); editor.chain().focus().redo().run(); }}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0 hover:bg-background rounded-lg shadow-sm"
          title="Làm lại"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>
      <EditorContent editor={editor} className="bg-muted/20 focus-within:bg-background transition-colors" />
    </div>
  );
};

export { RichTextEditor };
