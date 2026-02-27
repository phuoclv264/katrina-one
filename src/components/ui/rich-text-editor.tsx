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
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Type,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
}

const RichTextEditor = ({
  content,
  onChange,
  placeholder = 'Bắt đầu nhập...',
  className,
  editorClassName,
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
          'prose prose-neutral prose-sm max-w-none focus:outline-none min-h-[100px] p-6 text-foreground/90 leading-tight',
          editorClassName
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
    <div className={cn('flex flex-col rounded-2xl border border-muted-foreground/10 overflow-hidden bg-background focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm', className)}>
      <div className="flex items-center flex-wrap gap-1 p-2 bg-muted/40 border-b border-muted-foreground/10 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-1 mr-2 px-1 border-r border-muted-foreground/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.preventDefault(); editor.chain().focus().undo().run(); }}
            disabled={!editor.can().undo()}
            className="h-8 w-8 p-0 hover:bg-background rounded-lg text-muted-foreground disabled:opacity-30"
            title="Hoàn tác (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.preventDefault(); editor.chain().focus().redo().run(); }}
            disabled={!editor.can().redo()}
            className="h-8 w-8 p-0 hover:bg-background rounded-lg text-muted-foreground disabled:opacity-30"
            title="Làm lại (Ctrl+Y)"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 mr-2 px-1 border-r border-muted-foreground/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.preventDefault(); editor.chain().focus().setParagraph().run(); }}
            className={cn('h-8 px-2 p-0 rounded-lg transition-colors gap-2 text-xs font-bold', editor.isActive('paragraph') ? 'bg-background shadow-sm text-primary' : 'hover:bg-background text-muted-foreground')}
            title="Văn bản thường"
          >
            <Type className="h-3.5 w-3.5" /> Thường
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }}
            className={cn('h-8 w-8 p-0 rounded-lg transition-colors shadow-sm', editor.isActive('heading', { level: 1 }) ? 'bg-background shadow-inner text-primary' : 'hover:bg-background text-muted-foreground')}
            title="Tiêu đề chính (H1)"
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
            className={cn('h-8 w-8 p-0 rounded-lg transition-colors shadow-sm', editor.isActive('heading', { level: 2 }) ? 'bg-background shadow-inner text-primary' : 'hover:bg-background text-muted-foreground')}
            title="Tiêu đề lớn (H2)"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}
            className={cn('h-8 w-8 p-0 rounded-lg transition-colors shadow-sm', editor.isActive('heading', { level: 3 }) ? 'bg-background shadow-inner text-primary' : 'hover:bg-background text-muted-foreground')}
            title="Tiêu đề nhỏ (H3)"
          >
            <Heading3 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 mr-2 px-1 border-r border-muted-foreground/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
            className={cn('h-8 w-8 p-0 rounded-lg transition-colors shadow-sm font-bold', editor.isActive('bold') ? 'bg-background shadow-inner text-primary' : 'hover:bg-background text-muted-foreground')}
            title="In đậm (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
            className={cn('h-8 w-8 p-0 rounded-lg transition-colors shadow-sm italic', editor.isActive('italic') ? 'bg-background shadow-inner text-primary' : 'hover:bg-background text-muted-foreground')}
            title="In nghiêng (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 px-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
            className={cn('h-8 w-8 p-0 rounded-lg transition-colors shadow-sm', editor.isActive('bulletList') ? 'bg-background shadow-inner text-primary' : 'hover:bg-background text-muted-foreground')}
            title="Danh sách dấu chấm"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
            className={cn('h-8 w-8 p-0 rounded-lg transition-colors shadow-sm', editor.isActive('orderedList') ? 'bg-background shadow-inner text-primary' : 'hover:bg-background text-muted-foreground')}
            title="Danh sách số"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <EditorContent editor={editor} className="flex-1 overflow-auto selection:bg-primary/20" />
    </div>
  );
};

export { RichTextEditor };
