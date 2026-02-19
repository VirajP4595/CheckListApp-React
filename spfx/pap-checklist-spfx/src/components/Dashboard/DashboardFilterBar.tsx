import React, { useMemo, useState } from 'react';
import {
    Dropdown,
    Option,
    Button,
    Menu,
    MenuTrigger,
    MenuPopover,
    MenuList,
    MenuItemCheckbox,
} from '@fluentui/react-components';
import { Filter20Regular, Dismiss20Regular, Search20Regular, ChevronDown20Regular, ArrowSort20Regular } from '@fluentui/react-icons';
import { Checklist, ChecklistStatus, STATUS_CONFIG } from '../../models';
import styles from './DashboardFilterBar.module.scss';

export type SortParams = {
    field: 'updatedAt' | 'title';
    direction: 'asc' | 'desc';
};

export interface DashboardFilterState {
    search: string; // Not used implicitly since we use dropdown for job selection, but maybe we want a general text search too? User said "dropdown/combobox with search just like we have in checklist screen for workgroup".
    // The workgroup filter IS a searchable dropdown that SELECTS items.
    // So we should have a "Job" filter that selects specific jobs.
    selectedJobIds: string[];
    selectedClientNames: string[];
    selectedStatuses: ChecklistStatus[];
    sort: SortParams;
}

interface DashboardFilterBarProps {
    checklists: Checklist[]; // Needed for building the filter list
    filters: DashboardFilterState;
    onFiltersChange: (filters: DashboardFilterState) => void;
}

// Reusable Searchable Menu for Checklists (Jobs)
const JobFilter: React.FC<{
    checklists: Checklist[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
}> = ({ checklists, selectedIds, onChange }) => {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);

    const filtered = useMemo(() => {
        if (!search.trim()) return checklists;
        const q = search.toLowerCase();
        return checklists.filter(c =>
            c.title.toLowerCase().includes(q) ||
            c.jobReference.toLowerCase().includes(q)
        );
    }, [checklists, search]);

    const handleSelect = (id: string, checked: boolean) => {
        if (checked) {
            onChange([...selectedIds, id]);
        } else {
            onChange(selectedIds.filter(x => x !== id));
        }
    };

    const count = selectedIds.length;
    let label = 'Filter by Job';
    if (count === checklists.length && count > 0) label = 'All Jobs';
    else if (count > 0) label = `${count} Jobs Selected`;

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
                            placeholder="Search jobs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
                <MenuList className={styles['search-list']} checkedValues={{ job: selectedIds }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '8px', color: '#666', fontSize: '12px' }}>
                            No results found
                        </div>
                    ) : (
                        filtered.map(c => (
                            <MenuItemCheckbox
                                key={c.id}
                                name="job"
                                value={c.id}
                                onClick={(e) => {
                                    handleSelect(c.id, !selectedIds.includes(c.id));
                                    e.stopPropagation();
                                }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 500 }}>{c.title}</span>
                                    <span style={{ fontSize: '11px', color: '#888' }}>{c.jobReference}</span>
                                </div>
                            </MenuItemCheckbox>
                        ))
                    )}
                </MenuList>
            </MenuPopover>
        </Menu>
    );
};

const ClientFilter: React.FC<{
    checklists: Checklist[];
    selectedNames: string[];
    onChange: (names: string[]) => void;
}> = ({ checklists, selectedNames, onChange }) => {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);

    // key is clientName, value is count (or just existence)
    // We need a list of UNIQUE client names from checklists
    const clientOptions = useMemo(() => {
        const names = new Set<string>();
        checklists.forEach(c => {
            if (c.jobDetails?.clientName) names.add(c.jobDetails.clientName);
        });
        return Array.from(names).sort();
    }, [checklists]);

    const filteredOptions = useMemo(() => {
        if (!search.trim()) return clientOptions;
        const q = search.toLowerCase();
        return clientOptions.filter(name => name.toLowerCase().includes(q));
    }, [clientOptions, search]);

    const handleSelect = (name: string, checked: boolean) => {
        if (checked) {
            onChange([...selectedNames, name]);
        } else {
            onChange(selectedNames.filter(x => x !== name));
        }
    };

    const count = selectedNames.length;
    let label = 'Filter by Client';
    if (count === clientOptions.length && count > 0) label = 'All Clients';
    else if (count > 0) label = `${count} Clients`;

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
                            placeholder="Search clients..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
                <MenuList className={styles['search-list']} checkedValues={{ client: selectedNames }}>
                    {filteredOptions.length === 0 ? (
                        <div style={{ padding: '8px', color: '#666', fontSize: '12px' }}>
                            No clients found
                        </div>
                    ) : (
                        filteredOptions.map(name => (
                            <MenuItemCheckbox
                                key={name}
                                name="client"
                                value={name}
                                onClick={(e) => {
                                    handleSelect(name, !selectedNames.includes(name));
                                    e.stopPropagation();
                                }}
                            >
                                {name}
                            </MenuItemCheckbox>
                        ))
                    )}
                </MenuList>
            </MenuPopover>
        </Menu>
    );
};

