import React from 'react';
import ReactDOM from 'react-dom';
import { FluentProvider, createLightTheme, BrandVariants } from '@fluentui/react-components';
import { AuthProvider } from './providers/AuthProvider';
import App from './App';
import './styles/global.scss';

// PAP Brand Colors - based on brand guidelines
const papBrand: BrandVariants = {
    10: '#021d32',
    20: '#032b49',
    30: '#033a61',
    40: '#044879',
    50: '#03518b', // Primary brand color
    60: '#0a6dbc',
    70: '#2682c9',
    80: '#4497d4',
    90: '#63acdf',
    100: '#83c1ea',
    110: '#a3d5f4',
    120: '#c3e8fc',
    130: '#e0f4fe',
    140: '#f0faff',
    150: '#f8fcff',
    160: '#ffffff',
};

// Create custom theme with PAP brand colors
const papLightTheme = createLightTheme(papBrand);

// Additional theme customizations
papLightTheme.fontFamilyBase = "'Avenir', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";

ReactDOM.render(
    <React.StrictMode>
        <AuthProvider>
            <FluentProvider theme={papLightTheme}>
                <App />
            </FluentProvider>
        </AuthProvider>
    </React.StrictMode>,
    document.getElementById('root')
);
