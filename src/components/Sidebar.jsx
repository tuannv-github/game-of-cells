import React from 'react';
import AdminPanel from './AdminPanel';
import PlayerPanel from './PlayerPanel';
import TokenPanel from './TokenPanel';

const Sidebar = (props) => {
    const { isAdmin, token, useBackend } = props;
    const tokenPanelProps = { token, useBackend };
    return isAdmin
        ? <AdminPanel {...props} tokenPanelProps={tokenPanelProps} />
        : <PlayerPanel {...props} tokenPanelProps={tokenPanelProps} />;
};

export default Sidebar;
