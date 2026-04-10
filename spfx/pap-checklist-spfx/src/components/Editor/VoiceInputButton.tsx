import React, { useState, useRef, useCallback } from 'react';
import { Tooltip } from '@fluentui/react-components';
import { Mic24Regular, RecordStop24Filled } from '@fluentui/react-icons';
import styles from './VoiceInputButton.module.scss';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition: new () => SpeechRecognitionInstance;
    }
}

interface VoiceInputButtonProps {
    onTranscript: (text: string) => void;
    disabled?: boolean;
}

const isSpeechSupported = (): boolean => {
    return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
};

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({ onTranscript, disabled }) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

    const handleToggle = useCallback(() => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionClass) return;

        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-AU';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    transcript += event.results[i][0].transcript;
                }
            }
            if (transcript.trim()) {
                onTranscript(transcript.trim());
            }
        };

        recognition.onerror = () => {
            setIsListening(false);
            recognitionRef.current = null;
        };

        recognition.onend = () => {
            setIsListening(false);
            recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    }, [isListening, onTranscript]);

    if (!isSpeechSupported()) return null;

    return (
        <Tooltip content={isListening ? 'Tap to stop' : 'Voice input'} relationship="label">
            <button
                className={`${styles['voice-btn']} ${isListening ? styles['voice-btn--active'] : ''}`}
                onClick={handleToggle}
                disabled={disabled}
                type="button"
                aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
            >
                {isListening ? (
                    <>
                        <RecordStop24Filled className={styles['voice-btn__stop-icon']} />
                        <span className={styles['voice-btn__listening-dot']} />
                    </>
                ) : (
                    <Mic24Regular />
                )}
            </button>
        </Tooltip>
    );
};
