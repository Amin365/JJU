import React, { useState } from 'react';
import ChallengeForm from './ChallengeForm';

const CreateChallengeDialog = ({ open, onClose, onCreate }) => {
    const [challengeData, setChallengeData] = useState({});

    const handleCreate = () => {
        onCreate(challengeData);
        onClose();
    };

    return (
        <div>
            {open && (
                <div>
                    <h2>Create New Challenge</h2>
                    <ChallengeForm onChange={setChallengeData} onSubmit={handleCreate} />
                    <button onClick={onClose}>Close</button>
                </div>
            )}
        </div>
    );
};

export default CreateChallengeDialog;