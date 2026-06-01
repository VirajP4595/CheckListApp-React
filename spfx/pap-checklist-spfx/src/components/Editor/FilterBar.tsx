import React, { useState, useEffect } from 'react';
import {
    Dropdown,
    Option,
    Checkbox,
    Button,
    ToggleButton,
    Menu,
    MenuTrigger,
    MenuPopover,
    MenuList,
    MenuItemCheckbox,
} from '@fluentui/react-components';
import { Filter20Regular, Dismiss20Regular, ChevronDown20Regular, ChevronUp20Regular, Search20Regular } from '@fluentui/react-icons';
import { ANSWER_CONFIG, ANSWER_STATES, type AnswerState, type Workgroup } from '../../models';
import styles from './FilterBar.module.scss';

export type SectionFilter = 'client' | 'estimator' | 'reviewer';

export interface FilterState {
    answerStates: AnswerState[];
    markedForReview: boolean | null;
    notifyAdmin: boolean | null;
    builderToConfirm: boolean | null;
    internalOnly: boolean | null;
    workgroupIds: string[];
    showRowsWithData: boolean;
    sections: SectionFilter[];
}

interface FilterBarProps {
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
    workgroups?: Workgroup[];
    expandWorkgroups?: boolean;
    onExpandWorkgroupsChange?: (expanded: boolean) => void;
    expandTasks?: boolean;
    onExpandTasksChange?: (expanded: boolean) => void;
}

// Helper component for Searchable Workgroup Dropdown
const WorkgroupFilter: React.FC<{
    workgroups: Workgroup[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
}> = ({ workgroups, selectedIds, onChange }) => {
    const [search, setSearch] = React.useState('');
    const [open, setOpen] = React.useState(false);

    // Filter workgroups
    const filtered = React.useMemo(() => {
        if (!search.trim()) return workgroups;
        const q = search.toLowerCase();
        return workgroups.filter(wg =>
            wg.name.toLowerCase().includes(q) ||
            String(wg.number).toLowerCase().includes(q)
        );
    }, [workgroups, search]);

    const handleSelect = (id: string, checked: boolean) => {
        if (checked) {
            onChange([...selectedIds, id]);
        } else {
            onChange(selectedIds.filter(x => x !== id));
        }
    };

    const count = selectedIds.length;
    const label = count === 0
        ? 'Workgroup'
        : count === workgroups.length
            ? 'All Workgroups'
            : `${count} Selected`;

    return (
        <Menu open={open} onOpenChange={(_, data) => setOpen(data.open)}>
            <MenuTrigger disableButtonEnhancement>
                <Button
                    className={styles['filter-dropdown']}
                    appearance="outline"
                    icon={<ChevronDown20Regular />}
                    iconPosition="after"
                    style={{ justifyContent: 'space-between', fontWeight: 400 }}
                >
                    <span style={{ color: count === 0 ? '#616161' : 'inherit' }}>{label}</span>
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
                <MenuList className={styles['search-list']} checkedValues={{ workgroup: selectedIds }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '8px', color: '#666', fontSize: '12px' }}>
                            No results found
                        </div>
                    ) : (
                        filtered.map(wg => (
                            <MenuItemCheckbox
                                key={wg.id}
                                name="workgroup"
                                value={wg.id}
                                onClick={(e) => {
                                    handleSelect(wg.id, !selectedIds.includes(wg.id));
                                    e.stopPropagation(); // Keep open? Or let it toggle? 
                                    // Usually multiselect keeps open. 
                                    // Fluent Menu might close on click unless persisted?
                                    // Actually MenuItemCheckbox usually toggles. 
                                    // We need to manage `persistMenu`? No, standard behavior might work.
                                    // Let's assume standard toggle behavior but preventing close is tricky without `persistOnItemClick`.
                                    // Fluent v9 Menu: has `persistOnItemClick` prop on MenuList? No, on Context?
                                }}
                            >
                                <span style={{ fontWeight: 500 }}>{wg.number}</span> - {wg.name}
                            </MenuItemCheckbox>
                        ))
                    )}
                </MenuList>
            </MenuPopover>
        </Menu>
    );
};

