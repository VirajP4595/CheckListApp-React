import React, { useState, useMemo } from 'react';
import { makeStyles, TabList, Tab, SelectTabData, TabValue, tokens, shorthands, SelectTabEvent } from '@fluentui/react-components';
import { Chat24Regular, NoteEdit24Regular, Folder24Regular, Info24Regular, ClipboardPulse24Regular } from '@fluentui/react-icons';
import { Checklist } from '../../../models';
import { ChecklistChat, getUnreadCount } from './ChecklistChat';
import { CommonNotes } from './CommonNotes';
import { ChecklistFiles } from './ChecklistFiles';
import { ChecklistInfoPanel } from './ChecklistInfoPanel';
import ActivityLogPanel from './ActivityLogPanel';
import { useChecklistStore, useUserStore } from '../../../stores';

const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: tokens.colorNeutralBackground1,
        borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    tabs: {
        ...shorthands.padding('6px', '6px', '0', '6px'),
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    content: {
        flex: 1,
        overflow: 'hidden',
    },
    chatTabWrapper: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
    },
    unreadBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '16px',
        height: '16px',
        padding: '0 4px',
        borderRadius: '8px',
        backgroundColor: '#d13438',
        color: '#ffffff',
        fontSize: '10px',
        fontWeight: '700',
        lineHeight: '1',
    },
});

interface CollaborationSidebarProps {
    checklist: Checklist;
}

export const CollaborationSidebar: React.FC<CollaborationSidebarProps> = ({ checklist }) => {
    const styles = useStyles();
    const [selectedTab, setSelectedTab] = useState<TabValue>('info');
    const { updateChecklist, saveChecklist } = useChecklistStore();
    const user = useUserStore(state => state.user);

    const unreadCount = useMemo(() => {
        if (!user?.id) return 0;
        // Don't show unread badge when chat tab is active
        if (selectedTab === 'chat') return 0;
        return getUnreadCount(checklist, user.id);
    }, [checklist, checklist.comments, user?.id, selectedTab]);

    const onTabSelect = (_: SelectTabEvent, data: SelectTabData) => {
        setSelectedTab(data.value);
    };

    const handleUpdate = (updates: Partial<Checklist>) => {
        updateChecklist(checklist.id, updates);
    };

    const handleSave = () => {
        void saveChecklist();
    };

    return (
        <aside className={styles.root}>
            <div className={styles.tabs}>
                <TabList selectedValue={selectedTab} onTabSelect={onTabSelect} size="small">
                    <Tab value="info" icon={<Info24Regular />}>Info</Tab>
                    <Tab value="chat" icon={<Chat24Regular />}>
                        <span className={styles.chatTabWrapper}>
                            Chat
                            {unreadCount > 0 && (
                                <span className={styles.unreadBadge}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </span>
                    </Tab>
                    <Tab value="notes" icon={<NoteEdit24Regular />}>Notes</Tab>
                    <Tab value="files" icon={<Folder24Regular />}>Files</Tab>
                    <Tab value="activity" icon={<ClipboardPulse24Regular />}>Activity</Tab>
                </TabList>
            </div>

            <div className={styles.content}>
                {selectedTab === 'info' && (
                    <ChecklistInfoPanel
                        checklist={checklist}
                        onUpdate={handleUpdate}
                        readOnly={checklist.status === 'final'}
                    />
                )}
                {selectedTab === 'chat' && (
                    <ChecklistChat
                        checklist={checklist}
                        onUpdate={handleUpdate}
                        onSave={handleSave}
                        readOnly={checklist.status === 'final'}
                    />
                )}
                {selectedTab === 'notes' && (
                    <CommonNotes
                        checklist={checklist}
                        onUpdate={handleUpdate}
                        readOnly={checklist.status === 'final'}
                    />
                )}
                {selectedTab === 'files' && (
                    <ChecklistFiles
                        checklist={checklist}
                        onUpdate={handleUpdate}
                        readOnly={checklist.status === 'final'}
                    />
                )}
                {selectedTab === 'activity' && (
                    <ActivityLogPanel checklistId={checklist.id} />
                )}
            </div>
        </aside>
    );
};
