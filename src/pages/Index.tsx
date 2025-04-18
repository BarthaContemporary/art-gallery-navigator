import { Navigate } from 'react-router-dom';

// Redirect from index to dashboard
const Index = () => {
  return <Navigate to="/dashboard" replace />;
};

export default Index;
