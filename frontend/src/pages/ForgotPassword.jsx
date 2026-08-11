import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setResetLink('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.forgotPassword(email);
      if (response.data && response.data.success) {
        setSuccess('Password reset link generated! In a real app, this is sent via email.');
        if (response.data.resetLink) {
          setResetLink(response.data.resetLink);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error requesting reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">FinSight</div>
          <h2 className="auth-title">Reset Password</h2>
          <p className="auth-subtitle">Enter your email and we'll simulate sending a reset link</p>
        </div>

        {error && <div className="alert-box alert-box-error">{error}</div>}
        
        {success && (
          <div className="alert-box alert-box-success" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span>{success}</span>
            {resetLink && (
              <a 
                href={resetLink} 
                className="text-link" 
                style={{ wordBreak: 'break-all', textDecoration: 'underline', marginTop: '0.25rem' }}
              >
                Click here to reset your password (Test Simulation)
              </a>
            )}
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. sravani@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-block mt-lg"
              disabled={loading}
            >
              {loading ? 'Sending link...' : 'Generate Reset Link'}
            </button>
          </form>
        )}

        <div className="text-center mt-md" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Remember your password?{' '}
          <span className="text-link" onClick={() => navigate('/login')}>
            Back to Login
          </span>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
