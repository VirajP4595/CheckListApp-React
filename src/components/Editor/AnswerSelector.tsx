import React from 'react';
import {
    Menu,
    MenuTrigger,
    MenuPopover,
    MenuList,
    MenuItem,
    Button,
} from '@fluentui/react-components';
import { ChevronDown16Regular } from '@fluentui/react-icons';
import type { AnswerState } from '../../models';
import { ANSWER_CONFIG, ANSWER_STATES } from '../../models';
import styles from './AnswerSelector.module.scss';

interface AnswerSelectorProps {
    value: AnswerState;
    onChange: (value: AnswerState) => void;
}

export const AnswerSelector: React.FC<AnswerSelectorProps> = ({ value, onChange }) => {
    const config = ANSWER_CONFIG[value];

    return (
        <Menu>
            <MenuTrigger disableButtonEnhancement>
                <Button
                    className={styles['answer-trigger']}
                    appearance="outline"
                    icon={<ChevronDown16Regular />}
                    iconPosition="after"
                >
                    <span
                        className={styles['answer-dot']}
                        style={{ backgroundColor: config.color }}
                    />
                    {config.label}
                </Button>
            </MenuTrigger>
            <MenuPopover>
                <MenuList>
                    {ANSWER_STATES.map(state => {
                        const stateConfig = ANSWER_CONFIG[state];
                        return (
                            <MenuItem
                                key={state}
                                onClick={() => onChange(state)}
                            >
                                <div className={styles['answer-menu-item']}>
                                    <span
                                        className={styles['answer-dot']}
                                        style={{ backgroundColor: stateConfig.color }}
                                    />
                                    <span className={styles['answer-menu-label']}>{stateConfig.label}</span>
                                    <span className={styles['answer-menu-desc']}>{stateConfig.description}</span>
                                </div>
                            </MenuItem>
                        );
                    })}
                </MenuList>
            </MenuPopover>
        </Menu>
    );
};
