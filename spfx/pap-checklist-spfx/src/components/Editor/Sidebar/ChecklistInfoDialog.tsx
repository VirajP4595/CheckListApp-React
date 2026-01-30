import React, { useState } from 'react';
import {
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    TabList,
    Tab,
    SelectTabData,
    TabValue,
    SelectTabEvent,
    Button,
} from '@fluentui/react-components';
import { Dismiss24Regular, Info24Regular, Chat24Regular, NoteEdit24Regular, Folder24Regular, History24Regular, Image24Regular } from '@fluentui/react-icons';
import { Checklist } from '../../../models';
import { RevisionPanel } from '../../Revision/RevisionPanel';
import { ChecklistChat } from './ChecklistChat';
import { CommonNotes } from './CommonNotes';
import { ChecklistFiles } from './ChecklistFiles';
import { ChecklistInfoPanel } from './ChecklistInfoPanel';
import { BrandingPanel } from './BrandingPanel';
import { useChecklistStore } from '../../../stores';
import styles from './ChecklistInfoDialog.module.scss';

interface ChecklistInfoDialogProps {
    checklist: Checklist;
    onViewRevision: (revision: any) => void;
    triggerClassName?: string;
}

export const ChecklistInfoDialog: React.FC<ChecklistInfoDialogProps> = ({ checklist, onViewRevision, triggerClassName }) => {
    const [open, setOpen] = useState(false);
    const [selectedTab, setSelectedTab] = useState<TabValue>('info');
    const { updateChecklist } = useChecklistStore();

    const onTabSelect = (_: SelectTabEvent, data: SelectTabData) => {
        setSelectedTab(data.value);
    };

    const handleUpdate = (updates: Partial<Checklist>) => {
        updateChecklist(checklist.id, updates);
    };

    const handleViewRevision = (revision: any) => {
        setOpen(false);
        onViewRevision(revision);
    };

    return (
        <>
            <Button
                className={triggerClassName}
                appearance="subtle"
                icon={<Info24Regular />}
                onClick={() => setOpen(true)}
            >
                Checklist Info
            </Button>

            <Dialog
                open={open}
                onOpenChange={(_, data) => setOpen(data.open)}
            >
                <DialogSurface className={styles['info-dialog']}>
                    <DialogBody className={styles['dialog-body']}>
                        <div className={styles['dialog-header']}>
                            <DialogTitle>Checklist Information</DialogTitle>
                            <Button
                                className={styles['close-button']}
                                appearance="subtle"
                                icon={<Dismiss24Regular />}
                                onClick={() => setOpen(false)}
                                aria-label="Close dialog"
                            />
                        </div>

                        <TabList
                            className={styles['dialog-tabs']}
                            selectedValue={selectedTab}
                            onTabSelect={onTabSelect}
                            size="medium"
                        >
                            <Tab value="info" icon={<Info24Regular />}>Info</Tab>
                            <Tab value="chat" icon={<Chat24Regular />}>Chat</Tab>
                            <Tab value="notes" icon={<NoteEdit24Regular />}>Notes</Tab>
                            <Tab value="files" icon={<Folder24Regular />}>Files</Tab>
                            <Tab value="revisions" icon={<History24Regular />}>Revisions</Tab>
                            <Tab value="branding" icon={<Image24Regular />}>Branding</Tab>
                        </TabList>

                        <DialogContent className={styles['dialog-content']}>
                            {selectedTab === 'info' && (
                                <ChecklistInfoPanel
                                    checklist={checklist}
                                    onUpdate={handleUpdate}
                                    readOnly={false}
                                />
                            )}
                            {selectedTab === 'chat' && (
                                <ChecklistChat
                                    checklist={checklist}
                                    onUpdate={handleUpdate}
                                    readOnly={false}
                                />
                            )}
                            {selectedTab === 'notes' && (
                                <CommonNotes
                                    checklist={checklist}
                                    onUpdate={handleUpdate}
                                    readOnly={false}
                                />
                            )}
                            {selectedTab === 'files' && (
                                <ChecklistFiles
                                    checklist={checklist}
                                    onUpdate={handleUpdate}
                                    readOnly={false}
                                />
                            )}
                            {selectedTab === 'revisions' && (
                                <RevisionPanel
                                    checklistId={checklist.id}
                                    onViewRevision={handleViewRevision}
                                />
                            )}
                            {selectedTab === 'branding' && (
                                <BrandingPanel
                                    checklist={checklist}
                                />
                            )}
                        </DialogContent>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </>
    );
};
