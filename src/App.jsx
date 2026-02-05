import React from 'react';
import LoginForm from './components/LoginForm';
import GameApp from './GameApp';
import { useAuth } from './context/AuthContext';

const App = () => {
    const { isAuthenticated, login, register, playAsGuest } = useAuth();

    if (!isAuthenticated) {
        return (
            <LoginForm
                onLogin={login}
                onRegister={register}
                onGuest={playAsGuest}
            />
        );
    }

    return <GameApp />;
};

export default App;
