
import React, { useState, useContext } from 'react';
import { login } from '../auth';
import { Link, useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';


const Login: React.FC = () => {

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login: loginUser } = useContext(UserContext);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await login(username, password);
      const { token, user } = res.data;
  loginUser(user, token); // set user and token in context/localStorage
  navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button type="submit">Login</button>
      </form>
      {error && <div style={{ color: 'red' }}>{error}</div>}

      <div style={{ marginTop: 16 }}>
        <span>Don't have an account? </span>
        <Link to="/register">Register</Link>
      </div>
    </div>
  );
};

export default Login;
