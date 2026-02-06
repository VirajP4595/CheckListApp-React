import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import {
    Button,
    Tooltip,
    Menu,
    MenuTrigger,
    MenuList,
    MenuItem,
    MenuPopover,
} from '@fluentui/react-components';
import {
    TextBold20Regular,
    TextItalic20Regular,
    TextUnderline20Regular,
    TextBulletList20Regular,
    TextNumberListLtr20Regular,
    CheckboxChecked20Regular,
    TextParagraph20Regular,
    TextEffects20Regular,
    Circle20Filled,
    Color20Regular,
} from '@fluentui/react-icons';
import './RichTextEditor.css';
import styles from './RichTextEditor.module.scss';

// ... (existing imports)

interface RichTextEditorProps {
    content: string;
    onChange?: (html: string) => void;
    onBlur?: () => void;
    onFocus?: () => void;
    placeholder?: string;
    readOnly?: boolean;
    className?: string; // Allow custom styles
}

// ... (existing constants)

const HIGHLIGHT_COLORS = [
    { label: 'Yellow', value: '#FFEB3B', border: '#FBC02D' },
    { label: 'Green', value: '#8BC34A', border: '#689F38' },
    { label: 'Blue', value: '#03A9F4', border: '#0288D1' },
    { label: 'Pink', value: '#E91E63', border: '#C2185B' },
    { label: 'Red', value: '#F44336', border: '#D32F2F' },
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
    content,
    onChange,
    onBlur,
    onFocus,
    readOnly = false,
    placeholder,
    className,
}) => {
    const editor = useEditor({
        editable: !readOnly,
        extensions: [
            StarterKit.configure({
                heading: false,
            }),
            Underline,
            Highlight.configure({
                multicolor: true,
            }),
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Link.configure({
                openOnClick: false,
            }),
            Placeholder.configure({
                placeholder: readOnly ? '' : placeholder,
            }),
        ],
        content,
        // ... (existing handlers)
        onUpdate: ({ editor }) => {
            onChange?.(editor.getHTML());
        },
        onBlur: () => {
            if (onBlur) onBlur();
        },
        onFocus: () => {
            if (onFocus) onFocus();
        },
    });

    if (!editor) {
        return null;
    }

    // Update editable state if prop changes
    useEffect(() => {
        editor.setEditable(!readOnly);
    }, [editor, readOnly]);

    return (
        <div className={`${styles['editor-container']} ${readOnly ? styles['editor-container--readonly'] : ''} ${className || ''}`}>
            {!readOnly && (
                <div className={styles['editor-toolbar']}>
                    {/* ... (existing Bold, Italic, Underline buttons) */}
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

                    <Menu>
                        <MenuTrigger disableButtonEnhancement>
                            <Tooltip content="Highlight Color" relationship="label">
                                <Button
                                    className={`${styles['toolbar-btn']} ${editor.isActive('highlight') ? styles['toolbar-btn--active'] : ''}`}
                                    appearance="subtle"
                                    size="small"
                                    icon={<TextEffects20Regular />}
                                />
                            </Tooltip>
                        </MenuTrigger>
                        <MenuPopover>
                            <MenuList>
                                <MenuItem
                                    onClick={() => editor.chain().focus().unsetHighlight().run()}
                                    icon={<Color20Regular />}
                                >
                                    No Color
                                </MenuItem>
                                {HIGHLIGHT_COLORS.map((color) => (
                                    <MenuItem
                                        key={color.value}
                                        onClick={() => editor.chain().focus().toggleHighlight({ color: color.value }).run()}
                                        icon={<Circle20Filled primaryFill={color.value} />}
                                    >
                                        {color.label}
                                    </MenuItem>
                                ))}
                            </MenuList>
                        </MenuPopover>
                    </Menu>

                    {/* ... (existing List buttons) */}
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
            )}

            <EditorContent editor={editor} className={styles['editor-content']} />
        </div>
    );
};
