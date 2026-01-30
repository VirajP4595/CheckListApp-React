import React from 'react';
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

export interface FilterState {
    answerStates: AnswerState[];
    markedForReview: boolean | null;
    workgroupIds: string[];
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

    const clearFilters = () => {
        onFiltersChange({ answerStates: [], markedForReview: null, workgroupIds: [] });
    };

    const hasActiveFilters = filters.answerStates.length > 0 || filters.markedForReview !== null || filters.workgroupIds.length > 0;

    return (
        <div className={styles['filter-bar']}>
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

                <Dropdown
                    className={styles['filter-dropdown']}
                    placeholder="Answer"
                    multiselect
                    selectedOptions={filters.answerStates}
                    onOptionSelect={(_, data) => {
                        handleAnswerStateChange(data.selectedOptions as AnswerState[]);
                    }}
                >
                    {ANSWER_STATES.map(state => {
                        const config = ANSWER_CONFIG[state];
                        return (
                            <Option key={state} value={state} text={config.label}>
                                <div className={styles['answer-option']}>
                                    <span
                                        className={styles['answer-dot']}
                                        style={{ backgroundColor: config.color }}
                                    />
                                    <span className={styles['answer-label']}>{config.label}</span>
                                    {config.description && (
                                        <span className={styles['answer-desc']}>{config.description}</span>
                                    )}
                                </div>
                            </Option>
                        );
                    })}
                </Dropdown>

                <div className={styles['filter-review']}>
                    <Checkbox
                        label="Review"
                        checked={filters.markedForReview === true}
                        onChange={(_, data) => handleReviewChange(!!data.checked)}
                    />
                </div>
            </div>

            {hasActiveFilters && (
                <div className={styles['filter-active']}>
                    <Button
                        className={styles['filter-clear-btn']}
                        appearance="subtle"
                        size="small"
                        icon={<Dismiss20Regular />}
                        onClick={clearFilters}
                    >
                        Clear
                    </Button>
                </div>
            )}
        </div>
    );
};
