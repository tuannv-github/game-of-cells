import React from 'react';
import AdminPanel from './AdminPanel';
import PlayerPanel from './PlayerPanel';

const Sidebar = (props) => {
    const { isAdmin } = props;
    return isAdmin ? <AdminPanel {...props} /> : <PlayerPanel {...props} />;
};

export default Sidebar;
