import React, { useState } from 'react';

const PlanModal = ({ plan, onClose, onPayment }) => {
  const planDetails = {
    starter: { name: 'Starter Plan', price: '$29/month' },
    professional: { name: 'Professional Plan', price: '$99/month' },
    enterprise: { name: 'Enterprise Plan', price: '$299/month' }
  };

  const [formData, setFormData] = useState({
    cardholderName: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    billingAddress: '',
    city: '',
    zipCode: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onPayment();
  };

  const currentPlan = planDetails[plan] || planDetails.professional;

  return (
    <div className="modal active" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <span className="modal-close" onClick={onClose}>&times;</span>
        <h2><i className="fas fa-credit-card"></i> Complete Your Subscription</h2>
        
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '1.5rem', borderRadius: '10px', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>{currentPlan.name}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{currentPlan.price}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <h3 style={{ marginBottom: '1rem' }}>Payment Information</h3>
          
          <div className="form-group">
            <label>Cardholder Name</label>
            <input
              type="text"
              name="cardholderName"
              value={formData.cardholderName}
              onChange={handleChange}
              placeholder="Rayan Nadeem"
              required
            />
          </div>

          <div className="form-group">
            <label>Card Number</label>
            <input
              type="text"
              name="cardNumber"
              value={formData.cardNumber}
              onChange={handleChange}
              placeholder="1234 5678 9012 3456"
              maxLength="19"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Expiry Date</label>
              <input
                type="text"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleChange}
                placeholder="MM/YY"
                maxLength="5"
                required
              />
            </div>

            <div className="form-group">
              <label>CVV</label>
              <input
                type="text"
                name="cvv"
                value={formData.cvv}
                onChange={handleChange}
                placeholder="123"
                maxLength="4"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Billing Address</label>
            <input
              type="text"
              name="billingAddress"
              value={formData.billingAddress}
              onChange={handleChange}
              placeholder="Street address"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City"
                required
              />
            </div>

            <div className="form-group">
              <label>ZIP Code</label>
              <input
                type="text"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleChange}
                placeholder="12345"
                required
              />
            </div>
          </div>

          <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>
              <i className="fas fa-info-circle"></i> You won't be charged during your 14-day free trial. Cancel anytime.
            </p>
          </div>

          <button type="submit" className="btn btn-success" style={{ width: '100%' }}>
            <i className="fas fa-lock"></i> Start Free Trial
          </button>
        </form>
      </div>
    </div>
  );
};

export default PlanModal;

