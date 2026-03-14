import React, { useState } from 'react';
import { 
    Menu,
    MenuTrigger,
    MenuPopover,
    MenuList,
    MenuItemCheckbox,
    Button
} from '@fluentui/react-components';
import {
    ChevronDown20Regular, 
    ChevronRight20Regular,
    Search20Regular
} from '@fluentui/react-icons';
import type { Revision, Workgroup } from '../../models';
import { useChecklistStore } from '../../stores';
import { WorkgroupSection } from '../Editor/WorkgroupSection';
import type { FilterState } from '../Editor/FilterBar';
import styles from './RevisionSection.module.scss';

interface RevisionSectionProps {
    revision: Revision;
    revisionWorkgroups: Workgroup[];           // workgroups where revisionId === this revision's id
    originalWorkgroups: Workgroup[];            // workgroups where revisionId is undefined (for dropdown)
    onRowChange: () => void;                   // triggers autosave
    filters?: FilterState;                      // pass through editor filters
    expandTasks?: boolean;                      // pass through editor expand state
}

const AddWorkgroupDropdown: React.FC<{
    originalWorkgroups: Workgroup[];
    revisionWorkgroups: Workgroup[];
    onAdd: (id: string) => void;
}> = ({ originalWorkgroups, revisionWorkgroups, onAdd }) => {
    const [search, setSearch] = React.useState('');
    
    const filtered = originalWorkgroups.filter(wg => 
        !search.trim() || 
        wg.name.toLowerCase().includes(search.toLowerCase()) ||
        String(wg.number).includes(search)
    );

    return (
        <Menu>
            <MenuTrigger disableButtonEnhancement>
                <Button
                    className={styles['filter-dropdown']}
                    appearance="outline"
                    icon={<ChevronDown20Regular />}
                    iconPosition="after"
                    style={{ justifyContent: 'space-between', fontWeight: 400 }}
                >
                    <span style={{ color: '#616161' }}>Add workgroup to this revision...</span>
                </Button>
            </MenuTrigger>
            <MenuPopover>
                <div className={styles['search-container']} onClick={(e) => e.stopPropagation()}>
                    <div className={styles['search-wrapper']}>
                        <Search20Regular className={styles['search-icon']} />
                        <input
                            className={styles['search-input']}
                            placeholder="Search workgroups..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
                <MenuList 
                    className={styles['search-list']}
                    checkedValues={{ added: revisionWorkgroups.map(rwg => rwg.number.toString()) }}
                >
                    {filtered.length === 0 ? (
                        <div style={{ padding: '8px', color: '#666', fontSize: '12px' }}>
                            No results found
                        </div>
                    ) : (
                        filtered.map(wg => {
                            const isAlreadyAdded = revisionWorkgroups.some(rwg => rwg.number === wg.number);
                            return (
                                <MenuItemCheckbox
                                    key={wg.id}
                                    name="added"
                                    value={wg.number.toString()}
                                    disabled={isAlreadyAdded}
                                    onClick={(e) => {
                                        if (!isAlreadyAdded) {
                                            onAdd(wg.id);
                                        } else {
                                            e.stopPropagation();
                                        }
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
                                        <span>{wg.number} — {wg.name}</span>
                                        {isAlreadyAdded && (
                                            <span style={{ fontSize: '10px', color: '#999', fontStyle: 'italic' }}>
                                                Added
                                            </span>
                                        )}
                                    </div>
                                </MenuItemCheckbox>
                            );
                        })
                    )}
                </MenuList>
            </MenuPopover>
        </Menu>
    );
};

export const RevisionSection: React.FC<RevisionSectionProps> = ({
    revision,
    revisionWorkgroups,
    originalWorkgroups,
    onRowChange,
    filters,
    expandTasks = true
}) => {
    const [isExpanded, setIsExpanded] = useState(false); // collapsed by default
    const addRevisionWorkgroup = useChecklistStore(state => state.addRevisionWorkgroup);

    const toggleExpand = () => setIsExpanded(!isExpanded);

    const handleAddWorkgroup = async (sourceWorkgroupId: string) => {
        const source = originalWorkgroups.find(wg => wg.id === sourceWorkgroupId);
        if (!source) return;
        await addRevisionWorkgroup(revision.id, source.number, source.name);
    };

    const formatDate = (date: Date) => {
        try {
            return new Date(date).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return String(date);
        }
    };

    return (
        <div className={styles.revisionSection}>
            {/* Collapsible Header */}
            <div className={styles.revisionHeader} onClick={toggleExpand}>
                <div className={styles.revisionLeft}>
                    {isExpanded ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
                    <span className={styles.revisionBadge}>REV {revision.number}</span>
                    <span className={styles.revisionTitle}>{revision.title}</span>
                </div>
                
                <div className={styles.revisionRight}>
                    <span className={styles.revisionMeta}>
                        {formatDate(revision.createdAt)} • {revision.createdBy}
                    </span>
                    <span className={styles.revisionCount}>
                        {revisionWorkgroups.length} workgroup(s)
                    </span>
                </div>
            </div>

            {/* Expandable Body */}
            {isExpanded && (
                <div className={styles.revisionBody}>
                    {/* Notes (if present) */}
                    {revision.notes && (
                        <div 
                            className={styles.revisionNotes} 
                            dangerouslySetInnerHTML={{ __html: revision.notes }} 
                        />
                    )}

                    {/* Add Workgroup Dropdown (Matching FilterBar's Menu + Button style) */}
                    <div className={styles.addWorkgroupRow}>
                        <AddWorkgroupDropdown 
                            originalWorkgroups={originalWorkgroups}
                            revisionWorkgroups={revisionWorkgroups}
                            onAdd={(id) => void handleAddWorkgroup(id)}
                        />
                    </div>

                    {/* Revision Workgroups — reuse WorkgroupSection */}
                    <div className={styles.revisionWorkgroups}>
                        {revisionWorkgroups
                            .sort((a, b) => a.order - b.order)
                            .map(wg => (
                                <WorkgroupSection
                                    key={wg.id}
                                    workgroup={wg}
                                    onRowChange={onRowChange}
                                    filters={filters}
                                    isCollapsed={false}          // expanded within revision
                                    expandTasks={expandTasks}
                                />
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
};
