import React, { useState, useMemo } from 'react';
import {
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogTrigger,
    TabList,
    Tab,
    SelectTabData,
    TabValue,
    SelectTabEvent,
    Button,
} from '@fluentui/react-components';
import { Dismiss24Regular, Info24Regular, Chat24Regular, Folder24Regular, History24Regular, Image24Regular } from '@fluentui/react-icons';
import { Checklist } from '../../../models';
import { ChecklistChat, getUnreadCount } from './ChecklistChat';
import { ChecklistFiles } from './ChecklistFiles';
import { ChecklistInfoPanel } from './ChecklistInfoPanel';
import { BrandingPanel } from './BrandingPanel';
import { RevisionListTab } from './RevisionListTab';
import { useChecklistStore, useUserStore } from '../../../stores';
import styles from './ChecklistInfoDialog.module.scss';

interface ChecklistInfoDialogProps {
    checklist: Checklist;
    triggerClassName?: string;
}

export const ChecklistInfoDialog: React.FC<ChecklistInfoDialogProps> = ({ checklist, triggerClassName }) => {
    const [open, setOpen] = useState(false);
    const [selectedTab, setSelectedTab] = useState<TabValue>('info');
    const { updateChecklist, saveChecklist } = useChecklistStore();
    const user = useUserStore(state => state.user);

    // Unread count for Chat tab badge (suppress when chat tab is active & dialog open)
    const unreadCount = useMemo(() => {
        if (!user) return 0;
        if (open && selectedTab === 'chat') return 0; // user is looking at chat
        return getUnreadCount(checklist, user.id);
    }, [checklist, checklist.comments, user, open, selectedTab]);

    const onTabSelect = (_: SelectTabEvent, data: SelectTabData) => {
        setSelectedTab(data.value);
    };

    const handleUpdate = (updates: Partial<Checklist>, logMessage?: string) => {
        updateChecklist(checklist.id, updates, logMessage);
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
                            <DialogTrigger action="close">
                                <Button
                                    className={styles['close-button']}
                                    appearance="subtle"
                                    icon={<Dismiss24Regular />}
                                    aria-label="Close dialog"
                                />
                            </DialogTrigger>
                        </div>

                        <TabList
                            className={styles['dialog-tabs']}
                            selectedValue={selectedTab}
                            onTabSelect={onTabSelect}
                            size="medium"
                        >
                            <Tab value="info" icon={<Info24Regular />}>Info</Tab>
                            <Tab value="chat" icon={<Chat24Regular />}>
                                Chat
                                {unreadCount > 0 && (
                                    <span className={styles['chat-unread-badge']}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </Tab>
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
                                    onSave={saveChecklist}
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
                            {selectedTab === 'branding' && (
                                <BrandingPanel
                                    checklist={checklist}
                                />
                            )}
                            {selectedTab === 'revisions' && (
                                <RevisionListTab
                                    checklist={checklist}
                                />
                            )}
                        </DialogContent>
                    </DialogBody>
                </DialogSurface>
            </Dialog >
        </>
    );
};
