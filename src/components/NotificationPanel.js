import React, { useEffect, useRef } from 'react';

const NotificationPanel = ({ isActive, onClose }) => {
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        const icon = document.querySelector('.notification-icon');
        if (icon && !icon.contains(event.target)) {
          onClose();
        }
      }
    };

    if (isActive) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isActive, onClose]);

  return (
    <div className={`notification-panel ${isActive ? 'active' : ''}`} ref={panelRef}>
      <h3 style={{ marginBottom: '1.5rem' }}>Notifications</h3>
      
      <div className="notification-item">
        <h4>New Keyword Opportunity</h4>
        <p>3 new high-volume keywords detected in your niche</p>
        <div className="notification-time">2 hours ago</div>
      </div>

      <div className="notification-item">
        <h4>Ranking Improvement</h4>
        <p>Your page moved up 5 positions for "digital marketing"</p>
        <div className="notification-time">5 hours ago</div>
      </div>

      <div className="notification-item">
        <h4>Content Update Needed</h4>
        <p>2 articles need refreshing based on competitor analysis</p>
        <div className="notification-time">1 day ago</div>
      </div>
    </div>
  );
};

export default NotificationPanel;

