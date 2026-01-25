import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Button, Tooltip } from '@fluentui/react-components';
import {
    TextBold20Regular,
    TextItalic20Regular,
    TextUnderline20Regular,
    TextBulletList20Regular,
    TextNumberListLtr20Regular,
    CheckboxChecked20Regular,
    TextParagraph20Regular,
} from '@fluentui/react-icons';
import './RichTextEditor.css';
import styles from './RichTextEditor.module.scss';

interface RichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
    content,
    onChange,
    placeholder = 'Add notes, assumptions, or explanations...',
}) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false,
            }),
            Underline,
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Link.configure({
                openOnClick: false,
            }),
            Placeholder.configure({
                placeholder,
            }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    if (!editor) {
        return null;
    }

    return (
        <div className={styles['editor-container']}>
            <div className={styles['editor-toolbar']}>
                <Tooltip content="Bold (Ctrl+B)" relationship="label">
                    <Button
                        className={`${styles['toolbar-btn']} ${editor.isActive('bold') ? styles['toolbar-btn--active'] : ''}`}
                        appearance="subtle"
                        size="small"
                        icon={<TextBold20Regular />}
                        onClick={() => editor.chain().focus().toggleBold().run()}
                    />
                </Tooltip>
                <Tooltip content="Italic (Ctrl+I)" relationship="label">
                    <Button
                        className={`${styles['toolbar-btn']} ${editor.isActive('italic') ? styles['toolbar-btn--active'] : ''}`}
                        appearance="subtle"
                        size="small"
                        icon={<TextItalic20Regular />}
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                    />
                </Tooltip>
                <Tooltip content="Underline (Ctrl+U)" relationship="label">
                    <Button
                        className={`${styles['toolbar-btn']} ${editor.isActive('underline') ? styles['toolbar-btn--active'] : ''}`}
                        appearance="subtle"
                        size="small"
                        icon={<TextUnderline20Regular />}
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                    />
                </Tooltip>

                <div className={styles['toolbar-divider']} />

                <Tooltip content="Normal Text (Exit list/checkbox)" relationship="label">
                    <Button
                        className={`${styles['toolbar-btn']} ${!editor.isActive('bulletList') && !editor.isActive('orderedList') && !editor.isActive('taskList') ? styles['toolbar-btn--active'] : ''}`}
                        appearance="subtle"
                        size="small"
                        icon={<TextParagraph20Regular />}
                        onClick={() => {
                            editor.chain().focus().liftListItem('listItem').run();
                            editor.chain().focus().liftListItem('taskItem').run();
                        }}
                    />
                </Tooltip>
                <Tooltip content="Bullet List" relationship="label">
                    <Button
                        className={`${styles['toolbar-btn']} ${editor.isActive('bulletList') ? styles['toolbar-btn--active'] : ''}`}
                        appearance="subtle"
                        size="small"
                        icon={<TextBulletList20Regular />}
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                    />
                </Tooltip>
                <Tooltip content="Numbered List" relationship="label">
                    <Button
                        className={`${styles['toolbar-btn']} ${editor.isActive('orderedList') ? styles['toolbar-btn--active'] : ''}`}
                        appearance="subtle"
                        size="small"
                        icon={<TextNumberListLtr20Regular />}
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    />
                </Tooltip>
                <Tooltip content="Checklist" relationship="label">
                    <Button
                        className={`${styles['toolbar-btn']} ${editor.isActive('taskList') ? styles['toolbar-btn--active'] : ''}`}
                        appearance="subtle"
                        size="small"
                        icon={<CheckboxChecked20Regular />}
                        onClick={() => editor.chain().focus().toggleTaskList().run()}
                    />
                </Tooltip>
            </div>

            <EditorContent editor={editor} className={styles['editor-content']} />
        </div>
    );
};
