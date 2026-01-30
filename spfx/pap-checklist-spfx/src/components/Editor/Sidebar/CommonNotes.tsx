import React, { useState, useEffect } from 'react';
import { Textarea } from '@fluentui/react-components';
import { Checklist } from '../../../models';
import styles from './CommonNotes.module.scss';

interface CommonNotesProps {
    checklist: Checklist;
    onUpdate: (updates: Partial<Checklist>) => void;
    readOnly?: boolean;
}

export const CommonNotes: React.FC<CommonNotesProps> = ({ checklist, onUpdate, readOnly }) => {
    const [notes, setNotes] = useState(checklist.commonNotes || '');

    useEffect(() => {
        setNotes(checklist.commonNotes || '');
    }, [checklist.commonNotes]);

    const handleChange = (_: any, data: { value: string }) => {
        setNotes(data.value);
    };

    const handleBlur = () => {
        if (notes !== checklist.commonNotes) {
            onUpdate({ commonNotes: notes });
        }
    };

    return (
        <div className={styles['common-notes']}>
            <Textarea
                className={styles['notes-textarea']}
                value={notes}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={readOnly}
                placeholder="Type general notes here. These notes are visible to all team members working on this checklist..."
                resize="none"
                textarea={{ style: { height: '100%', maxHeight: '100%' } }}
            />
        </div>
    );
};
