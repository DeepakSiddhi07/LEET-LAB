import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { axiosInstance } from '../lib/axios';
import toast from 'react-hot-toast';

const Goog_leLogin = () => {
  const navigate = useNavigate();
  const { checkAuth } = useAuthStore();

  return (
    <GoogleLogin
      onSuccess={async (credentialResponse) => {
        const token = credentialResponse.credential;
        try {
          const res = await axiosInstance.post(
            "/auth/google-login",
            { token }
          );

          console.log("Login Success", res.data);
          toast.success("Login successful!");
          
          // ✅ Update auth store after successful login
          await checkAuth();
          
          // ✅ Navigate to home page
          navigate("/");
        } catch (err) {
          console.error("Login Failed", err);
          toast.error("Login failed. Please try again.");
        }
      }}
      onError={() => {
        console.log('Login Failed');
        toast.error("Google login failed");
      }}
    />
  );
};

export default Goog_leLogin;