export const DashboardFilterBar: React.FC<DashboardFilterBarProps> = ({
    checklists,
    filters,
    onFiltersChange,
}) => {

    const handleStatusChange = (status: ChecklistStatus[]) => {
        onFiltersChange({ ...filters, selectedStatuses: status });
    };

    const handleJobChange = (ids: string[]) => {
        onFiltersChange({ ...filters, selectedJobIds: ids });
    };

    const handleClientChange = (names: string[]) => {
        onFiltersChange({ ...filters, selectedClientNames: names });
    };

    const handleSortChange = (value: string) => {
        const [field, direction] = value.split('-');
        onFiltersChange({
            ...filters,
            sort: { field: field as 'updatedAt' | 'title', direction: direction as 'asc' | 'desc' }
        });
    };

    const clearFilters = () => {
        onFiltersChange({
            ...filters,
            selectedJobIds: [],
            selectedClientNames: [],
            selectedStatuses: [],
            search: '' // ensure search reset if we add it later
        });
    };

    const hasActiveFilters = filters.selectedJobIds.length > 0 || filters.selectedClientNames.length > 0 || filters.selectedStatuses.length > 0;
    const sortValue = `${filters.sort.field}-${filters.sort.direction}`;

    return (
        <div className={styles['filter-bar']}>
            <div className={styles['filter-label']}>
                <Filter20Regular />
                <span>Filter:</span>
            </div>

            <div className={styles['filter-controls']}>
                {/* Searchable Job Filter */}
                <JobFilter
                    checklists={checklists}
                    selectedIds={filters.selectedJobIds}
                    onChange={handleJobChange}
                />

                {/* Client Filter */}
                <ClientFilter
                    checklists={checklists}
                    selectedNames={filters.selectedClientNames}
                    onChange={handleClientChange}
                />

                {/* Status Dropdown */}
                <Dropdown
                    className={styles['filter-dropdown']}
                    placeholder="Status"
                    multiselect
                    selectedOptions={filters.selectedStatuses}
                    onOptionSelect={(_, data) => handleStatusChange(data.selectedOptions as ChecklistStatus[])}
                >
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <Option key={key} value={key} text={config.label}>
                            <span style={{ color: config.color, marginRight: '8px' }}>●</span>
                            {config.label}
                        </Option>
                    ))}
                </Dropdown>

                <div className={styles['filter-divider']} style={{ width: 1, height: 24, background: '#e0e0e0', margin: '0 8px' }} />

                {/* Sort Dropdown */}
                <div className={styles['filter-label']}>
                    <ArrowSort20Regular />
                </div>
                <Dropdown
                    className={styles['filter-dropdown']}
                    style={{ minWidth: 180, width: 180 }}
                    value={sortValue === 'updatedAt-desc' ? 'Modified (Newest)' :
                        sortValue === 'updatedAt-asc' ? 'Modified (Oldest)' :
                            sortValue === 'title-asc' ? 'Name (A-Z)' : 'Name (Z-A)'}
                    selectedOptions={[sortValue]}
                    onOptionSelect={(_, data) => handleSortChange(data.optionValue as string)}
                >
                    <Option value="updatedAt-desc">Modified (Newest)</Option>
                    <Option value="updatedAt-asc">Modified (Oldest)</Option>
                    <Option value="title-asc">Name (A-Z)</Option>
                    <Option value="title-desc">Name (Z-A)</Option>
                </Dropdown>
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
                        Clear Filters
                    </Button>
                </div>
            )}
        </div>
    );
};
