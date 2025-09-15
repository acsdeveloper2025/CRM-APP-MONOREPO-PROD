import React from 'react';

interface SpinnerProps {
    size?: 'small' | 'large';
    color?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'large', color = "#ffffff" }) => {
    const spinnerSize = size === 'small' ? '20px' : '40px';

    return (
        <div
            style={{
                width: spinnerSize,
                height: spinnerSize,
                border: `3px solid ${color}33`,
                borderTop: `3px solid ${color}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                display: 'inline-block'
            }}
        />
    );
};

export default Spinner;
