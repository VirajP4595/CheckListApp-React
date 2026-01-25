import React, { useState } from 'react';
import { makeStyles, TabList, Tab, SelectTabData, TabValue, tokens, shorthands, SelectTabEvent } from '@fluentui/react-components';
import { History24Regular, Chat24Regular, NoteEdit24Regular, Folder24Regular, Info24Regular } from '@fluentui/react-icons';
import { Checklist } from '../../../models';
import { RevisionPanel } from '../../Revision/RevisionPanel';
import { ChecklistChat } from './ChecklistChat';
import { CommonNotes } from './CommonNotes';
import { ChecklistFiles } from './ChecklistFiles';
import { ChecklistInfoPanel } from './ChecklistInfoPanel';
import { useChecklistStore } from '../../../stores';

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
    }
});

interface CollaborationSidebarProps {
    checklist: Checklist;
    onViewRevision: (revision: any) => void;
}

export const CollaborationSidebar: React.FC<CollaborationSidebarProps> = ({ checklist, onViewRevision }) => {
    const styles = useStyles();
    const [selectedTab, setSelectedTab] = useState<TabValue>('info');
    const { updateChecklist } = useChecklistStore();

    const onTabSelect = (_: SelectTabEvent, data: SelectTabData) => {
        setSelectedTab(data.value);
    };

    const handleUpdate = (updates: Partial<Checklist>) => {
        updateChecklist(checklist.id, updates);
    };

    return (
        <aside className={styles.root}>
            <div className={styles.tabs}>
                <TabList selectedValue={selectedTab} onTabSelect={onTabSelect} size="small">
                    <Tab value="info" icon={<Info24Regular />}>Info</Tab>
                    <Tab value="chat" icon={<Chat24Regular />}>Chat</Tab>
                    <Tab value="notes" icon={<NoteEdit24Regular />}>Notes</Tab>
                    <Tab value="files" icon={<Folder24Regular />}>Files</Tab>
                    <Tab value="revisions" icon={<History24Regular />}>Revisions</Tab>
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
                {selectedTab === 'revisions' && (
                    <RevisionPanel
                        checklistId={checklist.id}
                        onViewRevision={onViewRevision}
                    />
                )}
            </div>
        </aside>
    );
};