export const FilterBar: React.FC<FilterBarProps> = ({
    filters,
    onFiltersChange,
    workgroups = [],
    expandWorkgroups = true,
    onExpandWorkgroupsChange,
    expandTasks = true,
    onExpandTasksChange,
}) => {
    // Detect when filter bar is stuck (scrolled past its natural position)
    const barRef = React.useRef<HTMLDivElement>(null);
    const [isStuck, setIsStuck] = useState(false);

    useEffect(() => {
        const el = barRef.current;
        if (!el) return;
        // Sentinel: a 1px element placed right above the filter bar's natural position.
        // When it scrolls out of view, the filter bar is stuck.
        const sentinel = document.createElement('div');
        sentinel.style.height = '1px';
        sentinel.style.width = '1px';
        sentinel.style.position = 'absolute';
        sentinel.style.pointerEvents = 'none';
        el.parentElement?.insertBefore(sentinel, el);

        const observer = new IntersectionObserver(
            ([entry]) => { setIsStuck(!entry.isIntersecting); },
            { threshold: 0 }
        );
        observer.observe(sentinel);
        return () => { observer.disconnect(); sentinel.remove(); };
    }, []);

    // Local state for instant checkbox visual feedback — defers heavy workgroup re-renders to next task
    const [localShowRowsWithData, setLocalShowRowsWithData] = useState(filters.showRowsWithData);
    useEffect(() => { setLocalShowRowsWithData(filters.showRowsWithData); }, [filters.showRowsWithData]);

    const handleAnswerStateChange = (states: AnswerState[]) => {
        onFiltersChange({ ...filters, answerStates: states });
    };

    const handleWorkgroupChange = (ids: string[]) => {
        onFiltersChange({ ...filters, workgroupIds: ids });
    };

    const handleReviewChange = (checked: boolean) => {
        onFiltersChange({
            ...filters,
            markedForReview: checked ? true : null,
        });
    };

    const handleNotifyChange = (checked: boolean) => {
        onFiltersChange({
            ...filters,
            notifyAdmin: checked ? true : null,
        });
    };

    const handleBtcChange = (checked: boolean) => {
        onFiltersChange({
            ...filters,
            builderToConfirm: checked ? true : null,
        });
    };

    const handleInternalOnlyChange = (checked: boolean) => {
        onFiltersChange({
            ...filters,
            internalOnly: checked ? true : null,
        });
    };

    const handleShowRowsWithDataChange = (checked: boolean) => {
        setLocalShowRowsWithData(checked); // instant visual response
        setTimeout(() => { onFiltersChange({ ...filters, showRowsWithData: checked }); }, 0);
    };

    const allSections: SectionFilter[] = ['client', 'estimator', 'reviewer'];

    const handleSectionChange = (section: SectionFilter, checked: boolean) => {
        const current = filters.sections.length > 0 ? filters.sections : allSections;
        const updated = checked
            ? [...current, section]
            : current.filter(s => s !== section);
        onFiltersChange({ ...filters, sections: updated });
    };

    // Treat empty sections array as "all visible" for active-filter detection
    const sectionsFiltered = filters.sections.length > 0 && filters.sections.length < allSections.length;

    const clearFilters = () => {
        onFiltersChange({ answerStates: [], markedForReview: null, notifyAdmin: null, builderToConfirm: null, internalOnly: null, workgroupIds: [], showRowsWithData: false, sections: [] });
    };

    const hasActiveFilters = filters.answerStates.length > 0 || filters.markedForReview !== null || filters.notifyAdmin !== null || filters.builderToConfirm !== null || filters.internalOnly !== null || filters.workgroupIds.length > 0 || filters.showRowsWithData || sectionsFiltered;

    return (
        <div ref={barRef} className={`${styles['filter-bar']} ${isStuck ? styles['filter-bar--stuck'] : ''}`}>
            {/* Collapse Toggles */}
            {onExpandWorkgroupsChange && (
                <div className={styles['filter-toggles']}>
                    <ToggleButton
                        className={styles['filter-toggle-btn']}
                        size="small"
                        appearance="subtle"
                        checked={!expandWorkgroups}
                        icon={expandWorkgroups ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
                        onClick={() => onExpandWorkgroupsChange(!expandWorkgroups)}
                    >
                        {expandWorkgroups ? 'Collapse Workgroups' : 'Expand Workgroups'}
                    </ToggleButton>
                    <ToggleButton
                        className={styles['filter-toggle-btn']}
                        size="small"
                        appearance="subtle"
                        checked={!expandTasks}
                        icon={expandTasks ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
                        onClick={() => onExpandTasksChange?.(!expandTasks)}
                    >
                        {expandTasks ? 'Collapse Tasks' : 'Expand Tasks'}
                    </ToggleButton>
                </div>
            )}

            {onExpandWorkgroupsChange && <div className={styles['filter-divider']} />}

            <div className={styles['filter-label']}>
                <Filter20Regular />
                <span>Filter:</span>
            </div>

            <div className={styles['filter-controls']}>
                {workgroups.length > 0 && (
                    <WorkgroupFilter
                        workgroups={workgroups}
                        selectedIds={filters.workgroupIds}
                        onChange={handleWorkgroupChange}
                    />
                )}

                <Menu>
                    <MenuTrigger disableButtonEnhancement>
                        <Button
                            className={styles['filter-dropdown']}
                            appearance="outline"
                            icon={<ChevronDown20Regular />}
                            iconPosition="after"
                            style={{ justifyContent: 'space-between', fontWeight: 400 }}
                        >
                            <span style={{ color: filters.answerStates.length === 0 ? '#616161' : 'inherit' }}>
                                {filters.answerStates.length === 0 ? 'Key' : `${filters.answerStates.length} Selected`}
                            </span>
                        </Button>
                    </MenuTrigger>
                    <MenuPopover className={styles['filter-menu-popover']}>
                        <MenuList checkedValues={{ answer: filters.answerStates }}>
                            {ANSWER_STATES.map(state => {
                                const config = ANSWER_CONFIG[state];
                                return (
                                    <MenuItemCheckbox
                                        key={state}
                                        name="answer"
                                        value={state}
                                        onClick={(e) => {
                                            const newStates = filters.answerStates.includes(state)
                                                ? filters.answerStates.filter(s => s !== state)
                                                : [...filters.answerStates, state];
                                            handleAnswerStateChange(newStates);
                                            e.stopPropagation();
                                        }}
                                    >
                                        <div className={styles['answer-option']}>
                                            <span
                                                className={styles['answer-dot']}
                                                style={{ backgroundColor: config.color }}
                                            />
                                            <span className={styles['answer-label']}>{config.label}</span>
                                        </div>
                                    </MenuItemCheckbox>
                                );
                            })}
                        </MenuList>
                    </MenuPopover>
                </Menu>

                <Menu>
                    <MenuTrigger disableButtonEnhancement>
                        <Button
                            className={styles['filter-dropdown']}
                            appearance="outline"
                            icon={<ChevronDown20Regular />}
                            iconPosition="after"
                            style={{ justifyContent: 'space-between', fontWeight: 400 }}
                        >
                            <span style={{ color: (!filters.markedForReview && !filters.notifyAdmin && !filters.builderToConfirm && !filters.internalOnly) ? '#616161' : 'inherit' }}>
                                {(!filters.markedForReview && !filters.notifyAdmin && !filters.builderToConfirm && !filters.internalOnly)
                                    ? 'Row Status'
                                    : `${[filters.markedForReview, filters.notifyAdmin, filters.builderToConfirm, filters.internalOnly].filter(Boolean).length} Selected`}
                            </span>
                        </Button>
                    </MenuTrigger>
                    <MenuPopover>
                        <MenuList checkedValues={{
                            status: [
                                ...(filters.markedForReview ? ['markedForReview'] : []),
                                ...(filters.notifyAdmin ? ['notifyAdmin'] : []),
                                ...(filters.builderToConfirm ? ['builderToConfirm'] : []),
                                ...(filters.internalOnly ? ['internalOnly'] : [])
                            ]
                        }}>
                            <MenuItemCheckbox
                                name="status"
                                value="markedForReview"
                                onClick={(e) => {
                                    handleReviewChange(!filters.markedForReview);
                                    e.stopPropagation();
                                }}
                            >
                                Marked For Review
                            </MenuItemCheckbox>
                            <MenuItemCheckbox
                                name="status"
                                value="notifyAdmin"
                                onClick={(e) => {
                                    handleNotifyChange(!filters.notifyAdmin);
                                    e.stopPropagation();
                                }}
                            >
                                Notify Admin
                            </MenuItemCheckbox>
                            <MenuItemCheckbox
                                name="status"
                                value="builderToConfirm"
                                onClick={(e) => {
                                    handleBtcChange(!filters.builderToConfirm);
                                    e.stopPropagation();
                                }}
                            >
                                BTC - Builder To Confirm
                            </MenuItemCheckbox>
                            <MenuItemCheckbox
                                name="status"
                                value="internalOnly"
                                onClick={(e) => {
                                    handleInternalOnlyChange(!filters.internalOnly);
                                    e.stopPropagation();
                                }}
                            >
                                Internal Only
                            </MenuItemCheckbox>
                        </MenuList>
                    </MenuPopover>
                </Menu>

                <Menu>
                    <MenuTrigger disableButtonEnhancement>
                        <Button
                            className={styles['filter-dropdown']}
                            appearance="outline"
                            icon={<ChevronDown20Regular />}
                            iconPosition="after"
                            style={{ justifyContent: 'space-between', fontWeight: 400 }}
                        >
                            <span style={{ color: !sectionsFiltered ? '#616161' : 'inherit' }}>
                                {!sectionsFiltered ? 'Section' : `${filters.sections.length} Section${filters.sections.length !== 1 ? 's' : ''}`}
                            </span>
                        </Button>
                    </MenuTrigger>
                    <MenuPopover>
                        <MenuList checkedValues={{
                            section: filters.sections.length > 0 ? filters.sections : allSections
                        }}>
                            <MenuItemCheckbox
                                name="section"
                                value="client"
                                onClick={(e) => {
                                    const active = filters.sections.length > 0 ? filters.sections : allSections;
                                    handleSectionChange('client', !active.includes('client'));
                                    e.stopPropagation();
                                }}
                            >
                                Client/Checklist Notes
                            </MenuItemCheckbox>
                            <MenuItemCheckbox
                                name="section"
                                value="estimator"
                                onClick={(e) => {
                                    const active = filters.sections.length > 0 ? filters.sections : allSections;
                                    handleSectionChange('estimator', !active.includes('estimator'));
                                    e.stopPropagation();
                                }}
                            >
                                Estimator Notes
                            </MenuItemCheckbox>
                            <MenuItemCheckbox
                                name="section"
                                value="reviewer"
                                onClick={(e) => {
                                    const active = filters.sections.length > 0 ? filters.sections : allSections;
                                    handleSectionChange('reviewer', !active.includes('reviewer'));
                                    e.stopPropagation();
                                }}
                            >
                                Reviewer Notes
                            </MenuItemCheckbox>
                        </MenuList>
                    </MenuPopover>
                </Menu>
            </div>

            <div className={styles['filter-right']}>
                <div className={styles['filter-divider']} />
                <Checkbox
                    className={styles['filter-rows-data-checkbox']}
                    label="Show Rows With Data"
                    checked={localShowRowsWithData}
                    onChange={(_, data) => handleShowRowsWithDataChange(!!data.checked)}
                />
                {hasActiveFilters && (
                    <Button
                        className={styles['filter-clear-btn']}
                        appearance="subtle"
                        size="small"
                        icon={<Dismiss20Regular />}
                        onClick={clearFilters}
                    >
                        Clear
                    </Button>
                )}
            </div>
        </div>
    );
};
